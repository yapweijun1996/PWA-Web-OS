import { expect, test, type Page } from '@playwright/test';
import { createNote, editor, expectDraft, notesList, openNote, openNotes, reloadNotes, saveStatus } from './helpers/notes';

const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const notesDock = (page: Page) => dock(page).getByRole('button', { name: 'Notes' });
const notesWindow = (page: Page) => page.locator('#notes-window');

test('minimize retains a pending draft; Close flushes it to real IndexedDB before hiding the window', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('./');
  await openNotes(page);
  const original = { title: 'Synthetic window note', body: 'Initial text' };
  await createNote(page, original);
  const selected = notesList(page).getByRole('button', { name: original.title });
  const draft = { ...original, body: 'Pending edit across window actions' };
  // Freeze the debounce clock, not IndexedDB, so autosave cannot make Close appear to flush.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1_000);
  await editor(page).getByLabel('Body').fill(draft.body);
  await expect(saveStatus(page)).toHaveText('Unsaved changes');
  await page.getByRole('button', { name: 'Minimize', exact: true }).click();
  await expect(notesWindow(page)).toBeHidden();
  await expect(notesDock(page)).toBeFocused();
  await expect(notesDock(page)).toHaveAttribute('data-running', '');
  await expect(notesDock(page)).toHaveAttribute('aria-pressed', 'false');
  await notesDock(page).click();
  await expectDraft(page, draft);
  await expect(selected).toHaveAttribute('aria-current', 'true');
  await expect(saveStatus(page)).toHaveText('Unsaved changes');

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(notesWindow(page)).toBeHidden();
  await expect(notesDock(page)).toBeFocused();
  await expect(notesDock(page)).not.toHaveAttribute('data-running', '');
  const peer = await context.newPage();
  try {
    await peer.goto(page.url());
    await openNotes(peer);
    await openNote(peer, draft); // A separate tab can read only the committed record.
  } finally {
    await peer.close();
  }
  await notesDock(page).click();
  await expectDraft(page, draft);
  await expect(selected).toHaveAttribute('aria-current', 'true');
  await expect(saveStatus(page)).toHaveText('Saved on this device');
});

