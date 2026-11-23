import { expect, test } from '@playwright/test';
import { DB_NAME, DB_VERSION, type Note } from '../src/contracts';
import { openIdbFixturePage, readNotesDatabase, upgradeNotesDatabase } from './helpers/idb';
import { createNote, editor, expectDraft, noteButtons, notesList, openNotes, saveStatus } from './helpers/notes';

const incompatible = 'This build cannot read the saved Notes data. Open a newer build before trying again.';

const futureNote: Note = {
  id: '7b1ec150-0afe-4bad-95ac-0e222d94fe98',
  title: 'Newer schema sample',
  body: 'Synthetic saved text from a newer build. ',
  revision: 3,
  updatedAt: 1_700_000_000_000,
};

test('opening Notes with a newer native schema gives actionable feedback and leaves the database intact', async ({
  page, context, baseURL,
}) => {
  if (!baseURL) throw new Error('Playwright baseURL is required for the same-origin IndexedDB fixture.');
  const fixture = await openIdbFixturePage(context, baseURL);
  await fixture.evaluate(({ name, version, note }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name, version);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('notes', { keyPath: 'id' }).add(note);
      open.result.createObjectStore('future');
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { open.result.close(); resolve(); };
  }), { name: DB_NAME, version: DB_VERSION + 1, note: futureNote });
  const before = await readNotesDatabase(fixture);
  expect(before).toStrictEqual({ version: DB_VERSION + 1, stores: ['future', 'notes'], notes: [futureNote] });

  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('./');
  await expect(page).toHaveTitle('PWA Web OS');
  await openNotes(page);
  // The UI uses this copy only for StorageError('incompatible_schema').
  await expect(notesList(page).getByText(`Could not load notes. ${incompatible}`, { exact: true })).toBeVisible();
  await expect(notesList(page).getByRole('button', { name: 'Retry loading notes', exact: true })).toBeVisible();
  await expect(noteButtons(page)).toHaveCount(0);
  expect(await readNotesDatabase(fixture)).toStrictEqual(before);
  expect(pageErrors).toEqual([]);
});

test('a second tab upgrades without blocking; the live editor rejects its next save without losing the committed note', async ({
  page, context,
}) => {
  const original = { title: 'Versionchange sample', body: 'Synthetic text saved before the upgrade. ' };
  const draft = { ...original, body: 'Synthetic edit after the upgrade. ' };
  await page.goto('./');
  await openNotes(page);
  await createNote(page, original);

  const tabB = await openIdbFixturePage(context, page.url());
  const before = await readNotesDatabase(tabB);
  expect(before.version).toBe(DB_VERSION);
  expect(before.notes).toMatchObject([original]);
  // Tab A stays open. Native upgrade success without a blocked event proves its v1 connection released.
  expect(await upgradeNotesDatabase(tabB)).toBe(DB_VERSION + 1);

  // Tab B's upgrade connection is already closed. Use the same editor, without a reload.
  await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
  await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
  await expect(editor(page).getByText(incompatible, { exact: true })).toBeVisible();
  await expectDraft(page, draft);
  expect(await readNotesDatabase(tabB)).toStrictEqual({ ...before, version: DB_VERSION + 1 });
});
