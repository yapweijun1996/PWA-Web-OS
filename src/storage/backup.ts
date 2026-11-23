import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  LIMITS,
  BackupError,
  type BackupService,
  type Note,
} from '../contracts';
import type { RunNotesTransaction } from './database';
import { draftError } from './text';
import { isNoteTimestamp } from './timestamp';

type BackupNote = Pick<Note, 'id' | 'title' | 'body' | 'updatedAt'>;

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function hasOnlyFields<const Key extends string>(
  value: unknown,
  keys: readonly Key[],
): value is Record<Key, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function parseBackup(bytes: Uint8Array): BackupNote[] {
  if (bytes.byteLength > LIMITS.backupFileBytes) {
    throw new BackupError('too_large', 'The backup file exceeds the size limit.');
  }

  let file: unknown;
  try {
    file = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new BackupError('invalid_file', 'The backup must be valid UTF-8 JSON.');
  }
  if (!hasOnlyFields(file, ['format', 'version', 'notes']) || !Array.isArray(file.notes)) {
    throw new BackupError('invalid_file', 'The backup has an invalid structure.');
  }
  if (file.format !== BACKUP_FORMAT || file.version !== BACKUP_VERSION) {
    throw new BackupError('unsupported_version', 'The backup format or version is not supported.');
  }
  if (file.notes.length > LIMITS.backupNotes) {
    throw new BackupError('limit_exceeded', 'The backup contains too many notes.');
  }

  const ids = new Set<string>();
  return file.notes.map((note: unknown) => {
    if (!hasOnlyFields(note, ['id', 'title', 'body', 'updatedAt'])) {
      throw new BackupError('invalid_file', 'A backup note has an invalid structure.');
    }
    const { id, title, body, updatedAt } = note;
    if (typeof id !== 'string' || !uuidV4.test(id) || typeof title !== 'string' || typeof body !== 'string') {
      throw new BackupError('invalid_file', 'A backup note has an invalid ID or text.');
    }
    if (!isNoteTimestamp(updatedAt)) {
      throw new BackupError('invalid_file', 'A backup note has an invalid timestamp.');
    }
    const code = draftError(title, body);
    if (code === 'invalid') throw new BackupError('invalid_file', 'A backup note has invalid Unicode text.');
    if (code === 'limit_exceeded') throw new BackupError(code, 'A backup note exceeds the text size limit.');
    if (ids.has(id)) throw new BackupError('duplicate_ids', 'The backup contains duplicate note IDs.');
    ids.add(id);
    return { id, title, body, updatedAt };
  });
}

function findNewNotes(incoming: readonly BackupNote[], current: readonly Note[]): BackupNote[] {
  const byId = new Map(current.map((note) => [note.id, note]));
  return incoming.filter(({ id, title, body }) => {
    const existing = byId.get(id);
    if (!existing) return true;
    if (existing.title !== title || existing.body !== body) {
      throw new BackupError('conflict', 'A backup note differs from a saved note with the same ID.');
    }
    return false;
  });
}

export function createBackupService(run: RunNotesTransaction): BackupService {
  const previews = new WeakMap<object, readonly BackupNote[]>();
  const snapshot = () => run<Note[]>('readonly', (store, after, setResult) => {
    // Without an index or key range, getAll returns records in primary-key order.
    after(store.getAll(), setResult);
  });

  return {
    async exportBackup() {
      const notes = (await snapshot()).map(({ id, title, body, updatedAt }) => ({ id, title, body, updatedAt }));
      return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, notes });
    },
    async previewImport(bytes) {
      const incoming = parseBackup(bytes);
      let current: Note[];
      try {
        current = await snapshot();
      } catch {
        throw new BackupError('write_failed', 'The saved notes could not be checked for import.');
      }
      const newCount = findNewNotes(incoming, current).length;
      const token = {};
      previews.set(token, incoming);
      return { titles: incoming.map(({ title }) => title), newCount, unchangedCount: incoming.length - newCount, token };
    },
    async commitImport(preview) {
      const token = preview?.token;
      const incoming = typeof token === 'object' && token !== null ? previews.get(token) : undefined;
      if (!incoming) throw new BackupError('invalid_file', 'A valid import preview is required.');
      try {
        return await run<{ inserted: number; unchanged: number }>('readwrite', (store, after, setResult) => {
          after<Note[]>(store.getAll(), (current) => {
            const fresh = findNewNotes(incoming, current);
            if (current.length + fresh.length > LIMITS.databaseNotes) {
              throw new BackupError('limit_exceeded', 'The import would exceed the database note limit.');
            }
            for (const note of fresh) store.add({ ...note, revision: 1 } satisfies Note);
            setResult({ inserted: fresh.length, unchanged: incoming.length - fresh.length });
          });
        });
      } catch (error) {
        if (error instanceof BackupError) throw error;
        throw new BackupError('write_failed', 'The notes backup could not be saved.');
      }
    },
  };
}
