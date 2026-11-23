# PWA Web OS Feature Map

All first-release features are planned. The [product specification](PRODUCT_SPEC.md) owns the requirements and [release acceptance criteria](PRODUCT_SPEC.md#acceptance-criteria).

## 2026 first release

| Feature | User outcome | Depends on |
| --- | --- | --- |
| Workspace and launcher | Open Notes from a focused mobile view or a wider desktop workspace. | Responsive shell and Notes entry point |
| Install and launch | Use the workspace on Windows, macOS, iOS, and Android in the required tab and [app launch modes](PRODUCT_SPEC.md#platform-support). | Workspace, HTTPS, Web App Manifest, and platform install paths |
| Notes editor | Create and edit notes, see save progress, and recover from save errors. | Notes storage and save feedback |
| Offline draft recovery | After initial setup, edit without a connection and reopen the last locally saved draft. | Offline app shell and IndexedDB |
| Workspace preferences | Keep the theme between visits when preference storage is available. | localStorage with defaults on failure |
| App update | Choose when to update and reopen with saved notes intact. | Notes save lifecycle and Service Worker release handling |
| Backup and restore | Move notes to another device using versioned JSON. Invalid or conflicting imports leave existing notes intact. | Notes storage, backup schema, and import validation |
| Accessibility | Complete the Notes workflow with safe-area-aware controls, visible focus, keyboard navigation, and announced status messages. | Workspace and every core Notes interaction |

## Suggested implementation order

1. Build the workspace, launcher, and Notes editor with local save and reopen.
2. Add installation and offline startup. Verify the Notes flow in the required browser and app modes on all four platforms.
3. Add user-controlled updates and verify draft preservation and recovery across two builds.
4. Add backup and restore, then verify transfer on a second device and rejection of invalid or conflicting data.

Apply accessibility during every step. Before implementation, record supported browser and OS versions, the local storage and migration approach, and the backup schema.

## Beyond the first release

| Candidate | What it would add |
| --- | --- |
| Multiple windows | Keep several tools visible in one workspace. |
| Accounts and cloud sync | Resume work across devices without manually exchanging backups. |
| Third-party apps | Add tools with explicit, revocable permissions. |
| AI automation | Assist with tasks while keeping consequential actions under user control. |

These candidates support the long-term product vision and have no assigned release dates.
