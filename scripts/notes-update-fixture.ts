import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { test, type Page } from '@playwright/test';
import { DB_NAME, type Note } from '../src/contracts';
import { serveReleases } from './pwa-test-server';

const exec = promisify(execFile);
const releaseA = 'notes-update-a';
const releaseB = 'notes-update-b';

export const updateTest = test.extend<{ releases: {
  url: string;
  a: string;
  b: string;
  distB: string;
  deployA(): void;
  deployB(): void;
} }>({
  releases: async ({}, use, testInfo) => {
    const distA = testInfo.outputPath('dist-a');
    const distB = testInfo.outputPath('dist-b');
    const build = (outDir: string, id: string) => exec(process.execPath, [
      resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir,
    ], { env: { ...process.env, BUILD_ID: id } });
    await Promise.all([build(distA, releaseA), build(distB, releaseB)]);
    const server = await serveReleases(distA);
    try {
      await use({ url: server.url, a: releaseA, b: releaseB, distB, deployA: () => server.deploy(distA), deployB: () => server.deploy(distB) });
    } finally {
      await server.close();
    }
  },
});

/** Read real committed records, without creating or altering the Notes schema. */
export function committedNotes(page: Page): Promise<Note[]> {
  return page.evaluate((name) => new Promise<Note[]>((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('notes', 'readonly');
      const request = tx.objectStore('notes').getAll();
      tx.oncomplete = () => { db.close(); resolve(request.result as Note[]); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), DB_NAME);
}

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

/** Hold one tab just before its reload check. Real worker messages resume unchanged. */
export async function holdPeerReload(page: Page): Promise<{ switched(): Promise<boolean>; release(): Promise<void> }> {
  const handle = await page.evaluateHandle(() => {
    const original = navigator.serviceWorker.controller;
    const nativePost = ServiceWorker.prototype.postMessage;
    const queued: (() => void)[] = [];
    const switched = () => navigator.serviceWorker.controller !== null && navigator.serviceWorker.controller !== original;
    ServiceWorker.prototype.postMessage = function (message: unknown, ...options: unknown[]) {
      const send = () => Reflect.apply(nativePost, this, [message, ...options]);
      if (switched() && this === navigator.serviceWorker.controller
          && (message as { type?: string } | null)?.type === 'inspect') queued.push(send);
      else send();
    };
    return {
      switched,
      release() {
        ServiceWorker.prototype.postMessage = nativePost;
        queued.splice(0).forEach((send) => send());
      },
    };
  });
  return {
    switched: () => handle.evaluate((gate) => gate.switched()),
    async release() {
      await handle.evaluate((gate) => gate.release());
      await handle.dispose();
    },
  };
}
