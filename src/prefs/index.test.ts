// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { THEME_KEY } from '../contracts';
import { createPreferenceStore } from './index';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('defaults to System when the key is absent or invalid', () => {
  expect(createPreferenceStore().getTheme()).toBe('system');
  window.localStorage.setItem(THEME_KEY, 'sepia');
  expect(createPreferenceStore().getTheme()).toBe('system');
});

test('uses System if the localStorage getter throws and keeps a failed write in memory', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Synthetic denial', 'SecurityError');
  });
  const store = createPreferenceStore();
  expect(store.getTheme()).toBe('system');
  expect(store.setTheme('dark')).toEqual({ persisted: false });
  expect(store.getTheme()).toBe('dark');
  expect(createPreferenceStore().getTheme()).toBe('system');
});

test('applies a failed setItem in memory without changing the last persisted choice', () => {
  window.localStorage.setItem(THEME_KEY, 'light');
  const store = createPreferenceStore();
  vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Synthetic quota', 'QuotaExceededError');
  });
  expect(store.setTheme('dark')).toEqual({ persisted: false });
  expect(store.getTheme()).toBe('dark');
  expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
});

test('a new preference store reads a persisted raw value (reload simulation)', () => {
  expect(createPreferenceStore().setTheme('dark')).toEqual({ persisted: true });
  expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  expect(window.localStorage.length).toBe(1);
  expect(createPreferenceStore().getTheme()).toBe('dark');
});
