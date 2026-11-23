import { expect, test, type Page } from '@playwright/test';
import { LIMITS } from '../src/contracts';
import { openIdbFixturePage, readNotesDatabase } from './helpers/idb';
import { createNote, editor, expectDraft, openNotes, saveStatus } from './helpers/notes';

test('Chromium native quota rejection keeps the draft and last revision; Retry commits after space is available', async ({
  page, context, browserName,
}) => {
  test.skip(browserName !== 'chromium', 'UNVERIFIED in Firefox: this native quota fixture uses Chromium CDP.');
  const original = { title: 'Quota sample', body: 'Synthetic text saved before reaching quota. ' };
  const draft = { ...original, body: 'q'.repeat(LIMITS.bodyBytes) };
  await page.goto('./');
  const connection = page.getByRole('region', { name: 'Connection status and backup', exact: true });
  await expect(connection.getByText('Available offline', { exact: true })).toBeVisible();
  const fixture = await openIdbFixturePage(context, page.url());
  const session = await context.newCDPSession(page);
  const origin = new URL(page.url()).origin;
  const quotaSize = 4 * 1024 * 1024;
  let before: Awaited<ReturnType<typeof readNotesDatabase>>;
  try {
    // Set a small actual browser quota before the first IndexedDB write. Chromium
    // can cache available space, so lowering the limit below live usage may not bite.
    await session.send('Storage.overrideQuotaForOrigin', { origin, quotaSize });
    expect(await session.send('Storage.getUsageAndQuota', { origin })).toMatchObject({ overrideActive: true, quota: quotaSize });
    await openNotes(page);
    await createNote(page, original);
    before = await readNotesDatabase(fixture);
    expect(before.notes).toMatchObject([original]);
    await expectNativeQuotaFailure(fixture);

    await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
    await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
    await expect(editor(page).getByText(
      'Device storage is full. Free some browser storage and try again, or copy your draft.', { exact: true },
    )).toBeVisible();
    await expect(editor(page).getByRole('button', { name: 'Copy draft', exact: true })).toBeVisible();
    await expectDraft(page, draft);
    expect(await readNotesDatabase(fixture)).toStrictEqual(before);
  } finally {
    await session.send('Storage.overrideQuotaForOrigin', { origin });
    await session.detach();
  }

  await editor(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(saveStatus(page)).toHaveText('Saved on this device');
  expect(await readNotesDatabase(fixture)).toStrictEqual({
    ...before,
    notes: [{ ...before.notes[0], ...draft, revision: before.notes[0].revision + 1, updatedAt: expect.any(Number) }],
  });
});

async function expectNativeQuotaFailure(fixture: Page): Promise<void> {
  const result = await fixture.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('quota-test-filler', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('blobs');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    let key = 0;
    async function fillUntilAbort(bytes: number, maxWrites: number): Promise<string> {
      const blob = new Blob([new Uint8Array(bytes)]);
      for (let i = 0; i < maxWrites; i++) {
        const outcome = await new Promise<string>((resolve) => {
          const tx = db.transaction('blobs', 'readwrite');
          tx.oncomplete = () => resolve('committed');
          tx.onabort = () => resolve(tx.error?.name ?? 'unexpected abort');
          tx.objectStore('blobs').add(blob, ++key);
        });
        if (outcome !== 'committed') return outcome;
      }
      return 'write budget exhausted';
    }
    try {
      // Use smaller chunks after the first failure so space is too tight for a note update.
      const large = await fillUntilAbort(512 * 1024, 10);
      const small = await fillUntilAbort(4 * 1024, 160);
      return { large, small };
    } finally {
      db.close();
    }
  });
  expect(result).toEqual({ large: 'QuotaExceededError', small: 'QuotaExceededError' });
}
