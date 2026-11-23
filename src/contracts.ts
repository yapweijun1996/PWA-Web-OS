// Shared contracts between workstreams. Owned by the integration manager.
// Do not edit from a worker branch; report needed changes in your final reply.
// Source of truth: docs/M0_DECISIONS.md (storage and backup contracts).

export const LIMITS = {
  backupFileBytes: 10_485_760,
  backupNotes: 100,
  databaseNotes: 100,
  titleBytes: 256,
  bodyBytes: 16_384,
} as const;

export const BACKUP_FORMAT = 'pwa-web-os.notes' as const;
export const BACKUP_VERSION = 1 as const;
export const DB_NAME = 'pwa-web-os-notes' as const;
export const DB_VERSION = 1 as const;
export const THEME_KEY = 'pwa-web-os:preferences:theme' as const;

export interface Note {
  id: string; // lowercase UUID v4, immutable
  title: string;
  body: string;
  revision: number; // positive safe integer, starts at 1
}
export interface NoteDraft {
  title: string;
  body: string;
}

export type StorageErrorCode =
  | 'conflict' // stale revision, or id already exists on create
  | 'not_found'
  | 'limit_exceeded' // text or note-count limit
  | 'invalid'
  | 'quota'
  | 'blocked' // upgrade blocked by another tab
  | 'unavailable' // IndexedDB missing or failed to open
  | 'incompatible_schema' // database newer than this build understands
  | 'unknown';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/** Every method resolves only after the IndexedDB transaction has committed. */
export interface NoteRepository {
  /** Sorted by title (case-insensitive), then id. */
  list(): Promise<Note[]>;
  get(id: string): Promise<Note | undefined>;
  /** Generates the id, stores revision 1. */
  create(draft: NoteDraft): Promise<Note>;
  /** Compare expectedRevision and write revision + 1 in one transaction; otherwise throw StorageError('conflict'). */
  update(id: string, expectedRevision: number, draft: NoteDraft): Promise<Note>;
}

export type BackupErrorCode =
  | 'invalid_file'
  | 'too_large'
  | 'unsupported_version'
  | 'duplicate_ids'
  | 'conflict' // same id, different content (also rechecked at commit time)
  | 'limit_exceeded'
  | 'write_failed';

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

export interface ImportPreview {
  titles: string[];
  newCount: number;
  unchangedCount: number;
  /** Opaque token carrying the validated notes to commitImport. */
  readonly token: unknown;
}

export interface BackupService {
  /** Compact JSON of committed notes only, ascending id, no revisions. */
  exportBackup(): Promise<string>;
  /** Validates only; never writes. Throws BackupError. */
  previewImport(bytes: Uint8Array): Promise<ImportPreview>;
  /** One read-write transaction; rechecks conflicts; atomic; idempotent. Throws BackupError. */
  commitImport(preview: ImportPreview): Promise<{ inserted: number; unchanged: number }>;
}

export interface Storage {
  repository: NoteRepository;
  backup: BackupService;
}

export type Theme = 'system' | 'light' | 'dark';
export interface PreferenceStore {
  getTheme(): Theme;
  /** persisted=false when localStorage is unavailable; the choice still applies for the session. */
  setTheme(theme: Theme): { persisted: boolean };
}

export type FlushResult = { ok: true } | { ok: false; reason: 'save_failed' | 'conflict' };

export type UpdateStatus =
  | 'idle'
  | 'available' // verified candidate ready; user may defer
  | 'saving' // flushing pending edits
  | 'activating'
  | 'reloading'
  | 'paused' // unsafe to switch (flush failed or another client not ready)
  | 'failed'; // activation failed or timed out
export interface UpdateState {
  status: UpdateStatus;
  detail?: 'save_failed' | 'other_client' | 'activation_failed' | 'timeout' | 'reload_pending';
}
export interface UpdateController {
  getState(): UpdateState;
  subscribe(listener: (state: UpdateState) => void): () => void;
  /** User accepted. Must call the registered flush first; never reload with unsaved work. */
  accept(): Promise<void>;
  retry(): Promise<void>;
  /** The editor registers how to flush the current draft. Returns a disposer. */
  setFlush(flush: () => Promise<FlushResult>): () => void;
  /** Offline readiness: true only when a worker controls the page and required assets are cached. */
  isOfflineReady(): boolean;
  onOfflineReadyChange(listener: (ready: boolean) => void): () => void;
}

export interface AppDeps {
  storage: Storage;
  prefs: PreferenceStore;
  updates: UpdateController;
  buildId: string;
}
