# Handoff for the next work session

Status: **DRAFT written 2026-11-23 while the wave-3 workers were still running.** Sections marked `TO FILL` are completed after wave 3 is merged and verified. Do not treat a `TO FILL` section as a result.

## Where the project stands

- The Windows demo of the Notes workflow is deployed at <https://yapweijun1996.github.io/PWA-Web-OS/>. The last verified deployment is commit `dd2d68a` (deployment run checked by commit SHA, then a real-browser smoke test in Chromium and Firefox). It still has the pre-Aurora interface.
- Implemented: launcher and Notes UI, IndexedDB storage with revision checks and `updatedAt`, JSON backup export and restore, theme preference, manifest and icons, Service Worker offline cache, safe update coordinator.
- Release decision recorded in [RELEASE_EVIDENCE_WINDOWS_DEMO.md](RELEASE_EVIDENCE_WINDOWS_DEMO.md): Windows demo **HOLD**, full release **HOLD**.
- Wave 3 had two parts. The storage robustness part is merged and deployed (`dd2d68a`, 106 passed and 8 skipped in the e2e suite). The Aurora visual redesign is NOT merged: its pi worker was still running at about 18:00 on 2026-11-23 inside the worktree `C:/Users/tno/Documents/GitHub/PWA-Web-OS-w3-visual` (branch `w3/visual`, work uncommitted). A preview build of its half-finished state looked close to the Aurora anchors on desktop and phone (wallpaper, top bar, floating Notes window, Dock), but that preview was not verified beyond two screenshots. The owner cancelled the automated end-of-day job, so nothing will merge it automatically.

## Owner decisions in force

See [M0_DECISIONS.md](M0_DECISIONS.md) for the full table. In short: TypeScript with Vite, Vitest and Playwright on Node 24; GitHub Pages at `/PWA-Web-OS/`; Windows demo track because only one Windows machine is available; storage and backup contracts approved including `updatedAt`; Aurora look is the visual anchor for the Notes-only release; Open-Meteo weather is the second tool after the first release; public demo on GitHub Pages with the notice "Demo build. Notes are stored only on this device and are never uploaded."; push to `main` is allowed when every check passes.

## Open work, in suggested order

1. Finish the Aurora visual pass: check `scratchpad/par/w3_visual.status` or run `git status` in the `w3-visual` worktree (the scratch folder may be gone; the worktree is the source of truth). If the worker finished, commit that worktree, merge `w3/visual` into `m1-integration`, regenerate the lockfile if `package.json` conflicts, run `npm ci`, typecheck, tests, build and the full e2e from a clean install, capture screenshots at 1280x800 dark and light, 768x1024 and 390x844, compare them with `docs/assets/web-os-desktop-review-a-aurora.png` and `aurora-anchor-04-adaptive.png`, and only then push. If the worker died, rerun it with the saved brief or start a smaller follow-up. Check that its edits to existing e2e specs only changed selectors and did not weaken assertions.
2. Minimum Windows, Chrome and Firefox versions for the demo (M0 first item, still open). Record them from vendor guidance and confirm on the Windows machine.
3. Decide how the app and release notes label the demo beyond the existing notice.
4. Replace the timestamp-based build ID suffix policy if needed. The build ID currently combines a time stamp and the Git short SHA.
5. Real-browser gaps listed under "Not verified" below.
6. M2 and M3 task items need installed-app modes and the full platform matrix. They stay unchecked until verified.
7. After the first release: Weather tool (check Open-Meteo terms for public use first), then Aurora Files and other apps.

## Not verified (do not claim as done)

- Firefox axe scans: the 7 Firefox axe tests are skipped because Playwright's Firefox page crashes during axe evaluation on this Windows host. Chromium runs the full matrix.
- Installed-app modes (Chrome installed app, Firefox web app window), branded Chrome and a normal Firefox profile.
- macOS, iOS and Android: `BLOCKED`, no devices. Cross-device backup transfer: `BLOCKED`.
- Screen reader behaviour (desktop and iPhone VoiceOver), physical safe areas and software keyboard.
- Performance budgets and field Core Web Vitals; staging recovery rehearsal with retained artifacts; artifact digests bound to a candidate.
- Firefox native storage quota, exhaustion at the default quota, private browsing mode, and an upgrade from an older schema (the schema is still version 1, nothing older exists). Chromium native quota under a 4 MiB override, a newer-schema database, a blocked open, a second-tab version change and IndexedDB unavailable were verified in real browsers.
- GitHub Pages response headers. The CSP is a meta tag, which cannot provide `frame-ancestors`.
- Open-Meteo terms for a public site, and the licence and usage terms of the AI-generated wallpapers (generated with Codex CLI image generation; confirm before relying on them publicly).

## How to resume

Local paths on the owner's Windows machine:

| Item | Location |
| --- | --- |
| Shared checkout | `C:/Users/tno/Documents/GitHub/PWA-Web-OS` (branch `main`; another editor may have uncommitted edits there, so run `git status` first and stage by whitelist) |
| Integration worktree | `C:/Users/tno/Documents/GitHub/PWA-Web-OS-scaffold` (branch `m1-integration`) |
| Other worktrees and branches | `w/*`, `w2/*`, `w3/*`. Merged worktrees may be removed; the branches are kept. |
| Node 24 | The project needs Node 24 (`.nvmrc`). The machine default is Node 25, which Vitest 5 does not support. A portable Node 24.22.3 zip was used from a session scratch folder that may have been cleared; download the `win-x64` zip from nodejs.org, verify its SHA256 against `SHASUMS256.txt`, and put its folder first on `PATH`. |
| Knowledge base | KB `PWA-Web-OS`, id `b0acc29e-f95b-44a2-b56b-62767dadc7b1` (decisions, tooling notes) |

Commands, verified on Windows with Node 24.22.3:

```text
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox
PW_PORT=<free port> npm run e2e
```

Use a distinct `PW_PORT` for every parallel run. Pushing to `main` triggers `.github/workflows/pages.yml`. Check the deployment by the run whose `head_sha` matches the pushed commit, not just the latest run, then smoke test the live site in a real browser.

## Working practices that paid off

- Parallel pi workers in separate Git worktrees with disjoint owned paths, a shared contract file the manager owns, and a final report format. The manager merges, regenerates the lockfile, and reruns everything from a clean install.
- Do not trust a worker's report alone. Rerun the commands, and compare screenshots with the anchor images for visual work. The first deployed UI passed every functional test yet did not match the anchors because workers were never told to open the images.
- A "background task completed" notice for a launcher command only means the launcher exited, not that the worker finished.
- Tests that use fakes (fake-indexeddb, jsdom) say nothing about real browser behaviour; keep both layers.

## Files worth reading first

[RELEASE_EVIDENCE_WINDOWS_DEMO.md](RELEASE_EVIDENCE_WINDOWS_DEMO.md), [M0_DECISIONS.md](M0_DECISIONS.md), [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md), [AURORA_WORKSPACE_PLAN.md](AURORA_WORKSPACE_PLAN.md), `src/contracts.ts`.
