import { execFileSync } from 'node:child_process';
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

export default defineConfig({
  base: '/PWA-Web-OS/',
  plugins: pwaPlugins(buildId),
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
