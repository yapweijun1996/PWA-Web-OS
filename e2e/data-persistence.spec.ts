import { expect, test, type Page } from '@playwright/test';
import { createNote, editor, noteButtons, openNote, openNotes, reloadNotes, saveStatus } from './helpers/notes';

test('persists exact text across reloads and orders two notes by most recent edit, not by title', async ({ page }) => {
  const first = { title: 'Alpha café note', body: 'Synthetic first line\n  Second line with trailing space \n' };
  const second = { title: 'Zulu sample note', body: 'Synthetic second note' };
  const edited = { ...first, body: 'New synthetic text\n  Indented and still local. ' };

  await page.goto('./');
  await openNotes(page);
  await createNote(page, first);
  await reloadNotes(page);
  await openNote(page, first);

  await createNote(page, second);
  const rowTitles = noteButtons(page).locator('.note-row-title');
  await expect(rowTitles).toHaveText([second.title, first.title]);
  await openNote(page, first);
  await editor(page).getByLabel('Body', { exact: true }).fill(edited.body);
  await expect(saveStatus(page)).toHaveText('Saved on this device');
  await expect(rowTitles).toHaveText([first.title, second.title]);

  await reloadNotes(page);
  await expect(rowTitles).toHaveText([first.title, second.title]);
  await openNote(page, edited);
  await openNote(page, second);
});

async function expectOfflineReady(page: Page): Promise<void> {
  await expect(page.locator('.connection').getByText('Available offline', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
}

test('cold-opens the worker-controlled production app offline, edits a note and rereads it offline', async ({ page, context }) => {
  const original = { title: 'Offline sample note', body: 'Saved before going offline.\nSynthetic local text.' };
  const edited = { ...original, body: 'Saved offline.\n  Synthetic local edit. ' };

  await page.goto('./');
  await expectOfflineReady(page);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await openNotes(page);
  await createNote(page, original);
  const url = page.url();

  try {
    await context.setOffline(true);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(url);
    await expect(reopened).toHaveTitle('PWA Web OS');
    await expectOfflineReady(reopened);
    const offline = reopened.locator('.connection').getByText('Offline', { exact: true });
    await expect(offline).toBeVisible();
    expect(await reopened.evaluate(() => navigator.onLine)).toBe(false);
    await openNotes(reopened);
    await openNote(reopened, original);
    await editor(reopened).getByLabel('Body', { exact: true }).fill(edited.body);
    await expect(saveStatus(reopened)).toHaveText('Saved on this device');
    await expect(offline).toBeVisible();

    await reloadNotes(reopened);
    await expectOfflineReady(reopened);
    await expect(offline).toBeVisible();
    expect(await reopened.evaluate(() => navigator.onLine)).toBe(false);
    await openNote(reopened, edited);
  } finally {
    await context.setOffline(false);
  }
});
