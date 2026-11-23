# UI Foundation

Status: Implementation specification. The first integration target is Windows Chrome and Firefox in regular tabs. The [product specification](PRODUCT_SPEC.md) owns release scope, and the [modular plan](MODULAR_WEB_OS_PLAN.md) owns application boundaries. Aurora informs the visual direction and remains a later workspace project.

## Internationalization

- Ship English (`en`) and Simplified Chinese (`zh-Hans`) for the first Notes workflow. Bundle both catalogs with the offline core. On startup, use a valid saved preference, then a supported browser language, then English. Match Simplified Chinese tags explicitly (for example, `zh-Hans-SG` or `zh-CN`). Fall back to English for unsupported locales.
- Use a small typed message catalog with complete sentences and named placeholders. Group message keys by feature and verify catalog and placeholder parity in CI. Use native `Intl` formatters for displayed dates, numbers, and sizes. Keep stored values, note content, backup fields, URLs, and IDs language-neutral and unchanged by switching languages.
- Translate navigation, settings, titles, labels, validation, empty states, install guidance shown in the app, errors, save and update messages, and accessible announcements. Set `document.documentElement.lang` and document title on startup and on language changes. Give language choices their native labels. Keep the current draft, selection, and focus when changing language. [W3C guidance on page language](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html)
- Persist an explicit selection in `pwa-web-os:preferences:locale`. If preference storage fails, apply changes for the current session and resolve from browser language on the next launch. A missing translation falls back to English for display, but missing required keys fail the release check.

## Theme and CSS tokens

- Offer System, Light, and Dark. The existing `pwa-web-os:preferences:theme` key stores `system`, `light`, or `dark`, with System as the default. Only System follows live OS changes. Resolve theme before the first visible app render using CSP-compatible local assets. Match native controls using `color-scheme`, and use an opaque theme-aware application chrome where supported. Keep focus and pending edits through a theme switch. [CSS Color Adjustment specification](https://www.w3.org/TR/css-color-adjust-1/)
- Use one CSS custom property source, proposed at `src/styles/tokens.css`. Define primitives for palette, spacing, type, radius, and motion. Map primitives to semantic roles such as `--surface-canvas`, `--surface-panel`, `--text-primary`, `--border-subtle`, `--action-primary`, and `--focus-ring`. Light and Dark define the same role set. Use narrowly scoped component aliases only when a component needs its own override. [CSS Custom Properties specification](https://www.w3.org/TR/css-variables-1/)
- Components consume semantic roles and use `currentColor` for compatible SVG icons. Give focus, danger, success, and selection independent roles and visible non-color cues. Check both themes at reduced motion and Windows forced colors. Use system font fallbacks that cover Chinese and verify text wrapping and zoom. Keep fonts, tokens, icons, and critical chrome available offline.
- The theme preference owns mode, styles own visual values, and the shell owns the control. Notes uses the same semantic CSS and catalogs as the shell. Do not encode theme or locale inside the Notes database or backup format.

## Module ownership and parallel delivery

| Lane | Owns | Interface and handoff |
| --- | --- | --- |
| Integration | Bootstrap, contracts, shared entry point, merge order | Agree on app mount/dispose, translator, preference access, theme root, and repository contracts. Run the first thin slice in both real Windows browsers. |
| Localization | `src/i18n/` and shared message contract | Deliver typed catalogs, selected locale, formatter helpers, and catalog parity checks. Feature owners coordinate their keys with this lane and supply real strings. |
| Theme and tokens | `src/styles/` and theme resolution | Deliver Light and Dark semantic maps, System behavior, focus and reduced-motion treatment, and one reference screen. Agree on roles with shell and Notes owners before expansion. |
| Workspace and Notes | `src/workspace/` and `src/apps/notes/` | Use injected translator and repository contracts. Render a launcher-to-Notes flow with visible save states. Keep app-level state independent of token and locale services. |
| Preferences and storage | Preference adapter, IndexedDB repository, backup storage boundary | Own validation and failure results. Deliver reusable fixtures for failed preferences and stale note revisions. Keep localStorage reads and writes behind the preference adapter. |
| PWA and verification | Build asset inventory, worker coordination, and browser evidence | Verify both catalogs and all theme assets are available in the core build. Independently test real Chrome and Firefox tabs and identify the failing build and mode. |

After M0 fixes the contracts, localization, tokens, Notes, and storage can proceed in parallel. Give each shared file one writer. At M1 integrate one Notes screen first in English and Simplified Chinese, in both themes, with real save feedback. Once that passes, finish all message and component states. At M2–M4 rerun the foundation checks offline, across updates, and during backup. Extend platform verification after the Windows browser milestone.

## Windows acceptance

- Run the core Notes path in each of Chrome and Firefox for both languages and both explicit themes. Test System separately with the Windows appearance changing while the app is open. Record real browser versions and build ID.
- Switch locale and theme with an unsaved draft open. Check `html[lang]`, localized accessible labels and announcements, visible focus, and unchanged draft, selection, and content.
- Reload with saved preferences, corrupt preference values, and blocked storage. Check startup theme, language fallback, and continued Notes usability. Check for a wrong-theme flash on cold launch.
- Reopen offline and switch language/theme. Verify translated update and backup errors and that a new build retains applicable preferences. Check at narrow widths, with CJK text and zoom, keyboard only, reduced motion, and Windows forced colors.
- Require catalog/key and token-role parity, a focused import-boundary review, and browser evidence for representative loading, success, failure and recovery states before closing the milestone. Record failed and unrun checks explicitly.
