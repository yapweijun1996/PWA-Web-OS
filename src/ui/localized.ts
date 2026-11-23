import type { Copy, Language } from '../i18n';
import { button, element } from './dom';

// Bind stable UI nodes so switching language does not replace inputs, dialogs or
// focused controls. Note content and transient list rows are rendered separately.
export function localizedUi(language: Language) {
  const bindings = new Map<Text, Copy>();
  language.onChange(() => {
    for (const [text, copy] of bindings) text.data = language.resolve(copy);
  });
  function text(node: HTMLElement, copy: Copy) {
    const first = node.firstChild;
    const target = first instanceof Text ? first : document.createTextNode('');
    if (first !== target) node.prepend(target);
    bindings.set(target, copy);
    const translated = language.resolve(copy);
    if (target.data !== translated) target.data = translated;
  }
  function label<K extends keyof HTMLElementTagNameMap>(tag: K, copy: Copy, className?: string) {
    const node = element(tag, undefined, className);
    text(node, copy);
    return node;
  }
  function action(copy: Copy, fn: () => void, className?: string) {
    const node = button('', fn, className);
    text(node, copy);
    return node;
  }
  function attr(node: HTMLElement, name: string, copy: Copy) {
    const render = () => node.setAttribute(name, language.resolve(copy));
    render();
    language.onChange(render);
  }
  return { language, text, label, action, attr };
}
export type LocalizedUi = ReturnType<typeof localizedUi>;