test('Close leaves the editor and recovery visible when real validation rejects the pending draft', async ({ page }) => {
  await page.goto('./');
  await openNotes(page);
  const original = { title: 'Synthetic close failure', body: 'Keep the last commit' };
  await createNote(page, original);
  const oversizedTitle = 'x'.repeat(257);
  await editor(page).getByLabel('Title').fill(oversizedTitle);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
  await expect(notesWindow(page)).toBeVisible();
  await expect(editor(page)).toBeFocused();
  await expectDraft(page, { ...original, title: oversizedTitle });
  await expect(editor(page).getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(editor(page).getByRole('button', { name: 'Copy draft', exact: true })).toBeVisible();
  await reloadNotes(page);
  await openNote(page, original);
});

test('Dock keyboard order, tooltips and button activation open and switch the real views', async ({ page }) => {
  await page.goto('./');
  const workspaceDock = dock(page).getByRole('button', { name: 'Workspace' });
  const launcher = page.getByRole('region', { name: 'Workspace launcher' });
  for (const target of [page.getByRole('banner').getByRole('button', { name: 'Workspace' }),
    launcher.getByRole('button', { name: 'Notes' }), workspaceDock, notesDock(page)]) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
  }
  await expect(notesDock(page).getByText('Notes')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeFocused();
  await expect(notesDock(page)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Minimize' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(notesDock(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(workspaceDock).toBeFocused();
  await expect(workspaceDock.getByText('Workspace')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(launcher.getByRole('heading')).toBeFocused();
});

test('Maximize and Restore change real bounds without changing the open draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await openNotes(page);
  const sample = { title: 'Synthetic maximize note', body: 'Still in the same editor' };
  await createNote(page, sample);
  const before = (await notesWindow(page).boundingBox())!;
  await page.getByRole('button', { name: 'Maximize', exact: true }).click();
  const maximized = (await notesWindow(page).boundingBox())!;
  expect(maximized.width).toBeGreaterThan(before.width);
  expect(maximized.height).toBeGreaterThan(before.height);
  await expectDraft(page, sample);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  expect(await notesWindow(page).boundingBox()).toEqual(before);
  await expectDraft(page, sample);
});

test('phone Dock yields to focused text and switches between the launcher, editor and list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await notesDock(page).click();
  await expect(notesList(page)).toBeVisible();
  await expect(editor(page)).toBeHidden();
  const list = notesList(page);
  await list.getByRole('button', { name: 'New note' }).click();
  await expect(list).toBeHidden();
  await expect(dock(page)).toBeHidden(); // Checks focus-driven layout, not a physical software keyboard.
  const body = editor(page).getByLabel('Body');
  await body.fill('Synthetic phone draft');
  const back = editor(page).getByRole('button', { name: 'Back to Notes list' });
  await back.click();
  const selected = list.getByRole('button', { name: 'Untitled note' });
  await expect(selected).toBeFocused();
  await expect(editor(page)).toBeHidden();
  await expect(dock(page)).toBeVisible();
  await selected.click();
  await expect(body).toHaveValue('Synthetic phone draft');
  await dock(page).getByRole('button', { name: 'Workspace' }).click();
  await expect(page.getByRole('region', { name: 'Workspace launcher' })).toBeVisible();
  await notesDock(page).click();
  await expect(body).toHaveValue('Synthetic phone draft');
  await expect(list).toBeHidden();
});

test('clock shows browser-local time and changes at the minute boundary', async ({ page }) => {
  const first = new Date(2026, 0, 16, 10, 24, 55);
  await page.clock.install({ time: first });
  await page.clock.pauseAt(first.getTime() + 2_000);
  await page.goto('./');
  const clock = page.locator('.clock');
  const format = new Intl.DateTimeFormat(await page.evaluate(() => navigator.language), { hour: 'numeric', minute: '2-digit' });
  await expect(clock).toHaveAttribute('datetime', '10:24');
  await expect(clock).toHaveText(format.format(first));
  await page.clock.runFor(3_100);
  await expect(clock).toHaveAttribute('datetime', '10:25');
  await expect(clock).toHaveText(format.format(new Date(first.getTime() + 5_000)));
});

test('dark desktop and phone wallpapers decode under production CSP on an offline cold open', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  const url = page.url();
  await expect(page.locator('.connection').getByText('Available offline', { exact: true })).toBeVisible();
  await page.close();
  await context.setOffline(true);
  try {
    for (const [viewport, file, dimensions] of [
      [{ width: 1280, height: 800 }, 'aurora-lake-desktop.webp', [1600, 900]],
      [{ width: 390, height: 844 }, 'aurora-lake-phone.webp', [720, 1560]],
    ] as const) {
      const reopened = await context.newPage();
      await reopened.setViewportSize(viewport);
      await reopened.emulateMedia({ colorScheme: 'dark' });
      await reopened.goto(url);
      await expect(reopened.locator('.connection').getByText('Offline', { exact: true })).toBeVisible();
      await expect(reopened.locator('.connection').getByText('Available offline', { exact: true })).toBeVisible();
      const wallpaperUrl = new URL(`wallpapers/${file}`, url).href;
      const decoded = await reopened.evaluate(async (src) => {
        // Load the exact CSS-selected asset; also verify that the release cache owns it.
        const wallpaper = getComputedStyle(document.body).backgroundImage;
        const response = await caches.match(src);
        const image = new Image();
        image.src = src;
        await image.decode();
        return { wallpaper, cached: response?.ok, size: [image.naturalWidth, image.naturalHeight] };
      }, wallpaperUrl);
      expect(decoded).toMatchObject({ wallpaper: expect.stringContaining(wallpaperUrl), cached: true, size: dimensions });
      await reopened.close();
    }
  } finally {
    await context.setOffline(false);
  }
});
