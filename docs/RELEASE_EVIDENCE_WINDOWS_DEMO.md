# Windows Demo Release Evidence (candidate 1)

**Historical candidate.** See the [pending release tasks](../Task.md#pending-release-tasks) for the current release decision.

Status at the time of testing: **Provisional.** This records what was run for the Windows demo track defined in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). It does not clear the full production release, which needs every row of the [platform matrix](PRODUCT_SPEC.md#platform-support). The visual redesign decided in [M0_DECISIONS.md](M0_DECISIONS.md) (Aurora look) has not been implemented, so the current interface does not yet match the Aurora anchor images.

## Candidate

| Item | Value |
| --- | --- |
| Code tested | Commit `dd2d68a` (branch `m1-integration`, pushed to `main`); the tests ran on a working tree equal to that commit. The earlier candidate `ae37122` ran 97 passed and 7 skipped. |
| Environment | Windows 11 (10.0.26200), Node 24.22.3, Vite 8.3.8, Vitest 5.1.1, Playwright 1.65.1, TypeScript 7.0.2 |
| Browsers | Playwright Chromium 159.0.8154.6 and Firefox 159.0. These are Playwright builds, not branded Chrome or a normal Firefox profile. |
| Release owner | Not assigned |

## Commands run from a clean install

| Command | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 0 vulnerabilities reported |
| `npm run typecheck` | PASS | strict TypeScript, no diagnostics |
| `npm test` | PASS | 84 unit tests in 6 files, using fakes (jsdom, fake-indexeddb) |
| `npm run build` | PASS | production bundle and service worker emitted |
| `npm run e2e` | PASS | 106 passed, 8 skipped, 0 failed in Chromium and Firefox against `vite preview` of the production build |

Seven of the 8 skipped tests are the Firefox axe scans, which crash the page under Playwright on this host (`Page crashed`). Firefox axe coverage is `NOT_RUN`. Chromium ran the full axe matrix. The storage worker reported native Firefox quota behaviour as unverified, which is consistent with the remaining skip, but that mapping was not checked line by line here.

Live check of the deployed build `dd2d68a` (deployment run matched by commit SHA): a real Chromium and a real Firefox created two notes on <https://yapweijun1996.github.io/PWA-Web-OS/>, reloaded, found both notes with the most recently updated first, saw the Service Worker controlling the page and recorded no page errors.

## Gates

| Gate | Status | Basis |
| --- | --- | --- |
| G1 Data, offline and update safety | Partly evidenced | Real-browser tests cover persistence across reload, offline cold launch with edit and save, stale two-tab write, an injected IndexedDB abort with rollback and retry, text limits, backup export and restore in a fresh browser context, rejected backups, A to B update with a pending draft, flush failure, an unready second client and an A-only asset after deployment. Wave 3 added real-browser tests (Chromium and Firefox) for a database from a newer schema (data left untouched, clear message), a version change from a second tab, a blocked open (a fix now ends the wait with a clear error after 3 seconds instead of showing "Saving…" indefinitely), IndexedDB unavailable, and a native Chromium `QuotaExceededError` under a 4 MiB quota override (draft and last committed revision survive, Retry works). Not exercised: Firefox native quota, exhaustion at the default quota, private mode, and an upgrade from an older schema (the schema is still version 1, so no older schema exists). |
| G1 Security | Partly evidenced | Production CSP via meta tag allows the service worker, manifest and Blob download with no violations in the test flow. Imported markup stays literal text. Recorded requests were same-origin GETs for app assets only. The cache holds app assets plus one small retained-release metadata record. A meta CSP cannot provide `frame-ancestors` or other response headers. |
| G2 Compatibility | `NOT_RUN` or `BLOCKED` | See the matrix below. |
| G3 Performance | `NOT_RUN` | No budgets, lab measurements or field data recorded. |
| G4 Evidence and recovery | `NOT_RUN` | No staging rehearsal of recovery with retained artifacts. No artifact digests bound to the candidate. |

## Platform matrix

| Platform | Combination | Status |
| --- | --- | --- |
| Windows | Chromium tab (Playwright) | PASS by automation |
| Windows | Firefox tab (Playwright) | PASS by automation, except axe scans (`NOT_RUN`) |
| Windows | Chrome installed app, Firefox web app window | `NOT_RUN` |
| Windows | Branded Chrome and normal Firefox profiles | `NOT_RUN` |
| macOS | all rows | `BLOCKED` (no device) |
| iOS | all rows | `BLOCKED` (no device) |
| Android | all rows | `BLOCKED` (no device) |
| Cross-device backup transfer | second physical device | `BLOCKED` |

## Not verified

Screen reader announcements (manual), iPhone VoiceOver, physical safe areas and software keyboards, installed-app modes, GitHub Pages response headers, real quota exhaustion, performance budgets and field Core Web Vitals, and the Aurora visual match.

## Decision

- Windows demo: **HOLD** until the visual pass is done and its screenshots are reviewed. The functional workflow is tested, but the interface does not match the agreed anchor.
- Full production release: **HOLD**. Required platform rows are `BLOCKED` or `NOT_RUN`.
