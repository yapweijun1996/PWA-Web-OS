import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer, request as forward } from 'node:http';
import { expect, test as baseTest, type Page, type Request } from '@playwright/test';
import { BACKUP_FORMAT, BACKUP_VERSION, THEME_KEY, type Note } from '../src/contracts';

import { listenOnLoopback } from '../scripts/pwa-test-server';

type BackupNote = Omit<Note, 'revision'>;

declare global {
  interface Window { recordCspViolation(directive: string): void }
}
const base = '/PWA-Web-OS/';
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'self'; worker-src 'self'";
const imported: BackupNote = {
  id: '00000000-0000-4000-8000-000000000001',
  title: `ImportedSyntheticTitle <img src=x onerror="document.documentElement.dataset.notesMarkupRan='yes'">`,
  body: `ImportedSyntheticBody <script>document.documentElement.dataset.notesMarkupRan='yes'</script>`,
  updatedAt: 1,
};
const draft = {
  title: 'TypedSyntheticTitle <b data-note-markup-test>bold</b>',
  body: 'TypedSyntheticBody <strong data-note-markup-test>body</strong>',
};
const sensitiveMarkers = [imported.title, imported.body, draft.title, draft.body].map((text) => text.split(' ')[0])
  .concat(imported.id, BACKUP_FORMAT);

type ObservedRequest = { method: string; url: string; body: string | null; headers: Record<string, string | string[] | undefined> };

const test = baseTest.extend<{ recordedPreview: { url: URL; requests: ObservedRequest[] } }>({
  recordedPreview: async ({ baseURL }, use) => {
    if (!baseURL) throw new Error('Expected the production preview URL');
    const preview = new URL(baseURL);
    // Observe worker requests at the origin as well as page requests in Playwright.
    const requests: ObservedRequest[] = [];
    const server = createServer((incoming, outgoing) => {
      const entry: ObservedRequest = {
        method: incoming.method ?? '', url: new URL(incoming.url ?? '', url).href, body: null, headers: incoming.headers,
      };
      requests.push(entry);
      const body: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => body.push(chunk));
      incoming.on('end', () => { if (body.length) entry.body = Buffer.concat(body).toString('utf8'); });
      const upstream = forward({
        hostname: preview.hostname, port: preview.port, path: incoming.url, method: incoming.method, headers: incoming.headers,
      }, (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      });
      upstream.on('error', () => {
        if (outgoing.headersSent) outgoing.destroy();
        else outgoing.writeHead(502).end();
      });
      incoming.pipe(upstream);
    });
    const url = await listenOnLoopback(server);
    try {
      await use({ url, requests });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  },
});

test('production CSP allows worker, manifest and Blob export; markup stays literal and Notes data stays local', async ({
  page, context, browserName, recordedPreview,
}) => {
  const requests: Request[] = [];
  context.on('request', (request) => requests.push(request));
  const errors: string[] = [];
  const consoleWithNoteData: boolean[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') errors.push(text);
    if (containsNotes(text)) consoleWithNoteData.push(true);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const violations: string[] = [];
  await page.exposeFunction('recordCspViolation', (directive: string) => { violations.push(directive); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => window.recordCspViolation(event.effectiveDirective));
  });

  const appUrl = recordedPreview.url;
  await page.goto(appUrl.href);
  expect(page.url()).toBe(appUrl.href);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', policy);
  await expect(page.locator('.connection').getByText('Available offline', { exact: true })).toBeVisible();
  expect(await page.evaluate(async () => ({
    scope: (await navigator.serviceWorker.getRegistration())?.scope,
    worker: navigator.serviceWorker.controller?.scriptURL,
  }))).toEqual({ scope: appUrl.href, worker: new URL('sw.js', appUrl).href });
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute('href', `${base}manifest.webmanifest`);
  const manifest = await page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Manifest request failed');
    return response.json() as Promise<{ start_url: string; scope: string; icons: { src: string }[] }>;
  }, `${base}manifest.webmanifest`);
  expect(manifest).toMatchObject({ start_url: base, scope: base });
  if (browserName === 'chromium') {
    // Ask Chromium for its linked manifest, not just the result of a connect-src fetch.
    const cdp = await context.newCDPSession(page);
    const response = await cdp.send('Page.getAppManifest');
    expect(response.errors).toEqual([]);
    expect(response.url).toBe(new URL('manifest.webmanifest', appUrl).href);
    expect(response.data).toBeTruthy();
    await cdp.detach();
  }

  const workspace = page.getByRole('banner').getByRole('button', { name: 'Workspace' });
  await workspace.click();
  await page.getByRole('radio', { name: 'Dark theme' }).check();
  await workspace.click();
  await openNotes(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(draft.title);
  await page.getByRole('textbox', { name: 'Body' }).fill(draft.body);
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  await expect(noteButton(page, draft.title).locator('.note-row-title')).toHaveText(draft.title);
  await expectLiteralEditor(page, draft);

  await workspace.click();
  await page.getByText('Backup and restore', { exact: true }).click();
  const exported = await exportBackup(page);
  expect(exported).toEqual({ format: BACKUP_FORMAT, version: BACKUP_VERSION, notes: [expect.objectContaining(draft)] });
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: BACKUP_FORMAT, version: BACKUP_VERSION, notes: [imported],
  })) });
  const preview = page.getByRole('dialog', { name: 'Restore preview' });
  await expect(preview.getByRole('listitem')).toHaveText(imported.title);
  await expectNoMarkup(page);
  await preview.getByRole('button', { name: 'Restore notes', exact: true }).click();
  await expect(page.locator('.backup-menu').getByText('Notes restored: 1. Already in Notes: 0.', { exact: true })).toBeVisible();

  await page.reload();
  await openNotes(page);
  await expect(noteButton(page, imported.title).locator('.note-row-title')).toHaveText(imported.title);
  await noteButton(page, imported.title).click();
  await expectLiteralEditor(page, imported);
  await noteButton(page, draft.title).click();
  await expectLiteralEditor(page, draft);
  expect(await page.evaluate(() => Object.entries(localStorage))).toEqual([[THEME_KEY, 'dark']]);

  const cachePaths = ['index.html', 'manifest.webmanifest', 'THIRD-PARTY-NOTICES.txt', ...manifest.icons.map(({ src }) => src),
    ...(await readdir('dist/assets')).map((name) => `assets/${name}`),
    'wallpapers/wallpaper-desktop.webp', 'wallpapers/wallpaper-phone.webp'];
  await expectReleaseCache(page, appUrl, cachePaths);
  const allowed = new Set(['', 'sw.js', ...cachePaths].map((path) => new URL(path, appUrl).href));
  const browserRequests = await Promise.all(requests.map(async (request) => ({
    method: request.method(), url: request.url(), body: request.postData(), headers: await request.allHeaders(),
  })));
  expect(browserRequests.some(({ url }) => url === appUrl.href)).toBe(true);
  expect(recordedPreview.requests.some(({ url }) => url === new URL('sw.js', appUrl).href)).toBe(true);
  expect(recordedPreview.requests.some(({ url }) => url === new URL('manifest.webmanifest', appUrl).href)).toBe(true);
  for (const [source, observed] of [['browser', browserRequests], ['origin', recordedPreview.requests]] as const) {
    const unexpected = observed.filter(({ method, url, body }) => method !== 'GET' || !allowed.has(url) || body !== null);
    const summary = unexpected.map(({ method, url, body }) => ({
      method, hasBody: body !== null,
      urlKind: new URL(url).pathname === '/favicon.ico' ? 'default favicon' : 'unlisted request',
    }));
    expect(summary, `${source}: only bodyless same-origin GETs for known app assets`).toEqual([]);
    expect(observed.some((request) => containsNotes(JSON.stringify(request))),
      `${source}: no synthetic note or backup data in requests`).toBe(false);
  }
  expect(consoleWithNoteData.length, 'no synthetic note or backup data in console messages').toBe(0);
  expect(violations, 'no securitypolicyviolation events').toEqual([]);
  expect(errors.map((error) => containsNotes(error) ? '[synthetic note content redacted]' : error), 'no console or page errors').toEqual([]);
});

