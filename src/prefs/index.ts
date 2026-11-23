// STUB owned by the UI workstream: implement against localStorage per docs/M0_DECISIONS.md.
import type { PreferenceStore, Theme } from '../contracts';

export function createPreferenceStore(): PreferenceStore {
  let theme: Theme = 'system';
  return {
    getTheme: () => theme,
    setTheme(next) {
      theme = next;
      return { persisted: false };
    },
  };
}
