import type { AppDeps, Theme, UpdateState } from '../contracts';
import { createBackupMenu } from './backup';
import { button, createFeedback, element, setText, type Feedback } from './dom';
import { updateCopy } from './messages';
import { createNotes } from './notes';

type Route = 'launcher' | 'list' | 'editor';

export function mountApp(root: HTMLElement, deps: AppDeps): void {
  const { polite, assertive, feedback } = createFeedback();
  const theme = createThemeControl(deps.prefs, feedback);
  const app = element('div', undefined, 'workspace');
  const header = element('header', undefined, 'app-header');
  const brand = element('div');
  brand.append(element('p', 'Local workspace', 'eyebrow'), element('h1', 'PWA Web OS'));
  header.append(brand, theme);

  const demo = element('div', undefined, 'demo-notice');
  const build = element('small', `Build ID: ${deps.buildId}`);
  build.id = 'build-id';
  demo.append(element('p', 'Demo build. Notes are stored only on this device and are never uploaded.'), build);

  const connection = element('div', undefined, 'connection');
  const offline = element('span', 'Offline', 'badge');
  const ready = element('span', 'Available offline', 'badge');
  connection.append(offline, ready);
  const update = element('section', undefined, 'update-notice feedback');
  const updateHeading = element('h2');
  updateHeading.id = 'update-heading';
  update.setAttribute('aria-labelledby', updateHeading.id);
  const updateText = element('p');
  const updateProgress = element('span', undefined, 'progress-mark');
  updateProgress.setAttribute('aria-hidden', 'true');
  const updateButton = button('Update', () => { void requestUpdate(false); });
  const retryUpdate = button('Retry update', () => { void requestUpdate(true); });
  update.append(updateProgress, updateHeading, updateText, updateButton, retryUpdate);

  const grid = element('main', undefined, 'workspace-grid');
  const rail = element('nav', undefined, 'workspace-rail panel');
  rail.setAttribute('aria-label', 'Workspace');
  const launcher = element('section', undefined, 'launcher panel');
  launcher.setAttribute('aria-labelledby', 'launcher-heading');
  const launcherHeading = element('h2', 'Workspace launcher');
  launcherHeading.id = 'launcher-heading';
  launcherHeading.tabIndex = -1;
  const railLauncher = button('Workspace launcher', openLauncher);
  const railNotes = button('Notes', () => notes.enter());
  rail.append(element('p', 'Workspace', 'eyebrow'), railLauncher, railNotes);
  const tile = button('Notes', () => notes.enter(), 'launcher-tile');
  tile.prepend(noteIcon());
  launcher.append(element('p', 'Built-in tools', 'eyebrow'), launcherHeading,
    element('p', 'Open Notes to write and keep your work on this device.', 'muted'), tile);

  const notes = createNotes(deps.storage.repository, feedback, setRoute, openLauncher);
  const backup = createBackupMenu(deps.storage.backup, notes.hasUnsaved, notes.refresh, feedback);
  const tools = element('div', undefined, 'workspace-tools');
  tools.append(connection, backup.menu);
  grid.append(rail, launcher, notes.listPane, notes.editorPane);
  app.append(header, demo, tools, update, notes.issue, grid, backup.dialog);
  setRoute('launcher');
  root.replaceChildren(app);
  // The update controller makes #app inert while it switches builds. Keep the live
  // regions outside that subtree so progress and failures are still announced.
  document.querySelectorAll('[data-live-regions]').forEach((node) => node.remove());
  const live = element('div');
  live.dataset.liveRegions = '';
  live.append(polite, assertive);
  if (root.parentNode) root.after(live);
  else app.append(live);

  let current: UpdateState | undefined;
  let requesting = false;
  let lastOnline: boolean | undefined;
  ready.hidden = true;
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

  function setRoute(route: Route): void {
    app.dataset.route = route;
    if (route === 'launcher') {
      railLauncher.setAttribute('aria-current', 'page');
      railNotes.removeAttribute('aria-current');
    } else {
      railNotes.setAttribute('aria-current', 'page');
      railLauncher.removeAttribute('aria-current');
    }
  }

  function openLauncher(): void {
    setRoute('launcher');
    launcherHeading.focus();
  }

  function renderConnection(): void {
    const online = navigator.onLine;
    if (online === lastOnline) return;
    offline.hidden = online;
    if (!online || lastOnline !== undefined) feedback.announce(online ? 'Back online.' : 'Offline');
    lastOnline = online;
  }

  function renderReadiness(): void {
    const isReady = deps.updates.isOfflineReady();
    if (isReady && ready.hidden) feedback.announce('Available offline');
    ready.hidden = !isReady;
  }

  function lockForUpdate(): void {
    const status = current?.status;
    const progress = status === 'saving' || status === 'activating' || status === 'reloading';
    updateProgress.hidden = !progress;
    updateButton.setAttribute('aria-disabled', String(requesting));
    retryUpdate.setAttribute('aria-disabled', String(requesting));
    notes.setLocked(requesting || progress);
    backup.setLocked(requesting || progress);
  }

  function renderUpdate(state: UpdateState): void {
    if (current?.status === state.status && current?.detail === state.detail) return;
    current = { ...state };
    const { heading, message } = updateCopy(state);
    update.hidden = state.status === 'idle';
    setText(updateHeading, heading);
    setText(updateText, message);
    updateButton.hidden = state.status !== 'available';
    retryUpdate.hidden = state.status !== 'paused' && state.status !== 'failed';
    lockForUpdate();
    if (state.status === 'paused' || state.status === 'failed') feedback.alert(`${heading}. ${message}`);
    else if (state.status !== 'idle') feedback.announce(state.status === 'available' ? heading : message);
  }

  async function requestUpdate(retry: boolean): Promise<void> {
    if (requesting) return;
    requesting = true;
    lockForUpdate();
    try {
      if (retry) await deps.updates.retry();
      else await deps.updates.accept();
    } catch {
      renderUpdate({ status: 'failed', detail: 'activation_failed' });
    } finally {
      requesting = false;
      lockForUpdate();
    }
  }
}

function createThemeControl(prefs: AppDeps['prefs'], feedback: Feedback): HTMLFieldSetElement {
  const group = element('fieldset', undefined, 'theme-control');
  group.append(element('legend', 'Theme', 'visually-hidden'));
  const theme = prefs.getTheme();
  document.documentElement.dataset.theme = theme;
  const choices: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark theme' };
  for (const mode of ['system', 'light', 'dark'] as const) {
    const option = element('label');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = mode;
    radio.checked = mode === theme;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      document.documentElement.dataset.theme = mode;
      if (!prefs.setTheme(mode).persisted) feedback.announce('Theme changed for this session only.');
    });
    option.append(radio, element('span', choices[mode]));
    group.append(option);
  }
  return group;
}

function noteIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}
