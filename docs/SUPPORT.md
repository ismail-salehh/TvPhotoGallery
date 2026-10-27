# Support policy and test matrix

## What is supported

| Platform | Supported | Oldest | How it runs |
|---|---|---|---|
| Android TV / Google TV | Yes | Android 7.0 (API 24, `minSdkVersion`) | Native app (react-native-tvos) |
| LG webOS TV | Yes | webOS 22 (Chromium 87): the oldest web engine | Web build |
| Desktop browsers | Yes, for development and demos | Chrome/Edge 87+, current Firefox and Safari | Web build |
| Apple TV (tvOS) | Planned, not buildable yet | — | The Xcode project has only an iOS target (`SDKROOT = iphoneos`); a tvOS target must be added and built on a Mac |
| Phones and tablets | No | — | The UI is designed for a remote and a 10-foot screen |

**Screens:** 16:9 at 720p, 1080p and 4K. The app lays out on a 1920×1080 canvas scaled to the screen, so all three show the same layout; other shapes are letterboxed into that canvas.

**Languages:** English (LTR) and Arabic (RTL), switchable live in Settings.

**Input:** a D-pad remote (arrows, OK/select, Back). On the web the keyboard stands in for it: arrows, Enter, Escape or Backspace.

## Device tiers

| Tier | Typical device | Screen | What it bounds |
|---|---|---|---|
| Low | Older Android TV sticks, 1–1.5 GB RAM | 720p | Memory: lists are virtualised, images sized for 1080p (`w=1920`) |
| Mid | Current Android/Google TV, LG webOS 22+ | 1080p | The reference layout |
| High | 4K TVs and boxes | 2160p | Same layout, scaled; images still 1080p |

Performance budget and measurements for each platform: `docs/PERFORMANCE.md`.

## Test matrix

Every row runs the written key-sequence checks (`qa/key-sequences.json`) and the focus walk of every screen, in English and Arabic, unless the row says otherwise. Results are in `qa/results/`.

| Target | Engine / OS | Screen | Checks | Focus walk | Status |
|---|---|---|---|---|---|
| Web, desktop Chrome | Chromium (current) | 1280×720 | ✓ | ✓ | see results |
| Web, desktop Chrome | Chromium (current) | 1920×1080 | ✓ | ✓ | see results |
| Web, desktop Chrome | Chromium (current) | 3840×2160 | ✓ | ✓ | see results |
| Web, oldest engine | Chromium 87 (webOS 22) | 1920×1080 | ✓ | ✓ | **partly run** (2026-10-27): Chromium 87.0.4272.0 starts the production build with no engine errors and focuses the first album; the checks and walks are not run yet (see `docs/PERFORMANCE.md`). Static check of the bundle, dependencies included: no syntax or built-in newer than Chrome 87 |
| Android TV emulator | Android 16 (API 36) | 1280×720 @213 dpi | ✓ | — | see results |
| Android TV emulator | Android 16 (API 36) | 1920×1080 @320 dpi | ✓ | ✓ | see results |
| Android TV emulator | Android 16 (API 36) | 3840×2160 @640 dpi | ✓ | — | see results |
| Android TV, oldest OS | Android 7.0 (API 24) | 1080p | ✓ | ✓ | **not run**: needs an API 24 TV image or device |
| Real TV hardware | Any | Any | ✓ | ✓ | **not run**: no device attached |
| Apple TV | tvOS | — | — | — | not buildable yet (see above) |

The Android walk runs at 1080p only: at about 2.5 s per key on the emulator it takes ~25 minutes per language. The canvas makes 720p and 4K the same layout, so the checks at those sizes plus their screenshots cover the difference.

## How to run

```sh
npm run web                                                 # or any build serving the web app
node scripts/qa/web.mjs --url http://localhost:8080 --size 1920x1080 --out qa/results/web-1080p.json
node scripts/qa/web.mjs --chrome /path/to/chromium-87/chrome   # the oldest engine row

npm run android                                             # a debug build on the device
node scripts/qa/android.mjs --serial emulator-5554 --out qa/results/android-1080p.json
node scripts/qa/android.mjs --size 1280x720 --density 213 --only checks --shots qa/results/android-720p
node scripts/qa/android.mjs --size 3840x2160 --density 640 --only checks --shots qa/results/android-4k
```

- The web runner replays recorded Unsplash answers (`qa/fixtures/unsplash.json`): repeatable, and no API quota. `--record` refreshes them.
- The Android runner uses the live API (about 20 requests per language, of 50 an hour) and stops before pressing any key if the app is not in front. It restores the screen size and density when it ends.
- `npm test` includes tests that prove the walk finds what it is meant to find (unreachable items, lost focus, wrong-way and diagonal moves, off-screen focus).

## When something fails on a TV you can't reach

Every launch logs `[app] TvPhotoGallery <version> on <device>, <OS>`. Every failure is a one-line `[report] {…}` with the app version, the device and OS, the error and its stack, the last 30 key presses (held keys counted, typed characters never logged), and the last 10 focused items:

- **JavaScript errors** (uncaught, unhandled promise rejections, crashes an error boundary contained): reported when they happen.
- **Native crashes, freezes and the OS killing the app:** JavaScript can't run then, so key presses are saved every second; the next launch reports the session as `unexpected-exit` with them.

Where to read them:
- **Android TV:** `adb logcat -s ReactNativeJS | grep -E '\[(app|report)\]'` (adb over the network works on TVs in developer mode).
- **webOS:** the remote inspector (`ares-inspect`), console.
- **Anywhere:** set `REPORT_URL` in `src/diagnostics/config.ts` to POST each report as JSON. Until a server exists, the last 5 reports stay on the device and are sent once one is set.
