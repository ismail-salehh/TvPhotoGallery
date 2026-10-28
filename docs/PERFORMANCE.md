# Performance: budget and measurements by platform

Every number in the budget must hold **on the weakest supported device, in a release build**. That device has not been chosen yet. Proposal: the low-end Android TV streaming-stick class (1.5–2 GB RAM, quad-core Cortex-A35/A53, 1080p). The emulators and desktop browser measured below are far faster than that class, so a pass here is an early warning, not a sign-off.

## Budget

| Area | Measure | Budget |
|---|---|---|
| Startup | Cold launch to first frame | ≤ 1.0 s |
| Startup | Cold launch to the first album focused | ≤ 3.0 s |
| Key to focus | Remote press to the moved highlight on screen | ≤ 100 ms (p95) |
| Holding an arrow | Frame time while held (50 ms repeat) | p95 ≤ 33 ms, p99 ≤ 50 ms; one step per press, never skip |
| Large album | 2,000-photo album, Down held from the first photo | every photo reachable; same frame budget |
| Memory | Total PSS while browsing | ≤ 250 MB |
| Memory | Two-hour slideshow, after the first 10 minutes | no upward trend (≤ +10 MB per hour) |

## The matrix

One column per supported platform (`docs/SUPPORT.md`). ✓ within budget · ✗ over budget · — not measured (reason below the table). Measured 2026-10-27; LG webOS 22 on 2026-10-28. Startup: Android is the median of 5 cold launches; web is the first load, with an empty HTTP cache (on the TV: cache and app storage cleared).

| Measure | Android TV 1080p | Android TV 720p | Android TV 4K | Android 7 (oldest) | Web, Chrome 1080p | Web, Chrome 720p | Web, Chrome 4K | Web, CPU 4× slower | LG webOS 22 | Firefox / Safari | Apple TV |
|---|---|---|---|---|---|---|---|---|---|---|---|
| First frame (cold) | ✓ 0.18 s | ✓ 0.19 s | — | — | ✓ 0.14 s | ✓ 0.16 s | ✓ 0.18 s | ✓ 0.42 s | ✗ 1.07 s | — | — |
| First album focused (cold) | ✓ 0.63 s | ✓ 0.62 s | — | — | ✓ 0.21 s | ✓ 0.22 s | ✓ 0.23 s | ✓ 0.59 s | ✓ 1.44 s | — | — |
| Key to focus, p95 | — | — | — | — | ✓ 16 ms | ✓ 16 ms | ✓ 16 ms | ✓ 16 ms | ✓ 15 ms | — | — |
| Holding Right on a rail | ✓ p95 32 / p99 32 | ✓ 16 / 16 | — | — | ✓ 17 / 17 | ✓ 17 / 17 | ✓ 17 / 17 | ✓ 17 / 33 | **✗ 133 / 267** | — | — |
| Holding Down in an album | ✓ p95 31 / p99 36 | ✓ 32 / 32 | — | — | ✓ 17 / 17 | ✓ 17 / 17 | ✓ 17 / 17 | **✗ 67 / 83** | **✗ 300 / 350** | — | — |
| 2,000-photo album | — | — | — | — | ✓ all reached, 24 s | ✓ 23 s | ✓ 24 s, p99 33 | ✓ 31 s, p99 33 | ✗ all reached, 74 s, p99 233 | — | — |
| Memory while browsing | ✓ 152 MB | ✓ 148 MB | — | — | JS heap 62 MB | JS heap 66 MB | JS heap 68 MB | JS heap 68 MB | JS heap 15 MB | — | — |
| Two-hour slideshow | ? see Open | — | — | — | — | — | — | — | — | — | — |

**Not measured, and what it needs:**
- **Android TV 4K:** the `Television_4K` emulator crashes on start on this machine (segfault, with host and software GPU), and this emulator image ignores screen-size overrides above its physical 1080p. Needs a 4K TV, or a host that can run the 4K emulator.
- **Android 7 (API 24), the oldest supported:** no TV system image for API 24 is installed (only API 21, below `minSdkVersion`, and API 36).
- **LG webOS 22, whole-app memory and the two-hour slideshow:** DevTools gives the JS heap only, not the memory the TV's web app manager holds (decoded images included); the slideshow soak (`--soak 120`) was not run on the TV.
- **Firefox and Safari:** no browser automation for them here; Chrome is the engine of every TV target.
- **Apple TV:** the Xcode project has no tvOS target yet.
- **Key to focus on Android:** needs a high-speed camera or a Perfetto input-to-frame trace.
- **2,000-photo album on Android:** the device can't be given the generated album; a real 646-photo album was used for the hold instead.

## Measurements by platform

### Android TV emulator (release build)

