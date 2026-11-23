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

Use a new output filename for each run. The report records the source SHA, build ID, compiled worker digest, environment, raw timings and summary. The worker embeds the release asset hashes. Use a clean checkout for release evidence.

## Field policy

Record field LCP, INP and CLS at p75 separately when a representative dataset exists. No real-user timing collection is enabled in the app. With no such dataset, record INSUFFICIENT_DATA. As an initial launch policy, a passing lab run can support the Windows demo when the Windows baseline also passes. For full production, require candidate lab results on the declared desktop and mobile baselines, and record the release owner's decision about missing field samples. A lab result on macOS covers that profile only.
