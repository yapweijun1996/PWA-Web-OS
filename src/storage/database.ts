import { BackupError, DB_NAME, DB_VERSION, StorageError } from '../contracts';

const STORE = 'notes';
const OPEN_TIMEOUT_MS = 3_000;

function databaseError(error: unknown, duringOpen = false): StorageError {
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === 'QuotaExceededError') {
    return new StorageError('quota', 'There is not enough space to save notes.');
  }
  if (duringOpen) {
    return name === 'VersionError'
      ? new StorageError('incompatible_schema', 'The notes database needs a newer app version.')
      : new StorageError('unavailable', 'The notes database could not be opened.');
  }
  return name === 'ConstraintError'
    ? new StorageError('conflict', 'A note with this ID already exists.')
    : new StorageError('unknown', 'The notes transaction did not complete.');
}

function openDatabase(release: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(databaseError(error, true));
      return;
    }

    let abandoned = false;
    let migrationError: unknown;
    function abandon() {
      abandoned = true;
      clearTimeout(timeout);
      reject(new StorageError('blocked', 'Close other tabs using notes and retry.'));
    }
    // An open queued behind another tab's upgrade may not get its own blocked event.
    const timeout = setTimeout(abandon, OPEN_TIMEOUT_MS);
    request.onblocked = abandon;
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction!;
      // The open request cannot be canceled. Do not start a migration after reporting failure.
      if (abandoned || event.oldVersion !== 0 || event.newVersion !== 1) {
        transaction.abort();
        return;
      }
      try {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      } catch (error) {
        migrationError = error;
        transaction.abort();
      }
    };
    request.onerror = () => {
      clearTimeout(timeout);
      if (!abandoned) reject(databaseError(migrationError ?? request.error, true));
    };
    request.onsuccess = () => {
      clearTimeout(timeout);
      const db = request.result;
      if (abandoned) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        release();
      };
      db.onclose = release;
      resolve(db);
    };
  });
}

type AfterRequest = <Value>(request: IDBRequest<Value>, use: (value: Value) => void) => void;

export function createNotesTransactionRunner() {
  let connection: Promise<IDBDatabase> | undefined;

  function connect(): Promise<IDBDatabase> {
    if (!connection) {
      const release = () => {
        if (connection === attempt) connection = undefined;
      };
      const attempt = openDatabase(release);
      connection = attempt;
      void attempt.catch(release);
    }
    return connection;
  }

  return async function run<T>(
    mode: 'readonly' | 'readwrite',
    work: (store: IDBObjectStore, after: AfterRequest, setResult: (value: T) => void) => void,
  ): Promise<T> {
    const db = await connect();
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, mode);
    } catch (error) {
      throw databaseError(error);
    }

    return new Promise<T>((resolve, reject) => {
      let result: { value: T } | undefined;
      let failure: StorageError | BackupError | undefined;
      tx.oncomplete = () => {
        if (result) resolve(result.value);
        else reject(databaseError(undefined));
      };
      tx.onabort = () => reject(failure ?? databaseError(tx.error));

      function guard(action: () => void) {
        try {
          action();
        } catch (error) {
          failure = error instanceof StorageError || error instanceof BackupError
            ? error
            : databaseError(error);
          tx.abort();
        }
      }

      // Queue dependent writes in IDB success handlers while the transaction is active.
      const after: AfterRequest = (request, use) => {
        request.onsuccess = () => guard(() => use(request.result));
      };
      // Leave request errors uncanceled: IndexedDB aborts the transaction on failure.
      guard(() => work(tx.objectStore(STORE), after, (value) => { result = { value }; }));
    });
  };
}

export type RunNotesTransaction = ReturnType<typeof createNotesTransactionRunner>;
