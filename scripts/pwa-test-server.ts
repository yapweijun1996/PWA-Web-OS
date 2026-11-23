import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const base = '/PWA-Web-OS/';
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

// Serve successive dist directories without mutating the preview server's dist.
// Use a separate IPv6 loopback origin on the same PW_PORT as IPv4 Vite preview.
export async function serveReleases(initialDist: string, port: number) {
  let dist = resolve(initialDist);
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://[::1]').pathname);
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
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '::1', () => { server.removeListener('error', reject); resolve(); });
  });
  return {
    url: `http://[::1]:${port}${base}`,
    deploy(nextDist: string) { dist = resolve(nextDist); },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => { if (error) reject(error); else resolve(); });
      server.closeAllConnections();
    }),
  };
}
