import type { PreferenceStore, Theme } from '../contracts';
import { button, element, type Feedback } from './dom';
import { icon } from './icons';

export function createWorkspaceMenu(prefs: PreferenceStore, feedback: Feedback) {
  const panel = element('section', undefined, 'workspace-menu');
  panel.id = 'workspace-menu';
  panel.setAttribute('aria-label', 'Workspace settings');
  const trigger = button('', () => setOpen(panel.hasAttribute('hidden')), 'workspace-toggle');
  trigger.setAttribute('aria-controls', panel.id);
  trigger.append(element('span', 'Workspace'), icon('chevron'));
  const group = element('fieldset', undefined, 'theme-control');
  group.append(element('legend', 'Theme'));
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
  panel.append(group);
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