function containsNotes(text: string): boolean {
  return sensitiveMarkers.some((marker) => text.includes(marker));
}

async function openNotes(page: Page): Promise<void> {
  await page.getByRole('region', { name: 'Workspace launcher' }).getByRole('button', { name: 'Notes' }).click();
}

function noteButton(page: Page, title: string) {
  return page.getByRole('region', { name: 'Notes', exact: true }).getByRole('button', { name: title, exact: true });
}

async function exportBackup(page: Page): Promise<unknown> {
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('notes-backup.json');
  expect(new URL(download.url()).protocol).toBe('blob:');
  const file = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function expectLiteralEditor(page: Page, note: Pick<Note, 'title' | 'body'>): Promise<void> {
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(note.title);
  await expect(page.getByRole('textbox', { name: 'Body' })).toHaveValue(note.body);
  await expectNoMarkup(page);
}

async function expectNoMarkup(page: Page): Promise<void> {
  await expect(page.locator('#app :is(img, script, [data-note-markup-test], [onerror])')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-notes-markup-ran', 'yes');
}

async function expectReleaseCache(page: Page, appUrl: URL, paths: string[]): Promise<void> {
  const expected = await Promise.all(paths.map(async (path) => ({
    url: new URL(path, appUrl).href, method: 'GET',
    digest: createHash('sha256').update(await readFile(`dist/${path}`)).digest('hex'),
  })));
  const inventory = await page.evaluate(async () => ({
    build: window.__pwaUpdate?.buildId,
    stores: await Promise.all((await caches.keys()).map(async (name) => {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      const entries = await Promise.all(requests.map(async (request) => {
        const response = await cache.match(request);
        if (!response) throw new Error('Missing cached response');
        const copy = response.clone();
        const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()));
        const digest = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        // The worker keeps one metadata record about retained releases. Read it so the test can inspect it.
        const text = request.url.endsWith('/.pwa-previous-releases') ? await copy.text() : undefined;
        return { url: request.url, method: request.method, digest, text };
      }));
      return { name, entries };
    })),
  }));
  expect(inventory.build).toBeTruthy();
  expect(inventory.stores.map(({ name }) => name)).toEqual([`pwa-web-os:release:${inventory.build}`]);
  // Compare both keys and exact production bytes, so an asset URL cannot conceal cached note data.
  const entries = inventory.stores[0].entries;
  const metadata = entries.filter(({ url }) => url.endsWith('/.pwa-previous-releases'));
  const assets = entries.filter(({ url }) => !url.endsWith('/.pwa-previous-releases'))
    .map(({ url, method, digest }) => ({ url, method, digest }));
  expect(assets.sort((a, b) => a.url.localeCompare(b.url))).toEqual(expected.sort((a, b) => a.url.localeCompare(b.url)));
  // The retained-release metadata record is allowed, but it must stay small and free of note content.
  expect(metadata.length).toBeLessThanOrEqual(1);
  for (const record of metadata) {
    expect(record.text?.length ?? 0, 'metadata record stays small').toBeLessThan(4096);
    expect(containsNotes(record.text ?? ''), 'metadata record holds no note content').toBe(false);
  }
}
