# PWA Web OS

PWA Web OS is a planned personal workspace that runs in the browser and can be installed as a Progressive Web App. A shared launcher opens tools such as Notes, and the workspace adapts from a focused mobile view to a larger desktop layout.

The long-term design goal is to let people keep working across devices, browser changes, and software updates while retaining control of their files. See the [product specification](docs/PRODUCT_SPEC.md) for the first release and its acceptance criteria.

## Project status

The repository contains a runnable TypeScript and Vite PWA deployed to GitHub Pages at <https://yapweijun1996.github.io/PWA-Web-OS/>. Notes, offline support, safe updates, and backup are implemented but not yet fully verified. Verification covers Windows Chrome and Firefox only, so this is a **Windows demo**, not a full production release. macOS, iOS, and Android are `BLOCKED` for lack of devices. See [M0 decisions](docs/M0_DECISIONS.md) and the [production readiness checklist](docs/PRODUCTION_READINESS.md).

The first release targets Windows, macOS, iOS, and Android. Chrome and Firefox are required for browser use on all four platforms. See the [platform matrix](docs/PRODUCT_SPEC.md#platform-support) for install modes.

The first development milestone is a reliable Notes workflow in [Windows Chrome and Firefox tabs](docs/PRODUCTION_READINESS.md#first-milestone-windows-browser-tabs).

## Local development

Requires Node 24 (see `.nvmrc`); Vitest 5 does not support Node 25. These commands were verified from a clean install on Windows with Node 24.22.3:

```text
npm ci
npm run dev         # Vite dev server at /PWA-Web-OS/ (no service worker)
npm run typecheck
npm test            # Vitest unit tests
npm run build       # production build and service worker in dist/
npm run preview     # serve the production build
npx playwright install chromium firefox
npm run e2e         # Playwright in Chromium and Firefox (set PW_PORT to change the port)
```

Pushing to `main` deploys `dist/` to GitHub Pages through `.github/workflows/pages.yml`. Notes stay in the visitor's browser and are never uploaded.

## Development

Use the [feature map](docs/FEATURE_MAP.md) to see first-release scope, feature dependencies, and a suggested implementation order.

Track implementation and verification in the [development task checklist](Task.md).

Use the [production readiness checklist](docs/PRODUCTION_READINESS.md) to verify a Windows demo or full release candidate.

Use the [UI foundation](docs/UI_FOUNDATION.md) for internationalization, Light and Dark themes, CSS tokens, and parallel module ownership.

See the [modular development plan](docs/MODULAR_WEB_OS_PLAN.md) for module boundaries, failure handling, and milestone gates.

See the [delivery plan](docs/DELIVERY_PLAN.md) for parallel work and integration, and the [UI/UX anchor](docs/UI_UX_ANCHOR.md) for the proposed responsive Notes workspace.

See the [Aurora workspace exploration](docs/AURORA_WORKSPACE_PLAN.md) for the selected long-term desktop direction, responsive layouts, and candidate applications.

See the [upstream reuse plan](docs/UPSTREAM_REUSE.md) for reusable icons, the update loader, the Public-API candidate, and lessons from Blender 3D Gallery.

Start with the [first-release acceptance criteria](docs/PRODUCT_SPEC.md#acceptance-criteria). The first implementation should prove a complete Notes workflow from offline editing through update and data transfer. Add local setup, build, and test commands to the repository once those commands have been verified.
