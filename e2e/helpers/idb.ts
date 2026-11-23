import type { BrowserContext, Page } from '@playwright/test';
import { DB_NAME, DB_VERSION, type Note } from '../../src/contracts';

export async function openIdbFixturePage(context: BrowserContext, appUrl: string): Promise<Page> {
  const page = await context.newPage();
  // Same origin, outside the app's service worker scope. No app code or storage APIs are mocked.
  const url = new URL('/__idb-fixture__', appUrl).href;
  await page.route(url, (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>IndexedDB fixture</title>',
  }));
  await page.goto(url);
  return page;
}

export async function readNotesDatabase(page: Page): Promise<{ version: number; stores: string[]; notes: Note[] }> {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    // No version argument: inspect the current schema without creating or migrating it.
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => open.transaction!.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const version = db.version;
      const stores = Array.from(db.objectStoreNames);
      if (!stores.includes('notes')) {
        db.close();
        reject(new Error('The notes store is missing.'));
        return;
      }
      const tx = db.transaction('notes', 'readonly');
      const read: IDBRequest<Note[]> = tx.objectStore('notes').getAll();
      tx.oncomplete = () => { db.close(); resolve({ version, stores, notes: read.result }); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), DB_NAME);
}

export async function upgradeNotesDatabase(page: Page): Promise<number> {
  return page.evaluate(({ name, version }) => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open(name, version + 1);
    open.onupgradeneeded = (event) => {
      if (event.oldVersion !== version) open.transaction!.abort();
    };
    open.onblocked = () => reject(new Error('The upgrade is blocked by an open connection.'));
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      db.close();
      resolve(db.version);
    };
  }), { name: DB_NAME, version: DB_VERSION });
}
