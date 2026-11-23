import { expect, test } from 'vitest';
import { browserLocale } from '../prefs/locale';
import { en, type MessageKey } from './en';
import { zhHans } from './zhHans';

test('both offline catalogs provide every message and preserve its named placeholders', () => {
  const slots = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
  expect(Object.keys(zhHans).sort()).toEqual(Object.keys(en).sort());
  for (const key of Object.keys(en) as MessageKey[]) {
    expect(zhHans[key].trim(), key).not.toBe('');
    expect(slots(zhHans[key]), key).toEqual(slots(en[key]));
  }
});

test('resolves supported preferences in order without treating Traditional Chinese as Simplified', () => {
  expect(browserLocale(['de-DE', 'zh-Hans-SG'])).toBe('zh-Hans');
  expect(browserLocale(['zh-CN'])).toBe('zh-Hans');
  expect(browserLocale(['en-SG', 'zh-SG'])).toBe('en');
  expect(browserLocale(['invalid?', 'zh-Hant', 'zh-TW'])).toBe('en');
});
