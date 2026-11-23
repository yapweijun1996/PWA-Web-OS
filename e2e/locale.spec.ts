import { expect, test } from '@playwright/test';
import { LOCALE_KEY } from '../src/prefs/locale';

test.use({ locale: 'zh-CN' });

test('switches language with an unsaved offline draft and reopens the saved note in the chosen language', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page).toHaveTitle('PWA Web OS 工作区');
  await expect(page.locator('.offline-ready')).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('region', { name: '工作区启动器' }).getByRole('button', { name: '笔记' }).click();
  await page.getByRole('button', { name: '新建笔记' }).click();
  const title = page.locator('#note-title');
  const body = page.locator('#note-body');
  // A rejected save leaves a real unsaved draft open throughout the language change.
  const oversized = '草'.repeat(100);
  await title.fill(oversized);
  await body.fill('Today — 今天');
  await body.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(1, 4));
  await expect(page.locator('.save-status')).toHaveText('保存失败。更改尚未保存。');
  const settings = page.locator('.workspace-toggle');
  await settings.click();
  const language = page.getByRole('combobox', { name: '语言' });
  await language.focus();
  await language.selectOption('en');
  await expect(page.getByRole('combobox', { name: 'Language' })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('PWA Web OS');
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
  await expect(title).toHaveValue(oversized);
  await expect(body).toHaveValue('Today — 今天');
  expect(await body.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([1, 4]);
  await expect(page.locator('.save-status')).toHaveText('Save failed. Your changes are not saved.');
  await title.fill('Today');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.launcher-tile').click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByLabel('Body')).toHaveValue('Today — 今天');
});

test('falls back to the browser language when the preference is invalid or unavailable', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(key => localStorage.setItem(key, 'fr'), LOCALE_KEY);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  await page.reload();
  await page.locator('.workspace-toggle').click();
  await page.getByRole('combobox', { name: '语言' }).selectOption('en');
  await expect(page.getByRole('status')).toHaveText('Language changed for this session only.');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
});
