import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { committedNotes, failNoteWrites, holdNoteWrites, holdPeerReload, updateTest as test } from '../scripts/notes-update-fixture';

const buildId = (page: Page) => page.locator('#build-id');
const available = (page: Page) => page.getByRole('heading', { name: 'Update available', exact: true });
const update = (page: Page) => page.getByRole('button', { name: 'Update', exact: true });
const retry = (page: Page) => page.getByRole('button', { name: 'Retry update', exact: true });
const list = (page: Page) => page.getByRole('region', { name: 'Notes', exact: true });
const body = (page: Page) => page.getByLabel('Body', { exact: true });
const saveStatus = (page: Page) => page.locator('.save-status');
const connection = (page: Page) => page.locator('.connection');
const saved = (page: Page) => expect(saveStatus(page)).toHaveText('Saved on this device');

async function ready(page: Page, id: string) {
  await expect(buildId(page)).toHaveText(`Build ID: ${id}`);
  await expect(connection(page).getByText('Available offline', { exact: true })).toBeVisible();
}

async function enterNotes(page: Page) {
  await page.getByRole('region', { name: 'Workspace launcher', exact: true })
    .getByRole('button', { name: 'Notes', exact: true }).click();
}

async function start(page: Page, url: string, id: string) {
  await page.goto(url);
  await ready(page, id);
  await enterNotes(page);
}

async function createNote(page: Page, title: string, content: string) {
  await list(page).getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await body(page).fill(content);
  await saved(page);
  await expect(list(page).getByRole('button', { name: title, exact: true })).toBeVisible();
}

async function openNote(page: Page, title: string) {
  await list(page).getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
}

async function checkForUpdate(page: Page) {
  // Run the native update check without reloading or changing the editor in A.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('Missing service worker registration');
    await registration.update();
  });
}

function countNavigations(page: Page): () => number {
  let count = 0;
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) count++; });
  return () => count;
}

async function expectStillWaiting(page: Page, id: string) {
  await ready(page, id);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state))
    .toBe('installed');
}

async function reopenOnB(page: Page, id: string, title: string, content: string) {
  await ready(page, id);
  await enterNotes(page);
  await openNote(page, title);
  await expect(body(page)).toHaveValue(content);
  await expect(body(page)).toBeEditable();
}

test('rehearses A to B to retained A with compatible schema and synthetic notes', async ({ page, releases }) => {
  await start(page, releases.url, releases.a);
  let savedOnA = 'Created on A';
  await createNote(page, 'Recovery rehearsal', savedOnA);
  const schema = () => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('pwa-web-os-notes');
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const version = request.result.version; request.result.close(); resolve(version); };
  }));
  expect(await schema()).toBe(1);
  if (releases.stageMixedB) {
    const navigations = countNavigations(page);
    await releases.stageMixedB();
    await checkForUpdate(page);
    await expect(page.getByRole('heading', { name: 'Update failed', exact: true })).toBeVisible();
    await expect(update(page)).toBeHidden();
    await ready(page, releases.a);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting)).toBeNull();
    await expect(body(page)).toHaveValue(savedOnA);
    savedOnA = 'Saved on A after rejecting mixed release bytes';
    await body(page).fill(savedOnA);
    await saved(page);
    expect(await committedNotes(page)).toMatchObject([{ body: savedOnA }]);
    expect(navigations()).toBe(0);
  }
  await releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  await update(page).click();
  await reopenOnB(page, releases.b, 'Recovery rehearsal', savedOnA);
  await body(page).fill('Committed on B before rollback');
  await saved(page);
  const onB = await committedNotes(page);
  expect(await schema()).toBe(1);
  await releases.deployA();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  await update(page).click();
  await reopenOnB(page, releases.a, 'Recovery rehearsal', 'Committed on B before rollback');
  expect(await schema()).toBe(1);
  expect(await committedNotes(page)).toEqual(onB);
  await body(page).fill('Saved on retained A');
  await saved(page);
  expect(await committedNotes(page)).toMatchObject([{ id: onB[0].id, body: 'Saved on retained A' }]);
});

test('defers B while Notes stays editable and commits another edit on A', async ({ page, releases }) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Deferral note', 'Saved before deployment');
  const [before] = await committedNotes(page);
  const navigations = countNavigations(page);
  releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  await expect(update(page)).toBeVisible();
  await expect(body(page)).toBeEditable();
  await expect(body(page)).toHaveValue(before.body);
  await body(page).fill('Saved while B was waiting');
  await saved(page);
  expect(await committedNotes(page)).toEqual([{
    ...before, body: 'Saved while B was waiting', revision: before.revision + 1, updatedAt: expect.any(Number),
  }]);
  await expect(available(page)).toBeVisible();
  await expectStillWaiting(page, releases.a);
  expect(navigations()).toBe(0);
});

