import type { FlushResult, Note, NoteRepository } from '../contracts';
import { button, element, openDialog, setText, type Feedback } from './dom';
import { DraftSession } from './draft';
import { storageErrorCode, storageHelp } from './messages';

type NotesRoute = 'list' | 'editor';
const titles = new Intl.Collator('en', { sensitivity: 'accent' });
const displayTitle = (title: string) => title.trim() ? title : 'Untitled note';
const noopFlush: FlushResult = { ok: true };

export function createNotes(
  repository: NoteRepository,
  feedback: Feedback,
  navigate: (route: NotesRoute) => void,
  backToLauncher: () => void,
) {
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
  const listPane = element('section', undefined, 'notes-list panel');
  listPane.setAttribute('aria-labelledby', 'notes-heading');
  const heading = element('h2', 'Notes');
  heading.id = 'notes-heading';
  heading.tabIndex = -1;
  const list = element('ul', undefined, 'note-items');
  const empty = element('p', 'No notes yet. Create a note to get started.', 'empty-state');
  empty.hidden = true;
  const listStatus = element('p', undefined, 'muted');
  const refreshButton = button('Retry loading notes', () => { void refresh(); });
  refreshButton.hidden = true;
  const launcherBack = button('← Workspace launcher', backToLauncher, 'launcher-back');
  const add = button('New note', () => run('Could not create a note.', async () => {
    if (!await canSwitch()) return;
    const note = await repository.create({ title: '', body: '' });
    remember(note);
    showNote(note, true);
  }), 'primary');
  const listBar = element('div', undefined, 'pane-bar');
  listBar.append(heading, add);
  listPane.append(launcherBack, listBar, listStatus, refreshButton, empty, list);

  const editorPane = element('section', undefined, 'editor panel');
  editorPane.setAttribute('aria-labelledby', 'editor-heading');
  editorPane.tabIndex = -1;
  const editorHeading = element('h2', 'Note editor');
  editorHeading.id = 'editor-heading';
  const listBack = button('← Notes list', () => focusList(true), 'list-back');
  const placeholder = element('p', 'Select a note or create a new one.', 'empty-state');
  const title = element('textarea');
  title.id = 'note-title';
  title.rows = 1;
  const body = element('textarea');
  body.id = 'note-body';
  body.rows = 8;
  const titleLabel = element('label', 'Title');
  titleLabel.htmlFor = title.id;
  const bodyLabel = element('label', 'Body');
  bodyLabel.htmlFor = body.id;
  const fields = element('div', undefined, 'editor-fields');
  fields.append(titleLabel, title, bodyLabel, body);

  const saveStatus = element('p', undefined, 'save-status');
  const recovery = element('div', undefined, 'feedback error recovery');
  const recoveryDetail = element('p');
  const storageDetail = element('p');
  const clipboardDetail = element('p');
  clipboardDetail.hidden = true;
  const retry = button('Retry', () => {
    if (blocked()) return;
    editorPane.focus();
    void session?.flush(true);
  });
  const copy = button('Copy draft', () => { void copyDraft(); });
  const saveAsNew = button('Save as new', () => run('Could not save the draft as a new note.', async () => {
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
  const discardTitle = element('h2', 'Discard unsaved draft?');
  discardTitle.id = 'discard-heading';
  discard.setAttribute('aria-labelledby', discardTitle.id);
  const cancel = button('Cancel', () => discard.close());
  const confirm = button('Discard and reload', () => {
    if (blocked() || !session) return;
    discard.close();
    run('Could not reload the saved version.', async () => {
      if (!session) return;
      const saved = await repository.get(session.committed.id);
      if (!saved) {
        report('The saved note could not be found. Save your draft as a new note or copy it.');
        return;
      }
      remember(saved);
      showNote(saved, false);
    });
  });
  const reload = button('Reload saved version', () => {
    if (!blocked()) openDialog(discard, cancel, reload);
  });
  const discardActions = element('div', undefined, 'actions');
  discardActions.append(cancel, confirm);
  discard.append(discardTitle, element('p', 'This replaces your unsaved text with the latest saved version.'), discardActions);
  const recoveryActions = element('div', undefined, 'actions');
  recoveryActions.append(retry, saveAsNew, reload, copy);
  recovery.append(recoveryDetail, storageDetail, recoveryActions, clipboardDetail);
  editorPane.append(listBack, editorHeading, placeholder, fields, saveStatus, recovery, discard);

  title.addEventListener('input', () => { if (!blocked()) session?.edit('title', title.value); });
  body.addEventListener('input', () => { if (!blocked()) session?.edit('body', body.value); });

  function blocked(): boolean { return locked || operation !== undefined; }

  function report(message: string): void {
    issue.hidden = false;
    setText(issue, message);
    feedback.alert(message);
  }

  function run(label: string, action: () => Promise<void>): void {
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

  function feedbackForAction(label: string, error: unknown): void {
    const code = storageErrorCode(error);
    report(`${label} ${code === 'conflict' ? 'Try again.' : storageHelp[code]}`);
  }

  async function canSwitch(): Promise<boolean> {
    if (!session || (await session.flush()).ok) return true;
    navigate('editor');
    editorPane.focus();
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
    run('Could not open the note.', async () => {
      if (session?.committed.id === id && session.dirty) {
        navigate('editor');
        editorPane.focus();
        return;
      }
      if (!await canSwitch()) return;
      const note = await repository.get(id);
      if (!note) {
        report('This note is no longer saved. Choose another note.');
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
    setText(listStatus, 'Loading notes…');
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
      setText(listStatus, '');
      paintList();
    } catch (error) {
      if (request !== listRequest) return;
      const message = `Could not load notes. ${storageHelp[storageErrorCode(error)]}`;
      setText(listStatus, message);
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
    const sorted = [...notes.values()].sort((a, b) => titles.compare(a.title, b.title) || a.id.localeCompare(b.id));
    let focusedButton: HTMLButtonElement | undefined;
    for (const [index, note] of sorted.entries()) {
      let row = existing.get(note.id);
      if (!row) {
        row = element('li');
        const control = button('', () => openNote(note.id));
        control.dataset.noteId = note.id;
        row.append(control);
      }
      existing.delete(note.id);
      const control = row.firstElementChild as HTMLButtonElement;
      setText(control, displayTitle(note.title));
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
    const saveFailed = 'Save failed. Your changes are not saved.';
    const status = state === 'saving' ? 'Saving…'
      : state === 'saved' ? 'Saved on this device'
      : state === 'dirty' ? 'Unsaved changes'
      : state === 'failed' && !conflict ? saveFailed : '';
    setText(saveStatus, status);
    saveStatus.dataset.state = state ?? '';
    if ((state === 'saving' || state === 'saved') && announcedSave !== status) {
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
      ? 'A newer version of this note is already saved. Your draft has not been saved.'
      : code ? 'The last saved version is unchanged.' : '';
    setText(recoveryDetail, detail);
    setText(storageDetail, code ? storageHelp[code] : '');
    const failure = code ? [conflict ? '' : saveFailed, detail, storageHelp[code]].filter(Boolean).join(' ') : '';
    if (failure && failure !== announcedFailure) feedback.alert(failure);
    announcedFailure = failure;
  }

  async function copyDraft(): Promise<void> {
    if (!session) return;
    const current = session;
    const draft = current.draft;
    clipboardDetail.hidden = true;
    try {
      await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`);
      feedback.announce('Draft copied.');
    } catch {
      if (session !== current) return;
      const message = 'Could not copy the draft. Select and copy the text in the editor.';
      setText(clipboardDetail, message);
      clipboardDetail.hidden = false;
      feedback.alert(message);
    }
  }

  paintEditor();
  return {
    listPane, editorPane, issue,
    enter() { focusList(); void refresh(); },
    refresh,
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
