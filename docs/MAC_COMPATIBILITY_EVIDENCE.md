# macOS compatibility evidence

Supplementary manual check on 2026-11-23 in Singapore, against the deployed GitHub Pages origin. Build ID `b-mwt98wfdf2e9327` appeared in the app and the deployed service worker before and after the Chrome check. These observations do not establish the Windows milestone or full-release compatibility.

| Environment and mode | Result | Evidence and limits |
| --- | --- | --- |
| macOS 27.2 (26B123), stable Google Chrome 158.0.8127.37, installed app, fresh signed-out test profile | PARTIAL | Used Chrome's address-bar Install action and opened the resulting separate app window; it reported Available offline. A synthetic note was saved and was visible with its original contents when reopened online. Offline cold launch and offline edit/reopen are **not verified**: the shared host network was not disrupted, and Available offline is an app-reported status rather than proof of an offline cold launch. |
| macOS, ordinary Firefox tab | NOT_RUN | Firefox was not installed on this host. An official download was obtained, but preparation of a temporary copy stalled and was stopped; no Firefox test result is claimed here. |

The Chrome check used a test-only profile, not an existing personal browsing profile. The deployed worker identity was observed unchanged after the check; server-side identity observations do not by themselves prove every client asset. No accessibility, mobile, installed-app offline, or cross-device result is implied.

## Retail Firefox in an isolated macOS VM

On 2026-11-23 at approximately 21:10 Singapore time, a separate macOS 26.6.2 VM (25G83) ran Mozilla-signed retail Firefox 160.0.1 with geckodriver 0.37.1 in a unique test profile and a visible browser window. The deployed worker reported build `b-mwta2ilmff669f3` before and after the run, and the UI displayed that same ID on each launch.

A synthetic note was created and saved online. The browser was exited and started again; before navigating, WebDriver set Firefox's `Services.io.offline` to `true` and verified that an uncached request to an external site failed. The app cold-opened from its offline cache, displayed the saved note, and saved an edit. After another browser exit and restart, offline mode was set again before navigation, the uncached request failed again, and the edited content was still present. Both restarts displayed the same build ID.

This is a browser-level software simulation, not a physical network disconnection or installed-app test. Privileged WebDriver access was used only to set and read the browser offline state; it did not alter system networking. The disposable VM profile and test files were isolated from the owner's Chrome profile. These results do not establish compatibility on other OS/browser versions or a full production release.

A separate standalone Chrome user-data directory and a browser-only loopback proxy may make an installed-app offline rehearsal feasible without changing system networking, provided an uncached request is confirmed blocked after each actual app launch. Whether Chrome's installed app shim retains that proxy configuration across a cold restart remains unverified; a headless browser or `--app` window is not sufficient evidence of installation.

## WebKit engine checks

On 2026-11-23, a local production build from `95e8a40` (`b-mwtcz2g595e8a40`) ran on macOS 26.6.2 with Playwright 1.65.1 and WebKit 27.2. The desktop profile passed 18 tests for keyboard, workspace interactions, language and offline behavior. An iPhone 13 viewport and touch profile passed the 14 applicable tests, including offline reopening, the dock with a focused editor, and cache eviction repair. The initial broad run also attempted four desktop window or hover tests in the touch profile. Those expected controls were unavailable, so the mobile run was repeated with the desktop cases excluded. The engine run leaves iPhone installation, native keyboard, safe-area inset and VoiceOver checks open.