test('recovers from an evicted A entry script after B is hosted without switching a live editor automatically', async ({
  page, context, releases,
}) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Startup recovery note', 'Saved on A before eviction');
  const navigations = countNavigations(page);

  const evicted = await page.evaluate(async (id) => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')!.src;
    const cache = await caches.open('pwa-web-os:release:' + id);
    return { script, present: !!await cache.match(script), removed: await cache.delete(script) };
  }, releases.a);
  expect(evicted).toMatchObject({ present: true, removed: true });
  releases.deployB();
  expect((await page.request.get(evicted.script)).status()).toBe(404);

  const recovery = await context.newPage();
  // Make the origin unavailable to worker-owned requests as well as document requests.
  releases.takeOffline();
  await context.setOffline(true);
  try {
    expect((await recovery.goto(releases.url))?.status()).toBe(503);
    await expect(recovery.getByRole('heading', { name: 'Workspace temporarily unavailable' })).toBeVisible();
    await expect(recovery.getByRole('link', { name: 'Reopen workspace' })).toHaveAttribute('href', new URL(releases.url).pathname);
  } finally {
    releases.deployB();
    await context.setOffline(false);
  }
  await recovery.getByRole('link', { name: 'Reopen workspace' }).click();
  await expect(buildId(recovery)).toHaveText(`Build ID: ${releases.b}`);
  await expect(connection(recovery).getByText('Available offline', { exact: true })).toBeHidden();
  await expect(available(recovery)).toBeVisible();
  await expect(available(page)).toBeVisible();
  await expect(buildId(page)).toHaveText(`Build ID: ${releases.a}`);
  expect(navigations()).toBe(0);
  await body(page).fill('Saved by the live A editor');
  await saved(page);
  const before = await committedNotes(page);

  await update(recovery).click();
  await reopenOnB(recovery, releases.b, before[0].title, before[0].body);
  await ready(page, releases.b);
  expect(navigations()).toBe(1);
  expect(await committedNotes(recovery)).toEqual(before);
  await recovery.close();
  await page.close();
  await context.setOffline(true);
  try {
    const cold = await context.newPage();
    await cold.goto(releases.url);
    await reopenOnB(cold, releases.b, before[0].title, before[0].body);
  } finally {
    await context.setOffline(false);
  }
});

test('reloads only once into B after rapid repeated Update clicks during a pending write', async ({
  page, releases, browserName,
}, testInfo) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Pending note', 'Previously committed');
  const [before] = await committedNotes(page);
  const navigations = countNavigations(page);
  releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  const releaseWrites = await holdNoteWrites(page);
  try {
    await body(page).fill('Pending edit at the moment of acceptance');
    await expect(saveStatus(page)).toHaveText(/^(Unsaved changes|Saving…)$/);
    await update(page).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    const progress = page.locator('.update-notice').getByText('Saving changes before update…', { exact: true });
    await expect(progress).toBeVisible();
    await expect(update(page)).toBeHidden();
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await expectStillWaiting(page, releases.a);
    expect(navigations()).toBe(0);
    // Diagnostic evidence, not an expectation that the known UI defect remains present.
    const liveRegion = await progress.evaluate((notice) => {
      const status = document.querySelector('[role="status"]');
      return {
        noticeInertAncestor: notice.closest('[inert]')?.id ?? null,
        liveRegionExists: !!status,
        liveRegionInertAncestor: status?.closest('[inert]')?.id ?? null,
      };
    });
    let chromiumAXIgnored: boolean | undefined;
    if (browserName === 'chromium' && liveRegion.liveRegionExists) {
      const cdp = await page.context().newCDPSession(page);
      try {
        const { root } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role="status"]' });
        const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
        chromiumAXIgnored = nodes[0]?.ignored;
      } finally {
        await cdp.detach();
      }
    }
    const evidence = testInfo.outputPath('update-progress-accessibility.json');
    await writeFile(evidence, JSON.stringify({ ...liveRegion, chromiumAXIgnored }, null, 2));
    await testInfo.attach('update-progress-accessibility', { path: evidence, contentType: 'application/json' });
    if (!liveRegion.liveRegionExists || liveRegion.liveRegionInertAncestor !== null || chromiumAXIgnored) {
      testInfo.annotations.push({ type: 'accessibility defect', description: 'Update progress has no live region outside inert content.' });
    }
  } finally {
    await releaseWrites();
  }
  await reopenOnB(page, releases.b, before.title, 'Pending edit at the moment of acceptance');
  expect(await committedNotes(page)).toEqual([{
    ...before, body: 'Pending edit at the moment of acceptance', revision: before.revision + 1, updatedAt: expect.any(Number),
  }]);
  await body(page).fill('Another edit, saved on B');
  await saved(page);
  expect(await committedNotes(page)).toMatchObject([{ id: before.id, body: 'Another edit, saved on B' }]);
  expect(navigations()).toBe(1);
});

