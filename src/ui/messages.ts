import type { Copy, MessageKey } from '../i18n';
import { BackupError, StorageError, type BackupErrorCode, type StorageErrorCode, type UpdateState } from '../contracts';

export function storageErrorCode(error: unknown): StorageErrorCode {
  return error instanceof StorageError ? error.code : 'unknown';
}

export const storageHelp: Record<StorageErrorCode, MessageKey> = {
  conflict: 'storage.conflict',
  not_found: 'storage.not_found',
  limit_exceeded: 'storage.limit_exceeded',
  invalid: 'storage.invalid',
  quota: 'storage.quota',
  blocked: 'storage.blocked',
  unavailable: 'storage.unavailable',
  incompatible_schema: 'storage.incompatible_schema',
  unknown: 'storage.unknown',
};

const backupHelp: Record<BackupErrorCode, MessageKey> = {
  invalid_file: 'backup.invalid_file',
  too_large: 'backup.too_large',
  unsupported_version: 'backup.unsupported_version',
  duplicate_ids: 'backup.duplicate_ids',
  conflict: 'backup.conflict',
  limit_exceeded: 'backup.limit_exceeded',
  write_failed: 'backup.write_failed',
};

export function backupMessage(error: unknown, fallback: BackupErrorCode): MessageKey {
  return backupHelp[error instanceof BackupError ? error.code : fallback];
}

export function updateCopy({ status, detail }: UpdateState): { heading: Copy; message: Copy } {
  switch (status) {
    case 'idle':
      return { heading: () => '', message: () => '' };
    case 'available':
      return { heading: 'update.available', message: 'update.defer' };
    case 'saving':
      return { heading: 'update.progress', message: 'update.saving' };
    case 'activating':
      return { heading: 'update.progress', message: 'update.activating' };
    case 'reloading':
      return { heading: 'update.progress', message: 'update.reloading' };
    case 'paused':
      return {
        heading: 'update.paused',
        message: detail === 'other_client'
          ? 'update.otherClient'
          : detail === 'reload_pending'
            ? 'update.reloadPending'
            : 'update.saveFirst',
      };
    case 'failed':
      return {
        heading: 'update.failed',
        message: detail === 'timeout'
          ? 'update.timeout'
          : detail === 'reload_pending'
            ? 'update.readyReload'
            : 'update.activationFailed',
      };
  }
}
