import type { MessageKey } from '../i18n';
import { element } from './dom';
import type { LocalizedUi } from './localized';

const platforms = [
  ['install.iphone', 'install.iphoneSteps'],
  ['install.androidChrome', 'install.androidChromeSteps'],
  ['install.androidFirefox', 'install.androidFirefoxSteps'],
  ['install.desktopChrome', 'install.desktopChromeSteps'],
  ['install.windowsFirefox', 'install.windowsFirefoxSteps'],
  ['install.macFirefox', 'install.macFirefoxSteps'],
] as const satisfies ReadonlyArray<readonly [MessageKey, MessageKey]>;

export function createInstallGuide(ui: LocalizedUi): HTMLDetailsElement {
  const guide = element('details', undefined, 'install-guide');
  const summary = ui.label('summary', 'install.summary');
  const label = ui.label('label', 'install.platform');
  const select = element('select');
  select.id = 'install-platform';
  label.htmlFor = select.id;
  const prompt = ui.label('option', 'install.choose');
  prompt.value = '';
  select.append(prompt);
  for (const [name, steps] of platforms) {
    const option = ui.label('option', name);
    option.value = steps;
    select.append(option);
  }

  const directions = element('p');
  directions.setAttribute('aria-live', 'polite');
  select.addEventListener('change', () => {
    const match = platforms.find(([, steps]) => steps === select.value);
    ui.text(directions, match?.[1] ?? (() => ''));
  });
  guide.append(summary, label, select, directions,
    ui.label('p', 'install.fallback'),
    ui.label('p', t => t('install.offline', { ready: t('shell.ready'), saved: t('notes.saved') })));
  guide.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !guide.open) return;
    event.preventDefault();
    guide.open = false;
    summary.focus();
  });
  return guide;
}
