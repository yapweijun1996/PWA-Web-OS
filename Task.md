# PWA Web OS Development Tasks

## Pending release tasks

**Full production decision on 2026-11-23: HOLD.** The public Pages deployment serves the Notes demo. A checked implementation item below records the named behavior only. Use the [candidate checklist](docs/PRODUCTION_READINESS.md) for release sign-off.

| Priority | Remaining task | Completion evidence |
| --- | --- | --- |
| 1 | Freeze the Notes candidate and declare the minimum OS and browser versions the release will support. | Record the owner, source SHA, build ID, artifact digest, HTTPS URL and tested lower bounds. |
| 2 | Run the Windows milestone in normal Chrome and Firefox tabs, followed by Chrome installed and the Firefox web app window. | On one candidate, verify offline cold launch, edit/save/reopen, update deferral and recovery, transfer between profiles, both languages and all three appearance settings. The [Windows report](docs/RELEASE_EVIDENCE_WINDOWS_DEMO.md#subsequent-hosted-windows-tab-run) covers retail Chrome/Firefox restarts and same-machine backup transfer on Windows Server. Consumer Windows, installed modes and the remaining journey still require evidence. |
| 3 | Complete macOS Chrome tab/installed and Firefox tab, the four iPhone contexts and the four Android contexts. | Record each browser and launch mode against the same build. Use physical phones for keyboard, safe areas and offline relaunch. Record desktop screen reader and iPhone VoiceOver announcements. [macOS observations](docs/MAC_COMPATIBILITY_EVIDENCE.md) |
| 4 | Transfer a backup between two physical devices. | Export on device A, import on B, compare titles and bodies, and verify a repeat import adds no duplicates. Browser profiles on one machine cover a separate test. |
| 5 | Close the Firefox accessibility evidence gap. | Run the affected Firefox checks on a working configuration and review manual contrast findings. [Firefox accessibility evidence](docs/FIREFOX_AXE.md) |
| 6 | Run the candidate performance and recovery gates. | Capture cold launch, offline reopen and editor latency on the declared desktop and mobile baselines. Record the field-data decision. Rehearse retained release bytes on the intended staging host and verify note integrity after rollback. [Lab results](docs/PERFORMANCE.md) · [Recovery rehearsal](docs/RECOVERY_RUNBOOK.md) |
| 7 | Close the release record and verify the deployed artifact. | Bind the [60-case coverage index](docs/STANDARD_COVERAGE.md) to dated results, record exceptions, obtain rollout authorization, verify the live build identity and repeat the offline note smoke check. |

The top bar checks the hosting origin when visible. A real Chromium and Firefox regression covers OFF-02: the server stops serving its release while the OS remains online, local editing and saving continue, and the next successful check restores the online status. [Origin outage test](e2e/pwa.spec.ts)

### Candidate evidence from 2026-11-23

- Source `a437c29`, public build `b-mwtadq5ya437c29`. All 11 deployed files matched the retained manifest by SHA-256. GitHub lists the recovery archive digest as `fe8ea5a274ed2bc96996c0cf41cccf896926f78e16dd8c503e4d85d281a78acf`. [Pages run 45181689339](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45181689339)
- A clean macOS 26.6.2 checkout at that source passed type checking, the production build, 87 unit tests and 130 Playwright tests in Chromium 159.0.8154.6 and Firefox 159.0. The local build was `b-mwtadiora437c29`. Eight Firefox cases were skipped: seven [axe checks](docs/FIREFOX_AXE.md) and the Chromium-only quota fixture.
- Branded headless Chrome 158.0.8127.37 on macOS 27.2 saved a synthetic note on the live site. It relaunched the same profile offline, saved another edit, exited, then relaunched offline again and read the exact edit. Installed-window evidence remains separate. [macOS observations](docs/MAC_COMPATIBILITY_EVIDENCE.md)
- Chromium and Firefox on macOS passed the two retained-artifact tests for `d854a78 → a437c29 → d854a78` on loopback. The note created on the earlier build survived the update, the edit survived the rollback and saving still worked. The intended staging-host rehearsal remains open. [Recovery procedure](docs/RECOVERY_RUNBOOK.md)
- The seven-run desktop lab passed on macOS Chrome with local build `b-mwtadp90a437c29`. Cold launch, offline reopen and editor response p75 were 559 ms, 736 ms and 89 ms. Mobile and Windows baselines remain open. Field metrics are `INSUFFICIENT_DATA`. [Candidate samples and environment](docs/evidence/performance-macos-a437c29.json)

The first release covers Notes. The [feature map](docs/FEATURE_MAP.md), [UI anchor](docs/UI_UX_ANCHOR.md) and [delivery plan](docs/DELIVERY_PLAN.md) define its scope. See [post-release candidates](#post-release-candidates) for Files, Weather and Viewer.

## M0: Development baseline

- [ ] Assign [UI foundation workstream owners](docs/UI_FOUNDATION.md#module-ownership-and-parallel-delivery) and agree on message, token, preference, and app-entry contracts before parallel implementation.

- [ ] Record minimum Windows, macOS, iOS, and Android versions and required browser versions using the [platform matrix](docs/PRODUCT_SPEC.md#platform-support).
- [x] Define the IndexedDB schema and migrations, the localStorage preference keys and defaults, and the versioned JSON backup format and conflict policy.
- [x] Set up the application and record verified local start, build, and test commands. See [Local development](README.md#local-development).

## M1: Local Notes

- [ ] Integrate English and Simplified Chinese catalogs, System/Light/Dark, and semantic CSS tokens on the first Notes screen. Verify both Windows browsers before expanding coverage.

- [ ] Start integrated verification in regular Windows Chrome and Firefox tabs. Complete the [Windows browser milestone](docs/PRODUCTION_READINESS.md#first-milestone-windows-browser-tabs) across M1–M4 before extending runtime verification to installed modes and other platforms.

- [x] Build a responsive workspace with a launcher that opens Notes on mobile and desktop.
- [x] Select the workspace and Notes SVG icons from [SVG-Icon-Studio](https://github.com/yapweijun1996/SVG-Icon-Studio). Record source revisions and applicable notices, bundle the selected icons locally, and verify accessible control names.
- [x] Implement note creation, editing, and reopening using IndexedDB. Confirm the saved state appears only after the write transaction completes.
- [x] Persist the theme in localStorage and verify it survives a reload. Verify invalid preferences or unavailable localStorage fall back to defaults while Notes remains usable.
- [x] Simulate an IndexedDB write failure. Verify the editor reports the failure, retains the draft for retry or copy, and preserves the last saved revision.
- [x] Edit the same note in two clients and verify a stale write cannot overwrite the newer revision.
- [x] Show saving, saved, and failed states. Keep failed edits available for retry while the editor remains open.
- [ ] Verify iOS safe areas, desktop keyboard navigation, visible focus, and screen reader announcements.

## M2: Install and offline

- [x] Configure production HTTPS, the Web App Manifest, and icons.
- [x] Use a Service Worker to make the workspace and Notes available offline after initial setup.

For each item below, launch Notes online once to complete setup. Then disconnect, edit and save a note, close the workspace, reopen it offline in the same mode, and confirm the saved content. Use physical devices for mobile checks. The [platform matrix](docs/PRODUCT_SPEC.md#platform-support) defines the required modes.

Run the Windows tab checks first. Run installed-mode and other platform checks after the Windows browser milestone and before M5, or record why a required check is blocked.

- [ ] Windows: Chrome tab and installed app, Firefox tab and web app window.
- [ ] macOS: Chrome tab and installed app, Firefox tab.
- [ ] iOS: Safari, Chrome, and Firefox tabs, plus the Home Screen app installed through Safari.
- [ ] Android: Chrome and Firefox tabs, plus each browser's installed app or Home Screen launch.

## M3: Safe updates

- [x] Show an update when a new worker is ready and keep the editor usable while the user defers.
- [x] Preserve pending edits before activation, announce progress, and reopen once in the new build.
- [x] Select and bundle a [Loader Studio](https://github.com/yapweijun1996/Vanilla-HTML-Loader) loader for update progress. Verify readable status text, a static reduced-motion state, and recovery after timeout or failure.
- [x] Verify draft preservation across two builds. Exercise a failed activation and verify recovery.
- [x] Verify update deferral when another client cannot flush pending edits. Exercise a blocked IndexedDB migration and verify that saved data survives.
- [x] Reproduce a previous-build asset request after deployment and verify graceful recovery using the [Gallery reuse plan](docs/BLENDER_GALLERY_REUSE.md#apply-to-the-first-release).

## M4: Portability

- [x] Export saved notes as versioned JSON and validate imports before writing.
- [ ] Verify transfer on a separate device by comparing note titles and bodies.
- [x] Verify that malformed backups and conflicting records leave existing notes intact.

## M5: Release readiness

- [ ] Complete the [production readiness checklist](docs/PRODUCTION_READINESS.md) for the intended release track and record the go/hold decision.
- [ ] Run the complete Notes workflow against the supported device and browser matrix.
- [ ] Record the tested build, devices, results, and any exceptions to `pwa:product-standard` v1.1.0.
- [ ] Confirm that README and development commands match the tested implementation.

## Post-release candidates

- [ ] Prototype the Aurora Dock and window manager using the [feature anchors](docs/AURORA_WORKSPACE_PLAN.md#feature-anchors). Verify opening, switching, minimizing, restoring, and snapping Notes and a placeholder Files window.
- [ ] Validate the Aurora Files-to-Preview flow across desktop, tablet, and phone after agreeing on a workspace file contract. Verify import and export, viewport changes, and preservation of the current selection and Notes draft.
- [ ] Evaluate [Public-API](https://github.com/yapweijun1996/Public-API) as a source of optional online tools. Verify provider terms, browser access, request limits, and offline behavior before selecting any demo. Keep requests independent of Notes data.
- [ ] Evaluate the [one-model Viewer pilot](docs/BLENDER_GALLERY_REUSE.md#after-m5-one-model-viewer-pilot) with a cleared GLB, fallback, and device budget.
