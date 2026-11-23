import { createHash, randomUUID } from 'node:crypto';
import { open, readFile, readdir, rename, rm, lstat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { verifyHostedRelease } from './verify-hosted-release.ts';

const [mode, directory, manifestPath, commit] = process.argv.slice(2);
const validCommit = sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);
if (!['create', 'verify', 'verify-hosted'].includes(mode) || !directory || !manifestPath ||
    (mode !== 'verify' && !validCommit(commit))) {
  throw new Error('Usage: node scripts/release-evidence.mjs create <dist> <manifest> <full-commit-sha> | verify <dist> <manifest> | verify-hosted <url/> <manifest> <full-commit-sha>');
}
const root = resolve(directory);
async function inventory(dir = root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await inventory(path));
    else if (entry.isFile()) files.push(relative(root, path).split('\\').join('/'));
    else throw new Error('Release directory must contain only regular files and directories');
  }
  return files.sort();
}
async function hashes() {
  return Object.fromEntries(await Promise.all((await inventory()).map(async (path) => [
    path, createHash('sha256').update(await readFile(join(root, path))).digest('hex'),
  ])));
}
async function buildId() {
  const source = await readFile(join(root, 'sw.js'), 'utf8');
  const firstLine = source.split('\n', 1)[0];
  if (!firstLine.startsWith('const release = ') || !firstLine.endsWith(';')) throw new Error('Missing worker release identity');
  const release = JSON.parse(firstLine.slice('const release = '.length, -1));
  if (typeof release.buildId !== 'string' || !release.buildId) throw new Error('Missing build ID');
  return release.buildId;
}
if (mode === 'verify-hosted') {
  const expected = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (expected.version !== 1 || expected.commit !== commit || !expected.buildId ||
      !expected.files?.['index.html'] || !expected.files?.['sw.js']) {
    throw new Error('Manifest is missing the expected release identity or required files');
  }
  await verifyHostedRelease(directory, expected.files);
  console.log(`Verified hosted build ${expected.buildId} from commit ${commit}; launch URL and ${Object.keys(expected.files).length} files`);
} else if (mode === 'verify') {
  const actual = { buildId: await buildId(), files: await hashes() };
  const expected = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (expected.version !== 1 || !validCommit(expected.commit) || expected.buildId !== actual.buildId || JSON.stringify(expected.files) !== JSON.stringify(actual.files)) {
    throw new Error('Release identity or file digests do not match');
  }
  console.log(`Verified build ${actual.buildId} from commit ${expected.commit}; ${Object.keys(actual.files).length} files`);
} else {
  const actual = { buildId: await buildId(), files: await hashes() };
  const target = resolve(manifestPath);
  const fromRoot = relative(root, target);
  if (!fromRoot || (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith('..' + sep))) {
    throw new Error('Keep manifest outside dist');
  }
  try { const existing = await lstat(target); if (!existing.isFile()) throw new Error('Manifest target must be a regular file'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ version: 1, commit, ...actual }, null, 2) + '\n'); await file.sync(); }
    finally { await file.close(); }
    await rename(temp, target);
  } finally { await rm(temp, { force: true }); }
  console.log(`Recorded build ${actual.buildId}; ${Object.keys(actual.files).length} files`);
}
