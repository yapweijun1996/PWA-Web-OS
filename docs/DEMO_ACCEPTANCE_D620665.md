# Firefox quota recovery demo acceptance

**Full production decision is HOLD.** GitHub Pages serves the verified Notes demo. The frozen artifact passed the automated safety checks and the desktop observations below. Physical mobile, consumer Windows, screen-reader and cross-device acceptance still require evidence on this build.

| Release field | Verified value |
| --- | --- |
| Date | 2026-11-23 |
| Owner | `yapweijun1996` |
| Commit | `d6206655e522a55e65f703b1795219a4853b9ac9` |
| Build | `b-mwtfl4bdd620665` |
| Manifest SHA-256 | `7ae9fabd97b1d0f23e88e2bfb2312da9a7836a53c4965a45a35bc8997edf2130` |
| GitHub recovery archive SHA-256 | `1dbb9927397200062b2e4ea738778b02d1409046ae6215dc961f632073a7e135` |
| Public HTTPS launch | [Notes demo](https://yapweijun1996.github.io/PWA-Web-OS/) |

## Candidate checks

- Ubuntu 24.04 x64 with Node 24.22.3 passed type checking, the build, 90 unit tests and 146 browser tests with zero skips or flakes. The suite included native quota recovery in Chromium 156.0.8078.4 and Firefox 157.0. The downloaded browser report and candidate shared the same manifest. The deployment's live check and an independent check matched the launch URL and all 12 public files to that manifest. [Pages run and retained reports](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45207524392)
- A physical Mac running macOS 27.2 and Chrome 158.0.8127.37 saved a synthetic note on the deployed site, saved an offline edit after restarting Chrome and read the edit after a second offline restart. A fresh profile followed the deployed custom 404 link and later opened the same unknown path through the worker offline.
- On macOS 26.6.2, headed Chrome 158.0.8127.36 and Firefox 160.0.1 passed three tab launches each. Chrome also passed three launches with the app installed from its address bar. The installed windows reported standalone mode and reopened the same synthetic note offline. The rejecting proxy blocked an uncached request in each Firefox tab and Chrome installed offline session. [macOS observations](MAC_COMPATIBILITY_EVIDENCE.md#quota-recovery-demo)
- Windows Server 2025 passed six headed Chrome and Firefox tab sessions and repeat backup import across isolated profiles. Desktop Chrome p75 was 234 ms cold, 286 ms offline and 41 ms for editing. The physical Apple M4 lab passed at 227, 327 and 50 ms. Required physical mobile labs remain open. [Windows run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45210124329) · [Performance evidence](PERFORMANCE.md#recorded-desktop-run)
- On disposable HTTPS staging, Chromium and Firefox rejected a mixed upload, accepted the correct new build and preserved the committed note through rollback. The published build kept the previous stylesheet and manifest byte-for-byte. The same stylesheet had a minimum measured text contrast of 5.987:1. The candidate's automated contrast and accessibility checks passed. [Recovery rehearsal](RECOVERY_RUNBOOK.md#rehearsal-for-the-firefox-quota-recovery-build) · [Contrast evidence](evidence/contrast-54e9662.json)
- WebKit 27.2 passed the selected storage, backup, schema and offline cases in desktop and simulated iPhone 13 viewports. Twenty-four cases passed on the first run. Two narrow-viewport cases needed the existing **Back to Notes list** control before creating or reopening another note and passed after the test navigation was corrected. Physical iOS acceptance remains open.
- The dependency audit on November 23 reported zero known findings for the lockfile used in the release.

## Reconciliation of the 60 standard cases

The [case index](STANDARD_COVERAGE.md) links to individual test assertions and the [release checklist](PRODUCTION_READINESS.md) defines the acceptance gates. The previous release record preserves the [baseline failure and device evidence](DEMO_ACCEPTANCE_54E9662.md). The current run and the observations above establish the following outcomes.

| Outcome | Count | Cases |
| --- | ---: | --- |
| PASS | 37 | INS-01, INS-03, INS-07. SW-01–12. OFF-02, OFF-04–08. A11Y-01, A11Y-02, A11Y-04, A11Y-06, A11Y-07. QA-04–08. REL-01–05, REL-07. |
| BLOCKED | 17 | INS-02, INS-04–06, OFF-01, MOB-01–08, A11Y-03, A11Y-05, A11Y-08, REL-06. |
| INSUFFICIENT_DATA | 3 | QA-01–03. Field metrics follow the [recorded policy](PERFORMANCE.md#field-policy). |
| NOT_APPLICABLE | 3 | INS-08, OFF-03, REL-08. Notes exposes one entry URL and uses local writes and explicit backup import. |

OFF-05 passed after the Firefox connection fix. At quota, the editor retained the draft and the previous revision. After the fixture released storage, **Retry** committed exactly one revision. A rejected fixture write alone left enough room for the real Notes save in Firefox. The regression now verifies the actual editor failure before checking recovery.

REL-07 passed with the automatic live check on this deployment and the workflow's [verified failure path and owner notification](RECOVERY_RUNBOOK.md#check-the-live-release). The live check uses public release bytes and synthetic browser data supplies persistence evidence.