test('pauses after a real IndexedDB abort and retries the same draft into B', async ({ page, releases }) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Retry note', 'Last committed version');
  const before = await committedNotes(page);
  const navigations = countNavigations(page);
  releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  const fault = await failNoteWrites(page);
  try {
    await body(page).fill('Unsaved text retained through the failed update');
    await expect(saveStatus(page)).toHaveText('Save failed. Your changes are not saved.');
    const failedAutosaves = await fault.attempts();
    expect(failedAutosaves).toBeGreaterThan(0);
    await update(page).click();
    await expect(page.getByRole('heading', { name: 'Update paused', exact: true })).toBeVisible();
    await expect(page.getByText('Save your changes before retrying the update.', { exact: true })).toBeVisible();
    await expect(retry(page)).toBeVisible();
    expect(await fault.attempts()).toBeGreaterThan(failedAutosaves);
    await expect(body(page)).toHaveValue('Unsaved text retained through the failed update');
    await expect(body(page)).toBeEditable();
    expect(await committedNotes(page)).toEqual(before);
    await expectStillWaiting(page, releases.a);
    expect(navigations()).toBe(0);
  } finally {
    await fault.restore();
  }
  await retry(page).click();
  await reopenOnB(page, releases.b, before[0].title, 'Unsaved text retained through the failed update');
  expect(navigations()).toBe(1);
});

test('a second tab cannot flush: explains the pause and retries both tabs into B once', async ({ page, context, releases }) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Primary note', 'Saved in the first tab');
  const peer = await context.newPage();
  await start(peer, releases.url, releases.a);
  await createNote(peer, 'Peer note', 'Previously saved in the second tab');
  const before = await committedNotes(page);
  const navigations = countNavigations(page);
  const peerNavigations = countNavigations(peer);
  releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  await expect(available(peer)).toBeVisible();
  const fault = await failNoteWrites(peer);
  try {
    await body(peer).fill('Draft from the second tab');
    await expect(saveStatus(peer)).toHaveText('Save failed. Your changes are not saved.');
    const failedAutosaves = await fault.attempts();
    expect(failedAutosaves).toBeGreaterThan(0);
    await update(page).click();
    await expect(page.getByRole('heading', { name: 'Update paused', exact: true })).toBeVisible();
    await expect(page.getByText('Save changes in other Notes tabs or close those tabs, then retry the update.', { exact: true })).toBeVisible();
    await expect(peer.getByRole('heading', { name: 'Update paused', exact: true })).toBeVisible();
    await expect(retry(page)).toBeVisible();
    expect(await fault.attempts()).toBeGreaterThan(failedAutosaves);
    await expect(body(peer)).toHaveValue('Draft from the second tab');
    await expect(body(peer)).toBeEditable();
    expect(await committedNotes(page)).toEqual(before);
    await expectStillWaiting(page, releases.a);
    await expectStillWaiting(peer, releases.a);
    expect([navigations(), peerNavigations()]).toEqual([0, 0]);
  } finally {
    await fault.restore();
  }
  await retry(page).click();
  await Promise.all([
    reopenOnB(page, releases.b, 'Primary note', 'Saved in the first tab'),
    reopenOnB(peer, releases.b, 'Peer note', 'Draft from the second tab'),
  ]);
  expect([navigations(), peerNavigations()]).toEqual([1, 1]);
});

test('rejects a byte-mismatched B and keeps the real A editor usable and reopenable offline', async ({ page, context, releases }) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Offline recovery note', 'Saved before the failed install');
  const navigations = countNavigations(page);
  // The URL still returns 200; its bytes no longer match B's precache integrity hash.
  await writeFile(join(releases.distB, 'manifest.webmanifest'), '{}');
  releases.deployB();
  await checkForUpdate(page);
  await expect(page.getByRole('heading', { name: 'Update failed', exact: true })).toBeVisible();
  await expect(retry(page)).toBeVisible();
  await expect(update(page)).toBeHidden();
  await ready(page, releases.a);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting)).toBeNull();
  await context.setOffline(true);
  try {
    await expect(connection(page).getByText('Offline', { exact: true })).toBeVisible();
    await expect(body(page)).toHaveValue('Saved before the failed install');
    await expect(body(page)).toBeEditable();
    await body(page).fill('Saved offline after B failed');
    await saved(page);
    await ready(page, releases.a);
    await expect(page.getByRole('heading', { name: 'Update failed', exact: true })).toBeVisible();
    const reopened = await context.newPage();
    await start(reopened, releases.url, releases.a);
    await openNote(reopened, 'Offline recovery note');
    await expect(body(reopened)).toHaveValue('Saved offline after B failed');
    expect(navigations()).toBe(0);
  } finally {
    await context.setOffline(false);
  }
});

