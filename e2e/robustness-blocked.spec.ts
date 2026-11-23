import { expect, test } from '@playwright/test';
import { DB_NAME, DB_VERSION } from '../src/contracts';
import { openIdbFixturePage, readNotesDatabase, upgradeNotesDatabase } from './helpers/idb';
import { createNote, editor, expectDraft, openNotes, saveStatus } from './helpers/notes';

const saveDeadlineMs = 7_000;

test('a native upgrade blocks the next save only for a bounded wait; Retry preserves the draft and commits once', async ({
  page, context, browser,
}, testInfo) => {
  const original = { title: 'Blocked open sample', body: 'Synthetic text committed before the blocked upgrade. ' };
  const draft = { ...original, body: 'Synthetic edit while the open is queued. ' };
  await page.goto('./');
  await openNotes(page);
  await createNote(page, original);

  const tabB = await openIdbFixturePage(context, page.url());
  const before = await readNotesDatabase(tabB);
  expect(before).toMatchObject({ version: DB_VERSION, stores: ['notes'], notes: [original] });
  const blocker = await tabB.evaluateHandle(({ name, version }) => new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(name, version);
    open.onupgradeneeded = () => open.transaction!.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  }), { name: DB_NAME, version: DB_VERSION });
  const pending = await tabB.evaluateHandle(({ db, name, version }) => {
    let blocked = false;
    let notified = false;
    // Observe versionchange but deliberately leave this connection open.
    db.onversionchange = () => { notified = true; };
    const upgrade = indexedDB.open(name, version + 1);
    upgrade.onblocked = () => { blocked = true; };
    const completed = new Promise<string>((resolve) => {
      // Cancel the test upgrade on release so the app can actually retry against v1.
      upgrade.onupgradeneeded = () => upgrade.transaction!.abort();
      upgrade.onerror = () => resolve(upgrade.error!.name);
      upgrade.onsuccess = () => { upgrade.result.close(); resolve('unexpected success'); };
    });
    return { state: () => ({ notified, blocked }), release: () => { db.close(); return completed; } };
  }, { db: blocker, name: DB_NAME, version: DB_VERSION });
  await expect.poll(() => pending.evaluate((request) => request.state())).toEqual({ notified: true, blocked: true });

  const status = saveStatus(page);
  const start = performance.now();
  try {
    await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
    try {
      await expect(status).toHaveText('Save failed. Your changes are not saved.', { timeout: saveDeadlineMs });
    } finally {
      const elapsed = Math.round(performance.now() - start);
      await testInfo.attach('blocked save timing', {
        body: `${testInfo.project.name} ${browser.version()}: ${await status.innerText()} (${elapsed} ms from edit)`,
        contentType: 'text/plain',
      });
    }
    await expect(editor(page).getByText('Close other Notes tabs, then try again.', { exact: true })).toBeVisible();
    await expectDraft(page, draft);
  } finally {
    expect(await pending.evaluate((request) => request.release())).toBe('AbortError');
    await pending.dispose();
    await blocker.dispose();
  }

  // The read queues behind the abandoned open. Its eventual success must not write the draft.
  expect(await readNotesDatabase(tabB)).toStrictEqual(before);
  await expect(status).toHaveText('Save failed. Your changes are not saved.');
  await editor(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(status).toHaveText('Saved on this device');
  await expectDraft(page, draft);

  // An abandoned v1 connection left open without a versionchange handler would block this upgrade.
  expect(await upgradeNotesDatabase(tabB)).toBe(DB_VERSION + 1);
  expect(await readNotesDatabase(tabB)).toStrictEqual({
    ...before,
    version: DB_VERSION + 1,
    notes: [{ ...before.notes[0], ...draft, revision: before.notes[0].revision + 1, updatedAt: expect.any(Number) }],
  });
});
