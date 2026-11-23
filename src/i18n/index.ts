import { en, type MessageKey } from './en';
import { zhHans } from './zhHans';
import type { Locale } from '../prefs/locale';

export type { MessageKey };
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;
export type Copy = MessageKey | ((t: Translate) => string);

export function createLanguage(initial: Locale) {
  let locale = initial;
  let formats = createFormats(locale);
  const listeners = new Set<() => void>();
  const t: Translate = (key, values) => {
    const template = (locale === 'zh-Hans' ? zhHans[key] : en[key]) ?? en[key];
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = values[name];
      return typeof value === 'number' ? formats.number.format(value) : value;
    });
  };

  return {
    t,
    resolve: (copy: Copy) => typeof copy === 'string' ? t(copy) : copy(t),
    shortDate: (date: Date) => formats.shortDate.format(date),
    time: (date: Date) => formats.time.format(date),
    get locale() { return locale; },
    onChange(listener: () => void) { listeners.add(listener); },
    set(next: Locale) {
      if (locale === next) return;
      locale = next;
      formats = createFormats(next);
      for (const listener of listeners) listener();
    },
  };
}
function createFormats(locale: Locale) {
  return {
    number: new Intl.NumberFormat(locale),
    shortDate: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
  };
}

export type Language = ReturnType<typeof createLanguage>;
