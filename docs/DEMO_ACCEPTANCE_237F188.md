# Notes forced colors candidate

**Full production decision is HOLD.** Remaining release checks are tracked in [Task.md](../Task.md#pending-release-tasks).

| Identity | Evidence |
| --- | --- |
| Source | `237f1888593ce23e557483308049599dae984f66` |
| Build | `b-mwtvj2ds237f188` |
| Pages workflow | [Main push and retained candidate](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45285620980) |
| Native Windows check | [Windows 11 Enterprise 25H2 Arm64 workflow](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45286370229) · [Report and screenshot index](evidence/windows-forced-colors-237f188.json) |

Windows enabled its native contrast palette and restored the original palette on exit. Headed Chrome 157.0.8103.79 and Firefox 160.0 detected the palette. Both browsers retained the keyboard focus outline, displayed the English and Chinese sample and save status, and reopened the exact note after reload in the app's Light and Dark themes. The workflow verified the retained Pages candidate before opening it.

The first candidate rendered Firefox's hovered **New note** label at 1.42:1. The correction pairs the system `ButtonText` and `ButtonFace` colors in both button states and hides the wallpaper under forced colors. The rerun measured 16.29:1 in all four native screenshots. The verifier compared the browser's reported colors with pixels inside the rendered label. [Original finding and screenshot index](evidence/windows-forced-colors-37ad1b4.json) · [Text contrast criterion](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

The screenshot still shows part of the long fixture title scrolled within Chrome's single-row editor. The save and reopen checks compared the whole title and body.

Local type checking, 91 unit tests and 26 keyboard and responsive browser tests passed. The new forced colors case failed against the previous stylesheet and passed with the fix in both engines. The compiled stylesheet differs from `37ad1b4` by the forced colors rule alone. [Regression test](../e2e/a11y-responsive.spec.ts) · [Earlier release matrix](DEMO_ACCEPTANCE_37AD1B4.md)
