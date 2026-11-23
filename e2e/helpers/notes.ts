import { expect, type Locator, type Page } from '@playwright/test';
import type { NoteDraft } from '../../src/contracts';

export function notesList(page: Page): Locator {
  return page.getByRole('region', { name: 'Notes', exact: true });
}

export function noteButtons(page: Page): Locator {
  return notesList(page).getByRole('list').getByRole('button');
}

export function editor(page: Page): Locator {
  return page.getByRole('region', { name: 'Note editor', exact: true });
}

export function saveStatus(page: Page): Locator {
  return editor(page).locator('.save-status');
}

export async function openNotes(page: Page): Promise<void> {
  const launcher = page.getByRole('region', { name: 'Workspace launcher', exact: true });
  await launcher.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(notesList(page)).toBeVisible();
}

export async function reloadNotes(page: Page): Promise<void> {
  await page.reload();
  await openNotes(page);
}

export async function expectDraft(page: Page, draft: NoteDraft): Promise<void> {
  await expect(editor(page).getByLabel('Title', { exact: true })).toHaveValue(draft.title);
  await expect(editor(page).getByLabel('Body', { exact: true })).toHaveValue(draft.body);
}

export async function openNote(page: Page, draft: NoteDraft): Promise<void> {
  await notesList(page).getByRole('list').getByRole('button', { name: draft.title, exact: true }).click();
  await expectDraft(page, draft);
  await expect(saveStatus(page)).toHaveText('Saved on this device');
}

export async function createNote(page: Page, draft: NoteDraft): Promise<void> {
  await notesList(page).getByRole('button', { name: 'New note', exact: true }).click();
  await expect(editor(page).getByLabel('Title', { exact: true })).toBeFocused();
  await editor(page).getByLabel('Title', { exact: true }).fill(draft.title);
  await editor(page).getByLabel('Body', { exact: true }).fill(draft.body);
  await expect(saveStatus(page)).toHaveText('Saved on this device');
  await expectDraft(page, draft);
}
