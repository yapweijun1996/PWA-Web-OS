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

## Reconciliation of the 60 standard cases

The [case index](STANDARD_COVERAGE.md) maps the assertions. The [previous demo record](DEMO_ACCEPTANCE_B9DCAFA.md) contains its platform, screen reader and performance results. Use matching candidate results for checks that depend on the compiled release.

| Outcome | Count | Cases |
| --- | ---: | --- |
| PASS | 37 | INS-01, INS-03, INS-07. SW-01–12. OFF-02, OFF-04–08. A11Y-01, A11Y-02, A11Y-04, A11Y-06, A11Y-07. QA-04–08. REL-01–05, REL-07. |
| BLOCKED | 17 | INS-02, INS-04–06, OFF-01, MOB-01–08, A11Y-03, A11Y-05, A11Y-08, REL-06. |
| INSUFFICIENT_DATA | 3 | QA-01–03. Field metrics follow the [recorded policy](PERFORMANCE.md#field-policy). |
| NOT_APPLICABLE | 3 | INS-08, OFF-03, REL-08. Notes exposes one entry URL and uses local writes and explicit backup import. |
