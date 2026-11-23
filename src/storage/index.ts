// STUB owned by the storage workstream: replace with the IndexedDB implementation.
import { StorageError, type Note, type Storage } from '../contracts';

export function createStorage(): Storage {
  const notes = new Map<string, Note>();
  return {
    repository: {
      async list() {
        return [...notes.values()];
      },
      async get(id) {
        return notes.get(id);
      },
      async create(draft) {
        const note = { id: crypto.randomUUID(), ...draft, revision: 1 };
        notes.set(note.id, note);
        return note;
      },
      async update(id, expectedRevision, draft) {
        const cur = notes.get(id);
        if (!cur) throw new StorageError('not_found', 'missing');
        if (cur.revision !== expectedRevision) throw new StorageError('conflict', 'stale');
        const next = { id, ...draft, revision: cur.revision + 1 };
        notes.set(id, next);
        return next;
      },
    },
    backup: {
      async exportBackup() {
        throw new Error('not implemented');
      },
      async previewImport() {
        throw new Error('not implemented');
      },
      async commitImport() {
        throw new Error('not implemented');
      },
    },
  };
}
