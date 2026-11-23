# PWA Web OS First-Release Delivery Plan

This plan is proposed. The repository contains specifications and a concept explainer. Application setup, implementation, device testing, and release are pending.

The first release delivers one workflow across Windows, macOS, iOS, and Android. A user opens Notes from the launcher, edits offline after initial online setup, reopens the saved note, accepts an update without losing work, and transfers the note to a second device by JSON backup. IndexedDB owns note data. localStorage holds small interface preferences.

The product specification owns scope and acceptance criteria. The modular development plan owns architecture and runtime contracts. The UI/UX anchor guides the interface, and Task.md tracks completed implementation and verification. This plan sets the delivery sequence, handoffs, and release decisions. [Product specification](PRODUCT_SPEC.md) · [Modular development plan](MODULAR_WEB_OS_PLAN.md) · [UI/UX anchor](UI_UX_ANCHOR.md) · [Task checklist](../Task.md)

## Milestones and dependencies

| Milestone | Work and handoff | Exit evidence |
| --- | --- | --- |
| **M0 · Development baseline** | Resolve the decisions below. Assign an integration owner and book the physical devices. Scaffold the static app, pin the toolchain, and create a staging path that can serve two successive HTTPS releases. Record how to identify a build, start the app, build it, and run checks. | A clean checkout builds and launches. The documented commands work. The declared support matrix, initial storage and backup contracts, and release evidence approach are recorded. |
| **M1 · Local Notes** | Build the launcher, responsive editor, and theme preferences in parallel with IndexedDB. Integrate these in one end-to-end Notes flow. Carry the repository's committed revision and typed failures through to the editor before adding the worker. | Create, edit, save, and reopen a note through the launcher. Exercise a failed write, retry or copy, a stale two-client write, and unavailable preferences. Verify keyboard operation, focus, announcements, and mobile navigation. |
| **M2 · Install and offline** | Add the manifest, icons, browser-specific guidance, and versioned asset caching to the M1 build. Verify offline behavior in Windows browser tabs first. Broaden device and installed-mode testing after the Windows browser milestone. | On Windows Chrome and Firefox tabs, disconnect after initial setup, cold-launch, edit and save, close, then reopen offline in the same context and compare the content. Complete the remaining launch modes before M5. |
| **M3 · Safe updates** | Exercise builds A and B on the same staging origin. Join the editor's flush callback, client coordination, and worker lifecycle. Prepare an older database fixture for migration and retain both build artifacts for recovery rehearsal. | Defer B and keep editing. Accept B with a pending draft, observe progress, and reopen once on B with the draft intact. Verify an unready client, a failed candidate, timed-out activation, and a blocked migration. Check saved revisions after failure and after recovery. |
| **M4 · Portability** | Integrate the backup parser and preview with export of committed notes and atomic import. Verify against the same repository and revision rules used by normal editing. Run a full update-to-transfer flow with two separate devices. | Compare note titles and bodies across devices. Reject malformed, oversized, unsupported, duplicate-ID, and conflicting backups. Verify atomic rejection and idempotent re-import. Confirm unsaved edits are reported before export. |
| **M5 · Release readiness** | Freeze a candidate by commit and build ID. Run the acceptance matrix and applicable standard cases. Rehearse recovery on staging and reconcile installation guidance, development commands, support versions, and exceptions with the evidence. | The release owner records the G1–G4 outcomes, candidate identity, known limitations, staging recovery result, and release decision. A production rollout requires separate authorization. |

