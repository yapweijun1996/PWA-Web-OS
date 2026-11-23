import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Run with node scripts/generate-pwa-icons.mjs and an installed Playwright Chromium.
const svg = await readFile(new URL('./app-icon.svg', import.meta.url), 'utf8');
const output = new URL('../public/icons/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, maskable] of [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${
      maskable ? svg.replace(' rx="108"', '') : svg
    }`);
    await page.screenshot({ path: fileURLToPath(new URL(name, output)), omitBackground: true });
  }
} finally {
  await browser.close();
}
