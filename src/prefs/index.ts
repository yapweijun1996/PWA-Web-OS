import { THEMES, THEME_KEY, type PreferenceStore, type Theme } from '../contracts';

export function createPreferenceStore(): PreferenceStore {
  let theme: Theme = 'system';
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    theme = THEMES.find(value => value === stored) ?? theme;
  } catch {
    // Storage access itself can be denied, even when the API exists.
  }

  return {
    getTheme: () => theme,
    setTheme(next) {
      theme = next;
      try {
        window.localStorage.setItem(THEME_KEY, next);
        return { persisted: true };
      } catch {
        return { persisted: false };
      }
    },
  };
}
