# PWA Web OS M0 Decisions

Status: Draft for owner review. Decisions marked **Owner-confirmed** or **Owner-approved** were chosen by the owner on 2026-11-23. Everything marked **Proposed** comes from read-only drafts by pi workers (gpt-6.2-sol) and is not yet approved. This introduction records the planning session. The [task tracker](../Task.md#pending-release-tasks) records current implementation and verification.

The [product specification](PRODUCT_SPEC.md) owns scope. [Task.md](../Task.md) tracks M0 completion. M0 stays open until the commands and contracts below are verified.

## Owner-confirmed

| Topic | Decision | Consequence |
| --- | --- | --- |
| Toolchain | TypeScript with a small static bundler. | Pin runtime, package manager, bundler and test runner versions, then record verified install, start, build and test commands. |
| Hosting | GitHub repository with a demo deployed by GitHub Actions to GitHub Pages. | A project site is served from a subpath such as `/PWA-Web-OS/` unless a custom domain is added. Set the manifest `start_url` and `scope`, the Service Worker scope and all asset paths for that base path. Staging must still serve two successive builds on one origin. |
| Test devices | Only the owner's Windows machine is available. | Windows rows can be tested. macOS, iOS and Android rows cannot be verified yet and stay `BLOCKED`. The release gates in the [delivery plan](DELIVERY_PLAN.md) need all 15 matrix rows, so a release candidate is held until device access exists. |
| Scope of this step | Write M0 decisions as documents. No application code. | Scaffolding starts only after the open questions below are answered. |
| Base path | Default project-site subpath `/PWA-Web-OS/`, no custom domain. | Manifest `start_url` and `scope`, Service Worker scope and asset URLs use `/PWA-Web-OS/`. |
| First-release definition | Release track: **Windows demo** (Chrome and Firefox on Windows), as defined in PRODUCTION_READINESS.md. macOS, iOS and Android rows are recorded as `BLOCKED`; cross-device backup transfer is `BLOCKED` with one machine. | The demo must not claim support for untested platforms. The product specification's 15-row requirement is **not met** by this demo; a full release waits for devices. Update PRODUCT_SPEC if the demo is to be described as a first release. |
| Storage and backup contracts | Approved as drafted in "Storage and backup contracts" below. | These can still change before M1 starts; record any change here. |
| Tooling | Vite, Vitest and Playwright. | Exact versions are not yet chosen. Look up current stable versions and verify them from a clean checkout before recording them. |

## Direction and audience (Owner-confirmed 2026-11-23)

| Topic | Decision | Consequence |
| --- | --- | --- |
| Long-term experience | A macOS-like desktop: multiple floating windows, a Dock and a menu bar. | This is a later goal. The product specification keeps multiple floating windows outside the first release, and the first release stays Notes-only with a focused mobile view. A browser cannot provide a real kernel, hardware or system file control, so the target is the look and interaction model, not an operating system. The selected design direction is [Aurora](AURORA_WORKSPACE_PLAN.md); its shell prototype starts only after the Notes release. |
| Second tool | Weather lookup using the Open-Meteo entry from Public-API, after the first release. | Follows [UPSTREAM_REUSE.md](UPSTREAM_REUSE.md): explicit user action, user-entered or preset coordinates, no device location, bounded result, no provider responses in Service Worker caches. Verify Open-Meteo terms for public use before launch. |
| Audience | Public demo on GitHub Pages. | State clearly on the page that it is a demo and that notes stay on the visitor's device and are not uploaded. Use synthetic sample content only. Review the Content Security Policy and never commit secrets or personal data to the repository. |
| Release authorization | The owner authorized verified changes to be pushed to `main` and authorized deployment when ready. | Apply the [production readiness checklist](PRODUCTION_READINESS.md) to the actual candidate before a full rollout. The [task tracker](../Task.md#pending-release-tasks) records the current decision and outstanding evidence. |
| Visual anchor | The Notes-only release follows the Aurora look from [AURORA_WORKSPACE_PLAN.md](AURORA_WORKSPACE_PLAN.md) (dark wallpaper, top bar, bottom Dock, a floating Notes window with a list and editor; full-screen on phones). Decided 2026-11-23 after the first deployed UI did not match the anchor images. | A dedicated visual pass runs after the wave-2 workstreams merge. Workers must open the anchor images, and acceptance includes side-by-side screenshots of the running app at 1280x800 and 390x844 against the anchors. Functional behaviour and the approved storage and accessibility rules stay unchanged. Only Notes and the workspace launcher are real; Files and other Aurora apps stay out of the first release. |

## Storage and backup contracts (Owner-approved 2026-11-23)

The numeric limits below were approved as drafted but are not measured against browser quotas.

**Amendment (owner-approved 2026-11-23):** records also carry `updatedAt` (epoch milliseconds, set by the repository on every committed create or update). `list()` returns the most recently updated note first, then by id. Backup notes are exactly `id`, `title`, `body`, `updatedAt` (required non-negative safe integer; no revisions). Import still treats a same-id note as identical when title and body match, ignoring `updatedAt`, and a same-id note with different title or body is a conflict. The database stays at schema version 1 because nothing had shipped.


### IndexedDB
- Database `pwa-web-os-notes`, schema version `1`, one store `notes` keyed by `id`, no secondary indexes.
- Record fields: `id` (lowercase UUID v4, immutable), `title`, `body` (plain text, may be empty), `revision` (positive safe integer), and `updatedAt` (epoch milliseconds).
- Insert only if the ID is absent, at revision `1`. Update only if the expected revision matches, then commit `revision + 1`. A stale revision, an existing ID on insert or a missing record on update returns a conflict and writes nothing.
- Report "Saved on this device" only after the transaction commits for the current editor snapshot. Uncommitted text lives in the open editor only.
- First migration is `0 → 1`. Never delete or recreate the database to recover from a blocked or failed upgrade. A newer schema than the build understands is reported and left untouched.

### localStorage
- Theme key `pwa-web-os:preferences:theme` accepts `system`, `light` and `dark`. The default is `system`.
- Language key `pwa-web-os:preferences:locale` accepts `en` and `zh-Hans`. With no valid stored value, use the first supported browser language and fall back to English.
- Invalid or unreadable values use the default. A failed write applies the choice for the session only. No notes or drafts in localStorage.

### Backup format
- UTF-8 JSON object with exactly `format` (`pwa-web-os.notes`), `version` (`1`) and `notes`. Each note has exactly `id`, `title`, `body` and `updatedAt`. Revisions are not exported; imported notes get revision `1`.
- Limits: 10 MiB per file, 100 notes per backup and per database, 256 UTF-8 bytes per title, 16,384 UTF-8 bytes per body. These numbers are proposals and unmeasured against browser quotas.
- Reject the whole file for malformed JSON, oversize, unsupported format or version, unknown fields, or any repeated ID. Preview before writing.
- On confirm, check inside one transaction: identical existing record is a no-op, a same-ID record with different content aborts the whole import. Importing the same backup twice changes nothing.

### Other (Proposed, pending owner approval)
- Unsaved draft lifetime: kept in the open editor until committed; not guaranteed across close or reload.
- Standard profile: `pwa:product-standard` v1.1.0 with `STATIC_OFFLINE`, mapping each applicable case to a project test, with exclusions justified.
- Performance: record baseline devices and lab budgets; report lab and field results separately and mark missing field data `INSUFFICIENT_DATA`.
- Ownership: one integration owner, one writer per change.

## Open questions

1. Minimum Windows, Chrome and Firefox versions for the demo, and the minimums for the blocked rows.
2. Resolved: development and release checks use Node 24 from `.nvmrc` and the exact versions in `package-lock.json`. See [Local development](../README.md#local-development) and the [Firefox test toolchain evidence](FIREFOX_AXE.md).
3. Resolved: the owner confirmed the **Windows demo** track from [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) as the target (2026-11-23). A Windows demo result does not clear the full release gate. Still open: the exact wording the app and release notes use to label the demo. Backup transfer to a second device is recorded as `BLOCKED` while only one machine is available.
4. Approval of the "Other" proposals (draft lifetime, standard profile, performance budgets, ownership).

## Evidence

Drafts came from read-only pi runs on 2026-11-23, each citing the source section in this repository. The runs were not independently reviewed line by line; headings they cite were checked to exist.
