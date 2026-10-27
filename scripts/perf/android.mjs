// Android performance: node scripts/perf/android.mjs --serial emulator-5554
//   [--album 1532093] [--out results.json]
// Run on a release build. Startup from `am start -W` and the app's
// "[app] first focus" log line, frames from gfxinfo, memory from meminfo.
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { parseArgs, sleep } from '../qa/chrome.mjs';

const args = parseArgs(process.argv.slice(2));
const serial = args.serial ?? 'emulator-5554';
// "Mirror, Mirror": 646 photos, enough to hold Down through many pages
const album = args.album ?? '1532093';
const PACKAGE = 'com.tvphotogallery';

const adb = (...cmd) =>
  new Promise((resolve, reject) =>
    execFile(
      'adb',
      ['-s', serial, ...cmd],
      { timeout: 60000, maxBuffer: 3e7 },
      (error, out) => (error ? reject(error) : resolve(out)),
    ),
  );

async function assertInFront() {
  const top = (await adb('shell', 'dumpsys', 'activity', 'activities'))
    .split('\n')
    .find(line => line.includes('topResumedActivity'));
  if (!top?.includes(PACKAGE)) {
    throw new Error(`The app is not in front (${top?.trim()})`);
  }
}

const deviceNow = async () =>
  Number((await adb('shell', 'date', '+%s%3N')).trim());

// Cold launch: TotalTime, and the device-clock time of the first focus
async function coldLaunch(link) {
  await adb('logcat', '-c');
  const before = await deviceNow();
  const am = await adb(
    'shell',
    'am',
    'start',
    '-W',
    '-S',
    ...(link
      ? [
          '-a',
          'android.intent.action.VIEW',
          '-d',
          `tvphotogallery://${link}`,
          PACKAGE,
        ]
      : ['-n', `${PACKAGE}/.MainActivity`]),
  );
  const totalTime = Number(/TotalTime: (\d+)/.exec(am)?.[1]);
  for (let i = 0; i < 40; i++) {
    const log = await adb(
      'logcat',
      '-d',
      '-v',
      'epoch',
      '-s',
      'ReactNativeJS:V',
    );
    const line = log.split('\n').find(l => l.includes('[app] first focus'));
    if (line) {
      const at = Math.round(Number(line.trim().split(/\s+/)[0]) * 1000);
      return {
        firstFrameMs: totalTime,
        firstFocusMs: at - before,
        on: /on (\S+)/.exec(line)[1],
      };
    }
    await sleep(250);
  }
  return { firstFrameMs: totalTime, firstFocusMs: null };
}

async function frames(key, count) {
  await assertInFront();
  await adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'reset');
  await adb(
    'shell',
    'input',
    'keyevent',
    '--delay',
    '50',
    ...Array(count).fill(key),
  );
  await sleep(1000);
  const info = await adb('shell', 'dumpsys', 'gfxinfo', PACKAGE);
  const read = re => re.exec(info)?.[1];
  return {
    presses: count,
    frames: Number(read(/Total frames rendered: (\d+)/)),
    janky: read(/Janky frames: \d+ \(([\d.]+%)\)/),
    p50: Number(read(/50th percentile: (\d+)ms/)),
    p95: Number(read(/95th percentile: (\d+)ms/)),
    p99: Number(read(/99th percentile: (\d+)ms/)),
  };
}

const pssMB = async () => {
  const info = await adb('shell', 'dumpsys', 'meminfo', PACKAGE);
  return Math.round(
    Number(
      /TOTAL PSS:\s+(\d+)/.exec(info)?.[1] ?? /TOTAL\s+(\d+)/.exec(info)?.[1],
    ) / 1024,
  );
};

const result = {
  target: 'android',
  device: `${(
    await adb('shell', 'getprop', 'ro.product.model')
  ).trim()}, Android ${(
    await adb('shell', 'getprop', 'ro.build.version.release')
  ).trim()}`,
  screen: `${(await adb('shell', 'wm', 'size')).trim().split('\n').pop()}, ${(
    await adb('shell', 'wm', 'density')
  )
    .trim()
    .split('\n')
    .pop()}`,
  build: (await adb('shell', 'dumpsys', 'package', PACKAGE)).includes(
    'DEBUGGABLE',
  )
    ? 'debug'
    : 'release',
  at: new Date().toISOString(),
};

result.startup = [];
for (let run = 0; run < 5; run++) {
  result.startup.push(await coldLaunch());
  await sleep(2000);
}
await sleep(3000);
result.memoryHome = await pssMB();
// A Home rail holds 10 albums: 9 moves from the first to the last
result.holdRight = await frames('KEYCODE_DPAD_RIGHT', 9);

await coldLaunch(`album/${album}`);
await sleep(5000);
result.memoryAlbumOpen = await pssMB();
result.holdDown = await frames('KEYCODE_DPAD_DOWN', 40);
await sleep(4000);
result.memoryAfterHold = await pssMB();

console.log(JSON.stringify(result, null, 1));
if (args.out) {
  writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
}
