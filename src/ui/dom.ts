import type { Copy } from '../i18n';
import type { LocalizedUi } from './localized';
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, text?: string, className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function button(label: string, action: () => void, className?: string): HTMLButtonElement {
  const node = element('button', label, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export interface Feedback {
  announce(message: Copy): void;
  alert(message: Copy): void;
}

export function createFeedback(ui: LocalizedUi) {
  const polite = element('div', undefined, 'visually-hidden');
  polite.setAttribute('role', 'status');
  const assertive = element('div', undefined, 'visually-hidden');
  assertive.setAttribute('role', 'alert');
  const feedback: Feedback = {
    announce: (message) => { ui.text(polite, message); },
    alert: (message) => { ui.text(assertive, message); },
  };
  return { polite, assertive, feedback };
}

export function openDialog(dialog: HTMLDialogElement, cancel: HTMLButtonElement, trigger: HTMLElement): void {
  trigger.focus();
  dialog.addEventListener('close', () => {
    // Native modal dialogs restore focus themselves. Cover a disabled trigger or
    // a browser that does not restore it when closed programmatically.
    if (document.activeElement === document.body || dialog.contains(document.activeElement)) {
      trigger.focus();
    }
  }, { once: true });
  dialog.showModal();
  cancel.focus();
}
