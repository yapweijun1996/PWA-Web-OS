import { expect, test, type Page } from '@playwright/test';
import { DB_NAME, type Note } from '../src/contracts';
import { createNote, editor, expectDraft, openNote, openNotes, reloadNotes, saveStatus } from './helpers/notes';

// Read-only inspection supplements the UI check: the revision is not exposed by the editor.
async function committedRecords(page: Page): Promise<Note[]> {
  return page.evaluate((name) => new Promise<Note[]>((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => open.transaction!.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('notes', 'readonly');
      const read: IDBRequest<Note[]> = tx.objectStore('notes').getAll();
      tx.oncomplete = () => { db.close(); resolve(read.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), DB_NAME);
}

test('injected abort after native IndexedDB put succeeds rolls back the write and Retry commits the retained draft', async ({
  page, context,
}) => {
  const original = { title: 'Write failure sample', body: 'Last committed synthetic text\n  with whitespace. ' };
  const draft = { ...original, body: 'Synthetic text in the rejected edit.\n  Retry this draft. ' };
  await page.goto('./');
  await openNotes(page);
  await createNote(page, original);
  const before = await committedRecords(page);
  expect(before).toHaveLength(1);
  expect(before[0]).toMatchObject(original);

  const observer = await context.newPage();
  await observer.goto(page.url());
  const fault = await page.evaluateHandle(() => {
    const store = IDBObjectStore.prototype;
    const put = store.put;
    let aborts = 0;
    store.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = put.apply(this, args);
      if (this.name === 'notes') {
        const tx = this.transaction;
        // Inject an abort only after the native request succeeds. This is not quota exhaustion.
        request.addEventListener('success', () => tx.abort(), { once: true });
        tx.addEventListener('abort', () => { aborts++; }, { once: true });
      }
      return request;
    };
    return { abortCount: () => aborts, restore: () => { store.put = put; } };
  });
  try {
    await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
    await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
    expect(await fault.evaluate((injection) => injection.abortCount())).toBe(1);
    await expectDraft(page, draft);

    // Reload a different tab to check the committed record without closing the unsaved editor.
    await reloadNotes(observer);
    await openNote(observer, original);
    expect(await committedRecords(observer)).toStrictEqual(before);
  } finally {
    await fault.evaluate((injection) => injection.restore());
    await fault.dispose();
  }

  await expectDraft(page, draft);
  await editor(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(saveStatus(page)).toHaveText('Saved on this device');
  await reloadNotes(page);
  await openNote(page, draft);
  expect(await committedRecords(page)).toStrictEqual([{
    ...before[0], ...draft, revision: before[0].revision + 1, updatedAt: expect.any(Number),
  }]);
});
