import { expect, test, type Locator, type Page } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`keyboard follows the launcher-to-editor sequence with visible focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    const workspace = await openWorkspaceWithKeyboard(page);
    await tabTo(page, page.locator('.backup-menu summary'));
    await page.keyboard.press('Escape');
    await expect(workspace).toHaveAttribute('aria-expanded', 'false');
    await focusedWithIndicator(workspace);
    const launcher = page.getByRole('region', { name: 'Workspace launcher' });
    await tabTo(page, launcher.getByRole('button', { name: 'Notes' }));
    await page.keyboard.press('Enter');
    const list = page.getByRole('region', { name: 'Notes', exact: true });
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeFocused();
    for (const label of width === 1280 ? ['Minimize', 'Maximize', 'Close'] : ['Workspace launcher']) {
      await tabTo(page, page.getByRole('button', { name: label, exact: true }));
    }
    await tabTo(page, list.getByRole('button', { name: 'New note' }));
    await page.keyboard.press('Enter');
    const title = page.getByRole('textbox', { name: 'Title' });
    await focusedWithIndicator(title);
    await page.keyboard.type('Synthetic keyboard title');
    const body = page.getByRole('textbox', { name: 'Body' });
    await tabTo(page, body);
    await page.keyboard.type('Synthetic keyboard body');
    await expect(body).toHaveValue('Synthetic keyboard body');
    await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  });
}

test('Escape closes the backup disclosure and returns focus to its summary', async ({ page }) => {
  await page.goto('./');
  const { menu, summary } = await openBackupWithKeyboard(page);
  await tabTo(page, page.getByRole('button', { name: 'Export backup' }));
  await page.keyboard.press('Escape');
  await expect.soft(menu, 'the disclosure must close on Escape from inside it').not.toHaveAttribute('open', '');
  await focusedWithIndicator(summary);
});

test('Escape dismisses the real restore preview without importing and returns focus to Restore backup', async ({ page }) => {
  await page.goto('./');
  const { menu } = await openBackupWithKeyboard(page);
  await tabTo(page, page.getByRole('button', { name: 'Export backup' }));
  const restore = page.getByRole('button', { name: 'Restore backup' });
  await tabTo(page, restore);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), restore.press('Enter')]);
  await chooser.setFiles({
    name: 'synthetic.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'pwa-web-os.notes', version: 1, notes: [{
      id: '00000000-0000-4000-8000-000000000001', title: 'Synthetic canceled note', body: '', updatedAt: 1,
    }] })),
  });
  const dialog = page.getByRole('dialog', { name: 'Restore preview' });
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  const confirm = dialog.getByRole('button', { name: 'Restore notes' });
  await expect(cancel).toBeFocused();
  await tabTo(page, confirm);
  // Native dialogs may briefly give focus to browser chrome when Tab wraps.
  // No page control outside the dialog may receive focus before it is dismissed.
  await page.keyboard.press('Tab');
  const focusInDialogOrBrowser = () => dialog.evaluate(node =>
    node.contains(document.activeElement) || document.activeElement === document.body,
  );
  expect(await focusInDialogOrBrowser()).toBe(true);
  await cancel.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await focusInDialogOrBrowser()).toBe(true);
  await confirm.focus();
  await page.keyboard.press('Shift+Tab');
  await focusedWithIndicator(cancel);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await focusedWithIndicator(restore);
  await expect(menu).toHaveAttribute('open', '');
  await page.reload();
  await page.getByRole('region', { name: 'Workspace launcher' }).getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByText('No notes yet. Create a note to get started.')).toBeVisible();
});

async function openWorkspaceWithKeyboard(page: Page) {
  const workspace = page.getByRole('banner').getByRole('button', { name: 'Workspace' });
  await tabTo(page, workspace);
  await page.keyboard.press('Enter');
  await expect(workspace).toHaveAttribute('aria-expanded', 'true');
  await tabTo(page, page.getByRole('radio', { name: 'System' }));
  await tabTo(page, page.getByRole('combobox', { name: 'Language' }));
  return workspace;
}

async function openBackupWithKeyboard(page: Page) {
  await openWorkspaceWithKeyboard(page);
  const menu = page.locator('.backup-menu');
  const summary = menu.locator('summary');
  await tabTo(page, summary);
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  return { menu, summary };
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  await page.keyboard.press('Tab');
  await focusedWithIndicator(target);
}

async function focusedWithIndicator(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  const hasIndicator = await target.evaluate((node) => {
    const style = getComputedStyle(node);
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
  });
  expect(hasIndicator).toBe(true);
}
