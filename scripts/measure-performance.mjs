import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { build, preview } from 'vite';

const require = createRequire(import.meta.url);
const output = process.argv[2];
if (!output) throw new Error('Provide a new JSON evidence file path.');
const count = 7;
const budgetsMs = { coldLaunch: 2500, offlineReopen: 2000, editFrame: 200 };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const dir = await mkdtemp(join(os.tmpdir(), 'web-os-perf-'));
const report = {
  protocol: 'notes-desktop-lab-v1', commit, trackedChanges: git('status', '--short', '--untracked-files=no') !== '',
  startedAt: new Date().toISOString(), attempts: count, budgetsMs,
  environment: {
    platform: os.platform(), osRelease: os.platform() === 'darwin'
      ? execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim() : os.release(),
    cpu: os.cpus()[0].model, logicalCpus: os.availableParallelism(), memoryGiB: os.totalmem() / 2 ** 30,
    initialLoadAverage: os.loadavg(), node: process.version, playwright: require('playwright/package.json').version,
    browser: 'Google Chrome (headless)', viewport: { width: 1280, height: 800 },
  },
  samples: [], field: { status: 'INSUFFICIENT_DATA', observedSamples: 0 },
};

async function openSaved(page, url, title, body) {
  const nav = await page.goto(url);
  assert(nav?.fromServiceWorker(), 'Offline navigation must be served by the service worker');
  await page.locator('.launcher-tile').click();
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByLabel('Body', { exact: true })).toHaveValue(body);
}

const elapsed = (start) => Math.round(performance.now() - start);

async function measure(context, url, sample) {
  const title = 'Synthetic performance note';
  const body = 'Fixture content for a desktop editing session. '.repeat(32);
  const page = await context.newPage();
  const start = performance.now();
  const nav = await page.goto(url);
  assert(nav?.ok() && !nav.fromServiceWorker(), 'Cold navigation must load from the server');
  await page.locator('.launcher-tile').click();
  await expect(page.getByRole('button', { name: 'New note', exact: true })).toBeVisible();
  sample.coldLaunch = elapsed(start);

  const id = await page.evaluate(() => window.__pwaUpdate?.buildId);
  assert(id && (!report.buildId || report.buildId === id), 'Unexpected build identity');
  report.buildId = id;
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Body', { exact: true }).fill(body);
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  await expect(page.locator('.offline-ready')).toBeVisible();
  await page.close();
  await context.setOffline(true);

  const reopened = await context.newPage();
  const reopenStart = performance.now();
  await openSaved(reopened, url, title, body);
  sample.offlineReopen = elapsed(reopenStart);
  assert.equal(await reopened.evaluate(() => fetch('./noncached-probe', { cache: 'no-store' }).then(
    () => true, () => false,
  )), false, 'An uncached network request must fail offline');

  const editor = reopened.getByLabel('Body', { exact: true });
  await editor.focus();
  await editor.press('ControlOrMeta+End');
  const editStart = performance.now();
  await reopened.keyboard.type('x');
  const edited = await editor.evaluate(async (field) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return field.value;
  });
  sample.editFrame = elapsed(editStart);
  assert.equal(edited, body + 'x');
  await expect(reopened.locator('.save-status')).toHaveText('Saved on this device');
  await reopened.close();
  await openSaved(await context.newPage(), url, title, body + 'x');
}

let server, browser;
try {
  await build({ build: { outDir: dir }, logLevel: 'warn' });
  report.workerSha256 = createHash('sha256').update(await readFile(join(dir, 'sw.js'))).digest('hex');
  server = await preview({ build: { outDir: dir }, preview: { host: '127.0.0.1', port: 0 } });
  const url = new URL(server.config.base, 'http://127.0.0.1:' + server.httpServer.address().port).href;
  browser = await chromium.launch({ channel: 'chrome' });
  report.environment.browserVersion = browser.version();
  for (let i = 1; i <= count; i++) {
    const sample = { run: i };
    report.samples.push(sample);
    const context = await browser.newContext({ viewport: report.environment.viewport, locale: 'en-US' });
    try {
      await measure(context, url, sample);
    } catch (error) {
      sample.error = error.message.split('\n')[0];
      console.error('Attempt', i, error.message);
    } finally {
      await context.close();
    }
  }
  if (report.samples.every(s => !s.error)) {
    report.summaryMs = {};
    for (const metric of Object.keys(budgetsMs)) {
      const sorted = report.samples.map(s => s[metric]).sort((a, b) => a - b);
      report.summaryMs[metric] = {
        min: sorted[0], median: sorted[Math.floor(count / 2)],
        p75: sorted[Math.ceil(0.75 * count) - 1], max: sorted.at(-1),
      };
    }
  }
  report.status = report.summaryMs && Object.entries(budgetsMs).every(
    ([metric, ceiling]) => report.summaryMs[metric].p75 <= ceiling,
  ) ? 'PASS' : 'FAIL';
} catch (error) {
  report.status = 'FAIL';
  report.error = error.message.split('\n')[0];
  console.error(error);
} finally {
  await browser?.close();
  await server?.close();
  await rm(dir, { recursive: true, force: true });
}
report.endedAt = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(report.status, report.summaryMs ?? report.error ?? 'See sample errors', output);
if (report.status !== 'PASS') process.exitCode = 1;
