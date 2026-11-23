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

Run the **Windows desktop browser acceptance** workflow with the numeric ID of a completed main-branch Pages run. Use the recovery artifact from a successful run or the candidate artifact from a failed run, if available. The workflow verifies the manifest, opens the retained build in installed retail Chrome and Firefox using dedicated profiles, and exits the browser between each online or offline session. It exports a synthetic note from Chrome, imports it twice in Firefox and compares its contents after offline edits. The reports record the source run's conclusion, completed sessions and browser versions. This covers regular browser tabs on a hosted Windows Server machine. Installed windows, the minimum supported consumer Windows version, screen readers and transfer between physical devices require their own observations.

Set **windows_image** to `windows-11-arm` to run the same checks on the hosted Windows 11 client. The evidence includes the Windows edition, feature version, architecture and update build revision. Review those fields against the intended support baseline. [Runner images](https://github.com/actions/runner-images#available-images)

Enable **client_preferences** to exercise both catalogs in Light and Dark during an offline edit, retain the draft and selection, and retry the save. The check briefly changes the Apps appearance setting on the disposable Windows runner, verifies that System follows the OS, and restores the original setting.

Enable **client_data_safety** to open one saved note in two tabs of one profile. Verify that a stale write cannot replace the newer commit and that **Save as new** preserves the exact draft in a separate note. The same check rejects a malformed file and a batch containing a conflicting ID, then reloads and compares the saved titles, bodies, and IDs after each rejection. Each browser uses a fresh profile for these checks. [Windows Arm64 results](evidence/windows-data-safety-37ad1b4.json)

Enable **native_apps** to verify the selected release's live bytes, install through each browser's native control, and check the generated application shortcut. The test reuses the registered app ID and its isolated profile for separate process launches. In both installed modes it records an uncached 404 while online, a blocked uncached request during two offline launches, and the exact note read after saving offline.

Set **next_pages_run** to rehearse an update to a distinct compatible retained release on a loopback staging origin. Chrome and Firefox each save while the update waits, pause after an injected IndexedDB abort, and preserve both the open draft and the previous commit. The test then retries into the staged build and reads the exact committed edit. The default Windows Server workflow also passed its original tab, transfer, and lab checks on the same current release. [Windows 11 qualification](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45223847143) · [Default Windows Server run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45223921874)

With both options enabled, the installed update checks install **next_pages_run** first on a separate loopback origin and promote **pages_run** on that same origin. They compare the manifest ID, launch path, scope and display mode, save while the update waits, and close the upgraded app. Windows then opens the original Start menu shortcut through the shell. UI Automation checks the new build and the exact saved edit. [Installed update qualification](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45232735360)

The standard Ubuntu x64 runner exposed KVM API version 12 with 89 GiB of free temporary disk. A `windows-2025` x64 runner also started a blank Generation 2 Hyper-V guest and had about 220 GiB free on its temporary `D:` volume. Microsoft's deployment kit provides 25H2 client images for its Hyper-V evaluation lab. The kit has its own evaluation terms. Windows 11 x64 boot and browser acceptance remain open. [KVM preflight](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45239186556) · [Hyper-V preflight](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45240881415) · [Microsoft deployment kit](https://learn.microsoft.com/en-us/microsoft-365/enterprise/modern-desktop-deployment-and-management-lab?view=o365-worldwide)

### macOS hosted browser tabs

Run the **macOS desktop browser acceptance** workflow with the numeric ID of a successful main-branch Pages push. Choose `macos-15` for Arm64 or `macos-15-intel` for Intel. The workflow records the OS patch, verifies the retained release, installs the signed retail Chrome and Firefox bundles, and uses those binaries for headed cold launches and a same-host backup transfer. Inspect the exact OS patch recorded by the runner before counting the result against the supported minimum. [Workflow](https://github.com/yapweijun1996/PWA-Web-OS/actions/workflows/macos-tabs.yml) · [Sequoia observations](MAC_COMPATIBILITY_EVIDENCE.md#sequoia-browser-tabs) · [GitHub runner labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

### Desktop screen reader

Run [Windows desktop screen reader](https://github.com/yapweijun1996/PWA-Web-OS/actions/workflows/desktop-reader.yml) with two successful Pages push run IDs on `main`. Set **active_pages_run** to the release whose editor and update prompt should be observed. Set **next_pages_run** to the compatible release the local test server should serve during the update. The workflow checks both manifests and runs portable NVDA 2026.3.1 with headed Chrome in a disposable Windows Server session. It reads the NVDA Speech Viewer while testing control names, saving, failure and retry, and the pending-write update. The report identifies both builds and the captured phrases.

Keep the pointer outside Speech Viewer so it continues appending text. The runner pins the published NVDA checksum and checks its Windows signature before starting it. On macOS, accept the VoiceOver welcome window and verify playback in an isolated Chrome profile. In a disposable desktop session, use `Control+Option+Shift+C` to copy the latest spoken phrase after each action. Allow the initial automatic save and editor focus announcements to finish before starting the next action. Hold and release an IndexedDB write to observe saving and success separately. Reject one write, confirm the failure announcement, retry, and reread the committed edit. Test update availability and updating with a pending write, then reopen the note on the staged build. Record iPhone VoiceOver separately. [NV Access release and checksum](https://www.nvaccess.org/post/nvda-2026-3-1/) · [Apple VoiceOver commands](https://support.apple.com/guide/voiceover/repeat-copy-or-save-the-last-spoken-phrase-vo2725/mac) · [Recorded macOS journey](MAC_COMPATIBILITY_EVIDENCE.md#voiceover-notes-journey)

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

- [ ] Measure the production build on the [desktop lab profiles](PERFORMANCE.md#release-lab-baselines) and [physical mobile profiles](PERFORMANCE.md#physical-mobile-lab). Check cold launch, offline reopen, and editor responsiveness against the recorded budgets.
- [ ] Record lab results separately from field p75 metrics. When field samples are insufficient, record `INSUFFICIENT_DATA` and use the agreed launch policy.

## Browser evidence on each Pages push

The Pages build retains the verified `candidate-<sha>-<run>-<attempt>` archive before running the Chromium and Firefox Playwright suite on Ubuntu. The `browser-evidence-<sha>-<run>-<attempt>` artifact contains the Playwright JSON results, browser and runner versions, and the release manifest. SHA-256 verification after Playwright checks that the tested files are the ones sent for deployment. A failed suite stops deployment while allowing independent platform and performance checks on the same candidate bytes. Record the source run conclusion and skips by test and platform. Choose rollback inputs from successful deployments as described in the [recovery runbook](RECOVERY_RUNBOOK.md).

## G4: Evidence and recovery

- [ ] Use the [60-case coverage index](STANDARD_COVERAGE.md) to reconcile applicable `pwa:product-standard` v1.1.0 `STATIC_OFFLINE` cases with candidate results. Record each test ID, candidate build, environment, timestamp, outcome, and evidence reference. Explain exceptions. Verify all applicable release-blocking checks passed.
- [ ] Rehearse recovery on staging with retained artifacts and test notes. Verify older builds can read the retained schema before rollback. Document a forward fix path if they cannot.
- [ ] Record the release decision as `GO` or `HOLD`, the release track, owner, evidence links, and unresolved items. Hold for required checks that fail, are blocked, or have no execution evidence. Record cross-device transfer as blocked if a second device is unavailable.
- [ ] Obtain authorization for the intended rollout and publish the tested artifact for that track. Confirm the production URL resolves and serves the expected build, then smoke-test launch and offline readiness with synthetic notes.
- [ ] Verify the initial health and error signals without collecting note content. If the deployment serves inconsistent assets or risks user data, stop the rollout and use the rehearsed recovery procedure.