test('serves an A-only asset requested late by a live A tab already controlled by B', async ({ page, context, releases }) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Asset retention note', 'Retained across both tabs');
  const peer = await context.newPage();
  await start(peer, releases.url, releases.a);
  await openNote(peer, 'Asset retention note');
  const navigations = countNavigations(page);
  const peerNavigations = countNavigations(peer);
  // The app currently has no lazy JS chunk. Request its real versioned A entry as a late asset.
  const oldEntry = await peer.locator('script[type="module"][src]').evaluate((script: HTMLScriptElement) => script.src);
  const fetchEntry = () => peer.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    return { status: response.status, source: await response.text() };
  }, oldEntry);
  // Give A a wallpaper name that B does not ship. Use actual cached image bytes.
  const oldWallpaper = new URL('wallpapers/prior-desktop.webp', releases.url).href;
  const expectedWallpaper = await peer.evaluate(async ({ id, url, base }) => {
    const cache = await caches.open('pwa-web-os:release:' + id);
    const image = await cache.match(new URL('wallpapers/aurora-lake-desktop.webp', base));
    if (!image) throw new Error('A is missing its desktop wallpaper');
    await cache.put(url, image.clone());
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await image.arrayBuffer())));
  }, { id: releases.a, url: oldWallpaper, base: releases.url });
  const original = await fetchEntry();
  expect(original.status).toBe(200);
  expect(original.source).toContain(releases.a);
  releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  await expect(available(peer)).toBeVisible();
  expect((await page.request.get(oldEntry)).status()).toBe(404); // Server bypasses the browser worker and HTTP cache.
  const gate = await holdPeerReload(peer);
  try {
    await update(page).click();
    await ready(page, releases.b);
    await expect.poll(gate.switched).toBe(true);
    await expect(buildId(peer)).toHaveText(`Build ID: ${releases.a}`);
    expect(peerNavigations()).toBe(0);
    // Assert status separately so a failing test never dumps the JS bundle.
    const late = await fetchEntry();
    expect(late.status).toBe(200);
    expect(late.source === original.source).toBe(true);
    expect((await page.request.get(oldWallpaper)).status()).toBe(404);
    const lateWallpaper = await peer.evaluate(async url => {
      const response = await fetch(url);
      return { status: response.status, digest: Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', await response.arrayBuffer())
      )) };
    }, oldWallpaper);
    expect(lateWallpaper).toEqual({ status: 200, digest: expectedWallpaper });
  } finally {
    await gate.release();
  }
  await reopenOnB(peer, releases.b, 'Asset retention note', 'Retained across both tabs');
  // Once both documents really run B, the old release is retired.
  expect((await fetchEntry()).status).toBe(404);
  expect(await peer.evaluate(async url => (await fetch(url)).status, oldWallpaper)).toBe(404);
  expect([navigations(), peerNavigations()]).toEqual([1, 1]);
});

test('preserves all committed records and their updatedAt order in the same IndexedDB on B', async ({ page, releases }) => {
  await start(page, releases.url, releases.a);
  await createNote(page, 'Zulu note', 'First note');
  const [first] = await committedNotes(page);
  await createNote(page, 'Alpha note', 'Second note');
  const second = (await committedNotes(page)).find((note) => note.title === 'Alpha note');
  if (!second) throw new Error('The second note was not committed');
  expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
  await openNote(page, 'Zulu note');
  await body(page).fill('Edited after the second note');
  await saved(page);
  // Check chronological data independently of the Notes UI, which sorts titles alphabetically.
  const mostRecentFirst = async () => (await committedNotes(page)).sort((a, b) => b.updatedAt - a.updatedAt);
  const before = await mostRecentFirst();
  expect(before.map((note) => note.id)).toEqual([first.id, second.id]);
  expect(before[0].updatedAt).toBeGreaterThan(before[1].updatedAt);
  const navigations = countNavigations(page);
  releases.deployB();
  await checkForUpdate(page);
  await expect(available(page)).toBeVisible();
  await update(page).click();
  await reopenOnB(page, releases.b, 'Zulu note', 'Edited after the second note');
  await openNote(page, 'Alpha note');
  await expect(body(page)).toHaveValue('Second note');
  expect(await mostRecentFirst()).toEqual(before);
  expect(navigations()).toBe(1);
});
