import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { NoteDraft } from '../src/contracts';
import { createNote, editor, expectDraft, noteButtons, notesList, openNote, openNotes, reloadNotes, saveStatus } from './helpers/notes';

type BackupNote = NoteDraft & { id: string; updatedAt: number };
const format = 'pwa-web-os.notes';
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function backupMenu(page: Page): Locator {
  return page.locator('details').filter({ has: page.getByText('Backup and restore', { exact: true }) });
}

async function showBackupMenu(page: Page): Promise<Locator> {
  const workspace = page.getByRole('banner').getByRole('button', { name: 'Workspace' });
  if (await workspace.getAttribute('aria-expanded') === 'false') await workspace.click();
  const menu = backupMenu(page);
  const summary = menu.getByText('Backup and restore', { exact: true });
  await expect(summary).toBeVisible();
  if (await menu.getAttribute('open') === null) await summary.click();
  return menu;
}

async function exportBackup(page: Page, path: string): Promise<Buffer> {
  const menu = await showBackupMenu(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'), menu.getByRole('button', { name: 'Export backup', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('notes-backup.json');
  await download.saveAs(path);
  return readFile(path);
}

async function chooseBackup(page: Page, input: string | Buffer): Promise<void> {
  const menu = await showBackupMenu(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'), menu.getByRole('button', { name: 'Restore backup', exact: true }).click(),
  ]);
  await chooser.setFiles(typeof input === 'string' ? input : {
    name: 'synthetic-notes.json', mimeType: 'application/json', buffer: input,
  });
}

function restoreDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Restore preview', exact: true });
}

async function expectPreview(page: Page, titles: string[], added: number, unchanged: number): Promise<void> {
  const dialog = restoreDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(`New notes: ${added}`, { exact: true })).toBeVisible();
  await expect(dialog.getByText(`Already in Notes: ${unchanged}`, { exact: true })).toBeVisible();
  const items = dialog.getByRole('list', { name: 'Note titles in this backup', exact: true }).getByRole('listitem');
  await expect(items).toHaveText(titles);
}

async function confirmRestore(page: Page, added: number, unchanged: number): Promise<void> {
  const dialog = restoreDialog(page);
  await dialog.getByRole('button', { name: 'Restore notes', exact: true }).click();
  await expect(dialog).toBeHidden();
  const message = `Notes restored: ${added}. Already in Notes: ${unchanged}.`;
  await expect(backupMenu(page).getByText(message, { exact: true })).toBeVisible();
  // The Workspace popover can cover note rows. Dismiss it before returning to Notes.
  await page.getByRole('banner').getByRole('button', { name: 'Workspace' }).click();
}

function verifyExport(bytes: Buffer, expected: NoteDraft[]): BackupNote[] {
  const json: unknown = JSON.parse(bytes.toString('utf8'));
  expect(json).toStrictEqual({ format, version: 1, notes: expect.any(Array) });
  const { notes } = json as { notes: BackupNote[] };
  expect(notes).toHaveLength(expected.length);
  for (const draft of expected) {
    const note = notes.find(({ title }) => title === draft.title);
    expect(note).toStrictEqual({ ...draft, id: expect.stringMatching(uuidV4), updatedAt: expect.any(Number) });
    expect(Number.isSafeInteger(note?.updatedAt)).toBe(true);
    expect(note?.updatedAt).toBeGreaterThanOrEqual(0);
  }
  const ids = notes.map(({ id }) => id);
  expect(new Set(ids).size).toBe(expected.length);
  expect(ids).toEqual([...ids].sort());
  return notes;
}

