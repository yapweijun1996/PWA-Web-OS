import { createLanguage, type MessageKey } from '../i18n';
import { readLocale } from '../prefs/locale';
import { localizedUi, type LocalizedUi } from './localized';
import type { AppDeps, UpdateState } from '../contracts';
import { createBackupMenu } from './backup';
import { button, createFeedback, element } from './dom';
import { icon } from './icons';
import { createInstallGuide } from './install-guide';
import { updateCopy } from './messages';
import { createNotes } from './notes';
import { createWorkspaceMenu } from './workspace-menu';

type Surface = 'launcher' | 'notes' | 'desktop';

export function mountApp(root: HTMLElement, deps: AppDeps): void {
  const language = createLanguage(readLocale());
  const ui = localizedUi(language);
  const setDocumentLanguage = () => {
    document.documentElement.lang = language.locale;
    document.title = language.t('shell.title');
  };
  setDocumentLanguage();
  language.onChange(setDocumentLanguage);
  const { polite, assertive, feedback } = createFeedback(ui);
  const app = element('div', undefined, 'workspace');
  const banner = element('header', undefined, 'top-bar');
  const brand = element('div', undefined, 'brand');
  brand.append(icon('brand'), element('h1', 'PWA Web OS'));
  const menu = createWorkspaceMenu(ui, deps.prefs, feedback);

  const demo = element('footer', undefined, 'demo-notice');
  const build = ui.label('small', t => t('shell.build', { build: deps.buildId }));
  build.id = 'build-id';
  demo.append(ui.label('p', 'shell.demo'), build);

  const systemStatus = element('div', undefined, 'system-status');
  systemStatus.setAttribute('role', 'region');
  ui.attr(systemStatus, 'aria-label', 'shell.connection');
  const connection = element('div', undefined, 'connection');
  const network = element('span', undefined, 'network-status');
  const ready = ui.label('span', 'shell.ready', 'offline-ready');
  ready.hidden = true;
  connection.append(network, ready);
  const clock = element('time', undefined, 'clock');
  systemStatus.append(connection, clock);
  banner.append(brand, menu.trigger, menu.panel, systemStatus);

  const update = element('section', undefined, 'update-notice');
  const updateHeading = element('h2');
  updateHeading.id = 'update-heading';
  update.setAttribute('aria-labelledby', updateHeading.id);
  const updateText = element('p');
  const updateProgress = element('span', undefined, 'progress-mark');
  updateProgress.setAttribute('aria-hidden', 'true');
  const updateButton = ui.action('update.action', () => { void requestUpdate(false); });
  const retryUpdate = ui.action('update.retry', () => { void requestUpdate(true); });
  update.append(updateProgress, updateHeading, updateText, updateButton, retryUpdate);

  const stage = element('main', undefined, 'workspace-stage');
  const launcher = element('section', undefined, 'launcher');
  const launcherHeading = ui.label('h2', 'shell.launcher');
  launcherHeading.id = 'launcher-heading';
  launcherHeading.tabIndex = -1;
  launcher.setAttribute('aria-labelledby', launcherHeading.id);
  const tile = ui.action('notes.name', openNotes, 'launcher-tile');
  tile.prepend(icon('lines'));
  launcher.append(ui.label('p', 'shell.tools', 'eyebrow'), launcherHeading,
    ui.label('p', 'shell.intro', 'muted'), tile);

  const notes = createNotes(ui, deps.storage.repository, feedback, openLauncher);
  const backup = createBackupMenu(ui, deps.storage.backup, notes.hasUnsaved, notes.refresh, feedback, menu.show);
  menu.panel.append(backup.menu, createInstallGuide(ui), ui.label('p', 'shell.demo', 'menu-disclosure'));

  const notesWindow = element('div', undefined, 'notes-window');
  notesWindow.id = 'notes-window';
  const windowBar = element('div', undefined, 'window-bar');
  const windowControls = element('div', undefined, 'window-controls');
  const minimize = windowButton(ui, 'shell.minimize', 'minimize', () => hideNotes(true));
  const maximize = windowButton(ui, 'shell.maximize', 'maximize', toggleMaximized);
  const close = windowButton(ui, 'shell.close', 'close', () => { void closeNotes(); });
  windowControls.append(minimize, maximize, close);
  windowBar.append(icon('document'), notes.heading, windowControls);
  notesWindow.append(windowBar, notes.issue, notes.panes);
  stage.append(launcher, notesWindow);

  const dock = element('nav', undefined, 'dock');
  ui.attr(dock, 'aria-label', 'shell.dock');
  const workspaceDock = dockButton(ui, 'shell.workspace', 'cube', openLauncher);
  const notesDock = dockButton(ui, 'notes.name', 'lines', openNotes);
  notesDock.setAttribute('aria-controls', notesWindow.id);
  dock.append(workspaceDock, notesDock);
  app.append(banner, stage, demo, dock, backup.dialog);
  let surface: Surface = 'launcher';
  let running = false;
  let maximized = false;
  let closing = false;
  language.onChange(paintMaximizeLabel);
  renderSurface();
  root.replaceChildren(app);
  // Both the notice and its announcements must survive #app becoming inert.
  if (root.parentNode) root.before(update);
  else app.prepend(update);
  document.querySelectorAll('[data-live-regions]').forEach((node) => node.remove());
  const live = element('div');
  live.dataset.liveRegions = '';
  live.append(polite, assertive);
  if (root.parentNode) root.after(live);
  else app.append(live);

  let current: UpdateState | undefined;
  let requesting = false;
  let lastOnline: boolean | undefined;
  deps.updates.setFlush(async () => {
    await backup.settle();
    return notes.flush();
  });
  deps.updates.subscribe(renderUpdate);
  renderUpdate(deps.updates.getState());
  deps.updates.onOfflineReadyChange(renderReadiness);
  renderReadiness();
  window.addEventListener('online', renderConnection);
  window.addEventListener('offline', renderConnection);
  renderConnection();
  startClock(clock, ui);

  function renderSurface(): void {
    launcher.hidden = surface !== 'launcher';
    notesWindow.hidden = surface !== 'notes';
    workspaceDock.toggleAttribute('data-running', surface === 'launcher');
    notesDock.toggleAttribute('data-running', running);
    workspaceDock.setAttribute('aria-pressed', String(surface === 'launcher'));
    notesDock.setAttribute('aria-pressed', String(surface === 'notes'));
  }

  function openLauncher(): void {
    if (closing) return;
    surface = 'launcher';
    renderSurface();
    launcherHeading.focus();
  }

  function openNotes(): void {
    if (closing) return;
    surface = 'notes';
    running = true;
    renderSurface();
    notes.enter();
  }

  function hideNotes(stillRunning: boolean): void {
    if (closing) return;
    surface = 'desktop';
    running = stillRunning;
    renderSurface();
    notesDock.focus();
  }

  function paintMaximizeLabel(): void {
    const label = language.t(maximized ? 'shell.restore' : 'shell.maximize');
    maximize.setAttribute('aria-label', label);
    maximize.title = label;
  }

  function toggleMaximized(): void {
    if (closing) return;
    maximized = !maximized;
    notesWindow.toggleAttribute('data-maximized', maximized);
    paintMaximizeLabel();
    maximize.replaceChildren(icon(maximized ? 'restore' : 'maximize'));
  }

  async function closeNotes(): Promise<void> {
    if (closing) return;
    closing = true;
    lockControls();
    try {
      if (!(await notes.flush()).ok) {
        // Keep drafts that still need recovery visible.
        notes.focusEditor();
        return;
      }
    } finally {
      closing = false;
      lockControls();
    }
    if (maximized) toggleMaximized();
    hideNotes(false);
  }

  function renderConnection(): void {
    const online = navigator.onLine;
    if (online === lastOnline) return;
    ui.text(network, online ? 'shell.online' : 'shell.offline');
    network.toggleAttribute('data-offline', !online);
    if (!online || lastOnline !== undefined) feedback.announce(online ? 'shell.reconnected' : 'shell.offline');
    lastOnline = online;
  }

  function renderReadiness(): void {
    const isReady = deps.updates.isOfflineReady();
    if (isReady && ready.hidden) feedback.announce('shell.ready');
    ready.hidden = !isReady;
  }

  function lockControls(): void {
    const status = current?.status;
    const progress = status === 'saving' || status === 'activating' || status === 'reloading';
    updateProgress.hidden = !progress;
    updateButton.setAttribute('aria-disabled', String(requesting));
    retryUpdate.setAttribute('aria-disabled', String(requesting));
    notes.setLocked(closing || requesting || progress);
    backup.setLocked(requesting || progress);
    for (const control of [minimize, maximize, close, workspaceDock, notesDock]) {
      control.setAttribute('aria-disabled', String(closing));
    }
  }

  function renderUpdate(state: UpdateState): void {
    if (current?.status === state.status && current?.detail === state.detail) return;
    current = { ...state };
    const { heading, message } = updateCopy(state);
    update.hidden = state.status === 'idle';
    ui.text(updateHeading, heading);
    ui.text(updateText, message);
    updateButton.hidden = state.status !== 'available';
    retryUpdate.hidden = state.status !== 'paused' && state.status !== 'failed';
    lockControls();
    if (state.status === 'paused' || state.status === 'failed') {
      feedback.alert(t => t('update.alert', { heading: language.resolve(heading), message: language.resolve(message) }));
    } else if (state.status !== 'idle') feedback.announce(state.status === 'available' ? heading : message);
  }

  async function requestUpdate(retry: boolean): Promise<void> {
    if (requesting) return;
    requesting = true;
    lockControls();
    try {
      if (retry) await deps.updates.retry();
      else await deps.updates.accept();
    } catch {
      renderUpdate({ status: 'failed', detail: 'activation_failed' });
    } finally {
      requesting = false;
      lockControls();
    }
  }
}

function windowButton(ui: LocalizedUi, label: MessageKey, glyph: Parameters<typeof icon>[0], action: () => void): HTMLButtonElement {
  const control = button('', action);
  ui.attr(control, 'aria-label', label);
  ui.attr(control, 'title', label);
  control.append(icon(glyph));
  return control;
}

function dockButton(ui: LocalizedUi, label: MessageKey, glyph: 'cube' | 'lines', action: () => void): HTMLButtonElement {
  const control = button('', action, `dock-item dock-${glyph}`);
  ui.attr(control, 'aria-label', label);
  const face = element('span', undefined, 'dock-face');
  face.append(icon(glyph));
  const tooltip = ui.label('span', label, 'dock-tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  control.append(face, tooltip);
  return control;
}

function startClock(clock: HTMLTimeElement, ui: LocalizedUi): void {
  function tick(): void {
    if (!clock.isConnected) return;
    const now = new Date();
    clock.dateTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    ui.text(clock, () => ui.language.time(now));
    setTimeout(tick, 60_000 - now.getTime() % 60_000);
  }
  tick();
}
