# Firefox accessibility scan coverage

The seven axe browser tests run in the release suite on Chromium 156.0 and Firefox 157.0 with Playwright 1.64.0. Use the [Pages browser evidence](PRODUCTION_READINESS.md#browser-evidence-on-each-pages-push) for the tested artifact and versions. With Playwright 1.65.1, Firefox 159.0 on Windows and macOS requires the opt-in below. Record its default skips as NOT_RUN and diagnostic crashes or timeouts as FAIL. Screen reader announcements and manual contrast review have their own acceptance checks.

| Environment | Evidence |
| --- | --- |
| Windows 11, Playwright Firefox 159.0 | Earlier Windows tests reported a page crash during axe evaluation. See the [Windows demo evidence](RELEASE_EVIDENCE_WINDOWS_DEMO.md). |
| macOS 27.2 arm64, Playwright 1.65.1, bundled Firefox 159.0 | At source `f2e9327` on November 23, 2026, the 390 × 844 Light test reached its first audit in the workspace menu. The normal axe runner reported a page crash. Its single-document mode also failed to return results before the 60-second limit. The OS logged a Firefox content-process crash during each run. The host had heavy concurrent load. The underlying browser defect is undetermined. |
| macOS 27.2 arm64, installed Firefox Nightly 160.0a1, geckodriver, temporary headless profile | A separate probe opened the production build `b-mwt99r2yf2e9327`, opened the menu and selected Light. The actual CSS viewport measured 500 × 759. Direct axe-core 4.14.1 with the same four tags completed with 37 passing rules, zero violations and one incomplete rule (color-contrast). This covers one menu state. Manual contrast and the remaining states still require evidence. |

## Linux release gate

On 2026-11-23, the Pages Ubuntu 26 x64 runner at `e6797af` ran the full suite. The Playwright report recorded 132 passes, seven Firefox 159.0 scan failures and one Chromium-only quota case skipped in Firefox. All seven scans ended without a completed audit. The workflow retained the JSON, browser versions and exact build manifest and stopped before deployment. Normal Firefox storage, update and keyboard results have separate assertions. [Failed run and browser-evidence artifact](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45183876014)

A supplementary macOS 26.6.2 test of the bundled Firefox performed direct axe-core checks in separate real page contexts. The 390 px Light workspace-menu check completed. The conflict and waiting-update checks returned no usable audit. A headed retail Firefox 160.0.1 attempt also failed to finish the multi-state journey. Those observations remain diagnostic. Keep the gate open until the required views and rule set have complete results. The production demo remains at its most recent successful deployment.

At `9599c6e`, the Ubuntu Pages suite recorded 134 passes, the same seven Firefox axe failures and one quota skip. On a separate Ubuntu 24.04 arm64 workstation, a clean `3f85d8b` checkout ran the unchanged Firefox 159.0 suite headed under Xvfb. All seven scans ended with `frame.evaluate: Page crashed`. The reduced-motion update test passed. The audit failure therefore also occurs in headed mode. [Pages run 45190418790](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45190418790)

On the same Ubuntu workstation, Playwright 1.64.0 with Firefox 157.0 completed the seven headed axe tests and the reduced-motion update test against the same application source. Both runs used axe-core 4.14.1 and the same four tags and page states. The test toolchain pin aligns the axe peer and Playwright runtime on one version. With that pin applied to `95e8a40`, the full two-engine suite passed 145 tests, including all 14 browser axe cases. The Firefox quota fixture was the sole skip. Before upgrading either tool, verify the complete axe matrix in both engines against the new pin. [Playwright 1.64.0 browser versions](https://github.com/microsoft/playwright/releases/tag/v1.64.0#browser-versions)

On Ubuntu 24.04 x64, the hosted Pages run at `54e9662` matched those counts with no failed or flaky tests. Its browser-evidence manifest matched the retained candidate. The deploy job succeeded. [Pages result](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45195685417)

## Review of incomplete text contrast results

On 2026-11-23, Chromium 156.0.8078.4 and Firefox 157.0 repeated the 14 axe tests on macOS 26.6.2 and captured 144 page states across both themes and three viewport sizes. The Notes views used the verified `54e9662` artifacts. The waiting-update fixtures used the same production stylesheet bytes. The review covered the 1,126 text-contrast observations that axe left incomplete. It calculated relative luminance from the browsers' computed sRGB foreground colors and conservative background bounds, using the full channel range for unknown wallpaper colors and stop bounds for opaque legacy gradients. All reviewed bounds exceeded 4.5:1. The lowest bound was 5.987:1 for white text on the primary button gradient. Physical touch and spoken announcements have separate acceptance cases. [Contrast evidence](evidence/contrast-54e9662.json) · [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Retest the exception

To retest Firefox 159.0, use a disposable checkout with Playwright 1.65.1 and its bundled Firefox. Build the production assets as in the README. Choose a free port and run the original scan with the override enabled, then run the remaining matrix if that succeeds.

```sh
PW_PORT=41973 PW_RETRY_FIREFOX_AXE=1 npx playwright test e2e/a11y-axe.spec.ts --project=firefox --grep='390x844, Light'
PW_PORT=41973 PW_RETRY_FIREFOX_AXE=1 npx playwright test e2e/a11y-axe.spec.ts e2e/a11y-update.spec.ts --project=firefox --grep='axe scans'
```

On PowerShell set `$env:PW_PORT='41973'` and `$env:PW_RETRY_FIREFOX_AXE='1'` before running the same npx commands. Keep the four existing rule tags, all states and the normal production CSP. Once the previously failing configurations pass, remove the exception and bind the new results to the tested build. Keep screen reader, physical device and installed-mode acceptance separate.