test('downloads committed v1 JSON and restores it in an empty browser context; re-import changes nothing', async ({
  page, browser,
}, testInfo) => {
  const drafts = [
    { title: 'Synthetic café backup', body: 'One synthetic line\n  Two with trailing space. ' },
    { title: 'Synthetic backup with an empty body', body: '' },
  ];
  await page.goto('./');
  await openNotes(page);
  for (const draft of drafts) await createNote(page, draft);
  const file = testInfo.outputPath('notes-backup.json');
  const downloaded = await exportBackup(page, file);
  const titles = verifyExport(downloaded, drafts).map(({ title }) => title);

  const fresh = await browser.newContext({ acceptDownloads: true });
  try {
    const destination = await fresh.newPage();
    await destination.goto(page.url());
    await openNotes(destination);
    const empty = notesList(destination).getByText('No notes yet. Create a note to get started.', { exact: true });
    await expect(empty).toBeVisible();

    await chooseBackup(destination, file);
    await expectPreview(destination, titles, 2, 0);
    await restoreDialog(destination).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(restoreDialog(destination)).toBeHidden();
    await reloadNotes(destination);
    await expect(empty).toBeVisible();

    await chooseBackup(destination, file);
    await expectPreview(destination, titles, 2, 0);
    await confirmRestore(destination, 2, 0);
    await reloadNotes(destination);
    await expect(noteButtons(destination)).toHaveCount(2);
    for (const draft of drafts) await openNote(destination, draft);

    await chooseBackup(destination, file);
    await expectPreview(destination, titles, 0, 2);
    await confirmRestore(destination, 0, 2);
    await reloadNotes(destination);
    await expect(noteButtons(destination)).toHaveCount(2);
    for (const draft of drafts) await openNote(destination, draft);
    expect(await exportBackup(destination, testInfo.outputPath('restored-backup.json'))).toEqual(downloaded);
  } finally {
    await fresh.close();
  }
});

const existing = {
  id: '7b1ec150-0afe-4bad-95ac-000000000001',
  title: 'Existing synthetic note', body: 'Keep my saved text\n  unchanged. ', updatedAt: 1_700_000_000_000,
};
const incoming = { ...existing, id: '7b1ec150-0afe-4bad-95ac-000000000002', title: 'Do not import this note' };
const backupJson = (notes: BackupNote[], version = 1) => Buffer.from(JSON.stringify({ format, version, notes }));
const invalidFile = 'This file is not a valid Notes backup. Choose a Notes backup file.';

for (const { kind, bytes, message } of [
  { kind: 'malformed JSON', bytes: () => Buffer.from('{"format":'), message: invalidFile },
  {
    kind: 'unsupported version', bytes: () => backupJson([incoming], 2),
    message: 'This Notes backup version is not supported. Use a compatible version of Notes to open it.',
  },
  {
    kind: 'duplicate IDs', bytes: () => backupJson([incoming, incoming]),
    message: 'This backup contains duplicate note IDs. Choose a different Notes backup file.',
  },
  {
    kind: 'unknown note field',
    bytes: () => Buffer.from(JSON.stringify({ format, version: 1, notes: [{ ...incoming, revision: 1 }] })),
    message: invalidFile,
  },
  {
    kind: 'file one byte over 10 MiB', bytes: () => {
      const padded = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20);
      backupJson([incoming]).copy(padded);
      return padded; // Otherwise valid JSON with trailing whitespace.
    },
    message: 'This backup is larger than 10 MiB. Choose a smaller Notes backup file.',
  },
  {
    kind: 'same ID with a different body', bytes: () => backupJson([incoming, { ...existing, body: 'Conflicting text' }]),
    message: 'This backup contains a note that conflicts with a saved note. No notes were restored.',
  },
]) {
  test(`rejects invalid backup (${kind}) and preserves the existing note across reload`, async ({ page }) => {
    await page.goto('./');
    await openNotes(page);
    await chooseBackup(page, backupJson([existing]));
    await expectPreview(page, [existing.title], 1, 0);
    await confirmRestore(page, 1, 0);
    await openNote(page, existing);

    await chooseBackup(page, bytes());
    await expect(backupMenu(page).getByText(message, { exact: true })).toBeVisible();
    await expect(restoreDialog(page)).toBeHidden();
    await reloadNotes(page);
    await expect(noteButtons(page).locator('.note-row-title')).toHaveText([existing.title]);
    await openNote(page, existing);
  });
}

test('export warns about unsaved text and downloads only the last commit', async ({ page }, testInfo) => {
  const original = { title: 'Synthetic export warning note', body: 'Committed text only. ' };
  // Keep the editor dirty by exceeding the real byte limit, not by racing the save timer.
  const draft = { ...original, body: `${'é'.repeat(8192)}a` };
  await page.goto('./');
  await openNotes(page);
  await createNote(page, original);
  await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
  await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');

  const downloaded = await exportBackup(page, testInfo.outputPath('committed-only.json'));
  const warning = 'Unsaved changes are not included in this backup.';
  await expect(backupMenu(page).getByText(warning, { exact: true })).toBeVisible();
  verifyExport(downloaded, [original]);
  await expectDraft(page, draft);
});
