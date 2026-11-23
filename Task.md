# PWA Web OS Development Tasks

## Pending release tasks

**Full production decision on 2026-11-24 is HOLD.** GitHub Pages serves the verified Notes demo `b-mwtnv4pp37ad1b4`. See the [60 recorded case outcomes](docs/DEMO_ACCEPTANCE_37AD1B4.md) and the [candidate checklist](docs/PRODUCTION_READINESS.md).

| Priority | Remaining task | Completion evidence |
| --- | --- | --- |
| 1 | Verify the lower-end platform targets and publish supported versions. | All three macOS modes passed on Sequoia 15.8.3 Arm64. Complete the Windows x64, iOS, and Android rows before publishing. [Qualification targets](docs/PRODUCT_SPEC.md#minimum-version-qualification-targets) · [Sequoia report](docs/evidence/macos-sequoia-15-8-3-37ad1b4.json) |
| 2 | Complete Windows client support qualification. | Windows 11 Enterprise 25H2 Arm64 passed all four launch modes on `37ad1b4`, including original shortcuts after upgrading. A hosted x64 Hyper-V guest preflight passed. Run the four launch modes on a licensed 25H2 x64 client. [Arm64 results](docs/evidence/windows11-37ad1b4.json) · [Hyper-V preflight](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45240881415) |
| 3 | Complete the iPhone and Android launch matrix. | The Android 16 emulator passed the Chrome tab save and offline cold-launch journey. Qualify iOS 18 and Android 10 on physical phones, including each required launch mode, native keyboard, safe areas and rotation. [Qualification targets](docs/PRODUCT_SPEC.md#minimum-version-qualification-targets) · [Android emulator evidence](docs/evidence/android16-emulator-b9dcafa.json) |
| 4 | Transfer a backup between two physical devices. | Export on device A, import on B, compare titles and bodies, and verify a repeat import adds no duplicates. Browser profiles on one machine cover a separate test. |
| 5 | Verify iPhone VoiceOver and complete the reader acceptance. | NVDA passed nine speech checks on `37ad1b4`. Two Sequoia 15.8.3 runs captured all nine desktop VoiceOver checks, including ordinary saving and update availability. Record iPhone VoiceOver reading labels, save results and update states. [NVDA report](docs/evidence/nvda-37ad1b4.json) · [Sequoia 15.8.3 follow-up](docs/evidence/macos-voiceover-15-8-3-37ad1b4.json) |
| 6 | Complete candidate performance and recovery acceptance. | Both desktop profiles passed the lab on `37ad1b4`, which also passed HTTPS staging rollback in Chromium and Firefox. Measure the two physical phone profiles and apply the field-data policy. [Lab baselines](docs/PERFORMANCE.md#release-lab-baselines) · [Mobile procedure](docs/PERFORMANCE.md#physical-mobile-lab) · [Recovery rehearsal](docs/RECOVERY_RUNBOOK.md#rehearsal-for-the-startup-theme-build) |
| 7 | Update the release decision after the device and reader checks. | Reconcile the remaining [case outcomes](docs/DEMO_ACCEPTANCE_37AD1B4.md) and decide whether all full-release gates are met. The current demo passed live SHA-256 verification and the synthetic offline note smoke check. |

The top bar checks the hosting origin when visible. A real Chromium and Firefox regression covers OFF-02: the server stops serving its release while the OS remains online, local editing and saving continue, and the next successful check restores the online status. [Origin outage test](e2e/pwa.spec.ts)

### Current demo evidence from 2026-11-24

- Source `37ad1b4`, build `b-mwtnv4pp37ad1b4`. Pages passed 150 browser tests with zero skips, then verified the launch URL and 12 hosted files. The saved theme applies before the workspace script loads. Stable Chrome followed the live custom 404 link and retained Dark and the exact note body through two offline process restarts. [Candidate evidence](docs/DEMO_ACCEPTANCE_37AD1B4.md)
- The Sequoia 15.8.3 Arm64 guest passed Chrome tab, Chrome installed app, and Firefox tab. All three saved offline and read the exact edit after restarting. [Sequoia report](docs/evidence/macos-sequoia-15-8-3-37ad1b4.json)
- Chromium and Firefox preserved the note through `b9dcafa → 37ad1b4 → b9dcafa` on HTTPS staging after rejecting a mixed candidate. [Recovery evidence](docs/evidence/recovery-mixed-37ad1b4.json)
- Windows 11 25H2 Arm64 Chrome and Firefox passed the two-tab stale-write and backup rejection checks. Both recovered the draft as a separate note and retained the exact saved records after rejecting a malformed file and a conflicting batch. [Data safety report](docs/evidence/windows-data-safety-37ad1b4.json)

### Update focus demo evidence from 2026-11-24

- Source `b9dcafa`, build `b-mwth4sjcb9dcafa`. Pages passed 91 unit tests and 146 browser tests with zero skips, then verified the launch URL and 12 hosted files. Stable Chrome followed the live custom 404 link and reopened an offline edit. [Pages run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45215666979)
- The active release passed nine NVDA Speech Viewer checks and ten macOS VoiceOver checks. Both readers captured the pending-save update progress and the synthetic edit survived activation. [Candidate record](docs/DEMO_ACCEPTANCE_B9DCAFA.md)
- The same artifact passed all three macOS launch modes, six Windows Server tab sessions, HTTPS recovery, and the separate desktop lab batches on the physical Mac and hosted Windows. [Recovery](docs/RECOVERY_RUNBOOK.md#rehearsal-for-the-update-focus-build) · [Performance](docs/PERFORMANCE.md#recorded-desktop-run)

### Quota recovery demo evidence from 2026-11-23

- Source `d620665`, build `b-mwtfl4bdd620665`. The Pages runner passed 90 unit and 146 browser tests with zero skips. Firefox and Chromium both recovered from native quota exhaustion. The deploy verification matched the launch URL and all 12 hosted files. [Pages run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45207524392)
- The same artifact passed headed Chrome tab, Chrome installed and Firefox tab launches on macOS 26.6.2. Windows Server 2025 passed six headed Chrome and Firefox sessions and same-host backup transfer. [Evidence](docs/DEMO_ACCEPTANCE_D620665.md)
- Physical Mac and hosted Windows desktop performance passed on the same build. The HTTPS staging rehearsal rejected mixed release bytes, upgraded and preserved a synthetic edit through rollback in both engines. [Lab results](docs/PERFORMANCE.md) · [Recovery](docs/RECOVERY_RUNBOOK.md#rehearsal-for-the-firefox-quota-recovery-build)

### Previous demo evidence from 2026-11-23

- Source `54e9662`, build `b-mwtdek2h54e9662`. The Ubuntu x64 release runner passed 90 unit tests and 145 browser tests in Chromium 156.0.8078.4 and Firefox 157.0. The Firefox native quota fixture was the sole skip. The deployed files matched all 12 SHA-256 entries in the retained manifest. [Pages deployment and test report](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45195685417)
- Chrome 158.0.8127.36 on macOS 26.6.2 followed the live site's custom 404 link, prepared offline use and saved a synthetic note. It restarted offline, edited and saved, then restarted offline again and read the same edit. A controlled navigation opened that same unknown URL offline.
- The retained release rehearsal passed in both engines on loopback. See the [recovery identities and results](docs/RECOVERY_RUNBOOK.md#rehearsal-with-the-november-23-demo).
- The Windows Server 2025 lab passed all six Chrome and Firefox tab sessions and same-host backup transfer on the same artifact. [Windows browser results](docs/RELEASE_EVIDENCE_WINDOWS_DEMO.md#subsequent-hosted-windows-tab-run)
- The same retained build passed all three budgets on a physical Apple M4 with macOS 27.2. Two macOS VM batches exceeded the editing ceiling. [Performance evidence](docs/PERFORMANCE.md)

### Earlier candidate evidence from 2026-11-23

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

- [x] Integrate English and Simplified Chinese catalogs, System/Light/Dark, and semantic CSS tokens on the first Notes screen. Verify the integrated screen in both Windows browsers. [Windows 11 Chrome and Firefox evidence](docs/evidence/windows11-37ad1b4.json)

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
- [x] macOS: Chrome tab and installed app, Firefox tab. [Sequoia 15.8.3 Arm64](docs/evidence/macos-sequoia-15-8-3-37ad1b4.json)
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
- [x] Confirm that README and development commands match the tested implementation. [Candidate checks](docs/DEMO_ACCEPTANCE_37AD1B4.md#candidate-checks)

## Post-release candidates

- [ ] Prototype the Aurora Dock and window manager using the [feature anchors](docs/AURORA_WORKSPACE_PLAN.md#feature-anchors). Verify opening, switching, minimizing, restoring, and snapping Notes and a placeholder Files window.
- [ ] Validate the Aurora Files-to-Preview flow across desktop, tablet, and phone after agreeing on a workspace file contract. Verify import and export, viewport changes, and preservation of the current selection and Notes draft.
- [ ] Evaluate [Public-API](https://github.com/yapweijun1996/Public-API) as a source of optional online tools. Verify provider terms, browser access, request limits, and offline behavior before selecting any demo. Keep requests independent of Notes data.
- [ ] Evaluate the [one-model Viewer pilot](docs/BLENDER_GALLERY_REUSE.md#after-m5-one-model-viewer-pilot) with a cleared GLB, fallback, and device budget.
