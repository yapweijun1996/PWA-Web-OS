import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { createBuildId } from './src/build-info.ts';
import { pwaPlugins } from './vite-plugins/pwa.ts';

function gitSuffix(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Keep the scaffold's b-[0-9a-z]+ format for default IDs.
const buildId = process.env.BUILD_ID || createBuildId(Date.now()) + gitSuffix();

// The strict CSP meta in index.html targets the production build; Vite's dev server
// needs inline HMR scripts, so remove the meta while serving (not for preview or build).
const devCsp: Plugin = {
  name: 'pwa:dev-csp',
  apply: (_config, env) => env.command === 'serve' && !env.isPreview,
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace(/^[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n/m, ''),
  },
};

export default defineConfig({
  base: '/PWA-Web-OS/',
  plugins: [devCsp, ...pwaPlugins(buildId)],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
