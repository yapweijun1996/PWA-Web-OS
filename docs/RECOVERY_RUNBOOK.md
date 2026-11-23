# Release retention and recovery

The Pages workflow uses the existing short build ID and saves the exact `dist` served by the deploy job and `manifest.json` as `recovery-<full commit SHA>-<run ID>-<attempt>`. The manifest records the full commit, build ID extracted from the worker, and SHA-256 for every file; the artifact name binds these contents to the workflow run and attempt. The artifact is retained for 90 days, subject to repository settings; export approved candidates to an authorized durable store before expiry. A checksum detects changes, but does not establish provenance by itself: verify the workflow run, commit and artifact source separately. Do not add Notes data to release artifacts.

## Before release

1. Record the candidate's commit, build ID, workflow run, artifact name, expiry, and manifest reference in release evidence. Download the artifact from that run and execute `node scripts/release-evidence.mjs verify <artifact>/dist <artifact>/manifest.json`. Keep the previous approved artifact and this manifest available independently of the current deployment.
2. Determine whether the prior build understands the database schema produced by the candidate. Inspect both schema versions **and migration behavior**, and rehearse using representative synthetic data. Equal version numbers alone do not prove compatibility. If compatibility is unproven or a migration is not backward compatible, do not roll back to the older build; use a compatible forward fix and preserve data.
3. On a disposable staging origin with retained A and candidate B, create synthetic notes on A, update to B, save additional edits, then serve retained A on the same origin and accept the worker update. Reopen and compare notes and schema; save again on A. Test recovery with relevant browser modes and note all failures. Never use customer notes for this exercise.

A local rehearsal is `PW_PORT=41876 npx playwright test e2e/update-notes.spec.ts -g 'rehearses A to B'`. It builds A and B from the **same checkout** with different IDs, uses a loopback HTTP origin and disposable browser storage, checks schema 1 and the committed synthetic record, and verifies another save on A. It does not prove cross-version migration compatibility, production hosting, durable storage, real devices, or the deploy/rollback procedure on GitHub Pages. Record test date, commit, browser versions, result and artifacts; repeat with actual release artifacts on staging.

## Rehearse with downloaded release artifacts

Choose the previous trusted release A and candidate B from successful Pages workflow runs in this repository. For each run, verify the workflow name, full commit SHA, run ID and attempt on GitHub. Download the matching `recovery-<full commit SHA>-<run ID>-<attempt>` artifact into a separate directory. Each directory must contain `dist/` and `manifest.json`. Use the SHAs from the selected workflow runs as the expected identities.

With Node 24, the locked dependencies and Playwright browsers installed, run from this repository:

```sh
export RECOVERY_A_DIR=/absolute/path/to/extracted-A
export RECOVERY_A_SHA='previous-full-commit-sha'
export RECOVERY_B_DIR=/absolute/path/to/extracted-B
export RECOVERY_B_SHA='candidate-full-commit-sha'
PLAYWRIGHT_HTML_OPEN=never npx playwright test --config=playwright.recovery.config.ts --reporter=html
```

Set the four variables to actual values before running. The recovery configuration copies each artifact into the test output, verifies every distributed file against its manifest, checks its worker build ID and expected commit, and requires distinct commits and build IDs. Each browser uses an isolated loopback origin and disposable profile for the entire A → B → A sequence. The test asserts the schema, content and ability to save after returning to A. The HTML report includes a `recovery-identities` attachment with the actual build IDs, commits, manifest SHA-256 digests and origin. Keep that report with the two workflow run links and record the browser and OS versions. This rehearsal supplies evidence for the two downloaded builds in the tested browser modes. A staging or production hosting rehearsal is a separate check.

## Rehearse on disposable HTTPS staging

Install `cloudflared` and set the same four release variables. The HTTPS mode publishes the two verified static releases through an isolated Quick Tunnel. The browser keeps one HTTPS origin across A → B → A, and the fixture compares every served file against the retained manifest after each switch. Use public release artifacts and synthetic notes. The fixture stops the tunnel and loopback origin when the test ends. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

