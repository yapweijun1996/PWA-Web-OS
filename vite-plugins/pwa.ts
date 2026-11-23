import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithOxc, type Plugin, type ResolvedConfig } from 'vite';

const manifestPath = 'manifest.webmanifest';
const wallpapers = ['wallpapers/wallpaper-desktop.webp', 'wallpapers/wallpaper-phone.webp'];
const runtimePath = fileURLToPath(new URL('./service-worker-runtime.ts', import.meta.url));
const integrity = (bytes: string | Uint8Array) => `sha256-${createHash('sha256').update(bytes).digest('base64')}`;

export function pwaPlugins(buildId: string): Plugin[] {
  let config: ResolvedConfig;
  const readPublic = (path: string) => readFile(join(config.publicDir, path));
  async function manifest() {
    return JSON.parse((await readPublic(manifestPath)).toString('utf8')) as {
      theme_color: string;
      icons: { src: string }[];
    };
  }
  return [
    {
      name: 'pwa:manifest',
      configResolved(resolved) { config = resolved; },
      async transformIndexHtml() {
        return [
          { tag: 'link', attrs: { rel: 'manifest', href: config.base + manifestPath }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'theme-color', content: (await manifest()).theme_color }, injectTo: 'head' },
        ];
      },
    },
    {
      name: 'pwa:service-worker',
      apply: 'build',
      generateBundle: {
        order: 'post',
        async handler(_output, bundle) {
          if (!bundle['index.html']) throw new Error('Offline release requires index.html');
          const files: [string, string][] = Object.values(bundle).filter((file) => !file.fileName.endsWith('.map'))
            .map((file) => [file.fileName, integrity(file.type === 'asset' ? file.source : file.code)]);
          for (const path of [manifestPath, ...(await manifest()).icons.map((icon) => icon.src), ...wallpapers]) {
            files.push([path, integrity(await readPublic(path))]);
          }
          files.sort(([a], [b]) => a.localeCompare(b));
          const code = await readFile(runtimePath, 'utf8');
          const runtime = await transformWithOxc(code, runtimePath, { target: 'es2023' });
          this.emitFile({
            type: 'asset',
            fileName: 'sw.js',
            source: `const release = ${JSON.stringify({ buildId, base: config.base, files })};\n${runtime.code}`,
          });
        },
      },
    },
  ];
}
