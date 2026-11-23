import { expect, test, type Page } from '@playwright/test';

async function waitForOfflineReady(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    controlled: !!navigator.serviceWorker.controller,
    ready: window.__pwaUpdate?.isOfflineReady() ?? false,
  }))).toEqual({ controlled: true, ready: true });
}

test('serves the production manifest, decodes the icons, and verifies offline readiness', async ({ page }) => {
  await page.goto('./');
  const manifestUrl = await page.locator('link[rel="manifest"]').evaluate((link: HTMLLinkElement) => link.href);
  expect(new URL(manifestUrl).pathname).toBe('/PWA-Web-OS/manifest.webmanifest');
  const response = await page.request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/application\/(manifest\+json|json)/);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: '/PWA-Web-OS/', name: 'PWA Web OS', short_name: 'Web OS', start_url: '/PWA-Web-OS/',
    scope: '/PWA-Web-OS/', display: 'standalone', theme_color: '#17243a', background_color: '#f4f7fb',
    icons: [
      { sizes: '192x192', type: 'image/png', purpose: 'any' },
      { sizes: '512x512', type: 'image/png', purpose: 'any' },
      { sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', manifest.theme_color);
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestUrl);
    expect(url.pathname).toMatch(/^\/PWA-Web-OS\/icons\/.+\.png$/);
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, url.href);
    expect(dimensions).toBe(icon.sizes);
  }
  await waitForOfflineReady(page);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)).toBe(page.url());
});

test('reopens the built app shell offline in the same browser context', async ({ page, context }) => {
  await page.goto('./');
  await waitForOfflineReady(page);
  const url = page.url();
  const build = await page.evaluate(() => window.__pwaUpdate?.buildId);
  expect(build).toBeTruthy();
  await page.close();
  await context.setOffline(true);
  try {
    const reopened = await context.newPage();
    await reopened.goto(url);
    await waitForOfflineReady(reopened);
    await reopened.reload();
    expect(await reopened.evaluate(() => navigator.onLine)).toBe(false);
    expect(await reopened.evaluate(() => window.__pwaUpdate?.buildId)).toBe(build);
    await waitForOfflineReady(reopened);
  } finally {
    await context.setOffline(false);
  }
});
