// Notes and JSON backups stay local. Each storage instance opens IndexedDB lazily.
import type { Storage } from '../contracts';
import { createBackupService } from './backup';
import { createNotesTransactionRunner } from './database';
import { createNoteRepository } from './repository';

export function createStorage({ now = Date.now }: { now?: () => number } = {}): Storage {
  const run = createNotesTransactionRunner();
  return {
    repository: createNoteRepository(run, now),
    backup: createBackupService(run),
  };
}
