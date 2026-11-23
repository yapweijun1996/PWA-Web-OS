# Blender 3D Gallery Reuse Plan

Status: Proposed. This plan uses upstream evidence to guide PWA Web OS work. The first release remains a Notes-only workspace.

## Apply to the first release

| Upstream finding | Web OS decision | Verification |
| --- | --- | --- |
| A historical Gallery worker kept an older shell consistent, but a hashed GLB requested on demand had been removed from the server on deployment. | Treat retention of prior release assets as a hosting requirement. Keep a defined rollback window and verify that app paths still work for a client controlled by the previous worker. | At M3, keep build A open, deploy B on the same staging origin, then open a route or asset from A. Exercise the missing-asset case and verify an actionable state, no forced reload, and preservation of the draft. |
| The Gallery separates installation from explicitly preparing an offline Game pack. | For Notes, present offline readiness only after the controlling worker has the required core assets. Future large content uses a separate, explicit download. | At M2, test interrupted preparation and offline cold reopen. Confirm that installed status and offline readiness are distinct. |
| Gallery evidence separates built-artifact/browser simulations from actual worker and device checks. | Record which runtime each result exercised. Treat a simulated worker or emulated viewport as supporting evidence. | At M5, collect real HTTPS worker transitions and installed-mode results in the product's declared matrix. |

The historical Gallery replay supports the stale-asset failure mechanism. Its file-based recovery check simulated worker behavior and did not establish a real HTTP activation or physical-device result. [Gallery PWA verification](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/main/docs/pwa-verification.md)

## After M5: one-model Viewer pilot

The Gallery implements a lazy Three.js viewer with a local catalog of GLBs and measured metadata. Reuse its catalog, camera-fit, poster fallback, and resource disposal patterns. Compare extracting the viewer against adapting its minimal behavior after reviewing source dependencies and code licensing. Keep the Gallery stylesheet, routes, service worker, and game outside the integration. [Gallery architecture](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/main/docs/architecture.md)

| Boundary | First pilot |
| --- | --- |
| App registration | Add one built-in Viewer entry via the shared workspace contract. Start from a static poster; load viewer code and model bytes only when the user opens the 3D view. |
| Viewing | Show one model with rotation, zoom, reset, title, description, and attribution. Provide visible keyboard-operable controls and a poster when WebGL is unavailable, the asset fails to load, or context is lost. |
| Assets | Package one approved GLB and poster. Record stable ID, revision, exact source path, author, redistribution terms, attribution, byte size, triangle count, texture dimensions, and validation output. The public billiards pack has no stated redistribution terms; obtain explicit rights or use a separately cleared model. |
| Lifecycle | Let Viewer own canvas and GPU resources. When the user leaves, abort pending loads where supported, discard late results, remove listeners and release resources. Viewer does not read or write Notes or change update policy. |
| Offline | Ship the Notes shell without Viewer model bytes in its required precache. Start the 3D pilot with on-demand loading and an offline message when the model is unavailable. Design a separate opt-in pack only after the pilot proves the viewer lifecycle and budget. |

Use the upstream asset guidance as initial review ceilings: 5 MiB per GLB, 100,000 triangles, and 2,048 px textures. Choose a smaller asset for the pilot and set its actual byte and device budgets before integration. Validate the chosen GLB and inspect the export on real devices. [Gallery asset standard](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/main/docs/assets.md) · [Gallery asset status](https://github.com/yapweijun1996/Blender-3D-Gallery#status)

## Pilot acceptance

- Launch Notes from a clean load and verify the network records no viewer engine or model request and the page has no WebGL canvas.
- Open Viewer across the supported browser matrix. Verify loading feedback, rotation, zoom, reset, keyboard and touch behavior, orientation changes, and a readable poster fallback.
- Exercise missing model, slow loading, unavailable WebGL, and context loss. Reopen Viewer repeatedly and confirm no duplicate canvas, renderer, or active render loop survives closure.
- Measure viewer code and asset sizes, time to first usable view, and representative mobile frame rate. Compare Notes startup and the offline asset list with the baseline. Report physical-device results separately from automation.
- Reopen Notes after a Viewer failure, save a draft, and run the update and offline regression paths. Viewer remains optional until these checks pass.

The Viewer and Public-API tool are independent experiments. Public-API tests a network-dependent module with a small payload. Viewer tests large assets and resource cleanup. Start with the one that addresses the next product priority and apply the [upstream reuse provenance rules](UPSTREAM_REUSE.md#parallel-work-and-handoff).
