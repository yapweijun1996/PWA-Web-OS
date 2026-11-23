import { expect, test, type Locator, type Page } from '@playwright/test';

function launcher(page: Page): Locator {
  return page.getByRole('region', { name: 'Workspace launcher', exact: true });
}

async function openNotes(page: Page): Promise<void> {
  await launcher(page).getByRole('button', { name: 'Notes', exact: true }).click();
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(target).toBeFocused();
}

// These tests use the built app with its in-memory storage stub, not IndexedDB.
test('desktop panes sit side by side; the in-memory write shows Saving… then Saved and the page can reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await openNotes(page);
  const rail = page.getByRole('navigation', { name: 'Workspace' });
  const list = page.getByRole('region', { name: 'Notes', exact: true });
  const editor = page.getByRole('region', { name: 'Note editor' });
  await expect(list.getByText('No notes yet. Create a note to get started.')).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(list).toBeVisible();
  await expect(editor).toBeVisible();
  const [left, middle, right] = await Promise.all([rail.boundingBox(), list.boundingBox(), editor.boundingBox()]);
  expect(left && middle && right && left.x + left.width < middle.x && middle.x + middle.width < right.x).toBe(true);
  expect(left?.y).toBe(middle?.y);
  expect(middle?.y).toBe(right?.y);

  await list.getByRole('button', { name: 'New note' }).click();
  const status = editor.locator('.save-status');
  await expect(status).toHaveText('Saved on this device');
  // The stub completes in a microtask; observe DOM transitions without slowing or replacing storage.
  await status.evaluate((node) => {
    const observer = new MutationObserver((records) => {
      if (records.some((record) => Array.from(record.addedNodes).some((text) => text.textContent === 'Saving…'))) {
        (node as HTMLElement).dataset.observedSaving = 'true';
        observer.disconnect();
      }
    });
    observer.observe(node, { childList: true });
  });
  await editor.getByLabel('Title').fill('Synthetic desktop note');
  await editor.getByLabel('Body').fill('Local browser demo text');
  await expect(status).toHaveAttribute('data-observed-saving', 'true');
  await expect(status).toHaveText('Saved on this device');
  await expect(list.getByRole('button', { name: 'Synthetic desktop note' })).toBeVisible();
  await page.reload();
  await expect(launcher(page)).toBeVisible();
  // No note persistence assertion: reloading reconstructs the in-memory stub.
});

test('390×844 shows one pane, retains the draft across resize, and offers both back routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await openNotes(page);
  const list = page.getByRole('region', { name: 'Notes', exact: true });
  const editor = page.getByRole('region', { name: 'Note editor' });
  await expect(list).toBeVisible();
  await expect(editor).toBeHidden();
  await list.getByRole('button', { name: 'New note' }).click();
  const body = editor.getByLabel('Body');
  await body.fill('Synthetic mobile draft');
  await expect(list).toBeHidden();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(list).toBeVisible();
  await expect(body).toHaveValue('Synthetic mobile draft');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(body).toHaveValue('Synthetic mobile draft');
  const backToNotes = editor.getByRole('button', { name: 'Notes list' });
  expect((await backToNotes.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await backToNotes.click();
  await expect(list).toBeVisible();
  await expect(editor).toBeHidden();
  const note = list.getByRole('button', { name: 'Untitled note' });
  await expect(note).toBeFocused();
  await note.click();
  await expect(editor).toBeFocused();
  await expect(body).toHaveValue('Synthetic mobile draft');
  await backToNotes.click();
  await list.getByRole('button', { name: 'Workspace launcher' }).click();
  await expect(launcher(page).getByRole('heading')).toBeFocused();
  await expect(list).toBeHidden();
});

test('keyboard-only creation moves focus to Title, then to Body by Tab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await tabTo(page, launcher(page).getByRole('button', { name: 'Notes', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: 'New note' }));
  await page.keyboard.press('Enter');
  const title = page.getByLabel('Title', { exact: true });
  await expect(title).toBeFocused();
  await page.keyboard.type('Synthetic keyboard note');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Body', { exact: true })).toBeFocused();
  await page.keyboard.type('Local keyboard demo text');
  await expect(page.getByRole('button', { name: 'Synthetic keyboard note' })).toBeVisible();
});

test('System follows browser appearance and Dark theme persists through a real reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const html = page.locator('html');
  const dark = page.getByRole('radio', { name: 'Dark theme' });
  await expect(html).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(237, 242, 247)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveCSS('color-scheme', 'dark');
  await dark.check();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(dark).toBeChecked();
  await expect(html).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 25, 35)');
});
