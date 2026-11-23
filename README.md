# PWA Web OS

PWA Web OS is a browser workspace for local notes. Open Notes from the launcher or Dock, edit in the desktop window or phone editor, and export a JSON backup to move your work to another device.

The long-term design goal is to let people keep working across devices, browser changes, and software updates while retaining control of their files. See the [product specification](docs/PRODUCT_SPEC.md) for the first release and its acceptance criteria.

## Project status

[Open the public demo](https://yapweijun1996.github.io/PWA-Web-OS/). The current target is the **Windows demo**. The full release remains on hold until the required Windows, macOS, iOS and Android launch modes pass with a specific build. Track the [pending release tasks](Task.md#pending-release-tasks), [platform matrix](docs/PRODUCT_SPEC.md#platform-support) and [earlier Windows demo results](docs/RELEASE_EVIDENCE_WINDOWS_DEMO.md).

## Install and use Notes offline

Open the demo online in the browser or installed app you plan to use. Open **Workspace → Install and use offline** for directions for your device. Wait for **Available offline**, then create a note and wait for **Saved on this device** before closing. The first status confirms the app files are ready. The second confirms the note was written. **Site unreachable** means the browser has a network connection but could not reach the app. You can keep editing saved notes after offline setup. Use **Workspace → Backup and restore** before changing devices, switching browser profiles, or clearing site data.

| Platform | How to launch |
| --- | --- |
| Chrome on Windows or macOS | Use the install icon in the address bar when offered, or open the Chrome menu, then **Cast, save, and share → Install page as app**. [Chrome desktop help](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en) |
| Firefox on Windows | Use the web app button in the address bar to pin the site and reopen it from the taskbar. Mozilla documents this feature from Firefox 143, or 150 for the Microsoft Store edition. [Firefox Windows help](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows) |
| iPhone | In Safari, open **Share → Add to Home Screen**, enable **Open as Web App** when offered, and tap **Add**. Open the new icon online once. [Safari help](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios) |
| Android | In Chrome, open the browser menu and choose the installation or shortcut option, then **Install**. In Firefox, open the menu and choose **Install**, then confirm the Home Screen icon. [Chrome Android help](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en) · [Firefox Android help](https://support.mozilla.org/en-US/kb/use-web-apps-firefox-android) |

If an install action is unavailable, keep using the browser tab. The macOS Firefox target is a tab. Installation options depend on browser version and distribution. The table describes the vendor's installation paths. Project verification is tracked separately in the [production checklist](docs/PRODUCTION_READINESS.md).

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

Use the [first-release acceptance criteria](docs/PRODUCT_SPEC.md#acceptance-criteria) to verify the complete Notes workflow from offline editing through update and data transfer.
