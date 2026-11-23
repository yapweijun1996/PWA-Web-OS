# Update focus demo acceptance

**Full production decision is HOLD.** GitHub Pages serves the verified Notes demo. The remaining gates require physical iOS and Android checks, transfer between two physical devices, consumer Windows acceptance, iPhone VoiceOver, and declared support floors.

| Release field | Verified value |
| --- | --- |
| Date in Singapore | 2026-11-24 |
| Owner | `yapweijun1996` |
| Commit | `b9dcafae40c5389f69fc4eeed35c95a38158b1f6` |
| Build | `b-mwth4sjcb9dcafa` |
| Manifest SHA-256 | `7433ff5f3e3fc0836426f2f98619532da9821a67b506fbcc4b5e576016268314` |
| GitHub recovery archive SHA-256 | `c773df6437e11fb6dd87f2bbefd1f47b5274dfbfd7372414c40de1ce41d7a6a3` |
| Public HTTPS launch | [Notes demo](https://yapweijun1996.github.io/PWA-Web-OS/) |

## Candidate checks

- The Ubuntu 24.04 x64 release job passed type checking, the build, 91 unit tests and 146 browser tests with zero skips or flakes. Node 24.22.3 ran Chromium 156.0.8078.4 and Firefox 157.0. The Pages check and a second check matched the public launch URL and all 12 files to the same manifest. The dependency audit reported zero known findings. [Pages deployment and retained reports](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45215666979)
- On a physical Mac, stable Chrome 158.0.8127.37 followed the custom 404 link, saved online, edited after an offline restart and read the exact edit after a second offline restart through the same unknown path. macOS 26.6.2 repeated the journey in headed Chrome and Firefox tabs and the actual Chrome installed app. [macOS results](MAC_COMPATIBILITY_EVIDENCE.md#update-focus-demo-launches)
- The installed macOS Chrome app accepted `d620665 → b9dcafa` in a loopback rehearsal. The original macOS application bundle then reopened this release and read the exact note saved while the update waited. [Installed update results](MAC_COMPATIBILITY_EVIDENCE.md#updating-the-installed-chrome-app)
- Windows Server 2025 passed six headed Chrome and Firefox tab launches and repeated backup import across isolated profiles. Windows desktop lab p75 was 228 ms cold, 287 ms offline and 55 ms for editing. The physical M4 passed the separate lab batch at 172, 281 and 53 ms. Its first batch exceeded the editing ceiling at 259 ms. [Windows run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45217407898) · [Both Mac batches and Windows lab](PERFORMANCE.md#recorded-desktop-run)
- Windows 11 Enterprise 25H2 Arm64 client (26200.9974) repeated all six headed tab launches and the same-host import on the same artifact. Chrome 157.0.8103.79 and Firefox 160.0 saved and reopened exact offline edits. Desktop Chrome p75 was 122 ms cold, 208 ms offline and 38 ms for editing. [Windows 11 run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45218767300) · [Tab evidence](evidence/windows11-tabs-b9dcafa.json) · [Lab evidence](evidence/performance-windows11-b9dcafa.json)
- During offline editing, both retail Windows 11 browsers passed English and Simplified Chinese with both explicit appearance settings. System followed the real Windows Apps appearance from Light to Dark. Each session preserved the rejected draft and text selection across changes, recovered on Retry and reopened the committed edit. [Preference report](evidence/windows11-preferences-b9dcafa.json) · [Main workflow](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45222288140)
- On the same Windows 11 client, the Chrome installed app and Firefox Web App each used a browser-generated Windows shortcut and passed three process launches. Each saved online, relaunched offline for an edit and relaunched offline to reread it. Both browsers also passed staged update deferral, pause after an injected IndexedDB abort, preserved draft and committed revision, and retry into the compatible staged release in normal tabs. The full workflow passed on `main` and the default Windows Server run repeated the tab and desktop lab passes. [Chrome app](evidence/windows11-chrome-app-b9dcafa.json) · [Firefox Web App](evidence/windows11-firefox-app-b9dcafa.json) · [Tab updates](evidence/windows11-updates-b9dcafa.json) · [Windows 11 run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45223847143) · [Windows Server run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45223921874)
- Chrome 157.0.8103.79 and Firefox 160.0 on the Windows 11 Arm64 client upgraded their native app windows from `d620665` to `b9dcafa`. After the app processes closed, Windows opened each original Start menu shortcut. UI Automation confirmed the build footer and the exact note body after reopening. [Chrome shortcut report](evidence/windows11-chrome-shortcut-update-b9dcafa.json) · [Firefox shortcut report](evidence/windows11-firefox-shortcut-update-b9dcafa.json) · [Windows qualification run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45232735360)
- NVDA 2026.3.1 with headed Chrome on Windows Server passed nine checks for control names, saving, success, failure, retry and the two update prompts. VoiceOver with Chrome on macOS 26.6.2 passed the same nine checks and announced the Note editor region when reopening the draft. Both runs used this retained build for the active editor and verified the synthetic edit after activation. [NVDA run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45217411153) · [Speech Viewer report](evidence/nvda-b9dcafa.json) · [VoiceOver transcript](evidence/macos-voiceover-notes-b9dcafa.json)
- Disposable HTTPS staging verified `d620665 → b9dcafa → d620665` in Chromium and Firefox. Both rejected mixed bytes, accepted the verified candidate, preserved the synthetic edit through rollback, and saved again. The exact CSS bytes matched the earlier manual contrast review and the current automated accessibility checks passed. [Recovery record](RECOVERY_RUNBOOK.md#rehearsal-for-the-update-focus-build) · [Contrast samples](evidence/contrast-54e9662.json)

## Reconciliation of the 60 standard cases

The [case index](STANDARD_COVERAGE.md) links to individual assertions. The [previous demo's record](DEMO_ACCEPTANCE_D620665.md) preserves the baseline update announcement failure.

| Outcome | Count | Cases |
| --- | ---: | --- |
| PASS | 37 | INS-01, INS-03, INS-07. SW-01–12. OFF-02, OFF-04–08. A11Y-01, A11Y-02, A11Y-04, A11Y-06, A11Y-07. QA-04–08. REL-01–05, REL-07. |
| BLOCKED | 17 | INS-02, INS-04–06, OFF-01, MOB-01–08, A11Y-03, A11Y-05, A11Y-08, REL-06. |
| INSUFFICIENT_DATA | 3 | QA-01–03. Field metrics follow the [recorded policy](PERFORMANCE.md#field-policy). |
| NOT_APPLICABLE | 3 | INS-08, OFF-03, REL-08. Notes exposes one entry URL and uses local writes and explicit backup import. |

A11Y-03 and A11Y-08 have passing desktop observations in NVDA and macOS VoiceOver. Both still require iPhone VoiceOver. The fix keeps focus on visible progress when the focused Update control disappears and keeps the update phrase current while a note saves. Verify actual reader output when controls are replaced or several actions share a live region.
