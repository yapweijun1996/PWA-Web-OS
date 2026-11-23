# PWA Web OS Production Readiness Checklist

Use a fresh copy of this checklist for each candidate. The [pending release tasks](../Task.md#pending-release-tasks) link to recorded results and remaining evidence. The [product specification](PRODUCT_SPEC.md#acceptance-criteria) defines acceptance, and the [delivery plan](DELIVERY_PLAN.md#verification-and-release) defines release gates and evidence.

## First milestone: Windows browser tabs

Complete this milestone in regular Chrome and Firefox tabs on Windows before testing installed modes or expanding platform coverage. Use the same production build on staging and record results independently for each browser.

- [ ] Open the workspace under the intended project-site path and launch Notes with mouse and keyboard. Verify focus order, screen reader status, and layout at the agreed viewport and zoom settings.
- [ ] Create and edit a note, wait for save confirmation, and reopen the tab. Verify the saved content matches and saving fails visibly if IndexedDB is unavailable.
- [ ] Open the same note in two tabs of one browser profile. Verify a stale write preserves the newer saved version and gives the other editor a recovery action.
- [ ] Complete initial offline setup, disconnect, cold-open the workspace, edit, save, close, and reopen offline. Confirm that local save and offline status are distinct.
- [ ] Test builds A and B on the same staging origin. Verify update deferral, consent, draft protection, one reload, and recovery from a failed candidate or timeout.
- [ ] Export a note backup from one browser and import it into the other. Compare content and verify that malformed or conflicting backups leave existing notes intact. This validates transfer between browser contexts on Windows. Record the separate-device check independently.
- [ ] Record build SHA, Windows and browser versions, steps, results, and artifacts. Close any blocker affecting core tasks, data integrity, or recovery before advancing to installed mode.
- [ ] Pass the [UI foundation checks](UI_FOUNDATION.md#windows-acceptance) in both browsers. Include both languages, both explicit themes, System mode, offline assets, and preservation of drafts during preference changes.

This is an engineering milestone. The Windows demo and full release retain their separate gates below.

### Windows hosted browser check

Run the **Windows desktop browser acceptance** workflow with the numeric ID of a successful main-branch Pages run that still has its recovery artifact. It verifies the artifact manifest, opens the retained build in installed retail Chrome and Firefox using dedicated profiles, and exits the browser between each online or offline session. It exports a synthetic note from Chrome, imports it twice in Firefox and compares its contents after offline edits. The JSON report records each completed session and actual browser version. This covers regular browser tabs on a hosted Windows Server machine. Installed windows, the minimum supported consumer Windows version, screen readers and transfer between physical devices still require their own observations.

## Candidate and release scope

- [ ] Record the release owner, intended audience, commit SHA, build ID, staging URL, production URL, and artifact digest.
- [ ] Choose the release track and label it consistently in the app, release notes, and evidence.
  - **Windows demo:** verify Chrome and Firefox on Windows in the required tab and app modes. Disclose the limitations of the demo and record missing platform checks with their actual status.
  - **Full production release:** verify every required combination in the product platform matrix. A Windows demo result does not clear the full release gate.
- [ ] Confirm the candidate contains the scoped Notes workflow. Track Aurora desktop features and optional tools in their own plans.
- [ ] From a clean checkout, run the documented dependency install, checks, tests, and production build. Record the commands and results.
- [ ] Verify the intended HTTPS project-site path, manifest identity and scope, icon URLs, Service Worker scope, and direct launch. Verify the site can discover a new build while versioned asset URLs remain immutable.

## G1: Data, offline, and update safety

- [ ] Verify that IndexedDB reports a save only after commit. Reopen the note, check stale revisions across clients, and exercise storage failure and retry or copy without losing the last committed revision.
- [ ] Verify localStorage stores interface preferences only. Test invalid or unavailable preferences and confirm Notes still works.
- [ ] Test offline readiness after initial setup. Interrupt preparation and make sure the UI never claims readiness before the required release assets are available.
- [ ] In offline mode, cold launch Notes, edit and save, close, and reopen. Compare content with the saved revision.
- [ ] On the same staging origin, test builds A and B. Defer the update, continue editing, accept with pending edits, observe the loader, and confirm one reload into the expected build with the note intact.
- [ ] Exercise a failed candidate, a missing previous-build asset, a second client with pending work, a blocked or interrupted migration, and an activation timeout. Verify visible recovery, no forced reload, and preservation of committed data.
- [ ] Export a backup and restore it on a second device. Verify note titles and bodies. Reject malformed, oversized, incompatible, and conflicting imports atomically. Verify an identical re-import changes nothing.
- [ ] Review the delivered security policy and dependencies, verify imported text is rendered safely, and confirm network requests, Service Worker caches, logs, and release artifacts contain no note or backup content or credentials.
- [ ] Confirm selected SVG and loader assets have pinned sources, applicable notices, and offline coverage. Verify status text is available when animations are reduced.

## G2: Compatibility and accessibility

Use the [platform matrix](PRODUCT_SPEC.md#platform-support) for authoritative launch modes. Record the exact OS, browser version, and launch mode separately for each result.

| Platform | Combinations to verify | Status |
| --- | --- | --- |
| Windows | Chrome tab and installed app. Firefox tab and web app window. | NOT_RUN |
| macOS | Chrome tab and installed app. Firefox tab. | NOT_RUN |
| iOS | Safari, Chrome, and Firefox tabs. Safari Home Screen app. | NOT_RUN |
| Android | Chrome and Firefox tabs. App launch through each browser. | NOT_RUN |

- [ ] Run install, launch, and offline reopen in each required context. Use physical iOS and Android devices for mobile launch evidence.
- [ ] Verify keyboard-only operation, visible focus, readable contrast, text zoom, responsive layouts, safe areas, and screen reader announcements for save and update states. Include iPhone VoiceOver and desktop screen reader evidence for full release.
- [ ] Record unavailable devices as `BLOCKED` and checks that have not started as `NOT_RUN`. Keep the full release on hold while any required compatibility row lacks passing evidence.

## G3: Performance

- [ ] Measure the production build on agreed devices and profiles. Check cold launch, offline reopen, and editor responsiveness against the recorded budgets.
- [ ] Record lab results separately from field p75 metrics. When field samples are insufficient, record `INSUFFICIENT_DATA` and use the agreed launch policy.

## Browser evidence on each Pages push

The Pages build runs the complete Chromium and Firefox Playwright suite on its Ubuntu runner before deployment. Download the `browser-evidence-<sha>-<run>-<attempt>` artifact from the workflow run. It contains the Playwright JSON results, browser and runner versions, and the release manifest used to verify the tested files. An unsuccessful suite stops deployment and preserves available diagnostics. Record skips by test and platform. The Windows, macOS and physical mobile requirements above retain their own evidence.

## G4: Evidence and recovery

- [ ] Map applicable `pwa:product-standard` v1.1.0 `STATIC_OFFLINE` cases to tests. Record each test ID, candidate build, environment, timestamp, outcome, and evidence reference. Explain exceptions. Verify all applicable release-blocking checks passed.
- [ ] Rehearse recovery on staging with retained artifacts and test notes. Verify older builds can read the retained schema before rollback. Document a forward fix path if they cannot.
- [ ] Record the release decision as `GO` or `HOLD`, the release track, owner, evidence links, and unresolved items. Hold for required checks that fail, are blocked, or have no execution evidence. Record cross-device transfer as blocked if a second device is unavailable.
- [ ] Obtain authorization for the intended rollout and publish the tested artifact for that track. Confirm the production URL resolves and serves the expected build, then smoke-test launch and offline readiness with synthetic notes.
- [ ] Verify the initial health and error signals without collecting note content. If the deployment serves inconsistent assets or risks user data, stop the rollout and use the rehearsed recovery procedure.
