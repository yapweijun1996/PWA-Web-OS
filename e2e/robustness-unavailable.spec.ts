import { expect, test } from '@playwright/test';
import { THEME_KEY } from '../src/contracts';
import { noteButtons, notesList, openNotes } from './helpers/notes';

test('the app handles missing IndexedDB without uncaught errors and still persists a theme in localStorage', async ({ page }) => {
  // Simulate a missing browser API, not a private-browsing mode or a mocked repository result.
  await page.addInitScript(() => { Reflect.deleteProperty(window, 'indexedDB'); });
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('./');
  await expect(page).toHaveTitle('PWA Web OS');
  expect(await page.evaluate(() => typeof window.indexedDB)).toBe('undefined');
  await openNotes(page);
  const message = notesList(page).getByText('Could not load notes. Allow browser storage for this site, then try again.', {
    exact: true,
  });
  await expect(message).toBeVisible();
  await expect(notesList(page).getByRole('button', { name: 'Retry loading notes', exact: true })).toBeVisible();
  await expect(noteButtons(page)).toHaveCount(0);

  const theme = page.getByRole('group', { name: 'Theme', exact: true });
  await expect(theme.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
  const dark = theme.getByRole('radio', { name: 'Dark theme', exact: true });
  await dark.check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark');

  await page.reload();
  await expect(dark).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openNotes(page);
  await expect(message).toBeVisible();
  expect(pageErrors).toEqual([]);
});
