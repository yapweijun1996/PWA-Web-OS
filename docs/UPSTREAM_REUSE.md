# Reuse from sibling repositories

The Notes build includes the pinned SVG and loader selections below. The first release remains a Notes-only workspace. Its launch, editing, storage, and updates use the app's own release assets.

| Source | What to reuse | Integration point |
| --- | --- | --- |
| [SVG-Icon-Studio](https://github.com/yapweijun1996/SVG-Icon-Studio) | A small set of individually selected SVGs | M1 workspace and Notes controls |
| [Loader Studio](https://github.com/yapweijun1996/Vanilla-HTML-Loader) | One self-contained loader design | M3 update progress |
| [Public-API](https://github.com/yapweijun1996/Public-API) | One catalog entry and its request/response contract | Post-release second built-in app experiment |
| [Blender 3D Gallery](https://github.com/yapweijun1996/Blender-3D-Gallery) | Release and offline evidence, then viewer and asset patterns | M2–M5 verification and a [post-release Viewer pilot](BLENDER_GALLERY_REUSE.md) |

## M1: SVG icons

The source is the [SVG-Icon-Studio catalog at `f0c55ec`](https://github.com/yapweijun1996/SVG-Icon-Studio/tree/f0c55ec5bb202148114a3c10b6ff5878376f516f/icons/catalog). Each filename below is relative to `icons/catalog/` at that revision. The workspace bundles the reviewed path data in [icons.ts](../src/ui/icons.ts), joining compatible subpaths and retaining the 24 × 24 view box, rounded 1.5 stroke and `currentColor`. Only local path geometry is copied. Each SVG is decorative and the owning control exposes its name.

| Use | Local glyph | Upstream SVG |
| --- | --- | --- |
| Workspace Dock | `cube` | `package.svg` |
| Notes launcher and Dock | `lines` | `list.svg` (upstream marks it as adapted from Lucide 1.77.0) |
| Notes window and list rows | `document` | `document.svg` |
| New note | `plus` | `plus.svg` |
| Back navigation | `back` | `arrow-left.svg` |
| Committed save status | `check` | `check.svg` |
| Workspace menu | `chevron` | `chevron-down.svg` |

The project also retains its local brand and window-control geometry introduced in `bddfc2f`. The PWA installation PNGs have a separate project source, [app-icon.svg](../scripts/app-icon.svg), and [Chromium renderer](../scripts/generate-pwa-icons.mjs) first committed in `95b6d12`.

## M3: Update loader

The selected [Loader Studio `ring` (Classic Ring)](https://github.com/yapweijun1996/Vanilla-HTML-Loader/blob/a02c4f9c67eb48062eb5d651f4a7bcdf53d241fb/loaders/spinners.js) uses a circular track, an accent arc and a linear rotation. The local `.progress-mark` adaptation in [workspace.css](../src/styles/workspace.css) scales it to 1 rem, uses a 2 px, 30% accent track, and follows the workspace palette. The update coordinator controls visibility. Status text and announcements convey progress independently of the ring. With reduced motion the arc stays still.

The [distribution notices](../public/THIRD-PARTY-NOTICES.txt) contain both projects' MIT text and the upstream Lucide/Feather notices. The build ships that file on the site and precaches it alongside the bundled icon and loader code. Upstream catalog scripts and demo initializers are excluded.

## Wallpaper provenance

On 2026-11-23, the built-in Codex ImageGen tool generated an original landscape from text for public distribution in the Aurora Notes workspace. The generation used no reference images or external visual assets. The original PNG is 1672 × 941, SHA-256 `ae56d68925b0d6c53d8692f44b3533c397f6bee78d801af23bd629da7327dbe4`. The selected exports below replace the earlier images from `bddfc2f` in the release. The provider describes its assignment of rights in output to the user or customer in the applicable service terms. [Terms of Use](https://openai.com/policies/terms-of-use/) · [Services Agreement](https://openai.com/policies/services-agreement/)

The generation prompt was:

> Create an original stylized landscape painting for the Aurora Notes desktop wallpaper. Wide 16:9 composition. A quiet alpine lake at blue hour, low silhouettes of layered mountain ridges, indigo water, broad flowing strokes of violet dusk cloud with a restrained pink-coral glow near the right-hand horizon reflected in the lake. Keep the center and lower middle calm and the corners dark so desktop application windows remain legible. The center-right slice must also work as a portrait phone crop. A refined atmospheric digital landscape with soft tonal transitions and very limited fine detail. No buildings, people, symbols, logos, text, frame, desktop interface, or watermark.

Both exports use cwebp 1.6.0, quality 82, method 6. Crop coordinates give x, y, width and height in pixels of the original.

| File under `public/wallpapers/` | Crop | Export | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `aurora-lake-desktop.webp` | 0, 0, 1672, 940 | 1600 × 900 | 23,798 | `e9df90c60408fb3d960a4ba57fb8d3fdb824b4fa3f4b0748218fb1e14d0add19` |
| `aurora-lake-phone.webp` | 1020, 0, 434, 940 | 720 × 1560 | 20,088 | `3641deb91392a5c10fb58c8b1f7ff9de95e4c04c2be36bb7db6dfe63464817fe` |

## After M5: Public API tool

Use the Public-API catalog to shortlist one keyless, read-only endpoint that works from a browser and has a bounded response. Review the catalog entry's parameters, response shape, and execution policy together. Exclude manual-only providers and any endpoint that needs a proxy, custom credentials, or headers the target browsers cannot send. Verify provider terms, direct browser access from staging, request limits, and response handling before choosing it. Do not import the entire console or catalog into the workspace. A second built-in tool should prove that the same launcher and app registration contract can host a network-dependent tool alongside offline Notes.

Trigger the request from an explicit user action. Keep it out of startup, setup, and background update flows. Send only the tool's documented inputs. Keep note contents, backups, and preference values out of requests. Use a scoped adapter with a timeout and cancel an obsolete request when appropriate. Provide distinct results for loading, empty, offline, rate limit, timeout, and provider failure. Keep provider responses outside Service Worker caches for the experiment.

Evaluate the `weather` entry (Open-Meteo) first. Start with user-entered or preset coordinates and a compact result showing temperature, humidity, and wind. Keep device location access outside the experiment. The tool should reopen offline with an explanation that fetching a new result requires a connection. The selection remains provisional until the provider and browser checks pass.

Verify the adapter with fixtures and then check browser access from the deployed staging origin. Open the tool offline and during a provider failure, then switch to Notes and complete a local save. A provider problem must leave the rest of the workspace usable.

## Parallel work and handoff

- The workspace owner can shortlist icons while the storage owner defines the Notes contract. Integrate the selected icons with the launcher and editor in M1.
- The design owner can shortlist the loader while offline work is underway. The PWA owner wires it to real update transitions in M3.
- Public-API research can run in parallel with the first release. Implementation starts after M5 and uses the shared app entry contract.
- For every adopted artifact or contract, record the upstream URL, pinned revision, exact source, notices or provider terms, and local deviations. Recheck provenance and the targeted flow when updating a selection.
