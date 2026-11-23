import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium, expect } from '@playwright/test';
import { serveReleases } from './pwa-test-server.ts';
import { failNoteWrites, holdNoteWrites } from './notes-write-fixtures.ts';

const exec = promisify(execFile);
const [previous, candidate, output] = process.argv.slice(2);
if (!previous || !candidate || !output) {
  throw new Error('Usage: node scripts/check-desktop-reader.mts <verified A> <verified B> <report.json>');
}
const title = 'Synthetic accessibility note';
const initial = 'Synthetic text saved before the update.';
const updated = 'Synthetic edit committed during the update.';
const retried = 'Synthetic edit committed after a failed write and retry.';

async function release(directory: string) {
  const bytes = await readFile(join(directory, 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf-8')) as { buildId: string; commit: string };
  return {
    commit: manifest.commit, buildId: manifest.buildId,
    manifestSha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

interface SpeechViewer { ready: boolean; speech: string; controls: string[] }
async function speech(): Promise<SpeechViewer> {
  const { stdout } = await exec('python', [resolve('scripts/read-nvda-speech.py')], { timeout: 4_000 });
  return JSON.parse(stdout) as SpeechViewer;
}

const report = {
  startedAt: new Date().toISOString(),
  finishedAt: '',
  os: os.release(),
  browser: '',
  reader: 'NVDA 2026.3.1, Speech Viewer',
  a: await release(previous),
  b: await release(candidate),
  checks: [] as { id: string; phrase: string }[],
  outcome: 'FAIL',
};
if (report.a.commit === report.b.commit || report.a.buildId === report.b.buildId) {
  throw new Error('Use two distinct verified releases');
}

async function said(id: string, after: string, pattern: RegExp) {
  let newlySpoken = '';
  try {
    await expect.poll(async () => {
      const viewer = await speech();
      expect(viewer.ready, 'Speech Viewer must remain open').toBe(true);
      expect(viewer.speech.startsWith(after), 'Speech history was reset during a check').toBe(true);
      newlySpoken = viewer.speech.slice(after.length);
      return newlySpoken;
    }, { timeout: 7000 }).toMatch(pattern);
  } catch (error) {
    console.error('Missing speech for ' + id + '. Actual new speech: ' + JSON.stringify(newlySpoken));
    throw error;
  }
  report.checks.push({ id, phrase: newlySpoken.match(pattern)![0] });
  console.log('PASS ' + id);
}

await mkdir(dirname(output), { recursive: true });
const server = await serveReleases(join(previous, 'dist'));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  try {
    await expect.poll(speech, { timeout: 25_000 }).toMatchObject({ ready: true });
  } catch (error) {
    console.error('Speech Viewer startup probe: ' + JSON.stringify(await speech()));
    throw error;
  }
  browser = await chromium.launch({ channel: 'chrome', headless: false, chromiumSandbox: true });
  report.browser = browser.version();
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
  await page.goto(server.url);
  await page.bringToFront();
  await expect(page.locator('#build-id')).toHaveText('Build ID: ' + report.a.buildId);
  await expect(page.locator('.offline-ready')).toHaveText('Available offline');

  const noteButton = page.getByRole('region', { name: 'Workspace launcher' })
    .getByRole('button', { name: 'Notes', exact: true });
  let before = (await speech()).speech;
  await noteButton.focus();
  await said('launcher-notes', before, /\bNotes\b/i);
  await noteButton.click();
  await page.getByRole('button', { name: 'New note', exact: true }).click();

  const titleField = page.getByLabel('Title', { exact: true });
  const body = page.getByLabel('Body', { exact: true });
  const saveStatus = page.locator('.save-status');
  before = (await speech()).speech;
  await body.focus();
  await said('editor-body', before, /\bBody\b/i);
  before = (await speech()).speech;
  await titleField.focus();
  await said('editor-title', before, /\bTitle\b/i);

  await titleField.fill(title);
  await body.fill(initial);
  await expect(saveStatus).toHaveText('Saved on this device');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');

  const pending = await holdNoteWrites(page);
  try {
    before = (await speech()).speech;
    await body.fill('Synthetic candidate edit before a deliberate storage failure.');
    await expect(saveStatus).toHaveText('Saving…');
    await said('note-saving', before, /\bSaving\b/i);
    before = (await speech()).speech;
  } finally {
    await pending();
  }
  await expect(saveStatus).toHaveText('Saved on this device');
  await said('note-saved', before, /\bSaved on this device\b/i);

  const fault = await failNoteWrites(page);
  try {
    before = (await speech()).speech;
    await body.fill(retried);
    await expect(saveStatus).toHaveText('Save failed. Your changes are not saved.');
    await said('note-failed', before, /\bSave failed\b[\s\S]*\bYour changes are not saved\b/i);
    await expect(body).toHaveValue(retried);
    expect(await fault.attempts()).toBe(1);
  } finally {
    await fault.restore();
  }

  before = (await speech()).speech;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(saveStatus).toHaveText('Saved on this device');
  await said('note-retried', before, /\bSaved on this device\b/i);
  await page.reload();
  await page.getByRole('region', { name: 'Workspace launcher' }).getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(body).toHaveValue(retried);

  before = (await speech()).speech;
  server.deploy(join(candidate, 'dist'));
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await expect(page.getByRole('heading', { name: 'Update available' })).toBeVisible();
  await said('update-available', before, /\bUpdate available\b/i);

  const resume = await holdNoteWrites(page);
  try {
    await body.fill(updated);
    before = (await speech()).speech;
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.locator('.update-notice p')).toHaveText('Saving changes before update…');
    await said('update-saving', before, /\bSaving changes before update\b/i);
  } finally {
    await resume();
  }
  await expect(page.locator('#build-id')).toHaveText('Build ID: ' + report.b.buildId, { timeout: 15_000 });
  await page.getByRole('region', { name: 'Workspace launcher' }).getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(body).toHaveValue(updated);

  report.outcome = 'PASS';
} finally {
  try {
    await browser?.close();
    await server.close();
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
}
