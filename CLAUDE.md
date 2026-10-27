# TvPhotoGallery

React Native TV app (react-native-tvos 0.88) for Android TV / tvOS, plus a web build (react-native-web + webpack). Browses Unsplash collections as albums: Home → Album → Photo viewer / Slideshow, plus Search and Settings.

## Working rules — not negotiable, and they apply to agents too

**NO ESSAYS.** Every docstring and every run of consecutive comments is at most THREE short lines. Keep what names a rule id, records a measurement, or explains a refusal; cut restated history and anything the code already says. Nothing in this repo enforces this yet; much existing code predates the rule and runs longer, so bring a block under the cap when you touch it. Never reword a raised message or an assertion string: those are behaviour, not prose.

**FULL UNIT TESTING, FOUR LEVELS, EVERY CHANGE.** Function (the unit alone), functional (its behaviour through its own door), data integrity (what is actually recorded, and what a caller may NOT write), and e2e (a real request against real state). 100% statement AND branch, measured; an unreachable branch gets REMOVED, never pragma'd.

**MUTATION-CHECK EVERY TEST.** Break the thing it covers, confirm it goes red, restore. A test that passes against broken code is worse than none. Coverage is not evidence of this: a module can reach 100% branch while the live failure type is never exercised at all, and a gate can report 100% because its failing arms are a ternary and a comprehension filter.

**A PROBE THAT CANNOT FIND IS NOT A MEASUREMENT.** The same rule as the mutation one, applied to measuring instead of breaking. Before a zero, an empty set or an absent member is reported as a finding, show the probe capable of a non-zero on a case known to have one. Measured cost of skipping this: `isinstance(step, dict)` against a BlueprintStep, and `bp.feature` against a field named `feature_id`, each silently returned nothing and each was written up as a defect in the product.

**A REMOVAL IS NOT DONE UNTIL WHAT IT ORPHANED IS GONE TOO.** Deleting a caller is half the change: the module it was the last importer of is now dead, and so are the assets that module was the last importer of. Walk the chain to a fixed point, in the same change.

**USE MULTIPLE AGENTS FOR INDEPENDENT WORK — NOT BY DEFAULT.** A track earns an agent when it owns files no other track touches AND is large enough to repay its brief. Below that, do it yourself: serial is cheaper than a brief, a report, and a reconcile.

## Commands

- `npm start` (Metro), `npm run android`, `npm run web` (webpack dev server on :8080)
- `npx tsc --noEmit`, `npm run lint`, `npx prettier --check src`
- Key-sequence checks and focus walks (`qa/key-sequences.json`): `node scripts/qa/web.mjs --url <dev server>` and `node scripts/qa/android.mjs --serial <device>`. Support policy and test matrix: `docs/SUPPORT.md`.
- Field diagnostics: logcat lines `[app]` (version, device) and `[report]` (errors with the last keys and focus); see `src/diagnostics/`.
- `npm test` runs the unit, functional and data-integrity tests (no network: `fetch` rejects). `npm run test:e2e` makes ~10 real Unsplash requests (50/hour per key).
- After a native dependency change, rebuild the APK (`npm run android`); a JS reload is not enough.
- Emulator can't reach Metro after a restart → `adb reverse tcp:8081 tcp:8081`. With more than one device attached, set `ANDROID_SERIAL`.

## Layout (src/)

- `api/` Unsplash client and transformers · `i18n/` en + ar (same keys) · `platform/` native vs `*.web.ts` (back button, D-pad navigation)
- `ui-kit/focus/` focus system: `FocusScreen` scopes, `Focusable`, focus memory/restore · `ui-kit/layout/` design canvas, safe margins, keep-focus-in-view
- `app/navigation/Router.tsx` stack + Back + exit dialog · `app/screens/` · `app/components/{common,album,photo,search,slideshow}` · `app/context/` · `app/hooks/`

## Things that are not obvious

- All sizes are pixels of a 1920×1080 canvas scaled to the window (`DesignCanvas`). Use `useCanvas()`, never `useWindowDimensions`; use `useScreenMargins()` for the 5% TV safe area. Real Android TVs report ~960×540 layout units at 720p, 1080p and 4K.
- The dev emulator has `wm density 160` overridden (physical 320). Check layout at the real density too: `adb shell wm density reset`.
- react-native-tvos wraps every FlatList's scroll view in an unstyled `TVFocusGuideView`, so a vertical list can't be sized by `flex` (it overflows the screen). Give it a measured height, as `PhotoGrid` does.
- Lists scroll focused items themselves (`useKeepFocusInView`: native `scrollsChildToFocus` off, web `data-managed-scroll`).
- Every Back goes through `BackHandlerProvider` (400 ms double-press guard); a native `Modal`'s `onRequestClose` must call `useBackDispatch()`, but not on web.
- Preferred focus only applies until the user first presses an arrow on a screen; after that nothing may take focus away.
- The live Unsplash album list changes and some collections return no photos: tests must pick albums by name, not position.
- Never send remote keys to the emulator without checking the app is in front (`dumpsys activity activities | grep topResumedActivity`); stray keys twice reached the TV launcher (once adding a favorite). Changing `wm density` sends the emulator back to the launcher.
- Offline on the emulator: airplane mode and `svc wifi/data disable` do NOT cut its network. Use `cmd connectivity set-chain3-enabled true` + `set-package-networking-enabled false com.tvphotogallery` (undo both). Blocked requests hang (15 s timeout), they don't fail fast.
- Android `fetch` has an HTTP disk cache: an album opened before can still load offline. Test offline states with a request never made before (e.g. a new search).
- Recovery: `ConnectivityProvider` bumps a retry signal when the connection returns or the app comes back to the foreground; `StatusView` (error/offline) and `PhotoImage` retry on it.
- Each screen, the Home hero, the Home rail, the album grid and search results sit in an `ErrorBoundary`.
- Home rails are the album list cut into tens (`RAIL_SIZE`): Unsplash can't group collections, and a themed search per rail would cost a request each. Search on Home finds albums (`/search/collections`); an album's Search finds its photos (`/search/photos?collections=<id>`).
- The Home hero changes only after focus rests 500 ms on an album, and keeps the last photo up until the next has loaded; covers are not prefetched (low-end TVs, webOS 22).
- `KeepAwakeModule.kt` (native, Android) keeps the screen on while a slideshow plays; tvOS has no implementation yet. Native changes need an APK rebuild.
- Release build: `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86`; it's signed with the debug key, so it installs over the debug app (reinstall debug with `npm run android` after). Budget and measurements by platform: `docs/PERFORMANCE.md` (`scripts/perf/`).
