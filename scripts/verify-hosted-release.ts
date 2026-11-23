import { createHash } from 'node:crypto';

export async function verifyHostedRelease(url: string, files: Record<string, string>) {
  const base = new URL(url);
  const loopback = base.protocol === 'http:' && base.hostname === '127.0.0.1';
  if (!(base.protocol === 'https:' || loopback) || !base.pathname.endsWith('/') ||
      base.search || base.hash || base.username || base.password) {
    throw new Error('Use an HTTPS or loopback release URL ending in /');
  }
  await Promise.all(Object.entries(files).map(async ([path, expected]) => {
    const parts = path.split('/');
    if (path.includes('\\') || parts.some(part => !part || part === '.' || part === '..') ||
        !/^[0-9a-f]{64}$/.test(expected)) {
      throw new Error(`Invalid release manifest entry for ${path}`);
    }
    // Check the launch URL as well as the explicit index document.
    const paths = path === 'index.html' ? ['', path] : [path];
    await Promise.all(paths.map(async (requestPath) => {
      const label = requestPath || 'launch URL';
      const address = new URL(requestPath.split('/').map(encodeURIComponent).join('/'), base);
      const response = await fetch(address, {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7_000),
      }).catch((error: unknown) => {
        const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : String(error);
        throw new Error(`Cannot read ${label}: ${cause}`, { cause: error });
      });
      if (!response.ok) throw new Error(`Host returned HTTP ${response.status} for ${label}`);
      const sha = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      if (sha !== expected) throw new Error(`Host served unexpected bytes for ${label}`);
    }));
  }));
}
