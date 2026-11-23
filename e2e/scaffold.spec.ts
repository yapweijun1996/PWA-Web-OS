import { expect, test } from '@playwright/test';

test('shows the built scaffold at the Pages base path', async ({ page }) => {
  await page.goto('./');

  await expect(page).toHaveURL(/\/PWA-Web-OS\/$/);
  await expect(page).toHaveTitle('PWA Web OS');
  await expect(page.getByRole('heading', { name: 'PWA Web OS', exact: true })).toBeVisible();
  await expect(page.getByText(/^Build ID: b-[0-9a-z]+$/)).toBeVisible();
  await expect(page.getByText('Notes: not implemented yet', { exact: true })).toBeVisible();
});
