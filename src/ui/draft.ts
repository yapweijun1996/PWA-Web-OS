import { StorageError, type FlushResult, type Note, type NoteDraft, type NoteRepository } from '../contracts';
import { storageErrorCode } from './messages';

const SAVE_DELAY_MS = 300;

type SaveState = 'saved' | 'dirty' | 'saving' | 'failed';

/** One open editor; only one revision-checked write can run at a time. */
export class DraftSession {
  private snapshot: NoteDraft;
  private version = 0;
  private savedVersion = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private error?: StorageError['code'];

  constructor(
    private lastSaved: Note,
    private readonly repository: NoteRepository,
    private readonly onChange: () => void,
    private readonly onCommit: (note: Note) => void,
  ) {
    this.snapshot = { title: lastSaved.title, body: lastSaved.body };
  }

  get committed(): Note { return this.lastSaved; }
  get draft(): NoteDraft { return { ...this.snapshot }; }
  get dirty(): boolean { return this.version !== this.savedVersion; }
  get failure(): StorageError['code'] | undefined { return this.error; }
  get state(): SaveState {
    return this.error ? 'failed' : this.pending ? 'saving' : this.dirty ? 'dirty' : 'saved';
  }

  edit(field: keyof NoteDraft, value: string): void {
    if (this.snapshot[field] === value) return;
    this.snapshot[field] = value;
    this.version++;
    this.schedule();
    this.onChange();
  }

  async flush(retryFailed = false): Promise<FlushResult> {
    this.clearTimer();
    if (retryFailed && this.error && this.error !== 'conflict') this.save();
    while (this.dirty) {
      if (this.error) return { ok: false, reason: this.error === 'conflict' ? 'conflict' : 'save_failed' };
      await (this.pending ?? this.save());
      this.clearTimer();
    }
    return { ok: true };
  }

  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    this.clearTimer();
    if (this.dirty && !this.pending && !this.error) {
      this.timer = setTimeout(() => { void this.save(); }, SAVE_DELAY_MS);
    }
  }

  private save(): Promise<void> {
    this.clearTimer();
    this.error = undefined;
    const { id, revision } = this.lastSaved;
    const version = this.version;
    const draft = this.draft;
    this.pending = Promise.resolve().then(async () => {
      let committed: Note;
      try {
        committed = await this.repository.update(id, revision, draft);
      } catch (error) {
        this.error = storageErrorCode(error);
        return;
      }
      this.lastSaved = committed;
      this.savedVersion = version;
      this.onCommit(committed);
    }).finally(() => {
      this.pending = undefined;
      this.schedule();
      this.onChange();
    });
    this.onChange();
    return this.pending;
  }
}
