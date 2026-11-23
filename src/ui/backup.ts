import { LIMITS, type BackupService, type ImportPreview } from '../contracts';
import { button, element, openDialog, setText, type Feedback } from './dom';
import { backupMessage } from './messages';

const exportWarning = 'Unsaved changes are not included in this backup.';

function downloadBackup(json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = element('a');
  link.href = url;
  link.download = 'notes-backup.json';
  link.hidden = true;
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to start consuming the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function createBackupMenu(
  service: BackupService,
  hasUnsaved: () => boolean,
  refresh: () => Promise<void>,
  feedback: Feedback,
) {
  let locked = false;
  let reading = false;
  let exporting = false;
  let writing: Promise<void> | undefined;
  let preview: ImportPreview | undefined;

  const menu = element('details', undefined, 'backup-menu');
  const actions = element('div', undefined, 'actions');
  const exportButton = button('Export backup', () => { void exportFile(); });
  const restoreButton = button('Restore backup', () => { if (!locked && !reading && !writing) file.click(); });
  const file = element('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.hidden = true;
  const message = element('p', undefined, 'feedback');
  message.hidden = true;
  actions.append(exportButton, restoreButton, file);
  menu.append(element('summary', 'Backup and restore'), actions, message);

  const dialog = element('dialog');
  const heading = element('h2', 'Restore preview');
  heading.id = 'restore-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const newCount = element('p');
  const unchangedCount = element('p');
  const titleList = element('ul', undefined, 'preview-titles');
  titleList.setAttribute('aria-label', 'Note titles in this backup');
  const progress = element('p', 'Restoring notes…');
  progress.hidden = true;
  const cancel = button('Cancel', () => { if (!writing) dialog.close(); });
  const confirm = button('Restore notes', confirmRestore, 'primary');
  const dialogActions = element('div', undefined, 'actions');
  dialogActions.append(cancel, confirm);
  dialog.append(heading, newCount, unchangedCount, titleList, progress, dialogActions);
  dialog.addEventListener('cancel', (event) => { if (writing) event.preventDefault(); });
  dialog.addEventListener('close', () => { preview = undefined; });

  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    file.value = '';
    if (selected && !locked && !reading && !writing) void readPreview(selected);
  });

  function showMessage(text: string, error = false): void {
    setText(message, text);
    message.hidden = false;
    message.classList.toggle('error', error);
    if (error) feedback.alert(text);
    else feedback.announce(text);
  }

  function paint(): void {
    exportButton.setAttribute('aria-disabled', String(locked || exporting));
    restoreButton.setAttribute('aria-disabled', String(locked || reading || !!writing));
    confirm.setAttribute('aria-disabled', String(locked || !!writing));
    cancel.setAttribute('aria-disabled', String(!!writing));
    progress.hidden = !writing;
  }

  async function exportFile(): Promise<void> {
    if (locked || exporting) return;
    exporting = true;
    paint();
    message.hidden = true;
    const warned = hasUnsaved();
    if (warned) showMessage(exportWarning);
    try {
      const json = await service.exportBackup();
      if (!warned && hasUnsaved()) showMessage(exportWarning);
      downloadBackup(json);
    } catch {
      showMessage('Could not export the backup. Check browser storage and try again.', true);
    } finally {
      exporting = false;
      paint();
    }
  }

  async function readPreview(selected: File): Promise<void> {
    message.hidden = true;
    if (selected.size > LIMITS.backupFileBytes) {
      showMessage('This backup is larger than 10 MiB. Choose a smaller Notes backup file.', true);
      return;
    }
    reading = true;
    paint();
    try {
      const result = await service.previewImport(new Uint8Array(await selected.arrayBuffer()));
      if (locked) return;
      preview = result;
      setText(newCount, `New notes: ${result.newCount}`);
      setText(unchangedCount, `Already in Notes: ${result.unchangedCount}`);
      titleList.replaceChildren(...result.titles.map((title) => element('li', title.trim() ? title : 'Untitled note')));
      menu.open = true;
      openDialog(dialog, cancel, restoreButton);
    } catch (error) {
      showMessage(backupMessage(error, 'invalid_file'), true);
    } finally {
      reading = false;
      paint();
    }
  }

  function confirmRestore(): void {
    const accepted = preview;
    if (!accepted || locked || writing) return;
    writing = Promise.resolve().then(async () => {
      let result: Awaited<ReturnType<BackupService['commitImport']>>;
      try {
        result = await service.commitImport(accepted);
      } catch (error) {
        dialog.close();
        showMessage(backupMessage(error, 'write_failed'), true);
        return;
      }
      dialog.close();
      showMessage(`Notes restored: ${result.inserted}. Already in Notes: ${result.unchanged}.`);
      await refresh();
    }).finally(() => {
      writing = undefined;
      paint();
    });
    paint();
  }

  return {
    menu, dialog,
    setLocked(next: boolean) { locked = next; paint(); },
    async settle(): Promise<void> { await writing; },
  };
}
