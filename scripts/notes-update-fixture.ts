import { execFile } from 'node:child_process';
import { copyFile, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { DB_NAME, type Note } from '../src/contracts';
import { prepareRecoveryPair } from './recovery-artifacts';
import { serveReleases } from './pwa-test-server';
import { startRecoveryTunnel } from './recovery-tunnel';
import { verifyHostedRelease } from './verify-hosted-release';

const exec = promisify(execFile);
const releaseA = 'notes-update-a';
const releaseB = 'notes-update-b';

export interface RecoveryOptions { retainedArtifacts: boolean; httpsRecovery: boolean }

async function buildFixturePair(testInfo: TestInfo) {
  const build = async (buildId: string, name: string) => {
    const dist = testInfo.outputPath(name);
    await exec(process.execPath, [
      resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', dist,
    ], { env: { ...process.env, BUILD_ID: buildId } });
    return { dist, buildId };
  };
  const [a, b] = await Promise.all([build(releaseA, 'dist-a'), build(releaseB, 'dist-b')]);
  return { a, b };
}

export const updateTest = test.extend<RecoveryOptions & { releases: {
  url: string;
  a: string;
  b: string;
  distB: string;
  deployA(): void | Promise<void>;
  deployB(): void | Promise<void>;
  stageMixedB?: () => Promise<void>;
  takeOffline(): void;
} }>({
  retainedArtifacts: [false, { option: true }],
  httpsRecovery: [false, { option: true }],
  releases: async ({ retainedArtifacts, httpsRecovery, browser }, use, testInfo) => {
    const retained = retainedArtifacts
      ? await prepareRecoveryPair(testInfo.outputPath('verified-artifacts'))
      : undefined;
    const { a, b } = retained ?? await buildFixturePair(testInfo);
    const server = await serveReleases(a.dist);
    let tunnel: Awaited<ReturnType<typeof startRecoveryTunnel>> | undefined;
    const hosted: { release: 'A' | 'B' | 'mixed B'; fileCount: number; verifiedAt: string; replacedFile?: string }[] = [];
    try {
      if (httpsRecovery) {
        if (!retained) throw new Error('HTTPS recovery requires verified retained release artifacts');
        tunnel = await startRecoveryTunnel(server.url, testInfo.outputPath('tunnel.yml'));
      }
      const url = tunnel?.url ?? server.url;
      const verify = async (release: 'A' | 'B') => {
        if (!tunnel || !retained) return;
        const { files } = release === 'A' ? retained.a : retained.b;
        await verifyHostedRelease(url, files);
        hosted.push({ release, fileCount: Object.keys(files).length, verifiedAt: new Date().toISOString() });
      };
      if (tunnel) await expect(() => verify('A')).toPass({ timeout: 180_000, intervals: [2000, 4000] });
      if (retained) {
        const identity = ({ commit, buildId, manifestSha256 }: typeof retained.a) => ({ commit, buildId, manifestSha256 });
        await testInfo.attach('recovery-identities', {
          contentType: 'application/json',
          body: JSON.stringify({
            a: identity(retained.a), b: identity(retained.b), origin: new URL(url).origin,
            browser: { name: browser.browserType().name(), version: browser.version() },
          }),
        });
      }
      await use({
        url, a: a.buildId, b: b.buildId, distB: b.dist,
        deployA: () => { server.deploy(a.dist); if (tunnel) return verify('A'); },
        deployB: () => { server.deploy(b.dist); if (tunnel) return verify('B'); },
        stageMixedB: tunnel && retained ? async () => {
          const isBundle = (path: string) => path.startsWith('assets/') && path.endsWith('.js');
          const previous = Object.keys(retained.a.files).find(isBundle);
          const current = Object.keys(retained.b.files).find(isBundle);
          if (!previous || !current || retained.a.files[previous] === retained.b.files[current]) {
            throw new Error('Mixed-release rehearsal needs distinct A and B JavaScript bundles');
          }
          const mixed = testInfo.outputPath('mixed-release');
          await cp(b.dist, mixed, { recursive: true });
          await copyFile(join(a.dist, previous), join(mixed, current));
          server.deploy(mixed);
          const files = { ...retained.b.files, [current]: retained.a.files[previous] };
          await verifyHostedRelease(url, files);
          hosted.push({
            release: 'mixed B', fileCount: Object.keys(files).length,
            replacedFile: current, verifiedAt: new Date().toISOString(),
          });
        } : undefined,
        takeOffline: () => server.deploy(testInfo.outputPath('unavailable-release')),
      });
    } catch (error) {
      if (tunnel) await testInfo.attach('staging-tunnel-diagnostics', { contentType: 'text/plain', body: tunnel.diagnostics() });
      throw error;
    } finally {
      try {
        if (tunnel) await testInfo.attach('staging-byte-checks', { contentType: 'application/json', body: JSON.stringify(hosted) });
      } finally {
        try { await tunnel?.close(); }
        finally { await server.close(); }
      }
    }
  },
});

/** Read real committed records, without creating or altering the Notes schema. */
export function committedNotes(page: Page): Promise<Note[]> {
  return page.evaluate((name) => new Promise<Note[]>((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('notes', 'readonly');
      const request = tx.objectStore('notes').getAll();
      tx.oncomplete = () => { db.close(); resolve(request.result as Note[]); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), DB_NAME);
}

export { failNoteWrites, holdNoteWrites } from './notes-write-fixtures';

/** Hold one tab just before its reload check. Real worker messages resume unchanged. */
export async function holdPeerReload(page: Page): Promise<{ switched(): Promise<boolean>; release(): Promise<void> }> {
  const handle = await page.evaluateHandle(() => {
    const original = navigator.serviceWorker.controller;
    const nativePost = ServiceWorker.prototype.postMessage;
    const queued: (() => void)[] = [];
    const switched = () => navigator.serviceWorker.controller !== null && navigator.serviceWorker.controller !== original;
    ServiceWorker.prototype.postMessage = function (message: unknown, ...options: unknown[]) {
      const send = () => Reflect.apply(nativePost, this, [message, ...options]);
      if (switched() && this === navigator.serviceWorker.controller
          && (message as { type?: string } | null)?.type === 'inspect') queued.push(send);
      else send();
    };
    return {
      switched,
      release() {
        ServiceWorker.prototype.postMessage = nativePost;
        queued.splice(0).forEach((send) => send());
      },
    };
  });
  return {
    switched: () => handle.evaluate((gate) => gate.switched()),
    async release() {
      await handle.evaluate((gate) => gate.release());
      await handle.dispose();
    },
  };
}
