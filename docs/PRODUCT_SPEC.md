# PWA Web OS Product Specification

Status: Draft for the 2026 first release. This document defines intended behavior and acceptance criteria.

## Product goal

Give users an installable browser workspace whose files and progress survive routine interruptions and can be carried to another device. The 2050 vision is a workspace that can adapt to new devices, browsers, and tools while keeping user data portable and user permissions explicit.

The first release targets an individual user who wants to open a note, keep editing without a connection, and recover or transfer that work later.

## First release

- Provide a responsive workspace with a launcher and one built-in tool, Notes. Use a single focused view on narrow screens and a layout that can use available space on larger screens.
- Support the core workflow in browser tabs and installed app modes listed in the platform matrix. Serve the app over HTTPS with a Web App Manifest and platform-specific installation guidance.
- After an initial online load and offline setup, let users open Notes, create and edit notes offline, and reopen locally saved drafts. Show whether a draft is saving, saved on this device, or failed to save. Show a recovery path when storage is unavailable.
- Notify users when an update is ready. Preserve pending edits, show progress after the user chooses to update, and reopen in the new version. If activation fails, provide a recovery action and preserve the last saved draft.
- Export notes as a versioned JSON backup and import it on another device. Validate the backup before writing records. Keep existing notes intact when a backup contains conflicting records or invalid data.
- Design for iOS safe areas, readable contrast, keyboard operation on desktop, visible focus, and useful labels and status messages for assistive technology.

Cloud sync, accounts, third-party apps, multiple floating windows, AI automation, and online tools from Public-API are outside the first release.

The [Aurora workspace plan](AURORA_WORKSPACE_PLAN.md) describes the selected long-term desktop direction, including a Dock, window management, and a workspace file explorer.

## Platform support

All four operating systems are required for release. Each listed mode must pass the applicable acceptance criteria using normal browser profiles.

| Platform | Required browser tabs | Required app launch modes |
| --- | --- | --- |
| Windows | Chrome, Firefox | Chrome installed app and Firefox web app window |
| macOS | Chrome, Firefox | Chrome installed app. Firefox uses a browser tab. |
| iOS | Safari, Chrome, Firefox | Home Screen web app installed through Safari |
| Android | Chrome, Firefox | Installed app or Home Screen launch through Chrome and Firefox |

Record exact minimum OS and browser versions at M0. Verify the installed modes using the [Chrome desktop](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en), [Chrome Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en), [Firefox Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows), [Firefox Android](https://support.mozilla.org/en-US/kb/use-web-apps-firefox-android), and [Safari iPhone](https://support.apple.com/en-gb/guide/iphone/iphea86e5236/26/ios/26) installation paths. Treat each browser profile or install context as a potentially separate local workspace. Use backup and restore to transfer notes between contexts.

## Local data

Use IndexedDB as the authoritative store for notes and saved drafts. Use localStorage for small, non-sensitive interface preferences, such as theme. If preference storage is unavailable, continue with defaults. If IndexedDB cannot save a draft, show the failure and offer a way to copy the draft or retry while the editor remains open.

## Acceptance criteria

| Area | Evidence required before release |
| --- | --- |
| Install and launch | Use the launcher to open Notes in every required tab and app launch mode in the platform matrix. |
| Offline draft recovery | After initial online setup, disconnect the device. Open Notes, edit a draft, wait for local save confirmation, close the app, and reopen it while offline. Confirm the saved content matches. |
| Update integrity | With an existing draft, make a second build available. Confirm the update prompt appears and the draft remains editable before acceptance. Accept the update, observe progress, and confirm that the app opens the new build with the draft intact. Exercise one update failure and confirm recovery. |
| Backup and restore | Export a backup and import it on a separate device. Confirm note titles and bodies match. Repeat with a malformed backup and a conflicting record, and confirm existing notes remain intact. |
| Layout and access | Complete the Notes flow on iOS, Android, Windows, and macOS. Verify mobile safe areas, desktop keyboard navigation, and screen reader announcements for save and update states. |

## Standards and open decisions

Use the KB-MCP Skill Registry entry `pwa:product-standard` v1.1.0 as the project baseline, with the `STATIC_OFFLINE` profile for the initial release. Apply the requirements for that profile and document any exception and its rationale here. The acceptance criteria above describe the project's own release evidence.

Before implementation, record the supported operating system and browser versions, the local storage and migration approach, and the backup schema. Keep the development and test instructions aligned with the commands verified against the implemented app.
