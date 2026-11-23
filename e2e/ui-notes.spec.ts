import { expect, test, type Locator, type Page } from '@playwright/test';
import { committedNotes, holdNoteWrites } from '../scripts/notes-update-fixture';

function launcher(page: Page): Locator {
  return page.getByRole('region', { name: 'Workspace launcher', exact: true });
}

async function openNotes(page: Page): Promise<void> {
  await launcher(page).getByRole('button', { name: 'Notes', exact: true }).click();
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(target).toBeFocused();
}

test('desktop Notes panes sit side by side above the Dock; the IndexedDB write shows Saving… then Saved and the page can reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await openNotes(page);
  const dock = page.getByRole('navigation', { name: 'Dock' });
  const list = page.getByRole('region', { name: 'Notes', exact: true });
  const editor = page.getByRole('region', { name: 'Note editor' });
  await expect(list.getByText('No notes yet. Create a note to get started.')).toBeVisible();
  await expect(dock).toBeVisible();
  await expect(list).toBeVisible();
  await expect(editor).toBeVisible();
  const [left, right, bottom] = await Promise.all([list.boundingBox(), editor.boundingBox(), dock.boundingBox()]);
  expect(left && right && bottom && left.x < right.x && left.x + left.width <= right.x && left.y + left.height < bottom.y).toBe(true);
  expect(left?.y).toBe(right?.y);

  await list.getByRole('button', { name: 'New note' }).click();
  const status = editor.locator('.save-status');
  await expect(status).toHaveText('Saved on this device');
  // Hold a real write transaction open so the in-flight status is observable.
  const releaseWrites = await holdNoteWrites(page);
  try {
    await editor.getByLabel('Title').fill('Synthetic desktop note');
    await editor.getByLabel('Body').fill('Local browser demo text');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('Saving…');
  } finally {
    await releaseWrites();
  }
  await expect(status).toHaveText('Saved on this device');
  expect(await committedNotes(page)).toMatchObject([{
    title: 'Synthetic desktop note', body: 'Local browser demo text',
  }]);
  await expect(list.getByRole('button', { name: 'Synthetic desktop note' })).toBeVisible();
  await page.reload();
  await expect(launcher(page)).toBeVisible();
});

test('390×844 shows one pane, retains the draft across resize, and offers both back routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await openNotes(page);
  const list = page.getByRole('region', { name: 'Notes', exact: true });
  const editor = page.getByRole('region', { name: 'Note editor' });
  await expect(list).toBeVisible();
  await expect(editor).toBeHidden();
  await list.getByRole('button', { name: 'New note' }).click();
  const body = editor.getByLabel('Body');
  await body.fill('Synthetic mobile draft');
  await expect(list).toBeHidden();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(list).toBeVisible();
  await expect(body).toHaveValue('Synthetic mobile draft');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(body).toHaveValue('Synthetic mobile draft');
  const backToNotes = editor.getByRole('button', { name: 'Back to Notes list' });
  expect((await backToNotes.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await backToNotes.click();
  await expect(list).toBeVisible();
  await expect(editor).toBeHidden();
  const note = list.getByRole('button', { name: 'Untitled note' });
  await expect(note).toBeFocused();
  await note.click();
  await expect(editor).toBeFocused();
  await expect(body).toHaveValue('Synthetic mobile draft');
  await backToNotes.click();
  await list.getByRole('button', { name: 'Workspace launcher' }).click();
  await expect(launcher(page).getByRole('heading')).toBeFocused();
  await expect(list).toBeHidden();
});

test('keyboard-only creation moves focus to Title, then to Body by Tab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await tabTo(page, launcher(page).getByRole('button', { name: 'Notes', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: 'New note' }));
  await page.keyboard.press('Enter');
  const title = page.getByLabel('Title', { exact: true });
  await expect(title).toBeFocused();
  await page.keyboard.type('Synthetic keyboard note');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Body', { exact: true })).toBeFocused();
  await page.keyboard.type('Local keyboard demo text');
  await expect(page.getByRole('button', { name: 'Synthetic keyboard note' })).toBeVisible();
});

test('System follows browser appearance and Dark theme persists through a real reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const html = page.locator('html');
  const menu = page.getByRole('banner').getByRole('button', { name: 'Workspace' });
  const dark = page.getByRole('radio', { name: 'Dark theme' });
  await expect(html).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(238, 235, 250)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveCSS('color-scheme', 'dark');
  await menu.click();
  await dark.check();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await menu.click();
  await expect(dark).toBeChecked();
  await expect(html).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 19, 52)');
});
