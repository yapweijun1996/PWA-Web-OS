import { defineConfig } from 'vitest/config';
import { createBuildId } from './src/build-info.ts';

export default defineConfig({
  base: '/PWA-Web-OS/',
  define: {
    __BUILD_ID__: JSON.stringify(createBuildId(Date.now())),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
