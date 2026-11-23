import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const base = '/PWA-Web-OS/';
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

// Give each fixture its own local origin, stable across all deployments in that test.
export async function listenOnLoopback(server: Server): Promise<URL> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
  return new URL(`http://127.0.0.1:${address.port}${base}`);
}

export async function serveReleases(initialDist: string) {
  let dist = resolve(initialDist);
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      if (!path.startsWith(base)) throw new Error('Outside app');
      const file = resolve(dist, path.slice(base.length) || 'index.html');
      if (!file.startsWith(dist + sep)) throw new Error('Outside dist');
      const bytes = await readFile(file);
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
    }
  });
  return {
    url: (await listenOnLoopback(server)).href,
    deploy(nextDist: string) { dist = resolve(nextDist); },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => { if (error) reject(error); else resolve(); });
      server.closeAllConnections();
    }),
  };
}
