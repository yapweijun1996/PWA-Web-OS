# Reuse from sibling repositories

Status: Planned. The upstream repositories belong to the same owner and serve different roles. The first release remains a Notes-only workspace. Its launch, editing, storage, and updates use the app's own release assets.

| Source | What to reuse | Integration point |
| --- | --- | --- |
| [SVG-Icon-Studio](https://github.com/yapweijun1996/SVG-Icon-Studio) | A small set of individually selected SVGs | M1 workspace and Notes controls |
| [Loader Studio](https://github.com/yapweijun1996/Vanilla-HTML-Loader) | One self-contained loader design | M3 update progress |
| [Public-API](https://github.com/yapweijun1996/Public-API) | One catalog entry and its request/response contract | Post-release second built-in app experiment |
| [Blender 3D Gallery](https://github.com/yapweijun1996/Blender-3D-Gallery) | Release and offline evidence, then viewer and asset patterns | M2–M5 verification and a [post-release Viewer pilot](BLENDER_GALLERY_REUSE.md) |

## M1: SVG icons

Start with the launcher, Notes, new note, back, offline, and update icons. Prefer the studio's 24 × 24 outline family with a consistent 1.5 stroke and `currentColor` for theme-aware rendering. Select each from the upstream catalog, then use the original SVG source or a reviewed export. Record the upstream commit, path, and applicable attribution for each selected asset. Retain the applicable MIT and Lucide/Feather notices. Keep the in-app set separate from the manifest install icon work in M2.

Bundle the selected icons as local assets. Inspect the SVG files before inclusion and exclude scripts, event handlers, and remote references. Use visible text or an accessible name for controls and hide purely decorative glyphs from assistive technology. Verify recognizability, alignment, contrast, and offline rendering in the target layouts.

## M3: Update loader

Choose a compact Loader Studio example with plain markup and locally scoped CSS. Prefer an example that needs no JavaScript, remote fonts, or assets. If the selected snippet includes a demo initializer, omit it and let the workspace render the indicator from update state. Pin the source revision and record the upstream loader ID, path, notices, and local adaptations.

The existing PWA update coordinator owns readiness, activation, timeout, and recovery. Show the loader only after the user accepts and the app is actively preparing or switching builds. Pair it with status text and a static reduced-motion variant. Keep the editor usable while an update is waiting. Clear the busy state on completion, failure, or timeout and present the outcome and next action. Verify both motion settings on a staged two-build update, and check that the loader remains available when the candidate was prepared before the connection was lost.

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
