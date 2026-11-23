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

## Chrome installed app on the deployed demo

On 2026-11-23, Chrome 158.0.8127.36 on macOS 26.6.2 installed the deployed `54e9662` demo through Chrome's address bar in a disposable profile. The install created a macOS app shortcut for that profile. All three launches used the actual installed app ID and reported `display-mode: standalone` with build `b-mwtdek2h54e9662`. The first process created and saved a synthetic note online. During two fresh browser processes, a local rejecting proxy was configured for the test Chrome instance. An uncached request returned 404 online and failed on each later launch. The app saved an edit during the first offline session and read its exact value in the second. The test profile and its shortcut were removed. [Session evidence](evidence/macos-chrome-installed-54e9662.json) · [Deployed artifact](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45195685417)

## Firefox regular tab on the deployed demo

On the same macOS 26.6.2 VM, Mozilla-signed Firefox 160.0.1 opened the deployed `54e9662` demo in three distinct headed browser processes using one disposable test profile. The served worker digest matched the release manifest. An uncached request returned 404 during the online setup and failed in both later sessions under a browser-only rejecting proxy. Firefox saved the note, restarted offline, edited it, and compared its exact value after another offline restart. [Session evidence](evidence/macos-firefox-tabs-54e9662.json)

## Chrome regular tab on the deployed demo

Chrome 158.0.8127.36 on the same macOS VM ran the deployed `54e9662` demo as headed browser tabs across three distinct processes in a disposable profile. Browser-only network emulation blocked the uncached request in both offline launches. Each launch confirmed the worker and build identity. The note saved online was edited on the first offline launch and the exact edit was read after the second offline restart. This gives the three required macOS launch modes on the tested versions. Desktop screen-reader checks and the supported minimum version still need release sign-off. [Session evidence](evidence/macos-chrome-tabs-54e9662.json)

## Quota recovery demo

On November 23, macOS 26.6.2 (25G83) repeated all three launch modes against the deployed `d620665` build `b-mwtfl4bdd620665`. The served worker SHA-256 matched the retained manifest. Chrome 158.0.8127.36 ran in a normal tab and through an app installed with its address-bar Install action. Firefox 160.0.1 ran in ordinary tabs. Each mode saved a synthetic note online, restarted offline for an edit and restarted offline to read the exact edit. Chrome's installed window reported standalone mode on all three launches. A browser-only proxy blocked an uncached request in both Firefox and installed Chrome offline launches, and Chrome tab mode used browser network emulation. Test-only profiles and the installed shortcut were removed. The supported minimum OS and browser versions and screen-reader observations remain open. [Release and verification](DEMO_ACCEPTANCE_D620665.md)

## VoiceOver update progress

On November 24 in Singapore, the same macOS VM ran VoiceOver with Chrome 158.0.8127.36 against two verified release pairs on loopback. With `d620665` active, the Caption Panel omitted the waiting-save update message. With the retained `b9dcafa` candidate active, the panel captured **Update available** and **Saving changes before update**. The update finished with the synthetic edit intact. Focus stayed on the progress message while the pending write completed. Some editor labels and ordinary save states were missed in the macOS capture. [Paired observations](evidence/voiceover-update-b9dcafa.json)

## VoiceOver Notes journey

The follow-up on November 24 in Singapore used native VoiceOver with Chrome 158.0.8127.36 on macOS 26.6.2 (25G83) in the test VM. The test verified all 12 file hashes per release and served `b9dcafa` as the active build and `d620665` as the compatible staged build on one loopback origin. In a fresh foreground Chrome window, VoiceOver reported the Notes button, both editor field names, and the Note editor region. It reported saving, a committed save, a failed write, a successful retry, the waiting update, and the pending-save update. The test reopened the note in the staged build and compared the saved body with the exact synthetic edit. [Native speech report](evidence/macos-voiceover-notes-b9dcafa.json)

