import {
  IDBDatabase as FakeDatabase,
  IDBFactory as FakeFactory,
  IDBObjectStore as FakeStore,
  IDBVersionChangeEvent as FakeVersionChangeEvent,
} from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, DB_VERSION, LIMITS } from '../contracts';
import { createStorage } from './index';

const FIXED_ID = '7b1ec150-0afe-4bad-95ac-0e222d94fe98';
const draft = { title: 'Sample', body: 'Synthetic note' };

function openRaw(version: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database open was blocked.'));
  });
}

beforeEach(() => vi.stubGlobal('indexedDB', new FakeFactory()));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// fake-indexeddb simulates the engine; real-browser IndexedDB behavior is unverified here.
describe('Notes repository (simulated IndexedDB)', () => {
  it('sets updatedAt with the repository clock on create and update, ignoring extra draft fields', async () => {
    let time = 1_000;
    const now = () => time;
    const { repository } = createStorage({ now });
    const extraFields = { ...draft, id: FIXED_ID, revision: 23, updatedAt: 9_999, extra: 'ignored' };
    const created = await repository.create(extraFields);
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(created).toEqual({ ...draft, id: created.id, revision: 1, updatedAt: 1_000 });
    const reopened = createStorage({ now }).repository;
    expect(await reopened.get(created.id)).toEqual(created);
    expect(await repository.list()).toEqual([created]);

    time = 2_000;
    const updated = await repository.update(created.id, 1, { ...extraFields, body: '' });
    expect(updated).toEqual({ ...created, body: '', revision: 2, updatedAt: 2_000 });
    expect(await reopened.get(created.id)).toEqual(updated);

    time = 3_000;
    expect(await reopened.update(created.id, 2, { ...draft, body: '' }))
      .toEqual({ ...updated, revision: 3, updatedAt: 3_000 });
    expect(await repository.get(FIXED_ID)).toBeUndefined();
    await expect(repository.update(FIXED_ID, 1, draft)).rejects.toMatchObject({ name: 'StorageError', code: 'not_found' });
  });

  it('leaves the committed record and updatedAt intact on a UUID collision or stale update', async () => {
    // Fix only the generated UUID to trigger a genuine simulated add constraint failure.
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_ID);
    let time = 1_000;
    const { repository } = createStorage({ now: () => time });
    const first = await repository.create(draft);
    time = 2_000;
    await expect(repository.create({ ...draft, title: 'Collision' })).rejects.toMatchObject({ code: 'conflict' });
    expect(await repository.get(first.id)).toEqual(first);

    const next = await repository.update(first.id, 1, { ...draft, body: 'Revision 2' });
    expect(next.updatedAt).toBe(2_000);
    time = 3_000;
    await expect(repository.update(first.id, 1, draft)).rejects.toMatchObject({ code: 'conflict' });
    expect(await repository.list()).toEqual([next]);
  });

  it('does not write when the injected clock returns an invalid timestamp', async () => {
    let time = -1;
    const { repository } = createStorage({ now: () => time });
    await expect(repository.create(draft)).rejects.toMatchObject({ code: 'invalid' });
    expect(await repository.list()).toEqual([]);

    time = 1_000;
    const saved = await repository.create(draft);
    time = Number.NaN;
    await expect(repository.update(saved.id, 1, draft)).rejects.toMatchObject({ code: 'invalid' });
    expect(await repository.get(saved.id)).toEqual(saved);
  });

  it('allows only one of two concurrent updates at the same revision on distinct connections', async () => {
    const open = vi.spyOn(indexedDB, 'open');
    const first = createStorage().repository;
    const second = createStorage().repository;
    const note = await first.create(draft);
    expect(await second.get(note.id)).toEqual(note);
    expect(open).toHaveBeenCalledTimes(2);

    const outcomes = await Promise.allSettled([
      first.update(note.id, 1, { ...draft, body: 'First edit' }),
      second.update(note.id, 1, { ...draft, body: 'Second edit' }),
    ]);
    const wins = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const losses = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0].reason).toMatchObject({ code: 'conflict' });
    expect(wins[0].value.revision).toBe(2);
    expect(await second.get(note.id)).toEqual(wins[0].value);
  });

  it('lists by descending updatedAt, breaks ties by ascending ID, and moves an edited note to the front', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('7b1ec150-0afe-4bad-95ac-000000000001')
      .mockReturnValueOnce('7b1ec150-0afe-4bad-95ac-000000000003')
      .mockReturnValueOnce('7b1ec150-0afe-4bad-95ac-000000000002');
    let time = 1_000;
    const { repository } = createStorage({ now: () => time });
    const older = await repository.create({ ...draft, title: 'Beta' });
    time = 2_000;
    const largerId = await repository.create({ ...draft, title: 'Alpha' });
    const smallerId = await repository.create({ ...draft, title: 'Zulu' });
    expect(await repository.list()).toEqual([smallerId, largerId, older]);

    time = 3_000;
    const edited = await repository.update(older.id, 1, { ...draft, title: older.title, body: 'Edited' });
    expect(await repository.list()).toEqual([edited, smallerId, largerId]);
  });

  it.each([
    ['title', 'é'.repeat(LIMITS.titleBytes / 2)],
    ['body', '😀'.repeat(LIMITS.bodyBytes / 4)],
  ] as const)('accepts exactly the UTF-8 byte limit for %s on create and update, and rejects one byte over', async (field, text) => {
    const { repository } = createStorage();
    const atLimit = { ...draft, [field]: text };
    const over = { ...draft, [field]: `${text}a` };
    const created = await repository.create(atLimit);
    expect(created[field]).toBe(text);
    await expect(repository.create(over)).rejects.toMatchObject({ code: 'limit_exceeded' });
    const updated = await repository.update(created.id, 1, atLimit);
    expect(updated).toMatchObject({ ...atLimit, id: created.id, revision: 2 });
    await expect(repository.update(created.id, 2, over)).rejects.toMatchObject({ code: 'limit_exceeded' });
    expect(await repository.list()).toEqual([updated]);
  });

  it('allows exactly one create for the last database slot across two connections', async () => {
    const first = createStorage().repository;
    const second = createStorage().repository;
    await Promise.all(Array.from({ length: LIMITS.databaseNotes - 1 }, () => first.create(draft)));
    expect(await second.list()).toHaveLength(LIMITS.databaseNotes - 1);

    const outcomes = await Promise.allSettled([first.create(draft), second.create(draft)]);
    const created = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'limit_exceeded' });
    expect(await first.list()).toHaveLength(LIMITS.databaseNotes);
    expect((await first.update(created[0].value.id, 1, draft)).revision).toBe(2);
  });

  it('rejects unpaired high or low surrogates without writing', async () => {
    const { repository } = createStorage();
    const saved = await repository.create(draft);
    await expect(repository.create({ ...draft, title: '\uD800' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repository.update(saved.id, 1, { ...draft, body: '\uDC00' })).rejects.toMatchObject({ code: 'invalid' });
    expect(await repository.list()).toEqual([saved]);
  });

  it('refuses to increment past the largest safe integer', async () => {
    const { repository } = createStorage();
    const seeded = { ...await repository.create(draft), revision: Number.MAX_SAFE_INTEGER };
    const db = await openRaw(DB_VERSION);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('notes', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.objectStore('notes').put(seeded);
      });
    } finally {
      db.close();
    }
    await expect(repository.update(seeded.id, seeded.revision, { ...draft, body: 'Overflow' }))
      .rejects.toMatchObject({ name: 'StorageError', code: 'invalid' });
    expect(await repository.get(seeded.id)).toEqual(seeded);
  });

  it('rejects and rolls back an injected abort after the put request succeeds', async () => {
    let time = 1_000;
    const { repository } = createStorage({ now: () => time });
    const saved = await repository.create(draft);
    time = 2_000;
    const put = FakeStore.prototype.put;
    let requestSucceeded = false;
    vi.spyOn(FakeStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore, value) {
      const request = put.call(this, value);
      request.addEventListener('success', () => {
        requestSucceeded = true;
        this.transaction.abort();
      });
      return request;
    });
    await expect(repository.update(saved.id, 1, { ...draft, body: 'Aborted edit' }))
      .rejects.toMatchObject({ name: 'StorageError', code: 'unknown' });
    expect(requestSucceeded).toBe(true);
    expect(await repository.get(saved.id)).toEqual(saved);
  });

  it('maps an injected QuotaExceededError to quota without losing the last commit', async () => {
    const { repository } = createStorage();
    const saved = await repository.create(draft);
    // This injects the platform error; it does not measure or exhaust browser quota.
    vi.spyOn(FakeStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Injected quota failure', 'QuotaExceededError');
    });
    await expect(repository.update(saved.id, 1, { ...draft, body: 'Rejected edit' }))
      .rejects.toMatchObject({ code: 'quota' });
    expect(await repository.get(saved.id)).toEqual(saved);
  });
});

