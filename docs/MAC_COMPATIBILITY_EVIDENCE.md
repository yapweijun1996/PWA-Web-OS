# macOS compatibility evidence

Supplementary manual check on 2026-11-23 in Singapore, against the deployed GitHub Pages origin. Build ID `b-mwt98wfdf2e9327` appeared in the app and the deployed service worker before and after the Chrome check. These observations do not establish the Windows milestone or full-release compatibility.

| Environment and mode | Result | Evidence and limits |
| --- | --- | --- |
| macOS 27.2 (26B123), stable Google Chrome 158.0.8127.37, installed app, fresh signed-out test profile | PARTIAL | Used Chrome's address-bar Install action and opened the resulting separate app window; it reported Available offline. A synthetic note was saved and was visible with its original contents when reopened online. Offline cold launch and offline edit/reopen are **not verified**: the shared host network was not disrupted, and Available offline is an app-reported status rather than proof of an offline cold launch. |
| macOS, ordinary Firefox tab | NOT_RUN | Firefox was not installed on this host. An official download was obtained, but preparation of a temporary copy stalled and was stopped; no Firefox test result is claimed here. |

The Chrome check used a test-only profile, not an existing personal browsing profile. The deployed worker identity was observed unchanged after the check; server-side identity observations do not by themselves prove every client asset. No accessibility, mobile, installed-app offline, or cross-device result is implied.
