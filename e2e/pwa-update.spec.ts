import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { serveReleases } from '../scripts/pwa-test-server';

const exec = promisify(execFile);
const build = (outDir: string, id: string) => exec(process.execPath, [
  resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir,
], { env: { ...process.env, BUILD_ID: id } });

// Polled while a tab reloads: an evaluate that loses its execution context to the navigation
// reports undefined so the poll retries, instead of failing the test. Real failures still time out.
const release = (page: Page) => page.evaluate(() => ({
  buildId: window.__pwaUpdate?.buildId,
  status: window.__pwaUpdate?.getState().status,
  ready: window.__pwaUpdate?.isOfflineReady(),
})).catch((error: unknown) => {
  if (String(error).includes('Execution context was destroyed')) return undefined;
  throw error;
});

test('keeps A assets while B waits, then coordinates two live tabs and reloads each once into B', async ({
  page, context, browserName,
}, testInfo) => {
  const distA = testInfo.outputPath('dist-a');
  const distB = testInfo.outputPath('dist-b');
  await Promise.all([build(distA, 'pwa-e2e-a'), build(distB, 'pwa-e2e-b')]);
  const server = await serveReleases(distA, Number(process.env.PW_PORT ?? 41730));
  try {
    await page.goto(server.url);
    await expect.poll(() => release(page)).toEqual({ buildId: 'pwa-e2e-a', status: 'idle', ready: true });
    const oldEntry = await page.locator('script[type="module"][src]').first()
      .evaluate((script: HTMLScriptElement) => script.src);
    const peer = await context.newPage();
    await peer.goto(server.url);
    await expect.poll(() => release(peer)).toEqual({ buildId: 'pwa-e2e-a', status: 'idle', ready: true });

    server.deploy(distB);
    await page.reload(); // The old worker serves A's document and the page polls for updates.
    await expect.poll(() => release(page)).toEqual({ buildId: 'pwa-e2e-a', status: 'available', ready: true });
    expect((await page.request.get(oldEntry)).status()).toBe(404); // Not on the B server or in the HTTP cache.
    expect(await page.evaluate(async (url) => (await (await fetch(url)).text()).includes('pwa-e2e-a'), oldEntry)).toBe(true);
    // Playwright Firefox denies window CacheStorage on the IPv6 loopback; the worker still uses it.
    if (browserName === 'chromium') {
      const before = await page.evaluate(() => caches.keys());
      expect(before).toEqual(expect.arrayContaining(['pwa-web-os:release:pwa-e2e-a', 'pwa-web-os:release:pwa-e2e-b']));
    }
    expect(await page.locator('#app').evaluate((app: HTMLElement) => app.inert)).toBe(false);

    let primaryReloads = 0;
    let peerReloads = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) primaryReloads++; });
    peer.on('framenavigated', (frame) => { if (frame === peer.mainFrame()) peerReloads++; });
    // Trigger the actual controller; no mocked registration, transport, or navigation.
    await page.evaluate(() => { void window.__pwaUpdate?.accept(); });
    await Promise.all([page, peer].map((tab) => expect.poll(() => release(tab)).toEqual({
      buildId: 'pwa-e2e-b', status: 'idle', ready: true,
    })));
    if (browserName === 'chromium') {
      expect(await page.evaluate(() => caches.keys())).toEqual(['pwa-web-os:release:pwa-e2e-b']);
    }
    expect(await page.evaluate(() => sessionStorage.getItem('pwa-web-os:reload-target'))).toBe('pwa-e2e-b');
    expect({ primaryReloads, peerReloads }).toEqual({ primaryReloads: 1, peerReloads: 1 });
  } finally {
    await server.close();
  }
});

test('rejects a candidate served with a mismatched asset and keeps the old shell offline', async ({
  page, context, browserName,
}, testInfo) => {
  const distA = testInfo.outputPath('dist-a');
  const distB = testInfo.outputPath('dist-b');
  await Promise.all([build(distA, 'pwa-e2e-good'), build(distB, 'pwa-e2e-incomplete')]);
  // A real mixed deployment: the manifest still returns 200 but its bytes do not match the worker.
  await writeFile(join(distB, 'manifest.webmanifest'), '{}');
  await writeFile(join(distA, 'unlisted.txt'), 'Synthetic network-only resource');
  const server = await serveReleases(distA, Number(process.env.PW_PORT ?? 41730));
  try {
    await page.goto(server.url);
    await expect.poll(() => release(page)).toEqual({ buildId: 'pwa-e2e-good', status: 'idle', ready: true });
    expect(await page.evaluate(async () => (await fetch('./unlisted.txt')).text())).toBe('Synthetic network-only resource');
    server.deploy(distB);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.__pwaUpdate?.getState())).toEqual({
      status: 'failed', detail: 'activation_failed',
    });
    expect(await release(page)).toEqual({ buildId: 'pwa-e2e-good', status: 'failed', ready: true });
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);
    if (browserName === 'chromium') {
      expect(await page.evaluate(() => caches.keys())).toEqual(['pwa-web-os:release:pwa-e2e-good']);
    }

    await context.setOffline(true);
    await page.reload();
    await expect.poll(() => release(page)).toMatchObject({ buildId: 'pwa-e2e-good', ready: true });
    expect(await page.evaluate(() => fetch('./unlisted.txt').then(() => false, () => true))).toBe(true);
  } finally {
    await context.setOffline(false);
    await server.close();
  }
});
