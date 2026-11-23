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

### Minimum-version qualification targets

Use this matrix to select the lower-end devices and OS builds for the first release. Test the latest security patch available for the selected device, current stable Chrome and Firefox where required, and the Safari shipped with the selected iOS version. Record the exact browser versions alongside the results at each release. All required modes in the platform matrix apply at the selected minimums. Confirm the following targets before publishing the support statement.

| Platform | Lower version to qualify | Basis and current gap |
| --- | --- | --- |
| Windows | Windows 11 25H2, x64 and Arm64 | Home and Pro 24H2 servicing ended in October 2026. Firefox's native web app starts at version 143 from Mozilla and 150 from the Microsoft Store. The hosted Arm64 client passed the four launch modes on 25H2 with Chrome 157 and Firefox 160. Qualify a 25H2 x64 consumer client. [Microsoft servicing](https://learn.microsoft.com/en-us/windows/release-health/status-windows-11-24h2) · [Firefox installation requirements](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows) |
| macOS | macOS Sequoia 15, test on 15.8.3 or its later security patch | The three required modes passed on 15.8.3 Arm64 with Chrome 158.0.8127.37 and Firefox 160.0.1. Earlier Intel evidence covers both tabs on 15.7.9. [Sequoia 15.8.3 results](MAC_COMPATIBILITY_EVIDENCE.md#sequoia-1583-qualification) · [Apple security releases](https://support.apple.com/en-us/100100) |
| iOS | iOS 18, test on 18.7.12 or its later security patch for the selected device | Chrome's listed minimum is iOS 18. Apple issued 18.7.12 for iPhone XR and XS models. Qualify Safari, Chrome, Firefox and the Safari Home Screen app on a physical phone at that baseline. [Chrome iPhone installation](https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DiOS&hl=en) · [Apple security releases](https://support.apple.com/en-us/100100) · [WebKit Home Screen behavior](https://webkit.org/blog/13878/) |
| Android | Android 10 | Chrome's listed minimum is Android 10 and Mozilla lists Android 8 for Firefox. Qualify both browsers and both installed modes on a physical Android 10 device running current stable browser packages. Record the model and security patch date because Android update availability varies by device. [Chrome Android installation](https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DAndroid&hl=en) · [Firefox mobile requirements](https://support.mozilla.org/en-US/kb/will-firefox-work-my-mobile-device) |

The build uses Vite 8's default browser syntax targets of Chrome 111, Firefox 114 and Safari 16.4. Installation, local storage, update behavior and accessibility depend on additional browser and OS features. The release evidence must verify those interactions at the selected versions. [Vite build target](https://vite.dev/config/build-options#build-target)

## Local data

The first release supports English and Simplified Chinese interface text and System, Light, and Dark appearance. The [UI foundation](UI_FOUNDATION.md) defines localization, theme, and CSS token behavior.

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
