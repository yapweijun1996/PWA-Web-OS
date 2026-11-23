# PWA Web OS Development Tasks

Status: Planned. Check each task after its outcome has been verified. See the [feature map](docs/FEATURE_MAP.md) for scope and the [product specification](docs/PRODUCT_SPEC.md#acceptance-criteria) for release acceptance criteria.

Use the [modular development plan](docs/MODULAR_WEB_OS_PLAN.md) for implementation details, failure cases, and milestone gates.

Use the [delivery plan](docs/DELIVERY_PLAN.md) to assign parallel work and coordinate handoffs. Review the [UI/UX anchor](docs/UI_UX_ANCHOR.md) before implementing the workspace and Notes layout.

Follow the [upstream reuse plan](docs/UPSTREAM_REUSE.md) when selecting or verifying assets and evaluating the Public-API candidate.

## M0: Development baseline

- [ ] Record minimum Windows, macOS, iOS, and Android versions and required browser versions using the [platform matrix](docs/PRODUCT_SPEC.md#platform-support).
- [ ] Define the IndexedDB schema and migrations, the localStorage preference keys and defaults, and the versioned JSON backup format and conflict policy.
- [ ] Set up the application and record verified local start, build, and test commands.

## M1: Local Notes

- [ ] Build a responsive workspace with a launcher that opens Notes on mobile and desktop.
- [ ] Select the workspace and Notes SVG icons from [SVG-Icon-Studio](https://github.com/yapweijun1996/SVG-Icon-Studio). Record source revisions and applicable notices, bundle the selected icons locally, and verify accessible control names.
- [ ] Implement note creation, editing, and reopening using IndexedDB. Confirm the saved state appears only after the write transaction completes.
- [ ] Persist the theme in localStorage and verify it survives a reload. Verify invalid preferences or unavailable localStorage fall back to defaults while Notes remains usable.
- [ ] Simulate an IndexedDB write failure. Verify the editor reports the failure, retains the draft for retry or copy, and preserves the last saved revision.
- [ ] Edit the same note in two clients and verify a stale write cannot overwrite the newer revision.
- [ ] Show saving, saved, and failed states. Keep failed edits available for retry while the editor remains open.
- [ ] Verify iOS safe areas, desktop keyboard navigation, visible focus, and screen reader announcements.

## M2: Install and offline

- [ ] Configure production HTTPS, the Web App Manifest, and icons.
- [ ] Use a Service Worker to make the workspace and Notes available offline after initial setup.

For each item below, launch Notes online once to complete setup. Then disconnect, edit and save a note, close the workspace, reopen it offline in the same mode, and confirm the saved content. Use physical devices for mobile checks. The [platform matrix](docs/PRODUCT_SPEC.md#platform-support) defines the required modes.

- [ ] Windows: Chrome tab and installed app, Firefox tab and web app window.
- [ ] macOS: Chrome tab and installed app, Firefox tab.
- [ ] iOS: Safari, Chrome, and Firefox tabs, plus the Home Screen app installed through Safari.
- [ ] Android: Chrome and Firefox tabs, plus each browser's installed app or Home Screen launch.

## M3: Safe updates

- [ ] Show an update when a new worker is ready and keep the editor usable while the user defers.
- [ ] Preserve pending edits before activation, announce progress, and reopen once in the new build.
- [ ] Select and bundle a [Loader Studio](https://github.com/yapweijun1996/Vanilla-HTML-Loader) loader for update progress. Verify readable status text, a static reduced-motion state, and recovery after timeout or failure.
- [ ] Verify draft preservation across two builds. Exercise a failed activation and verify recovery.
- [ ] Verify update deferral when another client cannot flush pending edits. Exercise a blocked IndexedDB migration and verify that saved data survives.
- [ ] Reproduce a previous-build asset request after deployment and verify graceful recovery using the [Gallery reuse plan](docs/BLENDER_GALLERY_REUSE.md#apply-to-the-first-release).

## M4: Portability

- [ ] Export saved notes as versioned JSON and validate imports before writing.
- [ ] Verify transfer on a separate device by comparing note titles and bodies.
- [ ] Verify that malformed backups and conflicting records leave existing notes intact.

## M5: Release readiness

- [ ] Run the complete Notes workflow against the supported device and browser matrix.
- [ ] Record the tested build, devices, results, and any exceptions to `pwa:product-standard` v1.1.0.
- [ ] Confirm that README and development commands match the tested implementation.

## Post-release candidates

- [ ] Prototype the Aurora Dock and window manager using the [feature anchors](docs/AURORA_WORKSPACE_PLAN.md#feature-anchors). Verify opening, switching, minimizing, restoring, and snapping Notes and a placeholder Files window.
- [ ] Validate the Aurora Files-to-Preview flow across desktop, tablet, and phone after agreeing on a workspace file contract. Verify import and export, viewport changes, and preservation of the current selection and Notes draft.
- [ ] Evaluate [Public-API](https://github.com/yapweijun1996/Public-API) as a source of optional online tools. Verify provider terms, browser access, request limits, and offline behavior before selecting any demo. Keep requests independent of Notes data.
- [ ] Evaluate the [one-model Viewer pilot](docs/BLENDER_GALLERY_REUSE.md#after-m5-one-model-viewer-pilot) with a cleared GLB, fallback, and device budget.
