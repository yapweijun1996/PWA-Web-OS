# Notes performance acceptance

Run this check against the candidate before release. It builds the current checkout in a temporary directory, serves the production assets on loopback, and opens the installed Google Chrome in headless mode. Each of seven serial attempts gets an empty browser context, a 1280 × 800 viewport, an English locale and a synthetic note of about 1.5 KB. The browser process stays open for the batch. The network and CPU use host defaults. The harness reports machine load at the start.

| Lab measure | Start and finish | Desktop p75 ceiling |
| --- | --- | --- |
| Cold launch | Start the initial navigation with empty site data, open Notes from the launcher, and observe the New note action. | 2,500 ms |
| Offline reopen | After a committed save and offline preparation, close the page, disable networking and open a new page in the same context. Time navigation through opening the saved note and reading its exact body. | 2,000 ms |
| Editor response | With the reopened offline body focused, send one printable keystroke and read the changed value after two animation frames. The subsequent save and a second offline reopen must retain the character. | 200 ms |

The ceilings budget time for a usable Notes session and immediate editing feedback. Durations include the browser driver's round trips and action waits. The editor measure includes two frame callbacks. It measures a rendering opportunity rather than display hardware presentation. Installation, browser process startup and cloud network latency have separate test conditions.

Require successful assertions in all seven attempts and the sixth fastest value (nearest-rank p75) at or below each ceiling. Keep all raw times, including slow attempts. A functional failure invalidates the batch and yields FAIL. An unavailable test profile remains NOT_RUN. A new product build requires fresh candidate evidence.

From the repository root with Node 24, the lockfile dependencies and Google Chrome installed, run:

```sh
node scripts/measure-performance.mjs /tmp/notes-performance.json
```

To measure an extracted Pages recovery artifact, pass its directory as the second argument. The harness verifies a private copy against the manifest and checks the observed browser build on all seven attempts. The Windows desktop acceptance workflow uses this mode. Its report records the Pages commit, browser build, manifest digest and harness commit.

```sh
node scripts/measure-performance.mjs /tmp/retained-notes-performance.json /path/to/extracted-release
```

Use a new output filename for each run. The report records the source SHA, build ID, compiled worker digest, environment, raw timings and summary. The worker embeds the release asset hashes. Use a clean checkout for release evidence.

## Field policy

Record field LCP, INP and CLS at p75 separately when a representative dataset exists. The first Notes release uses local-only storage and the field result is `INSUFFICIENT_DATA`. For initial rollout, use a passing lab run on each declared desktop and physical mobile baseline, bound to the same release artifact. Pair those runs with synthetic launch, save and offline-reopen checks on the published build. The rest of the [full release gates](PRODUCTION_READINESS.md) apply. Report the measured lab and field outcomes separately in the release decision.

## Recorded desktop run

On November 23, 2026 the clean `de2c73c` build passed all seven journeys on an Apple M4, macOS 27.2 and Google Chrome 158.0.8127.37. The nearest-rank p75s were 570 ms for cold launch, 548 ms for offline reopen and 69 ms for editor response. The host ran concurrent workloads. These results cover the local desktop browser session only. Field metrics remain INSUFFICIENT_DATA. [Raw samples and build identity](evidence/performance-macos-de2c73c.json)

A separate run of the retained Pages build `b-mwtadq5ya437c29` on macOS 27.2 completed all seven functional journeys. The p75 times were 2,604 ms cold, 2,535 ms offline and 313 ms for editor response. All exceeded the desktop ceilings on this heavily loaded host. The previous local-build sample remains a distinct result. Recheck the release on the agreed baseline before signing the performance gate. [Retained-build measurements](evidence/performance-macos-a437c29-retained.json)

The Windows Server 2025 runner measured the retained `4ef0b87` Pages build `b-mwtat7jh4ef0b87` using Chrome 157.0.8103.79. All seven attempts passed. Cold launch, offline reopen and edit response p75 were 256 ms, 321 ms and 55 ms respectively. The retained manifest digest matched the headed browser run. Physical mobile, consumer Windows and field results retain their own scope. [Windows samples](evidence/performance-windows-4ef0b87.json) · [Workflow run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45187908757)

The retained `95e8a40` candidate `b-mwtd4vd395e8a40` passed all seven attempts in a macOS 26.6.2 VM with Chrome 158.0.8127.36. Cold launch, offline reopen and edit response p75 were 268 ms, 666 ms and 185 ms. The manifest and worker digests matched the Pages candidate archive. This result covers the virtual desktop lab profile for that candidate. [macOS samples](evidence/performance-macos-95e8a40-candidate.json) · [Source run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45193878930)

The retained `54e9662` build `b-mwtdek2h54e9662` completed all seven journeys in each of two batches on that macOS VM. The first cold launch, offline reopen and edit p75 were 302 ms, 605 ms and 205 ms. The second values were 164 ms, 702 ms and 201 ms. Both batches exceeded the 200 ms editing ceiling and are recorded as FAIL. The [full release checklist](PRODUCTION_READINESS.md#g3-performance) still requires an agreed desktop baseline and physical mobile results. [Both macOS batches](evidence/performance-macos-54e9662-candidate.json) · [Source run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45195685417)

Windows Server 2025 measured the same `54e9662` build and manifest with Chrome 157.0.8103.79. All seven journeys passed. Cold launch, offline reopen and edit response p75 were 216 ms, 289 ms and 42 ms. [Windows samples](evidence/performance-windows-54e9662.json) · [Windows run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45197841120)

A physical Apple M4 with macOS 27.2 and Chrome 158.0.8127.37 measured the same retained `54e9662` artifact. All seven journeys passed, with p75 of 824 ms for cold launch, 670 ms for offline reopen and 77 ms for edit response. The manifest and worker digests matched the deployed artifact and the two recorded VM batches. This is desktop evidence on this physical profile. Field data and mobile baselines remain open. [Physical Mac samples](evidence/performance-macos-54e9662-physical.json)

The same physical Mac measured the retained `d620665` quota-recovery build `b-mwtfl4bdd620665`. All seven journeys passed. Cold launch, offline reopen and editor response p75 were 227 ms, 327 ms and 50 ms. [Physical Mac samples](evidence/performance-macos-d620665.json) · [Source run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45207524392)

Windows Server 2025 completed all seven desktop journeys on the same retained build with Chrome 157.0.8103.79. The p75 results were 234 ms cold, 286 ms offline and 41 ms for editing. [Windows samples](evidence/performance-windows-d620665.json) · [Windows run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45210124329)

The physical Apple M4 tested seven journeys twice on the retained `b9dcafa` update-focus build. The first p75 results were 1,211 ms cold, 1,240 ms offline and 259 ms for editing. Editing exceeded the 200 ms limit while other release checks were running. A separate batch after those checks finished passed at 172, 281 and 53 ms. Both batches identify the same build and manifest. [First batch](evidence/performance-macos-b9dcafa-first.json) · [Separate batch](evidence/performance-macos-b9dcafa-repeat.json) · [Source run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45215666979)

Windows Server 2025 measured the same retained build with Chrome 157.0.8103.79. All seven journeys passed, with p75 of 228 ms cold, 287 ms offline and 55 ms for editing. [Windows samples](evidence/performance-windows-b9dcafa.json) · [Windows run](https://github.com/yapweijun1996/PWA-Web-OS/actions/runs/45217407898)
