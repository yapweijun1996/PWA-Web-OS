import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import AxeBuilder from '@axe-core/playwright';
import { markKnownFirefoxAxeCrash } from './helpers/firefox-axe';
import { expect, test as base, type Locator } from '@playwright/test';
import { serveReleases } from '../scripts/pwa-test-server';

const exec = promisify(execFile);
const build = (outDir: string, id: string) => exec(process.execPath, [
  resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir,
], { env: { ...process.env, BUILD_ID: id } });

type ProgressSample = { animated: boolean; transitioning: boolean; announcementInert: boolean; announcement: string };

declare global {
  interface Window { recordUpdateProgress(sample: ProgressSample): void }
}

const test = base.extend<{ notice: Locator }>({
  notice: async ({ page }, use, info) => {
    const distA = info.outputPath('dist-a');
    const distB = info.outputPath('dist-b');
    await Promise.all([build(distA, 'a11y-release-a'), build(distB, 'a11y-release-b')]);
    const server = await serveReleases(distA);
    try {
      await page.goto(server.url);
      await expect(page.locator('.connection').getByText('Available offline', { exact: true })).toBeVisible();
      server.deploy(distB);
      await page.reload();
      const notice = page.locator('.update-notice');
      await expect(notice.locator('h2')).toHaveText('Update available', { timeout: 10_000 });
      await expect(notice).toBeVisible();
      await use(notice);
    } finally {
      await server.close();
    }
  },
});

test('axe scans a real waiting release notice at all three sizes and in both themes', async ({ page, notice, browser }) => {
  markKnownFirefoxAxeCrash(browser);
  test.setTimeout(60_000);
  const findings: { state: string; rules: { id: string; targets: unknown[] }[] }[] = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      await page.locator('.workspace-toggle').click();
      await page.locator(`input[name="theme"][value="${theme}"]`).check();
      await page.locator('.workspace-toggle').click();
      await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
      await expect(notice).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      if (violations.length) findings.push({
        state: `update notice: ${viewport.width}x${viewport.height}, ${theme}`,
        rules: violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })),
      });
    }
  }
  expect(findings).toEqual([]);
});

test('reduced motion keeps real update progress static and its live announcement accessible', async ({ page, notice }) => {
  // Observe the actual update before navigation; no worker, controller or progress UI is replaced.
  const samples: ProgressSample[] = [];
  await page.exposeFunction('recordUpdateProgress', (sample: ProgressSample) => { samples.push(sample); });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.progress-mark')).toHaveCSS('animation-name', 'progress');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const progress = document.querySelector<HTMLElement>('.progress-mark')!;
    const update = progress.closest('section')!;
    const hasDuration = (list: string) => list.split(',').some((duration) => parseFloat(duration) > 0);
    const observer = new MutationObserver(() => {
      if (progress.hidden || progress.getClientRects().length === 0) return;
      const styles = [update, ...Array.from(update.querySelectorAll('*'))].map((node) => getComputedStyle(node));
      const status = document.querySelector('[role="status"]');
      window.recordUpdateProgress({
        animated: styles.some((style) => style.animationName !== 'none' && hasDuration(style.animationDuration)),
        transitioning: styles.some((style) => style.transitionProperty !== 'none' && hasDuration(style.transitionDuration)),
        announcementInert: !!status?.closest('[inert]'),
        announcement: status?.textContent ?? '',
      });
      observer.disconnect();
    });
    observer.observe(progress, { attributes: true, attributeFilter: ['hidden'] });
  });
  await notice.getByRole('button', { name: 'Update', exact: true }).click();
  await expect(page.locator('#build-id')).toHaveText('Build ID: a11y-release-b', { timeout: 10_000 });
  await expect.poll(() => samples.length).toBe(1);
  expect(samples[0]).toMatchObject({ animated: false, transitioning: false, announcement: /updat|reload/i });
  expect(samples[0].announcementInert, 'the progress live region must not be in the inert tree').toBe(false);
});
