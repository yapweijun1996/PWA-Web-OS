import { expect, test, type Page } from '@playwright/test';
import { createNote, editor, expectDraft, noteButtons, openNote, openNotes, reloadNotes, saveStatus } from './helpers/notes';

const original = { title: 'Shared synthetic note', body: 'Original committed text' };
const newer = { ...original, body: 'Tab A committed this text.\n  Keep this revision.' };
const stale = { title: 'Recovered synthetic draft', body: 'Tab B wrote this on a stale revision.\n  Keep as a copy. ' };

async function createStaleDraft(a: Page, b: Page): Promise<void> {
  await a.goto('./');
  await openNotes(a);
  await createNote(a, original);
  await b.goto(a.url());
  await openNotes(b);
  await openNote(b, original);

  await editor(a).getByLabel('Body', { exact: true }).fill(newer.body);
  await expect(saveStatus(a)).toHaveText('Saved on this device');
  await editor(b).getByLabel('Body', { exact: true }).fill(stale.body);
  await editor(b).getByLabel('Title', { exact: true }).fill(stale.title);

  await expect(editor(b).getByText('A newer version of this note is already saved. Your draft has not been saved.', {
    exact: true,
  })).toBeVisible();
  await expect(editor(b).getByRole('button', { name: 'Save as new', exact: true })).toBeVisible();
  await expect(editor(b).getByRole('button', { name: 'Reload saved version', exact: true })).toBeVisible();
  await expectDraft(b, stale);
}

test('rejects a stale write from a second tab and saves its draft as a separate note', async ({ page, context }) => {
  const tabB = await context.newPage();
  await createStaleDraft(page, tabB);

  await reloadNotes(page);
  await expect(noteButtons(page).locator('.note-row-title')).toHaveText([newer.title]);
  await openNote(page, newer);

  await editor(tabB).getByRole('button', { name: 'Save as new', exact: true }).click();
  await expect(saveStatus(tabB)).toHaveText('Saved on this device');
  await expectDraft(tabB, stale);
  await reloadNotes(tabB);
  await expect(noteButtons(tabB)).toHaveCount(2);
  await openNote(tabB, stale);
  await openNote(tabB, newer);
});

test('Reload saved version discards the stale draft only after confirmation and keeps the newer commit', async ({ page, context }) => {
  const tabB = await context.newPage();
  await createStaleDraft(page, tabB);

  const reload = editor(tabB).getByRole('button', { name: 'Reload saved version', exact: true });
  const dialog = tabB.getByRole('dialog', { name: 'Discard unsaved draft?', exact: true });
  await reload.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expectDraft(tabB, stale);

  await reload.click();
  await dialog.getByRole('button', { name: 'Discard and reload', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expectDraft(tabB, newer);
  await expect(saveStatus(tabB)).toHaveText('Saved on this device');
  await expect(reload).toBeHidden();

  await reloadNotes(tabB);
  await expect(noteButtons(tabB).locator('.note-row-title')).toHaveText([newer.title]);
  await openNote(tabB, newer);
});
