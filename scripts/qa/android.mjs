// Android TV target: node scripts/qa/android.mjs --serial emulator-5554
//   [--size 1280x720 --density 213] [--lang en,ar] [--only checks|walks]
//   [--out results.json] [--shots dir]
// Presses remote keys with adb and reads focus from uiautomator (the
// focusables' testIDs are their resource-ids). Stops if the app is ever
// not in front, so no key reaches another app.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runAll } from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) {
      const value = all[i + 1];
      pairs.push([
        arg.slice(2),
        value && !value.startsWith('--') ? value : true,
      ]);
    }
    return pairs;
  }, []),
);
const serial = args.serial ?? 'emulator-5554';
const languages = (args.lang ?? 'en,ar').split(',');
const spec = JSON.parse(
  readFileSync(new URL('../../qa/key-sequences.json', import.meta.url)),
);
const PACKAGE = 'com.tvphotogallery';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = (...cmd) =>
  new Promise((resolve, reject) =>
    execFile(
      'adb',
      ['-s', serial, ...cmd],
      { timeout: 30000, maxBuffer: 8e6 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    ),
  );

const KEYCODES = {
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  select: 'KEYCODE_DPAD_CENTER',
  back: 'KEYCODE_BACK',
};

async function assertInFront() {
  const activities = await adb('shell', 'dumpsys', 'activity', 'activities');
  const top = activities
    .split('\n')
    .find(line => line.includes('topResumedActivity'));
  if (!top?.includes(PACKAGE)) {
    throw new Error(
      `The app is not in front (${top?.trim()}): stopping before any key`,
    );
  }
}

const parseBounds = b => {
  const [x1, y1, x2, y2] = b.match(/\d+/g).map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

async function dump() {
  const xml = await adb('exec-out', 'uiautomator', 'dump', '/dev/tty');
  return [...xml.matchAll(/<node [^>]*>/g)].map(([node]) => ({
    id: /resource-id="([^"]*)"/.exec(node)?.[1] ?? '',
    focused: node.includes('focused="true"'),
    focusable: node.includes('focusable="true"'),
    rect: parseBounds(/bounds="([^"]*)"/.exec(node)[1]),
  }));
}

let screen;
async function viewport() {
  if (!screen) {
    const [, w, h] = /(\d+)x(\d+)\s*$/.exec(
      (await adb('shell', 'wm', 'size')).trim(),
    );
    screen = { width: Number(w), height: Number(h) };
  }
  return screen;
}

const driver = {
  async open(start, links) {
    // Leaving the app first closes its session cleanly (no crash report)
    const inFront = await assertInFront().then(
      () => true,
      () => false,
    );
    if (inFront) {
      await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
    }
    await sleep(800);
    await adb('shell', 'am', 'force-stop', PACKAGE);
    if (start.startsWith('link:')) {
      await adb(
        'shell',
        'am',
        'start',
        '-W',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        `tvphotogallery://${links[start.slice(5)]}`,
        PACKAGE,
      );
    } else {
      await adb('shell', 'am', 'start', '-W', '-n', `${PACKAGE}/.MainActivity`);
    }
    // Debug builds load JavaScript from Metro: give it time
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      if ((await driver.focus())?.id) {
        return;
      }
    }
  },
  async press(key) {
    await assertInFront();
    await adb('shell', 'input', 'keyevent', KEYCODES[key]);
  },
  // Waits `wait` ms, then until two dumps agree on a named focused item
  async focus(wait = 0) {
    await sleep(Math.max(wait, 300));
    // uiautomator waits for an idle UI; a playing slideshow rarely is, so
    // empty reads are retried for a while
    let last;
    for (let i = 0; i < 10; i++) {
      const focused = (await dump()).find(n => n.focused);
      const now = focused?.id ? { id: focused.id, rect: focused.rect } : null;
      if (now && now.id === last?.id) {
        return now;
      }
      if (i >= 3 && last && !now) {
        break;
      }
      last = now ?? last;
      await sleep(250);
    }
    return last ?? null;
  },
  viewport,
  async focusables() {
    return (await dump())
      .filter(n => n.focusable && n.id && n.rect.width > 0 && n.rect.height > 0)
      .map(({ id, rect }) => ({ id, rect }));
  },
  async setLanguage(language) {
    await driver.open('home', spec.links);
    await driver.press('up');
    for (const key of ['right', 'right', 'left', 'left', 'left']) {
      if ((await driver.focus())?.id === 'home-settings') {
        break;
      }
      await driver.press(key);
    }
    await driver.press('select');
    await driver.focus(1500);
    await driver.press('down');
    for (const key of ['right', 'left', 'left']) {
      if ((await driver.focus())?.id === `settings-language-${language}`) {
        break;
      }
      await driver.press(key);
    }
    if ((await driver.focus())?.id !== `settings-language-${language}`) {
      throw new Error(`Could not reach the ${language} option in Settings`);
    }
    await driver.press('select');
    await driver.focus(1500);
  },
};

const sizeSet = args.size && args.size !== true;
if (sizeSet) {
  await adb('shell', 'wm', 'size', args.size);
  if (args.density) {
    await adb('shell', 'wm', 'density', args.density);
  }
  await sleep(3000);
}
const device = (await adb('shell', 'getprop', 'ro.product.model')).trim();
const release = (
  await adb('shell', 'getprop', 'ro.build.version.release')
).trim();
let results = [];
let error = null;
try {
  results = await runAll(driver, spec, { languages, only: args.only });
  if (args.shots) {
    mkdirSync(args.shots, { recursive: true });
    for (const walk of spec.walks) {
      for (const language of languages.slice(-1)) {
        await driver.open(walk.start, spec.links);
        for (const key of walk.setup ?? []) {
          await driver.press(key);
          await driver.focus(900);
        }
        await driver.focus(walk.settle ?? 1500);
        const png = await new Promise((resolve, reject) =>
          execFile(
            'adb',
            ['-s', serial, 'exec-out', 'screencap', '-p'],
            { encoding: 'buffer', maxBuffer: 6e7 },
            (e, out) => (e ? reject(e) : resolve(out)),
          ),
        );
        writeFileSync(
          join(args.shots, `${walk.name.replace(/\W+/g, '-')}-${language}.png`),
          png,
        );
      }
    }
  }
} catch (e) {
  error = e.message;
  console.log(`ABORTED: ${error}`);
} finally {
  if (sizeSet) {
    await adb('shell', 'wm', 'size', 'reset');
    await adb('shell', 'wm', 'density', 'reset');
  }
}
const summary = {
  target: 'android',
  device: `${device}, Android ${release}`,
  size: sizeSet
    ? `${args.size} @${args.density ?? 'default'}dpi`
    : (await adb('shell', 'wm', 'size')).trim(),
  at: new Date().toISOString(),
  passed: results.filter(r => r.ok).length,
  failed: results.filter(r => !r.ok).length,
  aborted: error,
  results,
};
if (args.out) {
  writeFileSync(args.out, `${JSON.stringify(summary, null, 2)}\n`);
}
console.log(
  `${summary.passed} passed, ${summary.failed} failed (${summary.device}, ${summary.size})`,
);
process.exit(summary.failed || error ? 1 : 0);