`Television_1080p` AVD: Android 16 (API 36), x86, 4 cores, 2 GB RAM, host GPU. 720p is the same emulator with `wm size 1280x720` and `wm density 213`. Live Unsplash API, albums already in the app's cache. Raw results: `qa/results/perf-android-*.json`.

| Measure | 1080p @320 dpi | 720p @213 dpi | How |
|---|---|---|---|
| First frame (5 cold launches) | 167–226 ms | 186–210 ms | `am start -W -S` TotalTime |
| First album focused | 613–660 ms | 594–650 ms | the app's `[app] first focus` log line, against the device clock at launch |
| Holding Right on a Home rail (9 presses, the rail's length) | p50 16, p95 32, p99 32 ms; 23% janky of 39 frames | p50 16, p95 16, p99 16 ms; 12% janky of 58 | `dumpsys gfxinfo` |
| Holding Down in a 646-photo album (40 presses) | p50 20, p95 31, p99 36 ms; 5% janky of 162 | p50 16, p95 32, p99 32 ms; 13% janky of 134 | `dumpsys gfxinfo` |
| Memory: Home / album open / after the hold | 110 / 134 / 152 MB | 111 / 133 / 148 MB | `dumpsys meminfo`, TOTAL PSS |

With so few frames, "janky %" moves a lot between runs; the percentiles are the budget measure.

### Web: Chrome 155 on the development machine (production build)

Headless, software rendering (`--disable-gpu`), API answers replayed from `qa/fixtures/unsplash.json` (no network time), the 2,000-photo album generated. "CPU 4× slower" is Chrome's CPU throttling at 1080p: a rough stand-in for a TV processor, not a measurement of one. Raw results: `qa/results/perf-web-*.json`.

| Measure | 1080p | 720p | 4K | 1080p, CPU 4× slower |
|---|---|---|---|---|
| First paint, cold / warm | 144 / 56–76 ms | 160 / 56–64 ms | 176 / 68–100 ms | 424 / 204–248 ms |
| First album focused, cold / warm | 205 / 44–59 ms | 216 / 47–60 ms | 227 / 44–67 ms | 594 / 195–239 ms |
| Key to focus (press to the next frame after focus moved), p50 / p95 | rail 7 / 16, grid 8 / 16 ms | 9 / 14, 9 / 16 | 7 / 15, 9 / 16 | 6 / 15, 4 / 16 |
| Holding Right on a rail (9 presses), frame p50 / p95 / p99 | 17 / 17 / 17 ms | 17 / 17 / 17 | 17 / 17 / 17 | 17 / 17 / 33; 2% missed |
| Holding Down in an album (60 presses) | 17 / 17 / 17 ms; 60 of 60 moved | 17 / 17 / 17 | 17 / 17 / 17 | **17 / 67 / 83; 23% missed**, 60 of 60 moved |
| 2,000-photo album, Down held to the end | all reached, 400 presses, 24 s; p99 17 | 23 s; p99 17 | 24 s; p99 33, 1% missed | 31 s; p99 33, 5% missed |
| JS heap: Home / album open / after 180 rows | 17 / 16 / 62 MB | 21 / 16 / 66 MB | 21 / 14 / 68 MB | 19 / 19 / 68 MB |
| DOM nodes after 180 rows | 12,329 | 13,297 | 13,902 | 13,390 |

A frame over 25 ms missed a 60 Hz vsync. The JS heap leaves out decoded images, so it can't be compared with Android's PSS. Key to focus ends at the start of the frame that draws the move, not at the pixels on the TV.

### LG webOS 22 TV (production build)

LG 50UQ75006LG, webOS 22 (SDK 7.6.0, firmware 04.60.91), engine Chrome/87.0.4280.88; 1920×1080 CSS pixels at device pixel ratio 2. The `.ipk` from `scripts/tv/lg.sh install`, measured by `scripts/perf/web.mjs --devtools` through `ares-inspect`: key presses come over DevTools, not the remote, and DevTools stays attached during the run. API answers replayed from the fixtures (photos load from Unsplash over the TV's network). Raw results: `qa/results/perf-web-lg-webos22.json`.

| Measure | Result |
|---|---|
| First paint, cold / warm | 1,072 / 524–903 ms |
| First album focused, cold / warm | 1,439 / 481–871 ms |
| Key to focus, p50 / p95 | rail 4 / 15, grid 7 / 15 ms; every press moved focus |
| Holding Right on a rail (9 presses), frame p50 / p95 / p99 | 17 / 133 / 267 ms; 27% missed; 9 of 9 moved |
| Holding Down in an album (60 presses) | **117 / 300 / 350 ms; 96% missed**; 60 of 60 moved |
| 2,000-photo album, Down held to the end | all reached, 400 presses, 74 s; p50 50, p95 150, p99 233; 64% missed |
| JS heap: Home / album open / after 180 rows | 10 / 12.5 / 15.2 MB |
| DOM nodes after 180 rows | 3,474 |

### Findings

1. **Held arrows on the LG webOS 22 TV.** Holding Down in an album runs at p50 117, p95 300, p99 350 ms per frame (budget 33 / 50): almost every frame misses a vsync. A Home rail is over too (p95 133, p99 267). Focus still moves once per press and a single press shows in 15 ms (p95), so it reads as a stuttering scroll, not lost presses. The CPU 4× stand-in (grid p95 67, rail within budget) understated it. Cause not profiled yet.
2. **Cold start on the TV.** First paint 1.07 s against a 1.0 s budget; the first album is focused at 1.44 s (budget 3.0 s).
3. **DOM size after a long scroll.** 12–14 thousand DOM nodes after 180 rows in desktop Chrome: the grid's 7-screen render window still leaves a large page for a TV browser. The TV had 3,474 at the same point.

## Earlier measurements (2026-10-26, Android release build, emulator at 320 dpi)

| Measure | Result |
|---|---|
| Holding Right on the Home rail (30 presses, before rails were cut to 10 albums) | p50 18, p95 32, p99 38 ms, 7% janky |
| Holding Down in the 646-photo album (60 presses) | p50 19, p95 23, p99 32 ms, 3% janky |
| Viewer filmstrip, 20 presses 50 ms apart (debug build) | never skips or doubles; 11–15 of 20 presses moved: re-measure in release |
| Memory after ~180 rows | 185 MB |
| Two-hour slideshow (3 s per photo) | **inconclusive, likely failing**: 136 → 353 MB in the first 34 minutes, in steps; native heap 73 → 203 MB |

## Changes made to meet the budget

- Album grid: rendered window cut from 21 screens to 7, next page fetched three screens ahead, and no scroll animation while an arrow is held. On the 2,000-photo album this took the web traversal from 57 s to 19 s and p95 frame time from 67 ms to 33 ms.
- Viewer filmstrip opens at the current photo instead of rendering every photo before it.
- No scroll animation on any key press (lists and the viewer filmstrip jump): felt as lag on the emulator, 2026-10-27. Not re-measured.
- Home hero waits for focus to rest (500 ms) before loading an album's full-size cover, and covers are no longer all prefetched.
- Home rails: ten albums each, all rendered; about two screens of rails mounted (`windowSize` 3).
- Slideshow keeps the screen on while playing (`KeepAwakeModule.kt`).

## Open

1. **Slideshow memory.** The 2026-10-26 soak was interrupted (app left the foreground at minute 35, emulator rebooted at minute ~82). Re-run it uninterrupted, sampling every 47 s and checking two screenshots 4 s apart for movement; if the climb repeats, find what holds native memory. `scripts/perf/web.mjs --soak 120` runs the web equivalent.
2. **Held arrows on the LG TV** (finding 1): profile the grid and a rail while an arrow is held (`scripts/tv/lg.sh inspect`, Performance panel), fix, re-measure.
3. **Cold first paint on the LG TV** (finding 2), 70 ms over budget.
4. **Key-to-focus latency on Android**, and everything above on the real weakest device, in a release build.
5. **The columns marked —**, with what each needs (above).

## How to measure

```sh
# Android: release build on the device, then
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86
adb install -r app/build/outputs/apk/release/app-release.apk
node scripts/perf/android.mjs --serial emulator-5554 --out qa/results/perf-android-1080p.json
# 720p: adb shell wm size 1280x720 && adb shell wm density 213, run again, then wm size/density reset
# Reinstall the debug build afterwards (npm run android)

# Web: a production build served statically
npx webpack --mode production --output-path /tmp/web-prod && (cd /tmp/web-prod && python3 -m http.server 8091)
node scripts/perf/web.mjs --url http://localhost:8091 --size 1920x1080 --out qa/results/perf-web-1080p.json
node scripts/perf/web.mjs --url http://localhost:8091 --cpu 4      # slow-CPU stand-in
node scripts/perf/web.mjs --url http://localhost:8091 --chrome /path/to/chromium-87/chrome   # webOS 22 engine

# LG webOS TV (paired with scripts/tv/lg.sh setup <TV_IP>)
scripts/tv/lg.sh install
ares-inspect --device MyLGTV --app com.tvphotogallery     # prints http://localhost:<port>/devtools/...; leave it running
node scripts/perf/web.mjs --devtools http://localhost:<port> \
  --url file:///media/developer/apps/usr/palm/applications/com.tvphotogallery/index.html \
  --out qa/results/perf-web-lg-webos22.json
```

- The Android runner uses the live API: about 15 requests per run, of 50 an hour.
- Frames on Android: `dumpsys gfxinfo` reset, then `input keyevent --delay 50` with the key repeated. Memory: `dumpsys meminfo`, TOTAL PSS.
- Startup to first focus relies on the `[app] first focus on <id> after <n> ms` log line, which TVs in the field log too.
