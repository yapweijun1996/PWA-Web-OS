export type Locale = 'en' | 'zh-Hans';

export const LOCALE_KEY = 'pwa-web-os:preferences:locale';

export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    try {
      const tag = new Intl.Locale(language);
      if (tag.language === 'en') return 'en';
      if (tag.language === 'zh' && tag.maximize().script === 'Hans') return 'zh-Hans';
    } catch {
      // Ignore individual malformed language tags.
    }
  }
  return 'en';
}

export function readLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_KEY);
    if (saved === 'en' || saved === 'zh-Hans') return saved;
  } catch { /* Preferences are optional. */ }
  return browserLocale(navigator.languages);
}

export function saveLocale(locale: Locale): boolean {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
