import type { Page } from '@playwright/test';
import { DB_NAME } from '../src/contracts.ts';

/** Real readwrite transaction blocks later Notes writes until the test releases it. */
export async function holdNoteWrites(page: Page): Promise<() => Promise<void>> {
  const event = 'release-notes-write-lock';
  await page.evaluate(({ name, event }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('notes', 'readwrite');
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); reject(tx.error); };
      const store = tx.objectStore('notes');
      let held = true;
      window.addEventListener(event, () => { held = false; }, { once: true });
      // Keep the browser transaction alive without changing or reading any note content.
      const keepOpen = () => {
        store.count().onsuccess = () => {
          if (held) keepOpen();
          resolve();
        };
      };
      keepOpen();
    };
  }), { name: DB_NAME, event });
  return () => page.evaluate((event) => { window.dispatchEvent(new Event(event)); }, event);
}

/** Abort actual IDB writes in this page only; the app still uses its real save path. */
export async function failNoteWrites(page: Page): Promise<{ attempts(): Promise<number>; restore(): Promise<void> }> {
  const handle = await page.evaluateHandle(() => {
    const nativePut = IDBObjectStore.prototype.put;
    let attempts = 0;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof nativePut>) {
      if (this.name !== 'notes') return nativePut.apply(this, args);
      attempts++;
      // The real storage adapter handles the throw by aborting the transaction.
      throw new DOMException('Synthetic IndexedDB write failure', 'AbortError');
    };
    return { attempts: () => attempts, restore: () => { IDBObjectStore.prototype.put = nativePut; } };
  });
  return {
    attempts: () => handle.evaluate((fault) => fault.attempts()),
    async restore() {
      await handle.evaluate((fault) => fault.restore());
      await handle.dispose();
    },
  };
}
