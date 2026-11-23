import { test, type Browser } from '@playwright/test';

export function markKnownFirefoxAxeCrash(browser: Browser) {
  const affected = browser.browserType().name() === 'firefox'
    && browser.version() === '159.0'
    && (process.platform === 'win32' || process.platform === 'darwin');
  test.skip(affected && process.env.PW_RETRY_FIREFOX_AXE !== '1',
    'Firefox 159.0 crashed during axe scans on Windows and macOS. See docs/FIREFOX_AXE.md to retest.');
}
