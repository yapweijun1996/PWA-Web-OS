import type { LocalizedUi } from './localized';
import type { MessageKey } from '../i18n';
import { saveLocale } from '../prefs/locale';
import { THEMES, type PreferenceStore, type Theme } from '../contracts';
import { button, element, type Feedback } from './dom';
import { icon } from './icons';

export function createWorkspaceMenu(ui: LocalizedUi, prefs: PreferenceStore, feedback: Feedback) {
  const panel = element('section', undefined, 'workspace-menu');
  panel.id = 'workspace-menu';
  ui.attr(panel, 'aria-label', 'shell.settings');
  const trigger = button('', () => setOpen(panel.hasAttribute('hidden')), 'workspace-toggle');
  trigger.setAttribute('aria-controls', panel.id);
  trigger.append(ui.label('span', 'shell.workspace'), icon('chevron'));
  const group = element('fieldset', undefined, 'theme-control');
  group.append(ui.label('legend', 'settings.theme'));
  const theme = prefs.getTheme();
  document.documentElement.dataset.theme = theme;
  const choices: Record<Theme, MessageKey> = { system: 'settings.system', light: 'settings.light', dark: 'settings.dark' };
  for (const mode of THEMES) {
    const option = element('label');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = mode;
    radio.checked = mode === theme;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      document.documentElement.dataset.theme = mode;
      if (!prefs.setTheme(mode).persisted) feedback.announce('settings.themeSession');
    });
    option.append(radio, ui.label('span', choices[mode]));
    group.append(option);
  }
  const localeControl = element('label', undefined, 'locale-control');
  const select = element('select');
  for (const [value, name] of [['en', 'English'], ['zh-Hans', '简体中文']] as const) {
    const option = element('option', name);
    option.lang = value;
    option.value = value;
    select.append(option);
  }
  select.value = ui.language.locale;
  select.addEventListener('change', () => {
    const locale = select.value;
    if (locale !== 'en' && locale !== 'zh-Hans') return;
    ui.language.set(locale);
    if (!saveLocale(locale)) feedback.announce('settings.localeSession');
  });
  localeControl.append(ui.label('span', 'settings.language'), select);
  panel.append(group, localeControl);
  setOpen(false);

  function setOpen(open: boolean): void {
    if (!open && panel.contains(document.activeElement)) trigger.focus();
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  }

  const dismissOutside = (event: Event) => {
    if (panel.hidden || document.querySelector('dialog[open]')) return;
    const target = event.target;
    if (target instanceof Node && !panel.contains(target) && !trigger.contains(target)) setOpen(false);
  };
  document.addEventListener('pointerdown', dismissOutside);
  document.addEventListener('focusin', dismissOutside);
  for (const control of [trigger, panel]) {
    control.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || panel.hidden) return;
      event.preventDefault();
      setOpen(false);
    });
  }
  return { trigger, panel, show: () => setOpen(true) };
}
