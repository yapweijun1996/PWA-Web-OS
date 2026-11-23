import { defineConfig } from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 41730);
const baseURL = `http://127.0.0.1:${port}/PWA-Web-OS/`;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
  },
});
