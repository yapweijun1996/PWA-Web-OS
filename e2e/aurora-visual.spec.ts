import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1280, height: 800, colorScheme: 'dark', name: 'desktop-dark' },
  { width: 1280, height: 800, colorScheme: 'light', name: 'desktop-light' },
  { width: 768, height: 1024, colorScheme: 'dark', name: 'tablet' },
  { width: 390, height: 844, colorScheme: 'dark', name: 'phone' },
] as const;

test('captures the production Aurora shell with synthetic notes restored through the real backup UI', async ({ page }, info) => {
  const now = new Date(2026, 0, 16, 10, 24);
  await page.clock.setFixedTime(now);
  await page.setViewportSize(viewports[0]);
  await page.goto('./');
  await page.getByRole('banner').getByRole('button', { name: 'Workspace' }).click();
  await page.getByText('Backup and restore', { exact: true }).click();
  const notes = [
    { title: 'Field notes', body: '•  Back ridge at first light — clear visibility.\n•  Water level lower than last visit.\n•  Good location for a wider panorama.', updatedAt: +now },
    { title: 'Site ideas', body: 'Synthetic site ideas.', updatedAt: +new Date(2026, 0, 15, 18, 37) },
    { title: 'Checklist', body: 'Synthetic checklist.', updatedAt: +new Date(2026, 0, 14, 9, 5) },
  ].map((note, i) => ({ ...note, id: `00000000-0000-4000-8000-00000000000${i + 1}` }));
  await page.locator('input[type="file"]').setInputFiles({
    name: 'synthetic-aurora.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'pwa-web-os.notes', version: 1, notes })),
  });
  await page.getByRole('button', { name: 'Restore notes', exact: true }).click();
  await expect(page.locator('.backup-menu').getByText('Notes restored: 3. Already in Notes: 0.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Dock' }).getByRole('button', { name: 'Notes' }).click();
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  await expect(page.getByLabel('Body', { exact: true })).toHaveValue(notes[0].body);
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  // Capture the resting layout rather than a transient keyboard focus ring.
  await page.locator('.brand').click();
  for (const { width, height, colorScheme, name } of viewports) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveCSS('color-scheme', colorScheme);
    if (colorScheme === 'dark') {
      await page.evaluate(async () => {
        const src = getComputedStyle(document.body).backgroundImage.match(/url\("(.*?)"\)/)?.[1];
        if (!src) throw new Error('The dark surface has no wallpaper');
        const image = new Image();
        image.src = src;
        await image.decode();
      });
    }
    await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
  }
});
