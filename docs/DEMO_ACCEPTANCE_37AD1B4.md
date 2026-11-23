# Startup theme demo acceptance

**Full production decision is HOLD.** The verified startup theme build is live on the Notes demo. The full release still requires device compatibility at the selected minimum versions, physical mobile performance, transfer between two physical devices, and iPhone VoiceOver.

| Release field | Verified value |
| --- | --- |
| Date in Singapore | 2026-11-24 |
| Owner | `yapweijun1996` |
| Commit | `37ad1b41d4be8d96212ce60e59532470fd19f6c9` |
| Build | `b-mwtnv4pp37ad1b4` |
| Manifest SHA-256 | `3f9e7d0864046dba370f2a70196d21c23ab6b8e9c8ed28ee2c3ff3b16e1e1265` |
| Recovery archive SHA-256 | `df88ad6e628fe22e30f5767640cbe7f5114578e5ea947874a70a7535441e672f` |
| Public HTTPS launch | [Notes demo](https://yapweijun1996.github.io/PWA-Web-OS/) |

## Candidate checks

- GitHub Pages completed build, deployment and live verification on the retained candidate. The Ubuntu x64 build passed type checking, unit tests, and 150 browser tests with zero skips or flakes. The browser evidence uses Node 24.22.3, Chromium 156.0.8078.4 and Firefox 157.0. Both the Pages job and a second check matched the live entry and all 12 hosted files. The current lockfile audit reported zero findings. [Pages run and retained artifacts](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45249652707)
- Both browser projects passed the saved Light and Dark checks with the main script held and the production CSP in place. WebKit 27.2 on macOS 27.2 also applied both explicit settings before mounting and followed the system theme with invalid or inaccessible storage. The compiled stylesheet matches the earlier manual contrast check by SHA-256. [Startup checks](../e2e/ui-notes.spec.ts) · [CSP test](../e2e/security-local-data.spec.ts) · [WebKit results](evidence/startup-theme-37ad1b4.json) · [Contrast samples](evidence/contrast-54e9662.json)
- Chrome 158.0.8127.37 on macOS 27.2 followed the public custom 404 link, selected Dark and saved a synthetic note. In a fresh browser process with network disabled, the same unknown path reopened the workspace and the note saved an offline edit. A third process read the exact body, and both offline processes retained Dark. [Live smoke evidence](evidence/startup-theme-37ad1b4.json)
- Disposable HTTPS staging tested `b9dcafa → 37ad1b4 → b9dcafa` in Chromium and Firefox. Both verified each phase's served files, rejected the mixed release, saved after rejection, accepted verified B, and retained the committed edit through rollback. [Rehearsal evidence](evidence/recovery-mixed-37ad1b4.json)
- NVDA 2026.3.1 on Windows Server with Chrome 157.0.8103.79 passed nine speech checks on this candidate, including the editor field names, saving, success, failure, retry, update availability and the pending-save update announcement. The rehearsal staged `b9dcafa` to verify the saved edit after activation. [Speech Viewer report](evidence/nvda-37ad1b4.json) · [Workflow run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45251242945)
- Windows 11 Enterprise 25H2 Arm64 (26200.9974) passed all four required launch modes with Chrome 157.0.8103.79 and Firefox 160.0. The tabs verified offline editing, same-host backup, both languages, all appearance modes and update recovery after an aborted write. After upgrading from `b9dcafa`, each original Windows shortcut opened the exact build and retained note. Chrome lab p75 was 184 ms cold, 268 ms offline and 53 ms for editor response. [Client results](evidence/windows11-37ad1b4.json) · [Lab results](evidence/performance-windows11-37ad1b4.json) · [Actions run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45251244507)
- The physical Apple M4 completed all seven lab journeys with Chrome 158.0.8127.37. The exact candidate passed at 523 ms cold, 763 ms offline and 102 ms for editor response p75. A Sequoia VM was preparing an OS update and other work was running on the host. [Physical Mac samples](evidence/performance-macos-37ad1b4.json)
- The documented dev command opened Notes on `/PWA-Web-OS/` with the saved theme and no service worker on macOS 27.2. The clean Pages run exercised install, type check, unit tests, build, preview and both browser projects. A separate macOS run on `f9011cd` encountered a Firefox context-teardown timeout in the title-limit case. Both data-limit cases passed twice in an isolated rerun. [Local commands](../README.md#local-development) · [Clean Pages run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45249652707)

## Reconciliation of the 60 standard cases

The [case index](STANDARD_COVERAGE.md) maps the assertions. The [previous demo record](DEMO_ACCEPTANCE_B9DCAFA.md) contains its platform, screen reader and performance results. Use matching candidate results for checks that depend on the compiled release.

| Outcome | Count | Cases |
| --- | ---: | --- |
| PASS | 37 | INS-01, INS-03, INS-07. SW-01–12. OFF-02, OFF-04–08. A11Y-01, A11Y-02, A11Y-04, A11Y-06, A11Y-07. QA-04–08. REL-01–05, REL-07. |
| BLOCKED | 17 | INS-02, INS-04–06, OFF-01, MOB-01–08, A11Y-03, A11Y-05, A11Y-08, REL-06. |
| INSUFFICIENT_DATA | 3 | QA-01–03. Field metrics follow the [recorded policy](PERFORMANCE.md#field-policy). |
| NOT_APPLICABLE | 3 | INS-08, OFF-03, REL-08. Notes exposes one entry URL and uses local writes and explicit backup import. |
