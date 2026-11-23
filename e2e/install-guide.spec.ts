import { expect, test } from '@playwright/test';

test('the installation guide works offline, keeps keyboard focus and scrolls on a small screen', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('./');
  await expect(page.locator('.offline-ready')).toBeVisible();
  await context.setOffline(true);
  await page.reload();

  const workspace = page.getByRole('banner').getByRole('button', { name: 'Workspace' });
  await workspace.click();
  const guide = page.locator('.install-guide');
  const summary = guide.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const platform = page.getByRole('combobox', { name: 'Device and browser' });
  await expect(platform).toBeFocused();
  await platform.selectOption({ label: 'iPhone' });
  await expect(guide).toContainText('Share → Add to Home Screen');
  await expect(guide).toContainText('wait for “Available offline”');
  await expect(guide).toContainText('wait for “Saved on this device”');

  const fallback = guide.getByText('If you do not see an install option', { exact: false });
  await fallback.scrollIntoViewIfNeeded();
  await expect(fallback).toBeInViewport();
  expect(await page.locator('.workspace-menu').evaluate(menu => menu.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh-Hans');
  await expect(summary).toHaveText('安装与离线使用');
  const chinese = page.getByRole('combobox', { name: '设备与浏览器' });
  await expect(chinese).toHaveValue('install.iphoneSteps');
  await expect(guide).toContainText('在 Safari 中打开此网站');
  await chinese.selectOption({ label: 'Android · Firefox' });
  await expect(guide).toContainText('打开 Firefox 菜单并轻点“安装”');
  await chinese.focus();
  await page.keyboard.press('Escape');
  await expect(guide).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.workspace-toggle')).toBeFocused();
});
