import { BackupError, StorageError, type BackupErrorCode, type StorageErrorCode, type UpdateState } from '../contracts';

export function storageErrorCode(error: unknown): StorageErrorCode {
  return error instanceof StorageError ? error.code : 'unknown';
}

export const storageHelp: Record<StorageErrorCode, string> = {
  conflict: 'Reload the saved version or save your draft as a new note.',
  not_found: 'The saved note could not be found. Copy your draft before leaving the editor.',
  limit_exceeded: 'Shorten the draft or make room in Notes, then try again. Titles allow up to 256 bytes and bodies up to 16,384 bytes.',
  invalid: 'Check the title and body, then try again.',
  quota: 'Device storage is full. Free some browser storage and try again, or copy your draft.',
  blocked: 'Close other Notes tabs, then try again.',
  unavailable: 'Allow browser storage for this site, then try again.',
  incompatible_schema: 'This build cannot read the saved Notes data. Open a newer build before trying again.',
  unknown: 'Try again. If the problem continues, copy your draft before leaving the editor.',
};

const backupHelp: Record<BackupErrorCode, string> = {
  invalid_file: 'This file is not a valid Notes backup. Choose a Notes backup file.',
  too_large: 'This backup is larger than 10 MiB. Choose a smaller Notes backup file.',
  unsupported_version: 'This Notes backup version is not supported. Use a compatible version of Notes to open it.',
  duplicate_ids: 'This backup contains duplicate note IDs. Choose a different Notes backup file.',
  conflict: 'This backup contains a note that conflicts with a saved note. No notes were restored.',
  limit_exceeded: 'This backup exceeds the Notes limits for note count or text size. Choose a smaller backup.',
  write_failed: 'Could not restore the backup. No notes were restored. Check browser storage and try again.',
};

export function backupMessage(error: unknown, fallback: BackupErrorCode): string {
  return backupHelp[error instanceof BackupError ? error.code : fallback];
}

export function updateCopy({ status, detail }: UpdateState): { heading: string; message: string } {
  switch (status) {
    case 'idle':
      return { heading: '', message: '' };
    case 'available':
      return { heading: 'Update available', message: 'Keep editing or update when you’re ready.' };
    case 'saving':
      return { heading: 'Updating Notes', message: 'Saving changes before update…' };
    case 'activating':
      return { heading: 'Updating Notes', message: 'Applying update…' };
    case 'reloading':
      return { heading: 'Updating Notes', message: 'Reloading Notes…' };
    case 'paused':
      return {
        heading: 'Update paused',
        message: detail === 'other_client'
          ? 'Save changes in other Notes tabs or close those tabs, then retry the update.'
          : detail === 'reload_pending'
            ? 'Save your changes, then retry to reload Notes.'
            : 'Save your changes before retrying the update.',
      };
    case 'failed':
      return {
        heading: 'Update failed',
        message: detail === 'timeout'
          ? 'The update took too long. Retry the update when you’re ready.'
          : detail === 'reload_pending'
            ? 'The update is ready to finish. Retry to reload Notes safely.'
            : 'Could not apply the update. Retry the update when you’re ready.',
      };
  }
}
