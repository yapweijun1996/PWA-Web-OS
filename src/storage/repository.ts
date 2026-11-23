import { LIMITS, StorageError, type Note, type NoteDraft, type NoteRepository } from '../contracts';
import type { RunNotesTransaction } from './database';
import { draftError } from './text';
import { isNoteTimestamp } from './timestamp';

function validatedDraft(draft: NoteDraft): NoteDraft {
  const title = draft?.title;
  const body = draft?.body;
  const code = draftError(title, body);
  if (code) {
    throw new StorageError(code, code === 'invalid'
      ? 'The note must contain valid Unicode text.'
      : 'The note exceeds the text size limit.');
  }
  return { title, body };
}

export function createNoteRepository(run: RunNotesTransaction, now: () => number): NoteRepository {
  function timestamp(): number {
    const value = now();
    if (!isNoteTimestamp(value)) {
      throw new StorageError('invalid', 'The clock did not return a valid note timestamp.');
    }
    return value;
  }

  return {
    async list() {
      const notes = await run<Note[]>('readonly', (store, after, setResult) => {
        after(store.getAll(), setResult);
      });
      return notes.sort((a, b) => b.updatedAt - a.updatedAt
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
    get(id) {
      return run<Note | undefined>('readonly', (store, after, setResult) => {
        after(store.get(id), setResult);
      });
    },
    async create(draft) {
      const text = validatedDraft(draft);
      let id: string;
      try {
        id = globalThis.crypto.randomUUID().toLowerCase();
      } catch {
        throw new StorageError('unavailable', 'A note ID could not be generated.');
      }
      return run<Note>('readwrite', (store, after, setResult) => {
        after(store.count(), (count) => {
          if (count >= LIMITS.databaseNotes) {
            throw new StorageError('limit_exceeded', 'The notes database is full.');
          }
          const note: Note = { id, ...text, revision: 1, updatedAt: timestamp() };
          store.add(note);
          setResult(note);
        });
      });
    },
    async update(id, expectedRevision, draft) {
      const text = validatedDraft(draft);
      return run<Note>('readwrite', (store, after, setResult) => {
        after<Note | undefined>(store.get(id), (current) => {
          if (!current) throw new StorageError('not_found', 'The note no longer exists.');
          if (current.revision !== expectedRevision) {
            throw new StorageError('conflict', 'The note has changed since it was opened.');
          }
          const revision = current.revision + 1;
          if (!Number.isSafeInteger(revision)) {
            throw new StorageError('invalid', 'The note revision cannot be advanced safely.');
          }
          const note: Note = { id, ...text, revision, updatedAt: timestamp() };
          store.put(note);
          setResult(note);
        });
      });
    },
  };
}
