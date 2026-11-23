import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function prepareRecoveryPair(output: string, env: NodeJS.ProcessEnv = process.env) {
  async function prepare(side: 'A' | 'B') {
    const source = env[`RECOVERY_${side}_DIR`];
    const commit = env[`RECOVERY_${side}_SHA`];
    if (!source || !commit || !/^[a-f0-9]{40}$/.test(commit)) {
      throw new Error(`Set RECOVERY_${side}_DIR and RECOVERY_${side}_SHA from the selected GitHub Actions run`);
    }

    // Serve the same bytes that were checked, from an isolated copy. Tests
    // and external changes to downloaded artifacts cannot affect one another.
    const root = join(output, `release-${side}`);
    const dist = join(root, 'dist');
    const manifest = join(root, 'manifest.json');
    await mkdir(root, { recursive: true });
    await cp(join(source, 'dist'), dist, { recursive: true, errorOnExist: true, force: false });
    await cp(join(source, 'manifest.json'), manifest, { errorOnExist: true, force: false });
    await exec(process.execPath, [resolve('scripts/release-evidence.mjs'), 'verify', dist, manifest]);
    const bytes = await readFile(manifest);
    const metadata = JSON.parse(bytes.toString('utf8')) as { commit: string; buildId: string; files: Record<string, string> };
    if (metadata.commit !== commit) throw new Error(`Artifact ${side} manifest does not match the selected workflow commit`);
    return {
      dist, commit, buildId: metadata.buildId, manifestSha256: createHash('sha256').update(bytes).digest('hex'),
      files: metadata.files,
    };
  }

  const [a, b] = await Promise.all([prepare('A'), prepare('B')]);
  if (a.commit === b.commit) throw new Error('Recovery requires artifacts from two distinct commits');
  if (a.buildId === b.buildId) throw new Error('Recovery requires two distinct worker build IDs');
  return { a, b };
}
