import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LIMITS } from '../src/contracts';

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const themes = ['Light', 'Dark theme'] as const;
const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];

// State setup uses CSS locators so axe, rather than the setup, audits semantics.

test.describe('production Notes accessibility', () => {
  for (const viewport of viewports) {
    for (const theme of themes) {
      test(`axe scans Notes and backup states at ${viewport.width}x${viewport.height}, ${theme}`, async ({ page, context }) => {
        test.setTimeout(60_000);
        const findings: Awaited<ReturnType<typeof scan>>[] = [];
        const audit = async (state: string) => {
          const result = await scan(page, state);
          if (result.rules.length) findings.push(result);
        };
        await page.setViewportSize(viewport);
        await page.goto('./');
        await page.locator(`input[name="theme"][value="${theme === 'Light' ? 'light' : 'dark'}"]`).check();
        await expect(page.locator('html')).toHaveCSS('color-scheme', theme === 'Light' ? 'light' : 'dark');
        await expect(page.locator('.connection').getByText('Available offline', { exact: true })).toBeVisible();
        await audit('launcher');

        await openNotes(page);
        await expect(page.locator('.notes-list .empty-state')).toBeVisible();
        await audit('empty Notes');
        await page.locator('.notes-list .primary').click();
        const title = page.locator('#note-title');
        await title.fill('Synthetic accessibility note');
        await saved(page);
        await audit('editor');

        if (viewport.width < 704) await page.locator('.list-back').click();
        const note = page.locator('.note-items button').filter({ hasText: 'Synthetic accessibility note' });
        await expect(note).toBeVisible();
        await audit('populated Notes');
        await note.click();
        await expect(title).toHaveValue('Synthetic accessibility note');

        // Real validation rejection, not a simulated IndexedDB outage.
        await title.fill('x'.repeat(LIMITS.titleBytes + 1));
        await expect(page.locator('.save-status')).toHaveText('Save failed. Your changes are not saved.');
        await audit('save failed (text limit)');
        await title.fill('Synthetic corrected title');
        await page.locator('.recovery button').filter({ hasText: /^Retry$/ }).click();
        await saved(page);

        // Both tabs use the production IndexedDB store. The second tab commits first.
        const peer = await context.newPage();
        try {
          await peer.goto(page.url());
          await openNotes(peer);
          await peer.locator('.note-items button').filter({ hasText: 'Synthetic corrected title' }).click();
          await peer.locator('#note-body').fill('Synthetic newer revision');
          await saved(peer);
        } finally {
          await peer.close();
        }
        const body = page.locator('#note-body');
        await body.fill('Synthetic stale draft');
        await expect(page.locator('.recovery button').filter({ hasText: /^Save as new$/ })).toBeVisible();
        await expect(body).toHaveValue('Synthetic stale draft');
        await audit('revision conflict');
        const reloadSaved = page.locator('.recovery button').filter({ hasText: /^Reload saved version$/ });
        await reloadSaved.click();
        const discard = page.locator('dialog[aria-labelledby="discard-heading"]');
        await expect(discard).toBeVisible();
        await audit('discard confirmation');
        await page.keyboard.press('Escape');
        await expect(discard).toBeHidden();
        await expect(reloadSaved).toBeFocused();
        await expect(body).toHaveValue('Synthetic stale draft');
        await reloadSaved.press('Enter');
        await discard.locator('button').filter({ hasText: /^Discard and reload$/ }).click();
        await expect(body).toHaveValue('Synthetic newer revision');

        await page.locator('.backup-menu summary').click();
        await expect(page.locator('.backup-menu button').filter({ hasText: /^Export backup$/ })).toBeVisible();
        await audit('backup disclosure');
        const file = page.locator('input[type="file"]');
        await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('invalid JSON') });
        await expect(page.locator('.backup-menu').getByText(/not a valid Notes backup/)).toBeVisible();
        await audit('invalid backup feedback');
        await file.setInputFiles({
          name: 'synthetic.json', mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({ format: 'pwa-web-os.notes', version: 1, notes: [{
            id: '00000000-0000-4000-8000-000000000001', title: 'Synthetic imported note', body: '', updatedAt: 1,
          }] })),
        });
        await expect(page.locator('dialog[aria-labelledby="restore-heading"]')).toBeVisible();
        await audit('restore preview');
        expect(findings).toEqual([]);
      });
    }
  }
});

async function scan(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  return { state, rules: violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })) };
}

async function openNotes(page: Page): Promise<void> {
  await page.locator('.launcher-tile').click();
}

async function saved(page: Page): Promise<void> {
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
}
