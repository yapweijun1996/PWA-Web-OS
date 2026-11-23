import { readFileSync } from 'node:fs';
import { IDBDatabase as FakeDatabase, IDBFactory as FakeFactory, IDBObjectStore as FakeStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, LIMITS, type BackupErrorCode, type Note } from '../contracts';
import { createStorage } from './index';

const encoder = new TextEncoder();
const sample = { title: 'Existing', body: 'Text with trailing space ' };

function record(n: number, title = `Sample ${n}`, body = '', updatedAt = 1_000) {
  return { id: `7b1ec150-0afe-4bad-95ac-${n.toString(16).padStart(12, '0')}`, title, body, updatedAt };
}

function file(notes: unknown) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, notes };
}

function json(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function backupBytes(...notes: ReturnType<typeof record>[]): Uint8Array {
  return json(file(notes));
}

function backupRecord({ id, title, body, updatedAt }: Note) {
  return { id, title, body, updatedAt };
}

beforeEach(() => vi.stubGlobal('indexedDB', new FakeFactory()));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// fake-indexeddb simulates the engine; real-browser IndexedDB behavior is unverified here.
describe('Notes backup (simulated IndexedDB)', () => {
  it('exports one readonly snapshot in ascending ID order as compact JSON with updatedAt and no revisions', async () => {
    const { backup, repository } = createStorage({ now: () => 3_000 });
    const first = record(1, 'Zulu', 'Line 1\nLine 2', 2_000);
    const second = record(2, 'Alpha', '', 4_000);
    await backup.commitImport(await backup.previewImport(backupBytes(second, first)));
    await repository.update(first.id, 1, first);
    const transaction = vi.spyOn(FakeDatabase.prototype, 'transaction');
    expect(await backup.exportBackup()).toBe(
      `{"format":"pwa-web-os.notes","version":1,"notes":[{"id":"${first.id}","title":"Zulu","body":"Line 1\\nLine 2","updatedAt":3000},`
      + `{"id":"${second.id}","title":"Alpha","body":"","updatedAt":4000}]}`,
    );
    expect(transaction).toHaveBeenCalledExactlyOnceWith('notes', 'readonly');
  });

  it('imports the valid example file and preserves its updatedAt at revision 1', async () => {
    const { backup, repository } = createStorage();
    const bytes = readFileSync(new URL('./examples/valid-backup.json', import.meta.url));
    const preview = await backup.previewImport(bytes);
    expect(preview).toMatchObject({ titles: ['Sample note'], newCount: 1, unchangedCount: 0 });
    expect(await backup.commitImport(preview)).toEqual({ inserted: 1, unchanged: 0 });
    expect(await repository.list()).toEqual([
      { ...record(1, 'Sample note', 'Synthetic note body', 1_700_000_000_000), revision: 1 },
    ]);
  });

  const invalidFiles = [
    ['malformed JSON', 'invalid_file', () => encoder.encode('{"format":')],
    ['invalid UTF-8 inside otherwise valid JSON', 'invalid_file', () => {
      const bytes = backupBytes(record(1, '*'));
      bytes[bytes.indexOf(0x2a)] = 0x80;
      return bytes;
    }],
    ['oversize before parsing', 'too_large', () => new Uint8Array(LIMITS.backupFileBytes + 1)],
    ['an unknown top-level field', 'invalid_file', () => json({ ...file([]), extra: true })],
    ['an unknown note field', 'invalid_file', () => json(file([{ ...record(1), revision: 1 }]))],
    ['a missing body', 'invalid_file', () => json(file([{ ...record(1), body: undefined }]))],
    ['missing updatedAt', 'invalid_file', () => json(file([{ ...record(1), updatedAt: undefined }]))],
    ['fractional updatedAt', 'invalid_file', () => backupBytes({ ...record(1), updatedAt: 1.5 })],
    ['negative updatedAt in the invalid example file', 'invalid_file', () => readFileSync(
      new URL('./examples/invalid-backup.json', import.meta.url),
    )],
    ['unsafe updatedAt', 'invalid_file', () => backupBytes({ ...record(1), updatedAt: Number.MAX_SAFE_INTEGER + 1 })],
    ['string updatedAt', 'invalid_file', () => json(file([{ ...record(1), updatedAt: '1000' }]))],
    ['null updatedAt', 'invalid_file', () => json(file([{ ...record(1), updatedAt: null }]))],
    ['a non-array notes member', 'invalid_file', () => json(file({}))],
    ['a non-string title', 'invalid_file', () => json(file([{ ...record(1), title: 1 }]))],
    ['the wrong format', 'unsupported_version', () => json({ ...file([]), format: 'other.notes' })],
    ['version 2', 'unsupported_version', () => json({ ...file([]), version: 2 })],
    ['an invalid ID', 'invalid_file', () => backupBytes({ ...record(1), id: 'invalid-id' })],
    ['an uppercase UUID', 'invalid_file', () => backupBytes({ ...record(1), id: record(1).id.toUpperCase() })],
    ['a non-v4 UUID', 'invalid_file', () => backupBytes({ ...record(1), id: record(1).id.replace('-4bad-', '-1bad-') })],
    ['an invalid UUID variant', 'invalid_file', () => backupBytes({ ...record(1), id: record(1).id.replace('-95ac-', '-75ac-') })],
    ['identical duplicate IDs', 'duplicate_ids', () => backupBytes(record(1), record(1))],
    ['one too many notes', 'limit_exceeded', () => backupBytes(
      ...Array.from({ length: LIMITS.backupNotes + 1 }, (_, i) => record(i)),
    )],
    ['a title one UTF-8 byte too long', 'limit_exceeded', () => backupBytes(record(1, `${'é'.repeat(LIMITS.titleBytes / 2)}a`))],
    ['a body one UTF-8 byte too long', 'limit_exceeded', () => backupBytes(record(1, '', `${'😀'.repeat(LIMITS.bodyBytes / 4)}a`))],
    ['an escaped unpaired surrogate', 'invalid_file', () => backupBytes(record(1, '', '\uD800'))],
    ['a same-ID conflict even when only whitespace differs', 'conflict', (saved: Note) => backupBytes(
      record(1), { ...backupRecord(saved), body: saved.body.trim() },
    )],
    ['a same-ID conflict when only the title differs', 'conflict', (saved: Note) => backupBytes(
      { ...backupRecord(saved), title: 'Different title' },
    )],
  ] satisfies ReadonlyArray<readonly [string, BackupErrorCode, (saved: Note) => Uint8Array]>;

  it.each(invalidFiles)('rejects %s in preview (%s) and leaves the database unchanged', async (_label, code, input) => {
    const { backup, repository } = createStorage();
    const saved = await repository.create(sample);
    await expect(backup.previewImport(input(saved))).rejects.toMatchObject({ name: 'BackupError', code });
    expect(await repository.list()).toEqual([saved]);
  });

  it('accepts a file exactly at the byte limit with text exactly at both UTF-8 limits, without writing', async () => {
    const { backup, repository } = createStorage();
    const note = record(1, 'é'.repeat(LIMITS.titleBytes / 2), '😀'.repeat(LIMITS.bodyBytes / 4));
    const padded = new Uint8Array(LIMITS.backupFileBytes).fill(0x20);
    padded.set(backupBytes(note));
    expect(await backup.previewImport(padded)).toMatchObject({ titles: [note.title], newCount: 1, unchangedCount: 0 });
    expect(await repository.list()).toEqual([]);
  });

  it('preserves the supported updatedAt boundaries for newly imported notes', async () => {
    const { backup, repository } = createStorage();
    const oldest = record(1, 'Epoch', '', 0);
    const newest = record(2, 'Maximum safe integer', '', Number.MAX_SAFE_INTEGER);
    const preview = await backup.previewImport(backupBytes(oldest, newest));
    expect(await backup.commitImport(preview)).toEqual({ inserted: 2, unchanged: 0 });
    expect(await repository.list()).toEqual([
      { ...newest, revision: 1 }, { ...oldest, revision: 1 },
    ]);
  });

  it('previews without writing and commits idempotently, ignoring updatedAt for identical content', async () => {
    const { backup, repository } = createStorage({ now: () => 2_000 });
    const original = await repository.create(sample);
    const saved = await repository.update(original.id, 1, sample);
    const fresh = record(1);
    const bytes = backupBytes(fresh, { ...backupRecord(saved), updatedAt: 3_000 });
    const transaction = vi.spyOn(FakeDatabase.prototype, 'transaction');
    const preview = await backup.previewImport(bytes);
    expect(transaction).toHaveBeenCalledExactlyOnceWith('notes', 'readonly');
    expect(preview).toMatchObject({ titles: [fresh.title, saved.title], newCount: 1, unchangedCount: 1 });
    expect(await repository.list()).toEqual([saved]);

    transaction.mockClear();
    preview.titles[0] = 'Changed display label';
    expect(await backup.commitImport(preview)).toEqual({ inserted: 1, unchanged: 1 });
    expect(transaction).toHaveBeenCalledExactlyOnceWith('notes', 'readwrite');
    expect(await repository.get(fresh.id)).toEqual({ ...fresh, revision: 1 });
    expect(await repository.get(saved.id)).toEqual(saved);
    const secondPreview = await backup.previewImport(bytes);
    expect(secondPreview).toMatchObject({ newCount: 0, unchangedCount: 2 });
    expect(await backup.commitImport(secondPreview)).toEqual({ inserted: 0, unchanged: 2 });
    expect(await repository.list()).toEqual([saved, { ...fresh, revision: 1 }]);
  });

  it('rejects an unvalidated preview token without writing', async () => {
    const { backup, repository } = createStorage();
    const preview = { titles: ['Synthetic title'], newCount: 1, unchangedCount: 0, token: [record(1)] };
    await expect(backup.commitImport(preview)).rejects.toMatchObject({ code: 'invalid_file' });
    expect(await repository.list()).toEqual([]);
  });

  it('rechecks after preview and rejects the whole batch if a second connection introduces a conflict', async () => {
    const { backup, repository } = createStorage();
    const other = createStorage().backup;
    const original = await repository.create(sample);
    const fresh = record(1);
    const collision = record(2);
    const preview = await backup.previewImport(backupBytes(fresh, collision));
    expect(preview.newCount).toBe(2);

    const committedBetween = { ...collision, body: 'A different body' };
    await other.commitImport(await other.previewImport(backupBytes(committedBetween)));
    const before = await repository.list();
    await expect(backup.commitImport(preview)).rejects.toMatchObject({ name: 'BackupError', code: 'conflict' });
    expect(await repository.list()).toEqual(before);
    expect(await repository.get(original.id)).toEqual(original);
    expect(await repository.get(fresh.id)).toBeUndefined();
  });

  it('rechecks the projected database count at commit and allows exactly the limit without counting identical notes twice', async () => {
    const { backup, repository } = createStorage();
    const existing = Array.from({ length: LIMITS.databaseNotes - 1 }, (_, i) => record(i));
    const first = record(LIMITS.databaseNotes);
    const second = record(LIMITS.databaseNotes + 1);
    const preview = await backup.previewImport(backupBytes(first, second));
    await backup.commitImport(await backup.previewImport(backupBytes(...existing)));
    const before = await repository.list();
    await expect(backup.commitImport(preview)).rejects.toMatchObject({ code: 'limit_exceeded' });
    expect(await repository.list()).toEqual(before);
    expect(await repository.get(first.id)).toBeUndefined();
    expect(await repository.get(second.id)).toBeUndefined();

    const fullSize = await backup.previewImport(backupBytes(...existing, first));
    expect(fullSize.titles).toHaveLength(LIMITS.backupNotes);
    expect(await backup.commitImport(fullSize)).toEqual({ inserted: 1, unchanged: existing.length });
    expect(await repository.list()).toHaveLength(LIMITS.databaseNotes);
  });

  it('rolls back a successful first add when a later request fails in the same transaction', async () => {
    const { backup, repository } = createStorage();
    const saved = await repository.create(sample);
    const first = record(1);
    const preview = await backup.previewImport(backupBytes(first, record(2)));
    const add = FakeStore.prototype.add;
    let firstSucceeded = false;
    vi.spyOn(FakeStore.prototype, 'add')
      .mockImplementationOnce(function (this: IDBObjectStore, value) {
        const request = add.call(this, value);
        request.addEventListener('success', () => { firstSucceeded = true; });
        return request;
      })
      .mockImplementationOnce(function (this: IDBObjectStore) {
        // Use real simulated add() with an existing key to trigger an asynchronous request error.
        return add.call(this, saved);
      });
    await expect(backup.commitImport(preview)).rejects.toMatchObject({ name: 'BackupError', code: 'write_failed' });
    expect(firstSucceeded).toBe(true);
    expect(await repository.list()).toEqual([saved]);
  });

  it('reports write_failed and keeps notes intact if a queued batch hits an injected quota failure', async () => {
    const { backup, repository } = createStorage();
    const saved = await repository.create(sample);
    const preview = await backup.previewImport(backupBytes(record(1), record(2)));
    const add = FakeStore.prototype.add;
    vi.spyOn(FakeStore.prototype, 'add')
      .mockImplementationOnce(add)
      .mockImplementationOnce(() => { throw new DOMException('Injected quota failure', 'QuotaExceededError'); });
    await expect(backup.commitImport(preview)).rejects.toMatchObject({ name: 'BackupError', code: 'write_failed' });
    expect(await repository.list()).toEqual([saved]);
  });

  it('reports a BackupError instead of leaking an IndexedDB open error from preview', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(createStorage().backup.previewImport(backupBytes(record(1))))
      .rejects.toMatchObject({ name: 'BackupError', code: 'write_failed' });
  });
});
