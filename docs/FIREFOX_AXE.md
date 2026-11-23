# Firefox accessibility scan coverage

The seven axe browser tests run on Chromium, on Linux Firefox, and on new Firefox versions by default. The pinned Playwright Firefox 159.0 on Windows and macOS has a known scanner crash. Record its skipped matrix as NOT_RUN. A diagnostic attempt that crashes or times out is a failed run. Passing keyboard or storage tests cannot establish the missing accessibility results.

| Environment | Evidence |
| --- | --- |
| Windows 11, Playwright Firefox 159.0 | Earlier Windows tests reported a page crash during axe evaluation. See the [Windows demo evidence](RELEASE_EVIDENCE_WINDOWS_DEMO.md). |
| macOS 27.2 arm64, Playwright 1.65.1, bundled Firefox 159.0 | At source `f2e9327` on November 23, 2026, the 390 × 844 Light test reached its first audit in the workspace menu. The normal axe runner reported a page crash. Its single-document mode also failed to return results before the 60-second limit. The OS logged a Firefox content-process crash during each run. The host had heavy concurrent load. The underlying browser defect is undetermined. |
| macOS 27.2 arm64, installed Firefox Nightly 160.0a1, geckodriver, temporary headless profile | A separate probe opened the production build `b-mwt99r2yf2e9327`, opened the menu and selected Light. The actual CSS viewport measured 500 × 759. Direct axe-core 4.14.1 with the same four tags completed with 37 passing rules, zero violations and one incomplete rule (color-contrast). This covers one menu state. Manual contrast and the remaining states still require evidence. |

## Retest the exception

Use a clean install, build the production assets and install the project Firefox browser as in the README. Choose a free port and run the original scan with the override enabled, then run the remaining matrix if that succeeds.

```sh
PW_PORT=41973 PW_RETRY_FIREFOX_AXE=1 npx playwright test e2e/a11y-axe.spec.ts --project=firefox --grep='390x844, Light'
PW_PORT=41973 PW_RETRY_FIREFOX_AXE=1 npx playwright test e2e/a11y-axe.spec.ts e2e/a11y-update.spec.ts --project=firefox --grep='axe scans'
```

On PowerShell set `$env:PW_PORT='41973'` and `$env:PW_RETRY_FIREFOX_AXE='1'` before running the same npx commands. Keep the four existing rule tags, all states and the normal production CSP. Once the previously failing configurations pass, remove the exception and bind the new results to the tested build. Keep screen reader, physical device and installed-mode acceptance separate.