The test copied VoiceOver's last spoken phrase after each action. Wait for the automatic save announcement after creating a note before tabbing to Body and back to Title. After reopening a note, capture the editor region before staging the update. A timed sample can contain a neighboring announcement, so record it as unobserved and repeat the action after speech settles. The follow-up retained the original Caption Panel observations as a separate record. [Apple's last-phrase commands](https://support.apple.com/guide/voiceover/repeat-copy-or-save-the-last-spoken-phrase-vo2725/mac)

## Update focus demo launches

On November 24 in Singapore, macOS 26.6.2 repeated the three required launch modes for the deployed `b9dcafa` release. Chrome 158.0.8127.36 and Firefox 160.0.1 passed headed tab sessions. Chrome also installed the app through its native Install control and launched the actual app shortcut across three browser processes. Each reported standalone mode. The online request returned 404 and a fresh uncached request failed in both offline installed sessions. Each mode saved a synthetic note online, saved an offline edit and read it after another offline restart. The disposable profiles and shortcut were removed. [Release identity and evidence](DEMO_ACCEPTANCE_B9DCAFA.md)

## Updating the installed Chrome app

On November 24 in Singapore, Chrome 158.0.8127.36 on macOS 26.6.2 installed `d620665` through the address bar on a disposable loopback origin. The verified `b9dcafa` release had the same manifest ID, start URL, scope and display mode. The standalone app saved a synthetic note while the update waited, accepted the update and reopened the saved edit in `b9dcafa`.

After Chrome exited, Launch Services reopened the original `PWA Web OS.app` bundle. Its `Info.plist` digest matched the value recorded at installation. The build footer displayed `b-mwth4sjcb9dcafa` and text copied from the reopened editor matched the entire synthetic body. The test profile's first-run marker was initialized after Chrome presented its welcome dialog on the first shortcut launch. [Installed update report](evidence/macos-installed-update-b9dcafa.json)

## Sequoia browser tabs

The build `b-mwth4sjcb9dcafa` passed six headed sessions on each of three Sequoia environments. The hosted Mac images ran 15.8.2 (24H232) on Arm64 and 15.7.9 (24G830) on Intel. A disposable local Tart guest ran 15.7.7 (24G720) on Apple Silicon. All three ran retail Chrome 158.0.8127.37 and Firefox 160.0.1.

Each browser used three separate processes, one signed-out test profile and an uncached request that returned 404 online and failed during both offline launches. Chrome created the synthetic note, saved an offline edit and exported the backup on the final offline launch. Firefox imported it twice, made its own offline edit and read that edit after another process restart. The backup check used two browser profiles on each test host. [Session evidence](evidence/macos-sequoia-tabs-b9dcafa.json) · [Arm64 run on main](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45237947952) · [Hosted Intel run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45235982611)

In the hosted `37ad1b4` run, `codesign -R` treated the inline signing requirement as a filename. Shell command substitution let preparation continue after that error. The corrected helper supplies the `=` prefix for inline requirements and runs each installation as a standalone command. A failed signature check exits before browser version lookup or driver preparation and still detaches the disk image. [Hosted run log](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45252595358) · [Apple code requirements](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements/)

Apple Software Update offered 15.8.3 (24H241) to the local guest. The first base image had an APFS Recovery volume inside its system container, and personalization failed with Apple error 1256 because the separate SFR recovery partition was absent. The published Sequoia vanilla image keeps that partition. The `15.7.7` image at digest `sha256:57a83b1b52f928f5b11b0963927178fd6c4cac52c315279f227c27cc5ab81587` exposed `Apple_APFS_Recovery`. Apple Software Update completed and the guest restarted. `sw_vers` reported `15.8.3` and `24H241` before the browser runs. [Tart image template](https://github.com/cirruslabs/macos-image-templates/blob/main/templates/vanilla-sequoia.pkr.hcl) · [Apple's Sequoia release record](https://support.apple.com/en-us/149720)

## Sequoia Chrome installation

On the 15.7.7 Arm64 guest, signed retail Chrome 158.0.8127.37 installed the same retained release through its address bar and registered `PWA Web OS.app`. Three separate Chrome processes launched the registered app ID in standalone mode. The first created and saved a note with the origin running. After the loopback server stopped, the second cold launch saved a new edit and the third read the exact saved body. The uncached network control returned 404 online and failed on the two offline launches. [Installed-window report](evidence/macos-sequoia-installed-b9dcafa.json)

For a fresh test account, create the user Applications folder before installation. ChromeDriver's default `test-type` switch suppresses native app shims on macOS. The successful native install check excluded that switch and verified the generated bundle before restarting the app. [Chromium shortcut implementation](https://chromium.googlesource.com/chromium/src/+/05dc0d76b85428669a02367bb967477e7e0b0411/chrome/browser/web_applications/os_integration/web_app_shortcut_mac.mm)

## Sequoia 15.8.3 qualification

On November 24 in Singapore, the upgraded Arm64 guest verified all 12 retained files for build `b-mwtnv4pp37ad1b4`. The installed Chrome 158.0.8127.37 and Firefox 160.0.1 bundles satisfied the Apple signing requirements for their publisher and bundle identifiers. Six headed tab sessions passed the online and offline controls, exact note reads, and same-host backup transfer. The corrected preparation helper also passed a hosted repeat of all six tab sessions on 15.8.2 Arm64. [Exact target report](evidence/macos-sequoia-15-8-3-37ad1b4.json) · [Signed hosted rerun](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45258787839)

Chrome 158.0.8127.37 on 15.8.3 returned an unknown-method response for `PWA.install` on both test debugger connections. The address-bar Install action succeeded through Chrome's Next and Install prompts and generated `PWA Web OS.app`. The test verified its registered ID, launch URL and profile, then started three separate Chrome processes with that ID. All opened in standalone mode with the expected build. The loopback origin stopped after the online save. The uncached control returned 404 online and failed on both offline launches. The first offline process saved the edit and the second read its exact body. [Installed launch report](evidence/macos-sequoia-15-8-3-37ad1b4.json)

Native VoiceOver in the same guest captured seven of nine Chrome tab checks on `37ad1b4`. The Caption Panel reported the Notes control, Title and Body, save success, the injected failure, the successful retry, and the pending-save update. The update completed and the staged `b9dcafa` release reopened the exact edit. The panel showed navigation hints in the samples for ordinary saving and update availability. A follow-up confirmed ordinary saving text in the page's live region, and the framebuffer request timed out before the update-available retest. The exact 15.8.3 report retains both as unobserved. [VoiceOver report](evidence/macos-voiceover-37ad1b4.json)

## Sequoia VoiceOver caption follow-up

On November 24 in Singapore, a disposable 15.7.7 Arm64 guest (24G720) with signed Chrome 158.0.8127.37 verified all 12 files per retained release. Native Caption Panel frames captured **Saving** while a real IndexedDB write was held and **Update available** while the staged `b9dcafa` worker waited. After consent, the update installed and the reopened note matched the exact edit. [Targeted caption evidence](evidence/macos-voiceover-37ad1b4-followup.json)

The early update run recorded **Update available** in the page's polite live region while VoiceOver continued reading the page. The native caption appeared in a fresh run after existing speech had settled, with the same live-region text. Capture inside the guest when the remote framebuffer is unreliable, use separate image files per sample, and verify a launcher caption as a control. Release the held write promptly during update acceptance so the application stays inside its eight-second flush deadline. [VoiceOver webpage loading settings](https://support.apple.com/en-asia/guide/voiceover/cpvouwebpageloading/mac) · [Update deadline](../src/pwa/worker-client.ts)

The 15.8.3 Arm64 follow-up verified the boot build `24H241`, the signed Chrome 158.0.8127.89 bundle, and all 12 files per retained release. Guest-native screenshots missed the launcher caption while the virtual desktop showed the Caption Panel. The successful run sampled that panel with a launcher control, captured ordinary saving during a held write after a short typed edit, then captured update availability after prior speech settled. After the user action to apply the update, the staged `b9dcafa` build reopened the exact edit. Chrome 158.0.8127.37 on the same guest also captured the saving caption after the short edit. [Exact-patch caption report](evidence/macos-voiceover-15-8-3-37ad1b4.json)
