import { expect, test } from '@playwright/test';
import { createNote, editor, expectDraft, noteButtons, openNote, openNotes, reloadNotes, saveStatus } from './helpers/notes';

for (const { field, label, maxBytes } of [
  { field: 'title', label: 'Title', maxBytes: 256 },
  { field: 'body', label: 'Body', maxBytes: 16_384 },
] as const) {
  test(`enforces the ${maxBytes}-byte ${field} limit without losing the draft and saves after shortening`, async ({ page }) => {
    const original = { title: 'Synthetic limit sample', body: 'Keep this saved content. ' };
    const atLimit = 'é'.repeat(maxBytes / 2);
    const tooLong = `${atLimit}a`; // One extra UTF-8 byte, still below the limit in characters.
    await page.goto('./');
    await openNotes(page);
    await createNote(page, original);

    const input = editor(page).getByLabel(label, { exact: true });
    await input.fill(tooLong);
    await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
    await expect(editor(page).getByText(
      'Shorten the draft or make room in Notes, then try again. Titles allow up to 256 bytes and bodies up to 16,384 bytes.',
      { exact: true },
    )).toBeVisible();
    await expectDraft(page, { ...original, [field]: tooLong });

    await input.fill(atLimit);
    await editor(page).getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Saved on this device');
    const saved = { ...original, [field]: atLimit };
    await reloadNotes(page);
    await expect(noteButtons(page)).toHaveText([saved.title]);
    await openNote(page, saved);
  });
}