The critical path is M0 → integrated M1 → M2 → M3 → integrated M4 → M5. Build and verify the core journey first in regular Windows Chrome and Firefox tabs. Run the [Windows browser milestone](PRODUCTION_READINESS.md#first-milestone-windows-browser-tabs) across M1–M4 before testing installed modes and other platforms. Device booking and compatibility research can run in parallel. The full release matrix remains required at M5. Backup parsing, fixtures, and validation can start after the M0 format decision.

## Workstreams and integration

Use the [UI foundation lanes](UI_FOUNDATION.md#module-ownership-and-parallel-delivery) to assign localization, theme and CSS tokens, and feature UI work in parallel once the shared contracts are agreed.

The [upstream reuse plan](UPSTREAM_REUSE.md) assigns SVG selection to M1 and loader integration to M3. Apply [Blender Gallery's release lessons](BLENDER_GALLERY_REUSE.md#apply-to-the-first-release) to offline readiness in M2, previous-build asset recovery in M3, and evidence review in M5. Public-API and the one-model Viewer remain post-release experiments. Research can run in parallel.

| Proposed owner | Responsibility | Handoff |
| --- | --- | --- |
| Integration and release | Maintain the shared build, wire the modules, coordinate milestone reviews, and assemble the release record. | Publish a staging build ID and the exact validation entry points for each integration milestone. |
| Workspace and Notes UI | Implement launcher, responsive navigation, editor, preferences interaction, accessibility, and user-facing save, offline, update, and backup states. | At M1, demonstrate committed saves through the UI. Before M3, provide the editor flush and recovery behavior used by the update flow. |
| Notes storage and backup | Implement the IndexedDB adapter, migrations, revision checks, backup validation, snapshot export, and atomic import. | Provide the agreed repository contract, old-schema fixture, and valid and invalid backup fixtures. Integrate writes with the real repository in M4. |
| PWA and hosting | Own manifest, install guidance, HTTPS staging, release assets, worker lifecycle, and recovery artifacts. | At M2, provide an offline-capable staging build. At M3, provide two identifiable builds and reproducible failure cases for update testing. |
| Verification | Maintain test-to-requirement coverage, run automated checks and physical-device flows, and capture the results. | Return a reproducible failure and its build/device context to the owner. Confirm critical fixes on the candidate before release review. |

Assign people or agents to these responsibilities at M0. One person can cover multiple roles. Give each change one writer and let the integration owner coordinate changes to shared contracts. Agree on example values and failure outcomes at each handoff so implementations can proceed independently. Use fixtures to validate a contract in isolation, then rerun the relevant flow against the real modules before closing the milestone. A shared contract change carries its caller changes and focused regression evidence.

## Decisions required before implementation

| Decision | Proposed direction and closure evidence |
| --- | --- |
| Minimum supported versions | Record full OS and browser minimums and required launch modes for each row of the product matrix. Use current vendor installation guidance and confirm the chosen minimums on representative devices. Identify physical iOS and Android devices, a desktop screen reader, and access to the Windows and macOS targets. |
| Toolchain and hosting | Confirm the modular plan's TypeScript and static build proposal. Record tool versions, dependency installation, actual commands, origin and base path, HTTPS staging, manifest and worker scope, and promotion and recovery procedures. Staging must exercise the intended cache behavior across two builds. |
| Storage and backup contracts | Record the first IndexedDB schema, record fields and revision rules, first migration policy, theme key and default, and independent JSON backup format and version. Choose file and text limits, sample fixtures, and the handling of identical, conflicting, and unsupported imports. Record where unsaved work is held and what survives a close or reload. |
| Interface direction | Confirm the launch-to-editor navigation, mobile back flow, keyboard focus, save and offline status placement, and opt-in update interaction. Use content and input needs to choose layout transitions in implementation. [UI/UX anchor](UI_UX_ANCHOR.md) |
| Standard applicability and budgets | Record the `STATIC_OFFLINE` profile, offline scope, note and backup data classification, baseline devices, and performance measurement plan. Map the relevant `pwa:product-standard` v1.1.0 cases to project tests and document justified exclusions and launch policy for insufficient field samples. |

## UX acceptance during implementation

| Flow | Acceptance in the running UI |
| --- | --- |
| Launch and navigate | Desktop exposes the launcher and Notes list beside the editor when space permits. Tablet can use a list and editor. On narrow screens, the editor has a visible route to the Notes list, which leads back to the launcher. Resize and rotation preserve the selected note and pending text. Verify mobile keyboard clearance and iOS safe areas in portrait and landscape. |
| Edit and recover | Show saving, saved on this device, and save failure based on the current draft's transaction. A failure leaves editable text available for retry or copy. Test a failed save with a previous committed revision and verify that the two remain distinguishable. |
| Work offline | Offline readiness and local save feedback are separate. Verify the UI handles a real loss of connectivity after setup and that a successful local write still gets its own confirmation. |
| Update | The update action can be deferred while editing continues. On acceptance, convey progress through activation and reload. If another client prevents a safe switch or activation fails, explain the available action and keep the editor usable where the current build permits it. |
| Transfer | Export indicates whether the editor has unsaved changes. Import presents a preview before writing and reports a failure in terms the user can act on. Existing notes survive a rejected import. |

Apply visible focus, keyboard operation, readable contrast, text zoom, reduced motion, and accessible status announcements to these flows as they land. At M5, use a physical iPhone with VoiceOver and verify desktop keyboard and screen-reader operation on the candidate. A design review can confirm terminology and navigation. Runtime evidence is required for focus, announcements, save outcomes, and offline or update behavior.

## Verification and release

Run the launch and offline profile in all 15 required platform and mode combinations. Use physical iOS and Android devices for mobile rows. Record versions and distinguish a tab from an installed or Home Screen launch. Keep each browser profile or app context intact through its offline reopen. Use separate devices for the backup transfer. [Product platform matrix](PRODUCT_SPEC.md#platform-support)

Automate deterministic cases such as failed and stale writes, migration, malformed and conflicting imports, and update coordination where the browser runner can reproduce them. Use the physical devices for install, cold offline reopen, mobile viewport and keyboard, and same-origin A-to-B updates in the applicable app modes. The M0 coverage mapping assigns each remaining case to a runner and environment. Use synthetic note content in test fixtures, traces, logs, and screenshots.

For each result, record the standard and profile, test ID, build ID, commit SHA, environment and device, OS and browser versions, launch mode, runner, timestamp, assertions, status, and linked evidence with artifact digests. Record failure reasons and grounds for exceptions. Use the standard's test statuses `PASS`, `FAIL`, `NOT_RUN`, `BLOCKED`, and `NOT_APPLICABLE`. The concept image and planning documents provide design evidence. Capture execution evidence from the candidate.

| Release gate | Evidence to review |
| --- | --- |
| **G1 · Safety** | Applicable P0 data, security, and update cases pass. Saved notes survive a failed write, stale client, blocked migration, interrupted update, and rejected import. Review CSP and imported text rendering. Inspect network and cache behavior for local-only note and backup data. |
| **G2 · Compatibility** | The declared device and launch matrix has complete required evidence. Include physical mobile install and offline tests, iPhone VoiceOver, and desktop keyboard and screen-reader results. Map any additional standard rows to scope or justified exceptions. |
| **G3 · Performance** | Review the agreed device budget and measured thresholds. Keep lab results separate from field p75 Core Web Vitals. The standard's good field targets are LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1. Record missing field samples as `INSUFFICIENT_DATA` and apply the recorded launch policy. |
| **G4 · Evidence** | Bind the complete result set and artifact digests to the candidate. Exercise recovery with retained release artifacts using existing test data. Confirm compatibility before restoring an older build and use a forward fix when it cannot safely open the current schema. |

Hold the candidate on an applicable P0 failure, a missing critical safety or compatibility check, or a failed gate under the recorded launch policy. Review any proposed exception against the product specification and the selected standard profile. If a fix changes the candidate, identify the new build and rerun affected checks. Once authorized to deploy, promote the same tested build, verify the production manifest and build identity on a normal profile, then smoke-test launch and offline readiness with a synthetic note. Record the outcome and start the rehearsed recovery procedure if production serves inconsistent assets or user data is at risk.

## Risks and responses

| Signal | Response |
| --- | --- |
| A required installed mode fails on a target version or the device is unavailable. | Confirm minimum versions and device access during M0. Reproduce install and cold launch in M2 and keep the affected matrix row open until verified. |
| A save fails while a draft is open or another client writes a newer revision. | Exercise actual IndexedDB failure and stale-revision handling during M1. Keep the previous committed revision and verify retry or copy through the editor. |
| Client state and release assets disagree during a deployment or browser backgrounding. | Stage builds A and B, exercise failed candidates and background clients, and check that the expected build controls the page after activation. Retain the previous artifacts and verify recovery controls. |
| A database update stalls or an older release cannot open the newer schema. | Test an older fixture, blocked migration, and interrupted upgrade in M3. Prefer a compatible forward fix when needed to preserve data. |
| A user switches profiles, browser modes, or devices and expects their note to follow. | Describe saves as local to the current context and verify the backup transfer path in M4. Exercise an interrupted or rejected import against an existing note set. |
| Design review adds features that widen the first release. | Trace requests to the Notes release scope and record later capabilities in the existing feature map. [Features beyond the first release](FEATURE_MAP.md#beyond-the-first-release) |
