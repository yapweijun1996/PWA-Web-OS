import { expect, test } from '@playwright/test';

test('shows the workspace and demo disclosure at the Pages base path', async ({ page }) => {
  await page.goto('./');

  await expect(page).toHaveURL(/\/PWA-Web-OS\/$/);
  await expect(page).toHaveTitle('PWA Web OS');
  await expect(page.getByRole('heading', { name: 'PWA Web OS', exact: true })).toBeVisible();
  await expect(page.getByText(/^Build ID: b-[0-9a-z]+$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workspace launcher' })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByText('Demo build. Notes are stored only on this device and are never uploaded.', { exact: true })).toBeVisible();
});
