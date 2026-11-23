// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  BackupError, LIMITS, StorageError, type BackupErrorCode, type BackupService, type FlushResult, type Note,
  type NoteDraft, type NoteRepository, type UpdateState,
} from '../contracts';
import { createPreferenceStore } from '../prefs';
import { mountApp } from './mount';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Local fake only: controllable transaction outcomes exercise the mounted UI, not IndexedDB.
function fakeRepository() {
  const records = new Map<string, Note>();
  const writes: { expected: number; draft: NoteDraft; commit(): void; reject(error: StorageError): void }[] = [];
  let createGate: Promise<void> | undefined;
  const repository: NoteRepository = {
    async list() { return [...records.values()]; },
    async get(id) { return records.get(id); },
    async create(draft) {
      const id = `00000000-0000-4000-8000-${String(records.size + 1).padStart(12, '0')}`;
      await createGate;
      const note: Note = { id, ...draft, revision: 1, updatedAt: 1 };
      records.set(id, note);
      return note;
    },
    update(id, expected, draft) {
      const pending = deferred<Note>();
      writes.push({
        expected, draft, reject: pending.reject,
        commit() {
          if (records.get(id)?.revision !== expected) {
            pending.reject(new StorageError('conflict', 'Synthetic stale revision'));
            return;
          }
          const note: Note = { id, ...draft, revision: expected + 1, updatedAt: expected + 1 };
          records.set(id, note);
          pending.resolve(note);
        },
      });
      return pending.promise;
    },
  };
  return { repository, writes, records, holdCreate(promise: Promise<void>) { createGate = promise; } };
}

