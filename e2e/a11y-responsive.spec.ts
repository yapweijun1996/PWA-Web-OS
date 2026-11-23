import { expect, test, type Locator, type Page } from '@playwright/test';
import { LIMITS } from '../src/contracts';

const viewports = [
  { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 },
  { width: 768, height: 1024 }, { width: 1280, height: 800 },
];

for (const viewport of viewports) {
  test(`launcher, list, editor and backup reflow without horizontal scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const tile = page.getByRole('region', { name: 'Workspace launcher' }).getByRole('button', { name: 'Notes' });
    await withinViewport(page, tile);
    await minimumTarget(tile);
    const workspace = page.getByRole('banner').getByRole('button', { name: 'Workspace' });
    await minimumTarget(workspace);
    await workspace.click();
    await minimumTarget(page.getByText('Dark theme', { exact: true }).locator('..'));
    await workspace.click();
    await tile.click();
    const add = page.getByRole('button', { name: 'New note' });
    await withinViewport(page, add);
    await minimumTarget(add);
    await add.click();
    const title = page.getByRole('textbox', { name: 'Title' });
    const longTitle = 'W'.repeat(LIMITS.titleBytes);
    await title.fill(longTitle);
    await expect(page.locator('.save-status')).toHaveText('Saved on this device');
    await withinViewport(page, title, page.getByRole('textbox', { name: 'Body' }));
    const back = page.getByRole('button', { name: 'Back to Notes list' });
    if (viewport.width <= 600) await back.click();
    await withinViewport(page, page.getByRole('button', { name: longTitle, exact: true }));
    await workspace.click();
    const summary = page.getByText('Backup and restore', { exact: true });
    await minimumTarget(summary);
    await summary.click();
    await withinViewport(page, page.getByRole('button', { name: 'Export backup' }), page.getByRole('button', { name: 'Restore backup' }));
    await page.locator('input[type="file"]').setInputFiles({
      name: 'synthetic.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'pwa-web-os.notes', version: 1, notes: [{
        id: '00000000-0000-4000-8000-000000000001', title: longTitle, body: '', updatedAt: 1,
      }] })),
    });
    const dialog = page.getByRole('dialog', { name: 'Restore preview' });
    await withinViewport(page, dialog, dialog.getByRole('button', { name: 'Cancel' }));
    expect(await dialog.evaluate((node) => node.scrollWidth === node.clientWidth)).toBe(true);
  });
}

for (const width of [320, 768]) {
  test(`200% root text size retains usable editor fields at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    const normal = await page.locator('html').evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expect(page.locator('html')).toHaveCSS('font-size', `${normal * 2}px`);
    await page.getByRole('region', { name: 'Workspace launcher' }).getByRole('button', { name: 'Notes' }).click();
    await page.getByRole('button', { name: 'New note' }).click();
    const title = page.getByRole('textbox', { name: 'Title' });
    const body = page.getByRole('textbox', { name: 'Body' });
    await title.fill('Synthetic zoom title');
    await title.press('Tab');
    await expect(body).toBeFocused();
    await body.pressSequentially('Synthetic zoom body');
    await expect(body).toHaveValue('Synthetic zoom body');
    await expect(page.locator('.save-status')).toHaveText('Saved on this device');
    await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeHidden();
    const lines = await title.evaluate((node: HTMLTextAreaElement) => node.clientHeight >= parseFloat(getComputedStyle(node).lineHeight)
      + parseFloat(getComputedStyle(node).paddingBlockStart) + parseFloat(getComputedStyle(node).paddingBlockEnd));
    expect(lines, 'the one-row title fits a full line at 200% text size').toBe(true);
    await withinViewport(page, title, body);
  });
}

test('production HTML opts into viewport-fit and workspace CSS uses all four safe-area insets', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /(?:^|,\s*)viewport-fit=cover(?:,|$)/);
  for (const selector of ['.workspace', 'dialog']) {
    const declarations = await page.evaluate((selector) => Array.from(document.styleSheets).flatMap((sheet) =>
      Array.from(sheet.cssRules).filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText === selector)
        .map((rule) => rule.style.cssText)).join(' '), selector);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(declarations).toContain(`env(safe-area-inset-${side})`);
    }
  }
});

async function withinViewport(page: Page, ...controls: Locator[]): Promise<void> {
  const sizes = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(sizes.scroll).toBe(sizes.client);
  for (const control of controls) {
    await expect(control).toBeVisible();
    const bounds = (await control.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(sizes.client);
  }
}

async function minimumTarget(control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  const size = await control.evaluate((node) => {
    const { width, height } = node.getBoundingClientRect();
    return { width, height };
  });
  expect(size.height).toBeGreaterThanOrEqual(44);
  expect(size.width).toBeGreaterThanOrEqual(44);
}