describe('Notes schema lifecycle (simulated IndexedDB)', () => {
  it('upgrades an empty origin to version 1 with only the keyed notes store', async () => {
    const { repository } = createStorage();
    expect(await indexedDB.databases()).toEqual([]);
    expect(await repository.list()).toEqual([]);
    expect(await indexedDB.databases()).toEqual([{ name: DB_NAME, version: 1 }]);

    const db = await openRaw(DB_VERSION);
    try {
      expect(Array.from(db.objectStoreNames)).toEqual(['notes']);
      const store = db.transaction('notes').objectStore('notes');
      expect(store.keyPath).toBe('id');
      expect(store.autoIncrement).toBe(false);
      expect(Array.from(store.indexNames)).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('leaves a newer schema and its added store untouched and closes the old connection on versionchange', async () => {
    const { repository } = createStorage();
    const saved = await repository.create(draft);
    // This upgrade would be blocked if the v1 connection did not close.
    const future = await openRaw(DB_VERSION + 1, (db) => db.createObjectStore('future'));
    try {
      await expect(repository.get(saved.id)).rejects.toMatchObject({ code: 'incompatible_schema' });
      await expect(createStorage().repository.create(draft)).rejects.toMatchObject({ code: 'incompatible_schema' });
      expect(await indexedDB.databases()).toEqual([{ name: DB_NAME, version: DB_VERSION + 1 }]);
      expect(Array.from(future.objectStoreNames)).toEqual(['future', 'notes']);
      const records = await new Promise<unknown>((resolve, reject) => {
        const request = future.transaction('notes').objectStore('notes').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(records).toEqual([saved]);
    } finally {
      future.close();
    }
  });

  it('reports an interrupted first migration and retries on the same storage instance', async () => {
    const createStore = FakeDatabase.prototype.createObjectStore;
    vi.spyOn(FakeDatabase.prototype, 'createObjectStore').mockImplementationOnce(function (this: IDBDatabase, ...args) {
      const store = createStore.apply(this, args);
      store.transaction.abort();
      return store;
    });
    const { repository } = createStorage();
    await expect(repository.list()).rejects.toMatchObject({ code: 'unavailable' });
    expect(await repository.list()).toEqual([]);
    expect(await indexedDB.databases()).toEqual([{ name: DB_NAME, version: DB_VERSION }]);
  });

  it('reports an injected blocked-open event, then retries without running the abandoned migration', async () => {
    // New databases have no older connection at v0, so inject the event on a real simulated open request.
    const open = indexedDB.open;
    const createStore = vi.spyOn(FakeDatabase.prototype, 'createObjectStore');
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(function (this: IDBFactory, ...args) {
      const request = open.apply(this, args);
      queueMicrotask(() => request.dispatchEvent(new FakeVersionChangeEvent('blocked')));
      return request;
    });
    const { repository } = createStorage();
    await expect(repository.list()).rejects.toMatchObject({ code: 'blocked' });
    expect(await repository.list()).toEqual([]);
    expect(createStore).toHaveBeenCalledTimes(1);
  });
});
