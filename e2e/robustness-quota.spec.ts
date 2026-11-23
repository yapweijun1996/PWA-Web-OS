import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { LIMITS } from '../src/contracts';
import { openIdbFixturePage, readNotesDatabase } from './helpers/idb';
import { createNote, editor, expectDraft, openNotes, saveStatus } from './helpers/notes';

const quotaKiB = 4 * 1024;
const fillerName = 'quota-test-filler';
const cacheName = 'quota-test-pressure';
test.use({ launchOptions: { firefoxUserPrefs: { 'dom.quotaManager.temporaryStorage.fixedLimit': quotaKiB } } });

test('native quota rejection keeps the draft and last revision; Retry commits after space is available', async ({
  page, context, browserName,
}) => {
  test.skip(browserName === 'webkit', 'This fixture sets a small quota in Firefox and Chromium.');
  const original = { title: 'Quota sample', body: 'Synthetic text saved before reaching quota. ' };
  // Firefox compresses IndexedDB records. Use a draft that still needs space
  // after compression, so an existing database page cannot absorb the edit.
  const draft = { ...original, body: randomBytes(LIMITS.bodyBytes).toString('base64').slice(0, LIMITS.bodyBytes) };
  await page.goto('./');
  const connection = page.locator('.connection');
  await expect(connection.getByText('Available offline', { exact: true })).toBeVisible();
  const fixture = await openIdbFixturePage(context, page.url());
  const session = browserName === 'chromium' ? await context.newCDPSession(page) : undefined;
  const origin = new URL(page.url()).origin;
  const quotaSize = quotaKiB * 1024;
  try {
    // Set a small actual browser quota before the first IndexedDB write. Chromium
    // can cache available space, so lowering the limit below live usage may not bite.
    if (session) {
      await session.send('Storage.overrideQuotaForOrigin', { origin, quotaSize });
      expect(await session.send('Storage.getUsageAndQuota', { origin })).toMatchObject({ overrideActive: true, quota: quotaSize });
    } else {
      expect(await fixture.evaluate(() => navigator.storage.estimate())).toMatchObject({ quota: quotaSize });
    }
    await openNotes(page);
    await createNote(page, original);
    const before = await readNotesDatabase(fixture);
    expect(before.notes).toMatchObject([original]);
    await expectIndexedDbQuotaFailure(fixture, browserName === 'firefox');
    if (browserName === 'firefox') await fillFirefoxCache(fixture);

    await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
    await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
    await expect(editor(page).getByText(
      'Device storage is full. Free some browser storage and try again, or copy your draft.', { exact: true },
    )).toBeVisible();
    await expect(editor(page).getByRole('button', { name: 'Copy draft', exact: true })).toBeVisible();
    await expectDraft(page, draft);
    expect(await readNotesDatabase(fixture)).toStrictEqual(before);
    // Leave the small quota in place to prove Retry works after storage is freed.
    await fixture.evaluate(name => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }), fillerName);
    if (browserName === 'firefox') {
      // Free IndexedDB space first. Cache deletion itself can need space.
      expect(await fixture.evaluate(name => caches.delete(name), cacheName)).toBe(true);
      await expect.poll(async () => {
        const { usage } = await fixture.evaluate(() => navigator.storage.estimate());
        return usage ?? quotaSize;
      }).toBeLessThan(quotaSize / 2);
    }

    await editor(page).getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Saved on this device');
    expect(await readNotesDatabase(fixture)).toStrictEqual({
      ...before,
      notes: [{ ...before.notes[0], ...draft, revision: before.notes[0].revision + 1, updatedAt: expect.any(Number) }],
    });
  } finally {
    if (session) {
      try { await session.send('Storage.overrideQuotaForOrigin', { origin }); }
      finally { await session.detach(); }
    }
  }
});

async function expectIndexedDbQuotaFailure(fixture: Page, isFirefox: boolean): Promise<void> {
  const outcomes = await fixture.evaluate(async ({ name, isFirefox }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('blobs');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    let key = 0;
    async function fillUntilAbort(bytes: number, maxWrites: number): Promise<string> {
      const data = new Uint8Array(bytes);
      for (let i = 0; i < maxWrites; i++) {
        const outcome = await new Promise<string>((resolve) => {
          const tx = db.transaction('blobs', 'readwrite');
          tx.oncomplete = () => resolve('committed');
          tx.onabort = () => resolve(tx.error?.name ?? 'unexpected abort');
          // A fresh Blob prevents reusing the backing file in Firefox.
          tx.objectStore('blobs').add(new Blob([data]), ++key);
        });
        if (outcome !== 'committed') return outcome;
      }
      return 'write budget exhausted';
    }
    try {
      if (isFirefox) {
        // Approach the limit before the write that can block this connection.
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        const count = Math.max(0, Math.min(10, Math.floor((quota - usage - 128 * 1024) / (512 * 1024))));
        const large = await fillUntilAbort(512 * 1024, count);
        return [large === 'write budget exhausted' ? await fillUntilAbort(4 * 1024, 180) : large];
      }
      // Use smaller chunks after the first failure so space is too tight for a note update.
      const large = await fillUntilAbort(512 * 1024, 10);
      const small = await fillUntilAbort(4 * 1024, 160);
      return [large, small];
    } finally {
      db.close();
    }
  }, { name: fillerName, isFirefox });
  expect(outcomes).toEqual(isFirefox ? ['QuotaExceededError'] : ['QuotaExceededError', 'QuotaExceededError']);
}

async function fillFirefoxCache(fixture: Page): Promise<void> {
  const result = await fixture.evaluate(async (name) => {
    // IndexedDB can reject growth while the origin still has space for a note.
    // Use small cache entries to consume the remaining shared quota.
    const cache = await caches.open(name);
    const data = new Uint8Array(4 * 1024);
    for (let key = 0; key < 180; key++) {
      try {
        await cache.put('/__quota-pressure__/' + key, new Response(data));
      } catch (error) {
        const { quota = 0, usage = 0 } = await navigator.storage.estimate();
        return { failure: String(error), bytesLeft: quota - usage };
      }
    }
    throw new Error('Firefox quota fixture exhausted its write budget');
  }, cacheName);
  expect(result.failure).toMatch(/NS_ERROR_FILE_NO_DEVICE_SPACE|QuotaExceededError/);
  expect(result.bytesLeft).toBeLessThanOrEqual(8 * 1024);
}