```sh
RECOVERY_HTTPS=1 PLAYWRIGHT_HTML_OPEN=never npx playwright test --config=playwright.recovery.config.ts --reporter=html
```

`staging-byte-checks` records the time and file count for each verified phase. Tunnel DNS provisioning can take over a minute. If it fails, review the transport diagnostics in the local report. This mode exercises the project subpath, publicly trusted HTTPS and a real network release transition. A rollback on GitHub Pages uses its own hosting procedure.

## During an incident

Stop rollout and preserve current release artifacts and evidence. Verify the retained artifact against its manifest and establish schema compatibility before any rollback. Publish the exact retained artifact only under the approved incident and deployment procedure; do not rebuild it. Wait for the previous worker to be discovered and users to accept the update. Confirm build ID, launch, and synthetic-note persistence in the target environment. Existing tabs can continue to run the current build until updated; a server-side file replacement alone does not move every client. Record deployment identity, decisions and results. If old code cannot read the schema, prepare a forward fix instead; never delete or reset IndexedDB to force recovery.

## Local rehearsal evidence

On 2026-11-23, the recovery changes based on `8795fd3` were exercised on macOS using Node 24.22.3 and Playwright 1.65.1. The targeted loopback rehearsal passed in Playwright Chromium 159.0.8154.6 and Firefox 159.0 (2 passed): the schema remained version 1 and a synthetic record committed on B was read and edited after returning to A. The two builds came from the same working tree and differ in build ID; this is not an actual historical A-to-B upgrade or a staging deployment. The local manifest matched all 10 built files and rejected a modified `index.html`; this validates those checks, not artifact provenance. CI artifact upload, expiry, download and a production rollback have not been executed or verified by this rehearsal.

## Rehearsal with retained Pages artifacts

On 2026-11-23, the rehearsal used downloads from successful Pages runs [45176683571](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45176683571) (A, `f2e9327`, build `b-mwt98wfdf2e9327`) and [45177991277](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45177991277) (B, `d854a78`, build `b-mwt9jqg0d854a78`). The runner checked the expected full SHAs and every retained file. GitHub reported recovery archive SHA-256 digests `c42890016012e8b19c2b26afd34e35e32a50468f9159cec781003fc4040d7e45` and `70f24fefed668c064d09908eb1692029f86e693b761af437e3f181284eab8900`, respectively.

Both Playwright Chromium and Firefox passed the complete A → B → A case on macOS 26.6.2 with Node 24.22.2 on loopback. A note created on A survived B, the exact record edited on B survived the switch back, and another save committed on A. Both releases use schema 1. A separate macOS 27.2 run passed Chromium but timed out during Firefox startup. This rehearsal used real release bytes in a disposable profile. A production host rollback and a future schema migration require separate verification.

## Rehearsal with the November 23 demo

On macOS 26.6.2, Playwright 1.64.0 Chromium and Firefox both passed A → B → A using the retained `4ef0b87` release and the pre-deployment `54e9662` artifact. The manifest SHA-256 digests were `f2d7044d4fe020f32b38c6662a69e2fa0ef91b3e0922e8da123ec4de9c3bdc3d` and `7b3c7e32e415b0ba4a3017b14a41804d5a8d154ea82a02cd47bfd7a7cce78e05`. In both browsers the committed version from B survived rollback and a new edit saved on A. The rehearsal used disposable loopback origins. A subsequent live demo check matched all 12 hosted files to B's manifest and reread a synthetic edit after an offline restart. [Release A](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45183715617) · [Release B](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45195685417)

A second rehearsal used the same artifacts through temporary HTTPS staging on macOS 27.2. Chromium 156.0.8078.4 and Firefox 157.0 both verified all files in each phase, successfully upgraded, rolled back, reopened the saved note and saved again. Early attempts reached the tunnel connector while the assigned DNS names still returned no address. With a bounded readiness wait, the complete check passed in both browsers. [HTTPS staging evidence](evidence/recovery-https-54e9662.json)
