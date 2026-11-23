# Notes forced colors demo

**Full production decision is HOLD.** Remaining release checks are tracked in [Task.md](../Task.md#pending-release-tasks).

| Identity | Evidence |
| --- | --- |
| Source | `237f1888593ce23e557483308049599dae984f66` |
| Build | `b-mwtvj2ds237f188` |
| Manifest SHA-256 | `7a94c326a9d6768b9e02ea9c1dfaaaee7d19263b2b6c16ddd5bcc1771611a349` |
| Pages workflow | [Main push, deployment and retained build](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45285620980) |
| Native Windows check | [Windows 11 Enterprise 25H2 Arm64 workflow](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45286370229) · [Report and screenshot index](evidence/windows-forced-colors-237f188.json) |

Windows enabled its native contrast palette and restored the original palette on exit. Headed Chrome 157.0.8103.79 and Firefox 160.0 detected the palette. Both browsers retained the keyboard focus outline, displayed the English and Chinese sample and save status, and reopened the exact note after reload in the app's Light and Dark themes. The workflow verified the retained Pages candidate before opening it.

The first candidate rendered Firefox's hovered **New note** label at 1.42:1. The correction pairs the system `ButtonText` and `ButtonFace` colors in both button states and hides the wallpaper under forced colors. The rerun measured 16.29:1 in all four native screenshots. The verifier compared the browser's reported colors with pixels inside the rendered label. [Original finding and screenshot index](evidence/windows-forced-colors-37ad1b4.json) · [Text contrast criterion](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

The screenshot still shows part of the long fixture title scrolled within Chrome's single-row editor. The save and reopen checks compared the whole title and body.

Local type checking, 91 unit tests and 26 keyboard and responsive browser tests passed. The new forced colors case failed against the previous stylesheet and passed with the fix in both engines. The compiled stylesheet differs from `37ad1b4` by the forced colors rule alone. [Regression test](../e2e/a11y-responsive.spec.ts) · [Earlier release matrix](DEMO_ACCEPTANCE_37AD1B4.md)

The Ubuntu x64 Pages workflow passed 152 browser tests, with zero skips and zero retries needed, in Chromium 156.0.8078.4 and Firefox 157.0. A separate local run of the same retained artifact also passed all 152. The deployment and an independent live SHA-256 check matched the launch URL and all 12 files. Stable Chrome 158.0.8127.37 saved a synthetic note online, saved an edit after a fresh offline process launch, and read the exact edit after a second offline process launch. [Pages results](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45285620980) · [Live demo](https://yapweijun1996.github.io/PWA-Web-OS/)

The disposable HTTPS rehearsal used the exact `37ad1b4` and `237f188` files. Chromium and Firefox rejected the mixed build, accepted the verified update, and reopened the exact committed edit after rollback. The rehearsal verified 12 files in each of four phases per browser. [Recovery evidence](evidence/recovery-mixed-237f188.json)

NVDA 2026.3.1 on Windows Server with Chrome 157.0.8103.79 recorded all nine launcher, editor, save, retry and update announcements. The staged release reopened the exact edit after activation. [Speech Viewer report](evidence/nvda-237f188.json) · [Actions run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45287882820)

The seven-journey desktop lab passed on physical macOS 27.2 (545 / 448 / 53 ms) and hosted Windows 11 Arm64 (166 / 240 / 54 ms). The values are p75 for cold launch, offline reopen and editor response. [Physical Mac batch](evidence/performance-macos-237f188.json) · [Windows Cobalt 100 batch](evidence/performance-windows11-237f188.json)
