import { cp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { serveReleases } from '../scripts/pwa-test-server';

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

test('detects an unavailable origin with a working network and keeps offline edits when it recovers', async ({ page }) => {
  const server = await serveReleases('dist');
  try {
    await page.goto(server.url);
    await waitForOfflineReady(page);
    const status = page.locator('.network-status');
    await expect(status).toHaveText('Online');

    // Keep the browser network online while the origin serves no release files.
    server.deploy('dist/missing-release');
    await page.clock.install();
    await page.reload();
    await expect(status).toHaveText('Site unreachable');
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.locator('.offline-ready')).toBeVisible();

    await page.locator('.launcher-tile').click();
    await page.getByRole('button', { name: 'New note' }).click();
    const body = page.getByLabel('Body', { exact: true });
    await page.getByLabel('Title', { exact: true }).fill('Reachability test');
    await body.fill('Saved while the origin was unavailable');
    await expect(page.locator('.save-status')).toHaveText('Saved on this device');
    await expect(body).toBeFocused();

    server.deploy('dist');
    await page.clock.fastForward(60_000);
    await expect(status).toHaveText('Online');
    await expect(body).toBeFocused();
    await page.reload();
    await page.locator('.launcher-tile').click();
    await page.getByRole('button', { name: 'Reachability test', exact: true }).click();
    await expect(body).toHaveValue('Saved while the origin was unavailable');
  } finally {
    await server.close();
  }
});

test('withdraws offline readiness after eviction and restores only integrity-checked missing files', async ({ page, context }, info) => {
  const server = await serveReleases('dist');
  const damaged = info.outputPath('bad-assets');
  const files = ['icons/icon-192.png', 'icons/icon-512.png'];
  try {
    await cp('dist', damaged, { recursive: true });
    await writeFile(join(damaged, files[1]), 'Different bytes from the verified release');
    await page.goto(server.url);
    await waitForOfflineReady(page);
    await page.locator('.launcher-tile').click();
    await page.getByRole('button', { name: 'New note' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Cache recovery note');
    await page.getByLabel('Body', { exact: true }).fill('Committed before eviction');
    await expect(page.locator('.save-status')).toHaveText('Saved on this device');

    const cacheName = await page.evaluate(() => 'pwa-web-os:release:' + window.__pwaUpdate!.buildId);
    const digests = () => page.evaluate(async ({ cacheName, files }) => {
      const cache = await caches.open(cacheName);
      return Promise.all(files.map(async file => {
        const entry = await cache.match(new URL(file, location.href));
        if (!entry) return null;
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await entry.arrayBuffer())));
      }));
    }, { cacheName, files });
    const original = await digests();
    expect(original.every(hash => hash?.length === 32)).toBe(true);
    server.deploy(damaged);
    await context.setOffline(true);
    await page.evaluate(async ({ cacheName, files }) => {
      const cache = await caches.open(cacheName);
      for (const file of files) await cache.delete(new URL(file, location.href));
    }, { cacheName, files });
    await page.reload();
    await expect(page.locator('.network-status')).toHaveText('Offline');
    await expect(page.locator('.offline-ready')).toBeHidden();
    await context.setOffline(false);

    // Wait for a complete repair attempt against the wrong bytes before checking atomic rejection.
    const ready = await page.evaluate(() => new Promise<boolean>(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => { channel.port1.close(); resolve(data.ready); };
      navigator.serviceWorker.controller!.postMessage({
        type: 'inspect', documentBuildId: window.__pwaUpdate!.buildId, repairMissing: true,
      }, [channel.port2]);
    }));
    expect(ready).toBe(false);
    // A direct subresource read must also reject wrong bytes while the cache is incomplete.
    expect(await page.evaluate(file => fetch(file).then(() => false, () => true), files[1])).toBe(true);
    expect(await digests()).toEqual([null, null]);
    await expect(page.locator('.offline-ready')).toBeHidden();

    server.deploy('dist');
    await context.setOffline(true);
    await expect(page.locator('.network-status')).toHaveText('Offline');
    await context.setOffline(false);
    await waitForOfflineReady(page);
    expect(await digests()).toEqual(original);

    // The origin still serves this release. Recover even when the shell, script and entire cache are gone.
    expect(await page.evaluate(name => caches.delete(name), cacheName)).toBe(true);
    await page.reload();
    await waitForOfflineReady(page);
    expect(await digests()).toEqual(original);
    await page.close();
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(server.url);
    await waitForOfflineReady(reopened);
    await reopened.locator('.launcher-tile').click();
    await reopened.getByRole('button', { name: 'Cache recovery note', exact: true }).click();
    await expect(reopened.getByLabel('Body', { exact: true })).toHaveValue('Committed before eviction');
  } finally {
    await context.setOffline(false);
    await server.close();
  }
});
