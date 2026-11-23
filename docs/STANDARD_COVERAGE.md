# Notes release case coverage

This index maps the 60 cases of `pwa:product-standard` v1.1.0 to the public Notes release, profile `STATIC_OFFLINE`. Note content stays in IndexedDB. Only app assets enter the service worker cache. The [platform matrix](PRODUCT_SPEC.md#platform-support) defines the supported launch modes.

Use the test title and project name in the candidate's retained Playwright JSON to locate an executed assertion. The adjoining manifest binds those results to the compiled worker and files. Two-release fixture tests build their own A and B, and retained-artifact rehearsals have their own two identities. For manual checks, record the candidate SHA, build ID, artifact digest, date, OS, browser/version, mode, observation and evidence location. A source link describes coverage. Assign PASS only when the candidate's matching observation covers the case in the claimed context. Track missing device access as BLOCKED and unexecuted checks as NOT_RUN.

## Installation

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| INS-01 | HTTPS project site exposes the manifest | [Manifest discovery](../e2e/pwa.spec.ts) on preview. Verify the deployed HTTPS response and build identity. |
| INS-02 | Updates keep the same installed app identity | Compare the retained A and B manifests' `id`, origin and scope. On each installed target verify the existing icon launches the updated workspace. |
| INS-03 | Scope and launch URL resolve to the project path | [Manifest fields and registration](../e2e/pwa.spec.ts), [project-path launch](../e2e/scaffold.spec.ts). |
| INS-04 | Declared icons decode at intended sizes | [Manifest and icon assertions](../e2e/pwa.spec.ts). Inspect mask cropping on installed platforms. |
| INS-05 | Launch in a standalone app window | [macOS observations](MAC_COMPATIBILITY_EVIDENCE.md). Verify all declared installed modes on the selected release. |
| INS-06 | Safari Home Screen instructions work for an iPhone user | [Offline guide test](../e2e/install-guide.spec.ts) checks text and keyboard use. Complete the installation on an iPhone. |
| INS-07 | A user lacking an install option can stay in a tab | [Install guide fallback](../e2e/install-guide.spec.ts) checks the offline guidance and its visibility on a narrow viewport. |
| INS-08 | Launch a supported deep link from an installation | The Notes release exposes one launcher URL and no note-specific deep links. Verify the installed start URL and retain this scoped exception for note links. |

## Service worker and updates

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| SW-01 | Report readiness only after installation and cache validation | [Fresh setup and controlling worker](../e2e/pwa.spec.ts), [incomplete cache decision](../src/pwa/update-controller.test.ts). |
| SW-02 | Discover a new release without replacing an open editor | [A and B on one origin](../e2e/pwa-update.spec.ts), [deferred edit on A](../e2e/update-notes.spec.ts). |
| SW-03 | A mismatched worker or unverified asset cannot silently take over | [Controller identity and reload guards](../src/pwa/update-controller.test.ts), [byte-mismatched B](../e2e/pwa-update.spec.ts). Check mixed-release delivery on staging. |
| SW-04 | Reject stale or missing release bytes | [Rejected B and late A-only asset](../e2e/update-notes.spec.ts). |
| SW-05 | Announce the waiting update and let the user defer | [Real update notice](../e2e/a11y-update.spec.ts), [defer while editing](../e2e/update-notes.spec.ts). |
| SW-06 | Protect dirty edits before activation | [Pending write, real abort and retry](../e2e/update-notes.spec.ts). |
| SW-07 | Coordinate all active Notes tabs | [Second client cannot flush](../e2e/update-notes.spec.ts), [both tabs reload once](../e2e/pwa-update.spec.ts). |
| SW-08 | Repeated acceptance cannot start a second switch | [Update and reload checks](../e2e/update-notes.spec.ts) cover a single accepted switch. Exercise rapid repeated acceptance while the write is pending. |
| SW-09 | Announce progress and reload only into the expected controller | [Real progress and one reload](../e2e/update-notes.spec.ts), [controller timeout](../src/pwa/update-controller.test.ts). |
| SW-10 | Failed update retains the usable offline editor | [Candidate rejection, offline save and reread](../e2e/update-notes.spec.ts). |
| SW-11 | Recover with a retained build and preserve editability | [Retained release rehearsal](RECOVERY_RUNBOOK.md). Repeat on the intended staging host with the candidate pair. |
| SW-12 | Recover from an unknown navigation within the app scope | Test a previously prepared workspace using an unknown path online and offline. Also check the hosting response on an uncontrolled first navigation. |

## Offline storage

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| OFF-01 | Cold-open the shell and recover a committed edit offline | [Same-context offline persistence](../e2e/data-persistence.spec.ts), [retail desktop restarts](../scripts/check-desktop-tabs.py). Verify each required launch mode. |
| OFF-02 | An origin outage is visible while the browser reports a working connection | [Unavailable origin, automatic recovery and saved draft](../e2e/pwa.spec.ts), [timeout and stale-result checks](../src/pwa/connection.test.ts). |
| OFF-03 | Server acknowledgement for queued server writes | NOT_APPLICABLE. Notes has no server mutations. Its local commit boundary is covered by the [native write failure test](../e2e/data-write-failure.spec.ts). |
| OFF-04 | Preserve acknowledged work across process or update boundaries | [Offline reread](../e2e/data-persistence.spec.ts), [pending update flush](../e2e/update-notes.spec.ts). An unsaved input remains in the open editor until its IndexedDB transaction commits. |
| OFF-05 | Recover from a full local store | [Native Chromium quota rejection](../e2e/robustness-quota.spec.ts). Obtain Firefox quota evidence separately. |
| OFF-06 | Preserve stored notes when schema handling fails | [Blocked upgrade](../e2e/robustness-blocked.spec.ts), [newer schema and version change](../e2e/robustness-schema.spec.ts). Version 1 is the first shipped schema. Test real old-to-new migrations when the schema changes. |
| OFF-07 | Recover when cached release assets are evicted | [Eviction and verified repair](../e2e/pwa.spec.ts) removes two real cache entries, rejects mismatched server bytes atomically and restores the exact files after reconnecting. It also deletes the entire asset cache while the same release is hosted and rereads the saved note after a fresh offline launch. Verify boot recovery separately if the previous entry script has been evicted and the origin has already replaced that release. |
| OFF-08 | Keep note and backup content out of network caches | [Exact cache inventory, bytes and request observations](../e2e/security-local-data.spec.ts). |

## Mobile behavior

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| MOB-01 | Keep controls clear of the display cutout | [Safe-area CSS contract](../e2e/a11y-responsive.spec.ts). Inspect the top bar, menus and dialogs on a physical iPhone. |
| MOB-02 | Keep the Dock and confirmation actions clear of the home indicator | Check the actual bottom inset in portrait and landscape on iOS. |
| MOB-03 | Make editor fields and actions reachable with the software keyboard open | [Focused phone editor and Dock](../e2e/aurora.spec.ts). Verify with the native iOS and Android keyboards. |
| MOB-04 | Focusing an editor field should preserve usable zoom | Observe focus and text scale on the supported physical phones. |
| MOB-05 | Preserve layout and draft across rotation | [Responsive layouts](../e2e/a11y-responsive.spec.ts). Rotate a physical device with a draft open and compare content and focus. |
| MOB-06 | Keep the top bar available in the Notes workspace | The shell uses a fixed workspace header and scrollable panes. Verify controls remain reachable during real touch scrolling; record the fixed-header exception to a collapsing top bar. |
| MOB-07 | Return to the top of long content with accessible navigation | The launcher fits its workspace. Check navigation within a long note list and editor with touch, keyboard and VoiceOver before closing this case. |
| MOB-08 | Match system appearance in installed and browser modes | [Theme switches](../src/prefs/index.test.ts), [manifest chrome color](../e2e/pwa.spec.ts). Observe actual OS chrome with both system appearances. |

## Accessibility

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| A11Y-01 | Operate the launcher, editor and backup with the keyboard | [Keyboard journey](../e2e/a11y-keyboard.spec.ts), [Dock](../e2e/aurora.spec.ts), [installation guide](../e2e/install-guide.spec.ts). |
| A11Y-02 | Show focus and return it predictably | [Visible indicator and focus restoration](../e2e/a11y-keyboard.spec.ts). |
| A11Y-03 | Communicate names, regions and current editor state | [Automated scans](../e2e/a11y-axe.spec.ts). Listen with a desktop reader and iPhone VoiceOver. |
| A11Y-04 | Retain readable contrast across themes and UI states | [Six viewport/theme combinations](../e2e/a11y-axe.spec.ts), [update notice](../e2e/a11y-update.spec.ts). Review incomplete findings and [Firefox exceptions](FIREFOX_AXE.md). |
| A11Y-05 | Touch targets remain reachable and sufficiently spaced | Inspect physical touch behavior at the smallest supported viewport and higher text size. |
| A11Y-06 | Preserve status text with reduced motion | [Reduced-motion progress during a real update](../e2e/a11y-update.spec.ts). |
| A11Y-07 | Keep dialog focus contained and restore it on dismissal | [Keyboard dismissal and focus restoration](../e2e/a11y-keyboard.spec.ts). Check Tab and Shift+Tab containment in the native modal. |
| A11Y-08 | Announce save and update state changes | [Live region during update](../e2e/a11y-update.spec.ts), [saving and failure states](../e2e/ui-notes.spec.ts). Listen for sequencing on the declared readers. |

## Quality

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| QA-01 | Field LCP | [Performance policy](PERFORMANCE.md). Record representative field p75 or INSUFFICIENT_DATA. Lab cold launch measures the entire Notes journey. |
| QA-02 | Field INP | Record representative field p75 or INSUFFICIENT_DATA. [Editor lab](PERFORMANCE.md) measures a controlled edit. |
| QA-03 | Field CLS | Record representative field p75 or INSUFFICIENT_DATA and the release owner's launch decision. |
| QA-04 | Reflow without clipping or horizontal page scroll | [Portrait, landscape and 200% text](../e2e/a11y-responsive.spec.ts), [small-screen guide](../e2e/install-guide.spec.ts). |
| QA-05 | Apply the production CSP and render imported content as text | [Production policy and imported note assertions](../e2e/security-local-data.spec.ts). |
| QA-06 | Exclude note data from the cache and app requests | [Observed browser and origin requests plus cached bytes](../e2e/security-local-data.spec.ts). |
| QA-07 | Review release dependencies and lockfile | Run the clean install and dependency review for the candidate. Record findings, including the production and build-time scopes. |
| QA-08 | Recover from expected runtime failures | [Unavailable IndexedDB](../e2e/robustness-unavailable.spec.ts), [write failure and retry](../e2e/data-write-failure.spec.ts), [conflicts](../e2e/data-conflict.spec.ts). |

## Release

| ID | Check for this workspace | Automated evidence and outstanding observations |
| --- | --- | --- |
| REL-01 | Build and serve the verified files over HTTPS | [Pages workflow](../.github/workflows/pages.yml). Compare deployed files with the retained manifest and cold-open a synthetic note. |
| REL-02 | Move a user from the older build into the newer one | [Real two-build flow](../e2e/update-notes.spec.ts). Rehearse the selected pair of retained release artifacts. |
| REL-03 | Keep notes and a usable version when an update aborts | [Aborted write and unavailable second client](../e2e/update-notes.spec.ts), [activation timeout](../src/pwa/update-controller.test.ts). |
| REL-04 | Retain and verify a usable rollback artifact | [Manifest checks and A → B → A procedure](RECOVERY_RUNBOOK.md). Record both run IDs, digests and post-rollback edits. |
| REL-05 | Bind each candidate outcome to its environment and evidence | [Retained browser evidence](PRODUCTION_READINESS.md#browser-evidence-on-each-pages-push), manual observations and this index. Reconcile all open rows before GO. |
| REL-06 | Complete the declared browser and installed-mode matrix | [Platform matrix](PRODUCT_SPEC.md#platform-support), [Windows retail workflow](../.github/workflows/desktop-tabs.yml) and [macOS observations](MAC_COMPATIBILITY_EVIDENCE.md). |
| REL-07 | Detect deployment failures and protect note privacy | Verify Pages failure visibility, expected live build, synthetic persistence and the response to an inconsistent deployment. Document who receives release failures. |
| REL-08 | Prevent automatic resubmission of a remote transaction | NOT_APPLICABLE. This release sends no remote mutations. Local backup import remains explicit and [idempotent](../e2e/data-backup.spec.ts). |
