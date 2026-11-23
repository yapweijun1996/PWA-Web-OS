import type { Copy, MessageKey } from '../i18n';
import type { LocalizedUi } from './localized';
import type { FlushResult, Note, NoteRepository } from '../contracts';
import { button, element, openDialog, setText, type Feedback } from './dom';
import { DraftSession } from './draft';
import { icon } from './icons';
import { storageErrorCode, storageHelp } from './messages';

type NotesRoute = 'list' | 'editor';
const noopFlush: FlushResult = { ok: true };

export function createNotes(
  ui: LocalizedUi,
  repository: NoteRepository,
  feedback: Feedback,
  backToLauncher: () => void,
) {
  let view: NotesRoute = 'list';
  let session: DraftSession | undefined;
  let notes = new Map<string, Note>();
  let ready = false;
  let locked = false;
  let savingCopy = false;
  let operation: Promise<void> | undefined;
  let listRequest = 0;
  let announcedSave = '';
  let announcedFailure = '';

  const issue = element('p', undefined, 'feedback error');
  issue.hidden = true;
  const panes = element('div', undefined, 'notes-panes');
  panes.dataset.view = view;
  const listPane = element('section', undefined, 'notes-list');
  listPane.setAttribute('aria-labelledby', 'notes-heading');
  const heading = ui.label('h2', 'notes.name');
  heading.id = 'notes-heading';
  heading.tabIndex = -1;
  const list = element('ul', undefined, 'note-items');
  const empty = ui.label('p', 'notes.empty', 'empty-state');
  empty.hidden = true;
  const listStatus = element('p', undefined, 'muted');
  const refreshButton = ui.action('notes.retryLoading', () => { void refresh(); });
  refreshButton.hidden = true;
  const launcherBack = ui.action('shell.launcher', backToLauncher, 'launcher-back');
  launcherBack.prepend(icon('back'));
  const add = ui.action('notes.new', () => run('notes.createFailed', async () => {
    if (!await canSwitch()) return;
    const note = await repository.create({ title: '', body: '' });
    remember(note);
    showNote(note, true);
  }), 'primary');
  add.prepend(icon('plus'));
  listPane.append(launcherBack, add, listStatus, refreshButton, empty, list);

  const editorPane = element('section', undefined, 'editor');
  editorPane.setAttribute('aria-labelledby', 'editor-heading');
  editorPane.tabIndex = -1;
  const editorHeading = ui.label('h2', 'notes.editor', 'visually-hidden');
  editorHeading.id = 'editor-heading';
  const listBack = ui.action('notes.back', () => focusList(true), 'list-back');
  listBack.prepend(icon('back'));
  const placeholder = ui.label('p', 'notes.select', 'empty-state');
  const title = element('textarea');
  title.id = 'note-title';
  title.rows = 1;
  ui.attr(title, 'placeholder', 'notes.untitled');
  const body = element('textarea');
  body.id = 'note-body';
  body.rows = 8;
  const titleLabel = ui.label('label', 'notes.title', 'visually-hidden');
  titleLabel.htmlFor = title.id;
  const bodyLabel = ui.label('label', 'notes.body', 'visually-hidden');
  bodyLabel.htmlFor = body.id;
  const fields = element('div', undefined, 'editor-fields');
  const editorHeader = element('div', undefined, 'editor-header');
  const saveStatus = element('p', undefined, 'save-status');
  const statusChip = element('div', undefined, 'save-chip');
  statusChip.append(icon('check'), saveStatus);
  editorHeader.append(titleLabel, title, statusChip);
  const recovery = element('div', undefined, 'feedback error recovery');
  const recoveryDetail = element('p');
  const storageDetail = element('p');
  const clipboardDetail = element('p');
  clipboardDetail.hidden = true;
  const retry = ui.action('notes.retry', () => {
    if (blocked()) return;
    editorPane.focus();
    void session?.flush(true);
  });
  const copy = ui.action('notes.copy', () => { void copyDraft(); });
  const saveAsNew = ui.action('notes.saveAsNew', () => run('notes.copyFailed', async () => {
    if (!session) return;
    savingCopy = true;
    paintEditor();
    try {
      const note = await repository.create(session.draft);
      remember(note);
      showNote(note, true);
    } finally {
      savingCopy = false;
    }
  }));
  const discard = element('dialog');
  const discardTitle = ui.label('h2', 'notes.discardTitle');
  discardTitle.id = 'discard-heading';
  discard.setAttribute('aria-labelledby', discardTitle.id);
  const cancel = ui.action('common.cancel', () => discard.close());
  const confirm = ui.action('notes.discard', () => {
    if (blocked() || !session) return;
    discard.close();
    run('notes.reloadFailed', async () => {
      if (!session) return;
      const saved = await repository.get(session.committed.id);
      if (!saved) {
        report('notes.missing');
        return;
      }
      remember(saved);
      showNote(saved, false);
    });
  });
  const reload = ui.action('notes.reload', () => {
    if (!blocked()) openDialog(discard, cancel, reload);
  });
  const discardActions = element('div', undefined, 'actions');
  discardActions.append(cancel, confirm);
  discard.append(discardTitle, ui.label('p', 'notes.discardInfo'), discardActions);
  const recoveryActions = element('div', undefined, 'actions');
  recoveryActions.append(retry, saveAsNew, reload, copy);
  recovery.append(recoveryDetail, storageDetail, recoveryActions, clipboardDetail);
  fields.append(editorHeader, recovery, bodyLabel, body);
  editorPane.append(listBack, editorHeading, placeholder, fields, discard);
  panes.append(listPane, editorPane);

  title.addEventListener('input', () => { if (!blocked()) session?.edit('title', title.value); });
  body.addEventListener('input', () => { if (!blocked()) session?.edit('body', body.value); });

  function blocked(): boolean { return locked || operation !== undefined; }

  function report(message: Copy): void {
    issue.hidden = false;
    ui.text(issue, message);
    feedback.alert(message);
  }

  function run(label: MessageKey, action: () => Promise<void>): void {
    if (blocked()) return;
    issue.hidden = true;
    operation = Promise.resolve().then(action).catch((error: unknown) => {
      feedbackForAction(label, error);
    }).finally(() => {
      operation = undefined;
      paintEditor();
      paintList();
    });
    paintEditor();
    paintList();
  }

  function feedbackForAction(label: MessageKey, error: unknown): void {
    const code = storageErrorCode(error);
    report(t => `${t(label)} ${t(code === 'conflict' ? 'notes.retryHelp' : storageHelp[code])}`);
  }

  function navigate(route: NotesRoute): void {
    view = route;
    panes.dataset.view = route;
  }

  function focusEditor(): void {
    navigate('editor');
    editorPane.focus();
  }

  async function canSwitch(): Promise<boolean> {
    if (!session || (await session.flush()).ok) return true;
    focusEditor();
    return false;
  }

  function focusList(preferCurrent = false): void {
    navigate('list');
    const current = preferCurrent && list.querySelector<HTMLButtonElement>('[aria-current="true"]');
    (current || heading).focus();
  }

  function showNote(note: Note, newNote: boolean): void {
    session = new DraftSession(note, repository, paintEditor, remember);
    title.value = note.title;
    body.value = note.body;
    announcedSave = '';
    clipboardDetail.hidden = true;
    paintEditor();
    paintList();
    navigate('editor');
    (newNote ? title : editorPane).focus();
  }

  function openNote(id: string): void {
    run('notes.openFailed', async () => {
      if (session?.committed.id === id && session.dirty) {
        focusEditor();
        return;
      }
      if (!await canSwitch()) return;
      const note = await repository.get(id);
      if (!note) {
        report('notes.gone');
        void refresh();
        return;
      }
      remember(note);
      showNote(note, false);
    });
  }

  function remember(note: Note): void {
    notes.set(note.id, note);
    paintList();
  }

  async function refresh(): Promise<void> {
    const request = ++listRequest;
    const knownAtStart = new Map(notes);
    ready = false;
    refreshButton.hidden = true;
    empty.hidden = true;
    ui.text(listStatus, 'notes.loading');
    try {
      const records = await repository.list();
      if (request !== listRequest) return;
      // A save may have completed after this read's snapshot was taken.
      const fresh = new Map(records.map((note) => [note.id, note]));
      for (const [id, known] of notes) {
        if (knownAtStart.get(id) !== known && known.revision > (fresh.get(id)?.revision ?? 0)) {
          fresh.set(id, known);
        }
      }
      notes = fresh;
      ready = true;
      ui.text(listStatus, () => '');
      paintList();
    } catch (error) {
      if (request !== listRequest) return;
      const message: Copy = t => `${t('notes.loadFailed')} ${t(storageHelp[storageErrorCode(error)])}`;
      ui.text(listStatus, message);
      refreshButton.hidden = false;
      feedback.alert(message);
    }
  }

  function paintList(): void {
    // Keeping busy controls focusable lets an async action restore focus reliably.
    add.setAttribute('aria-disabled', String(blocked()));
    const focused = list.contains(document.activeElement)
      ? (document.activeElement as HTMLButtonElement).dataset.noteId
      : undefined;
    const existing = new Map(Array.from(list.children, (item) => {
      const row = item as HTMLLIElement;
      return [(row.firstElementChild as HTMLButtonElement).dataset.noteId, row];
    }));
    // Preserve NoteRepository.list() ordering when merging locally committed changes.
    const sorted = [...notes.values()].sort((a, b) => b.updatedAt - a.updatedAt
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let focusedButton: HTMLButtonElement | undefined;
    for (const [index, note] of sorted.entries()) {
      let row = existing.get(note.id);
      if (!row) {
        row = element('li');
        const control = button('', () => openNote(note.id));
        control.dataset.noteId = note.id;
        const label = element('span', undefined, 'note-row-text');
        const name = element('span', undefined, 'note-row-title');
        const updated = element('time', undefined, 'note-row-date');
        name.id = `note-name-${note.id}`;
        updated.id = `note-date-${note.id}`;
        control.setAttribute('aria-labelledby', name.id);
        control.setAttribute('aria-describedby', updated.id);
        label.append(name, updated);
        control.append(icon('document'), label);
        row.append(control);
      }
      existing.delete(note.id);
      const control = row.firstElementChild as HTMLButtonElement;
      const name = control.querySelector<HTMLElement>('.note-row-title')!;
      const updated = control.querySelector('time')!;
      setText(name, note.title.trim() ? note.title : ui.language.t('notes.untitled'));
      paintDate(ui, updated, note.updatedAt);
      control.setAttribute('aria-disabled', String(blocked()));
      if (note.id === session?.committed.id) control.setAttribute('aria-current', 'true');
      else control.removeAttribute('aria-current');
      if (focused === note.id) focusedButton = control;
      // Keep nodes already in the correct position, including the focused row.
      const at = list.children[index];
      if (at !== row) list.insertBefore(row, at ?? null);
    }
    for (const row of existing.values()) row.remove();
    if (focused && document.activeElement === document.body) (focusedButton ?? heading).focus();
    empty.hidden = !ready || notes.size > 0;
  }

  function paintEditor(): void {
    const state = savingCopy ? 'saving' : session?.state;
    const code = session?.failure;
    const conflict = code === 'conflict';
    placeholder.hidden = !!session;
    fields.hidden = !session;
    title.readOnly = blocked();
    body.readOnly = blocked();
    const saveFailed = 'notes.failed';
    const status = state === 'saving' ? 'notes.saving'
      : state === 'saved' ? 'notes.saved'
      : state === 'dirty' ? 'notes.dirty'
      : state === 'failed' && !conflict ? saveFailed : '';
    ui.text(saveStatus, status || (() => ''));
    saveStatus.dataset.state = state ?? '';
    statusChip.hidden = !status;
    if ((state === 'saving' || state === 'saved') && status && announcedSave !== status) {
      announcedSave = status;
      feedback.announce(status);
    } else if (state === 'failed') {
      announcedSave = '';
    }
    recovery.hidden = !code;
    retry.hidden = conflict;
    saveAsNew.hidden = !conflict;
    reload.hidden = !conflict;
    // Keep recovery buttons focusable during updates, but guard their actions.
    for (const control of [retry, saveAsNew, reload, confirm]) {
      control.setAttribute('aria-disabled', String(blocked()));
    }
    const detail = conflict
      ? 'notes.conflict'
      : code ? 'notes.unchanged' : '';
    ui.text(recoveryDetail, detail || (() => ''));
    ui.text(storageDetail, code ? storageHelp[code] : () => '');
    if (code && code !== announcedFailure) {
      const parts = [conflict ? undefined : saveFailed, detail || undefined, storageHelp[code]];
      feedback.alert(t => parts.filter((key): key is MessageKey => !!key).map(key => t(key)).join(' '));
    }
    announcedFailure = code ?? '';
  }

  async function copyDraft(): Promise<void> {
    if (!session) return;
    const current = session;
    const draft = current.draft;
    clipboardDetail.hidden = true;
    try {
      await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`);
      feedback.announce('notes.copied');
    } catch {
      if (session !== current) return;
      const message = 'notes.clipboardFailed';
      ui.text(clipboardDetail, message);
      clipboardDetail.hidden = false;
      feedback.alert(message);
    }
  }

  ui.language.onChange(paintList);
  paintEditor();
  return {
    heading, panes, issue,
    enter() {
      if (view === 'editor') focusEditor();
      else focusList();
      void refresh();
    },
    focusEditor, refresh,
    hasUnsaved: () => session?.dirty ?? false,
    setLocked(next: boolean) {
      if (locked === next) return;
      locked = next;
      paintEditor();
      paintList();
    },
    async flush(): Promise<FlushResult> {
      await operation;
      return session ? session.flush(true) : noopFlush;
    },
  };
}

function paintDate(ui: LocalizedUi, node: HTMLTimeElement, updatedAt: number): void {
  const date = new Date(updatedAt);
  if (!Number.isFinite(date.getTime())) {
    node.removeAttribute('datetime');
    setText(node, ui.language.t('notes.noDate'));
    return;
  }
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const day = date.toDateString();
  const label = day === today.toDateString() ? ui.language.t('notes.today')
    : day === yesterday.toDateString() ? ui.language.t('notes.yesterday')
    : ui.language.shortDate(date);
  const iso = date.toISOString();
  if (node.dateTime !== iso) node.dateTime = iso;
  setText(node, ui.language.t('notes.timestamp', { day: label, time: ui.language.time(date) }));
}