function fixture(backupOverride?: Partial<BackupService>) {
  const fake = fakeRepository();
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  let activeFlush: (() => Promise<FlushResult>) | undefined;
  let update: UpdateState = { status: 'idle' };
  let offlineReady = false;
  const subscribers = new Set<(state: UpdateState) => void>();
  const readiness = new Set<(ready: boolean) => void>();
  const retry = vi.fn(async () => {});
  mountApp(root, {
    buildId: 'test-build',
    prefs: createPreferenceStore(),
    storage: {
      repository: fake.repository,
      backup: {
        async exportBackup() { throw new Error('Not covered by this fixture'); },
        async previewImport() { throw new Error('Not covered by this fixture'); },
        async commitImport() { throw new Error('Not covered by this fixture'); },
        ...backupOverride,
      },
    },
    updates: {
      getState: () => update,
      subscribe(listener) { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
      async accept() {},
      retry,
      setFlush(flush) { activeFlush = flush; return () => { activeFlush = undefined; }; },
      isOfflineReady: () => offlineReady,
      onOfflineReadyChange(listener) { readiness.add(listener); return () => { readiness.delete(listener); }; },
    },
  });
  return {
    ...fake, root, retry,
    flush: () => {
      if (!activeFlush) throw new Error('The editor did not register a flush handler');
      return activeFlush();
    },
    setUpdate(state: UpdateState) {
      update = state;
      for (const listener of subscribers) listener(state);
    },
    setReady(ready: boolean) {
      offlineReady = ready;
      for (const listener of readiness) listener(ready);
    },
  };
}

const tick = () => vi.advanceTimersByTimeAsync(0);
const debounce = () => vi.advanceTimersByTimeAsync(300);
function node<T extends HTMLElement>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing test element: ${selector}`);
  return match;
}
function click(label: string, where: ParentNode = document): void {
  const control = Array.from(where.querySelectorAll('button')).find((button) => button.textContent === label);
  if (!control) throw new Error(`Missing test button: ${label}`);
  control.click();
}
function enterNotes() { click('Notes', node('.launcher')); }
async function createNote() {
  enterNotes();
  click('New note');
  await tick();
}
function edit(field: '#note-title' | '#note-body', value: string): void {
  const input = node<HTMLTextAreaElement>(field);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const saveStatus = () => node('.save-status').textContent;
const lastAlert = () => node('[role="alert"]').textContent;
const lastStatus = () => node('[role="status"]').textContent;

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('empty Notes gives guidance and creates a note before focusing Title (fake repository)', async () => {
  const app = fixture();
  enterNotes();
  await tick();
  expect(node('.notes-list .empty-state').hidden).toBe(false);
  expect(node('.notes-list .empty-state').textContent).toBe('No notes yet. Create a note to get started.');
  click('New note');
  await tick();
  expect(app.records.size).toBe(1);
  expect(document.activeElement).toBe(node('#note-title'));
  expect(saveStatus()).toBe('Saved on this device');
});

test('an older fake commit resolving after a newer edit never marks the newer draft saved', async () => {
  const app = fixture();
  await createNote();
  edit('#note-title', 'First draft');
  await debounce();
  expect(saveStatus()).toBe('Saving…');
  edit('#note-title', 'Latest draft');
  edit('#note-body', 'Synthetic body');
  await debounce();
  expect(app.writes).toHaveLength(1); // Writes cannot resolve out of order: only one revision is in flight.
  app.writes[0].commit();
  await tick();
  expect(saveStatus()).toBe('Unsaved changes');
  expect(lastStatus()).toBe('Saving…');
  expect(node<HTMLTextAreaElement>('#note-title').value).toBe('Latest draft');
  await debounce();
  expect(app.writes[1]).toMatchObject({ expected: 2, draft: { title: 'Latest draft', body: 'Synthetic body' } });
  expect(saveStatus()).toBe('Saving…');
  app.writes[1].commit();
  await tick();
  expect(saveStatus()).toBe('Saved on this device');
  expect(lastStatus()).toBe('Saved on this device');
});

test('failed fake write preserves the committed revision and draft; Retry saves the latest text', async () => {
  const app = fixture();
  await createNote();
  edit('#note-body', 'Synthetic unsaved text');
  await debounce();
  app.writes[0].reject(new StorageError('quota', 'Synthetic quota'));
  await tick();
  expect(saveStatus()).toBe('Save failed. Your changes are not saved.');
  expect(node('.recovery').textContent).toContain('The last saved version is unchanged.');
  expect(lastAlert()).toContain('Device storage is full.');
  expect(node<HTMLTextAreaElement>('#note-body').value).toBe('Synthetic unsaved text');
  expect([...app.records.values()][0]).toMatchObject({ body: '', revision: 1 });
  edit('#note-body', 'Revised synthetic text');
  await debounce();
  expect(app.writes).toHaveLength(1);
  click('Retry');
  await tick();
  expect(saveStatus()).toBe('Saving…');
  expect(app.writes[1]).toMatchObject({ expected: 1, draft: { body: 'Revised synthetic text' } });
  app.writes[1].commit();
  await tick();
  expect(saveStatus()).toBe('Saved on this device');
});

test('fake conflict keeps the newer record and switches to the copy only after Save as new commits', async () => {
  const app = fixture();
  await createNote();
  const saved = [...app.records.values()][0];
  app.records.set(saved.id, { ...saved, title: 'Newer saved version', revision: 2 });
  edit('#note-title', 'My synthetic draft');
  await debounce();
  app.writes[0].commit();
  await tick();
  expect(lastAlert()).toContain('A newer version of this note is already saved. Your draft has not been saved.');
  expect(await app.flush()).toEqual({ ok: false, reason: 'conflict' });
  const slow = deferred<void>();
  app.holdCreate(slow.promise);
  click('Save as new');
  await tick();
  expect(saveStatus()).toBe('Saving…');
  expect(node('.note-items [aria-current]').getAttribute('data-note-id')).toBe(saved.id);
  expect(app.records.size).toBe(1);
  slow.resolve(undefined);
  await tick();
  expect(saveStatus()).toBe('Saved on this device');
  expect(node('.note-items [aria-current]').getAttribute('data-note-id')).not.toBe(saved.id);
  expect(app.records.get(saved.id)?.title).toBe('Newer saved version');
  expect([...app.records.values()][1]).toMatchObject({ revision: 1, title: 'My synthetic draft' });
});

test('registered flush waits for the fake write, returns failure, and can retry immediately', async () => {
  const app = fixture();
  expect(await app.flush()).toEqual({ ok: true });
  await createNote();
  edit('#note-body', 'Save before applying update');
  const initial = app.flush();
  await tick();
  expect(saveStatus()).toBe('Saving…');
  app.writes[0].reject(new StorageError('unavailable', 'Synthetic open error'));
  expect(await initial).toEqual({ ok: false, reason: 'save_failed' });
  const retry = app.flush();
  await tick();
  app.writes[1].commit();
  expect(await retry).toEqual({ ok: true });
  expect(saveStatus()).toBe('Saved on this device');
});

test('copy announces only after the injected clipboard promise succeeds, and gives guidance if it rejects', async () => {
  const app = fixture();
  await createNote();
  edit('#note-title', 'Synthetic title');
  await debounce();
  app.writes[0].reject(new StorageError('blocked', 'Synthetic blocked database'));
  await tick();
  const copied = deferred<void>();
  const writeText = vi.fn(() => copied.promise);
  // jsdom has no clipboard. Inject only the browser boundary; test the UI response.
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  try {
    click('Copy draft');
    expect(writeText).toHaveBeenCalledWith('Synthetic title\n\n');
    expect(lastStatus()).not.toBe('Draft copied.');
    copied.resolve(undefined);
    await tick();
    expect(lastStatus()).toBe('Draft copied.');
    writeText.mockRejectedValueOnce(new DOMException('Synthetic denial', 'NotAllowedError'));
    click('Copy draft');
    await tick();
    expect(lastAlert()).toBe('Could not copy the draft. Select and copy the text in the editor.');
  } finally {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

test('connection, offline readiness and fake update states do not change editor save state or focus', async () => {
  const app = fixture();
  await createNote();
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
  expect(node('.network-status').textContent).toBe('Offline');
  expect(node('.offline-ready').hidden).toBe(true);
  app.setReady(true);
  expect(node('.offline-ready').hidden).toBe(false);
  online.mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
  expect(node('.network-status').textContent).toBe('Online');
  expect(node('.offline-ready').hidden).toBe(false);

  const title = node<HTMLTextAreaElement>('#note-title');
  title.focus();
  app.setUpdate({ status: 'available' });
  expect(node('.update-notice h2').textContent).toBe('Update available');
  expect(title.readOnly).toBe(false);
  app.setUpdate({ status: 'saving' });
  expect(node('.update-notice p').textContent).toBe('Saving changes before update…');
  expect(title.readOnly).toBe(true);
  app.setUpdate({ status: 'activating' });
  expect(node('.update-notice p').textContent).toBe('Applying update…');
  app.setUpdate({ status: 'reloading' });
  expect(node('.update-notice p').textContent).toBe('Reloading Notes…');
  app.setUpdate({ status: 'paused', detail: 'other_client' });
  expect(lastAlert()).toContain('close those tabs');
  expect(title.readOnly).toBe(false);
  expect(saveStatus()).toBe('Saved on this device');
  expect(document.activeElement).toBe(title);
  click('Retry update');
  expect(app.retry).toHaveBeenCalledTimes(1);
  await tick();
});

test('an oversized backup is rejected before reading bytes or calling the injected service', () => {
  const previewImport = vi.fn<BackupService['previewImport']>();
  fixture({ previewImport });
  const file = new File([new Uint8Array(LIMITS.backupFileBytes + 1)], 'synthetic.json');
  const read = vi.spyOn(file, 'arrayBuffer');
  const picker = node<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(picker, 'files', { value: [file] });
  picker.dispatchEvent(new Event('change'));
  expect(read).not.toHaveBeenCalled();
  expect(previewImport).not.toHaveBeenCalled();
  expect(lastAlert()).toBe('This backup is larger than 10 MiB. Choose a smaller Notes backup file.');
});

test.each<[BackupErrorCode, string]>([
  ['invalid_file', 'This file is not a valid Notes backup. Choose a Notes backup file.'],
  ['unsupported_version', 'This Notes backup version is not supported. Use a compatible version of Notes to open it.'],
  ['duplicate_ids', 'This backup contains duplicate note IDs. Choose a different Notes backup file.'],
  ['conflict', 'This backup contains a note that conflicts with a saved note. No notes were restored.'],
])('rejected fake backup preview (%s) is actionable and does not call commit', async (code, message) => {
  const previewImport = vi.fn<BackupService['previewImport']>().mockRejectedValue(new BackupError(code, 'Synthetic failure'));
  const commitImport = vi.fn<BackupService['commitImport']>();
  fixture({ previewImport, commitImport });
  const picker = node<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(picker, 'files', { value: [new File(['x'], 'synthetic.json')] });
  picker.dispatchEvent(new Event('change'));
  await tick();
  expect(previewImport).toHaveBeenCalledWith(new Uint8Array([120]));
  expect(commitImport).not.toHaveBeenCalled();
  expect(lastAlert()).toBe(message);
});

test('the theme control reports a session-only choice when storage throws', () => {
  fixture();
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Synthetic denial', 'SecurityError');
  });
  node<HTMLInputElement>('input[value="dark"]').click();
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(lastStatus()).toBe('Theme changed for this session only.');
});

test('translates an existing update alert and backup error without changing the open menu', async () => {
  const app = fixture();
  app.setUpdate({ status: 'paused', detail: 'other_client' });
  expect(lastAlert()).toContain('Save changes in other Notes tabs');
  node<HTMLButtonElement>('.workspace-toggle').click();
  const language = node<HTMLSelectElement>('.locale-control select');
  language.focus();
  language.value = 'zh-Hans';
  language.dispatchEvent(new Event('change'));
  expect(document.activeElement).toBe(language);
  expect(node('.update-notice h2').textContent).toBe('更新已暂停');
  expect(lastAlert()).toBe('更新已暂停。请保存其他笔记标签页中的更改，或关闭那些标签页，然后重试更新。');
  expect(node('.workspace-menu').hidden).toBe(false);
  click('导出备份', node('.backup-menu'));
  await tick();
  expect(lastAlert()).toContain('无法导出备份');
  language.value = 'en';
  language.dispatchEvent(new Event('change'));
  expect(node('.backup-menu .feedback').textContent).toContain('Could not export the backup.');
});
