# Notes acceptance for the November 23 demo

**Full production decision: HOLD.** This record tracks evidence for the `54e9662` demo. The [product specification](PRODUCT_SPEC.md#platform-support) defines the launch matrix and the [case index](STANDARD_COVERAGE.md) defines the scope of the 60 standard cases.

| Release field | Verified value |
| --- | --- |
| Date | 2026-11-23 |
| Source | `54e966254c0dab30ac3e28fb480e4f56eb33a0bd` |
| Build | `b-mwtdek2h54e9662` |
| Manifest SHA-256 | `7b3c7e32e415b0ba4a3017b14a41804d5a8d154ea82a02cd47bfd7a7cce78e05` |
| GitHub recovery archive SHA-256 | `c8b05b603f9d6c2d3d23da60921944a721488db975236d8bc65ef6dd5dba7444` |
| Public HTTPS origin and path | [Notes demo](https://yapweijun1996.github.io/PWA-Web-OS/) |
| Release authorization | [Owner decision](M0_DECISIONS.md#direction-and-audience-owner-confirmed-2026-11-23) |

- **CI evidence** is from Ubuntu 24.04 x64, Node 24.22.3, Chromium 156.0.8078.4 and Firefox 157.0. The browser-evidence report records 145 passed, one skipped, and zero failures or flaky results. All 12 deployed files matched the retained manifest. [Pages release run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45195685417)
- **Desktop evidence** covers Windows Server 2025 with retail Chrome and Firefox tabs. On macOS 26.6.2, all three required launch modes passed on the deployed demo. The platform records contain the exact versions and launch methods. [Windows evidence](RELEASE_EVIDENCE_WINDOWS_DEMO.md#subsequent-hosted-windows-tab-run) · [macOS evidence](MAC_COMPATIBILITY_EVIDENCE.md)
- **HTTPS staging evidence** covers Chromium and Firefox on macOS 27.2. Both phases of release replacement plus return to A used the same HTTPS origin within each run. [Staging record](RECOVERY_RUNBOOK.md#rehearsal-with-the-november-23-demo)
- **Desktop lab evidence** covers the same build on a physical Apple M4 and Windows Server 2025. Both passed. Two macOS VM batches exceeded the editing ceiling. The launch policy records field results as `INSUFFICIENT_DATA` and requires the same build to pass the declared desktop and physical mobile labs. The physical mobile measurements and support floors remain open. [Performance](PERFORMANCE.md)

PASS covers the observation stated in that row. FAIL records a check with a reproduced failure. BLOCKED records a required environment or device that is unavailable. NOT_RUN records an unfinished or skipped check. INSUFFICIENT_DATA is the field measurement outcome.

| ID | Outcome | Observation or remaining evidence |
| --- | --- | --- |
| INS-01 | PASS | CI manifest discovery and live HTTPS asset verification. |
| INS-02 | BLOCKED | A and B match on manifest ID, start URL, scope and standalone display. Updating an existing installation through each required app icon remains unverified. |
| INS-03 | PASS | The project subpath, manifest fields, worker scope and launch passed in CI and on the published site. |
| INS-04 | BLOCKED | CI decoded the declared icons at their listed sizes. Check the installed icon treatment on the physical targets. |
| INS-05 | BLOCKED | The macOS Chrome app passed three standalone launches. Windows installed modes and both phone platforms remain open. |
| INS-06 | BLOCKED | CI exercised the available-offline install guide and narrow layout. Safari Home Screen installation requires an iPhone. |
| INS-07 | PASS | CI opened the offline install guide in a tab, used it by keyboard and scrolled its narrow layout. |
| INS-08 | NOT_APPLICABLE | Notes exposes one supported entry URL and has no note-specific deep links. The entry URL is covered by INS-03. |
| SW-01 | PASS | CI waited for worker control and verified readiness was withdrawn when required cache entries were removed. |
| SW-02 | PASS | CI discovered B and preserved the live A editor while the user kept editing. |
| SW-03 | PASS | Chromium and Firefox rejected a mixed B on HTTPS staging, saved on the unchanged A controller, accepted healthy B, and preserved the note through rollback. [Mixed-release evidence](evidence/recovery-mixed-54e9662.json) |
| SW-04 | PASS | CI rejected wrong bytes and served the retained A-only asset to a live A document. |
| SW-05 | PASS | The real update notice was visible and the user could defer while saving on A. Voice output is tracked in A11Y-08. |
| SW-06 | PASS | CI exercised an actual pending IndexedDB write, a native abort and the same-draft retry into B. |
| SW-07 | PASS | CI coordinated two tabs and deferred activation when the second tab could not flush. |
| SW-08 | PASS | Two rapid Update clicks led to one saved revision and one reload. |
| SW-09 | PASS | CI observed progress, one expected-controller reload and the controller timeout guards. |
| SW-10 | PASS | A rejected B left the A editor usable. CI saved an edit and reopened it offline. |
| SW-11 | PASS | Both HTTPS staging runs retained committed notes during A → B → A and saved another edit on A. |
| SW-12 | PASS | A clean profile followed the live custom 404 link. A worker-controlled offline navigation to the same unknown URL opened Notes. |
| OFF-01 | BLOCKED | CI and the recorded retail desktop contexts cold-opened and recovered offline edits. Required phone and Windows installed modes remain open. |
| OFF-02 | PASS | CI simulated an unavailable origin with the browser still online, preserved edits and recovered the connection state. |
| OFF-03 | NOT_APPLICABLE | Notes has zero queued server writes. |
| OFF-04 | PASS | The same committed note survived offline restarts and the retained-artifact update and rollback. |
| OFF-05 | FAIL | Chromium recovered from native quota rejection. The original CI result skipped Firefox. A later check against this retained build reproduced Firefox keeping the draft and last revision while Retry still failed after space was freed. [Quota regression](../e2e/robustness-quota.spec.ts) |
| OFF-06 | PASS | CI preserved data during blocked and newer schema conditions. A real migration is required when the schema changes. |
| OFF-07 | PASS | CI verified same-release cache repair and recovery when A's entry file was evicted after B was hosted. |
| OFF-08 | PASS | CI compared release cache bytes and network traffic, with synthetic notes and backup content absent. |
| MOB-01 | BLOCKED | CI checked the safe-area CSS contract. A physical iPhone cutout check remains. |
| MOB-02 | BLOCKED | Verify the actual Home Indicator clearance in both orientations. |
| MOB-03 | BLOCKED | Editor and Dock behavior passed in simulation. Check access to actions with native iOS and Android keyboards. |
| MOB-04 | BLOCKED | Observe actual focus-triggered zoom and readable text on both phone platforms. |
| MOB-05 | BLOCKED | CI covered portrait and landscape layouts. Compare focus and draft contents after a physical rotation. |
| MOB-06 | BLOCKED | The fixed header and scrollable panes need a real touch scroll test. |
| MOB-07 | BLOCKED | Verify return navigation through a long list and editor with touch and VoiceOver. |
| MOB-08 | BLOCKED | CI tested system appearance and manifest chrome color. Confirm both appearances in actual browser and installed modes. |
| A11Y-01 | PASS | CI used the keyboard to open Notes, edit a note and navigate backup and restore. |
| A11Y-02 | PASS | CI verified visible keyboard focus and restoration after closing workspace controls and the restore preview. |
| A11Y-03 | BLOCKED | All automated axe views passed. Desktop reader and iPhone VoiceOver observations remain. |
| A11Y-04 | PASS | Both engines passed the axe matrix in Light and Dark. The manual review calculated at least 5.987:1 contrast for all 1,126 incomplete text-contrast observations. [Contrast evidence](evidence/contrast-54e9662.json) |
| A11Y-05 | BLOCKED | Check target spacing with physical touch and larger text. |
| A11Y-06 | PASS | CI verified static reduced-motion progress with update status available. |
| A11Y-07 | PASS | CI checked tab containment at both dialog edges, Escape dismissal and focus restoration. |
| A11Y-08 | BLOCKED | CI verified live region updates. Confirm audible save and update sequencing on the declared readers. |
| QA-01 | INSUFFICIENT_DATA | No representative field LCP sample. The cold-launch lab passed on the measured physical Mac and hosted Windows profiles. |
| QA-02 | INSUFFICIENT_DATA | No representative field INP sample. Editor p75 passed on the physical Mac and hosted Windows and exceeded the ceiling in two Mac VM batches. |
| QA-03 | INSUFFICIENT_DATA | No representative field CLS sample. The launch policy requires passing candidate lab results and live synthetic checks with field data recorded separately. |
| QA-04 | PASS | CI checked mobile portrait and landscape reflow and 200% text at 320 and 768 CSS pixels. |
| QA-05 | PASS | CI exercised the production CSP, worker, manifest, backup export and literal imported text. |
| QA-06 | PASS | CI recorded network requests and exact app caches without synthetic note data. |
| QA-07 | PASS | At 2026-11-23 15:04 UTC, clean npm 11.19.0 audits of the release lockfile returned zero known findings with and without development dependencies. The manifest declares no runtime npm dependencies. |
| QA-08 | PASS | CI exercised unavailable storage, rejected writes, stale conflicts and successful retries. |
| REL-01 | PASS | Pages served the 12 verified release files at the project-site path. A clean browser configured offline use and saved a synthetic note. |
| REL-02 | PASS | The exact retained builds upgraded on HTTPS staging in Chromium and Firefox. |
| REL-03 | PASS | CI rejected a failed candidate and kept the working editor across write abort, peer deferral and activation-timeout scenarios. |
| REL-04 | PASS | Both retained manifest digests and all staging phases were verified. The note remained editable after rollback. |
| REL-05 | PASS | This record binds all 60 cases to the selected build and identifies each required gap. |
| REL-06 | BLOCKED | Consumer Windows and required installed sessions, physical phones and reader checks still lack full evidence. |
| REL-07 | PASS | The live check accepted this release and reported an older manifest as a failed Actions run. The owner received the Pages failure in GitHub. Synthetic persistence and mixed-release rejection were verified separately. [Health runbook](RECOVERY_RUNBOOK.md#check-the-live-release) |
| REL-08 | NOT_APPLICABLE | Notes sends no remote transactions. Local backup import is explicit and repeatable. |

Proceed to a full release when the [release gates](PRODUCTION_READINESS.md) are met on one frozen build. Cross-device backup transfer still requires two physical devices.
