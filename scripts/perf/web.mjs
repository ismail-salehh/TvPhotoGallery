// Web performance: node scripts/perf/web.mjs --url <production build>
//   [--chrome path] [--size 1920x1080] [--cpu 4] [--soak minutes]
//   [--out results.json]
// Measures the docs/PERFORMANCE.md budget items in a headless Chrome, API from
// the QA fixtures plus a generated 2,000-photo album. --cpu slows the CPU.
import { readFileSync, writeFileSync } from 'node:fs';

import { openChrome, parseArgs, sleep } from '../qa/chrome.mjs';

const args = parseArgs(process.argv.slice(2));
const base = args.url ?? 'http://localhost:8091';
const [width, height] = (args.size ?? '1920x1080').split('x').map(Number);
const cpu = Number(args.cpu ?? 1);
const BIG = 'perf-2000';
const BIG_SIZE = 2000;

// Real photos from the fixtures, reused under new ids for the big album
const fixtures = JSON.parse(
  readFileSync(new URL('../../qa/fixtures/unsplash.json', import.meta.url)),
);
const samples = Object.entries(fixtures)
  .filter(([key]) => /^\/collections\/[^/]+\/photos/.test(key))
  .flatMap(([, { body }]) => JSON.parse(body));
const generate = key => {
  if (key.startsWith(`/collections/${BIG}/photos`)) {
    const q = new URLSearchParams(key.split('?')[1]);
    const page = Number(q.get('page'));
    const per = Number(q.get('per_page'));
    const photos = [];
    for (let i = (page - 1) * per; i < Math.min(page * per, BIG_SIZE); i++) {
      photos.push({ ...samples[i % samples.length], id: `big${i}` });
    }
    return { total: String(BIG_SIZE), body: JSON.stringify(photos) };
  }
  if (key.startsWith(`/collections/${BIG}`)) {
    return {
      total: '0',
      body: JSON.stringify({
        id: BIG,
        title: '2,000 photos',
        description: null,
        total_photos: BIG_SIZE,
        cover_photo: samples[0],
      }),
    };
  }
  return undefined;
};

const chrome = await openChrome({
  chrome: args.chrome,
  width,
  height,
  generate,
});
const { send, evaluate, press } = chrome;
if (cpu > 1) {
  await send('Emulation.setCPUThrottlingRate', { rate: cpu });
}
await send('Performance.enable');

// In every page: frame times, key presses, focus moves, first album focus
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const p = window.__perf = { frames: [], keys: [], moves: [], firstAlbum: null };
    const tick = t => { p.frames.push(t); if (p.frames.length > 20000) p.frames.splice(0, 10000); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    addEventListener('keydown', e => p.keys.push(performance.now()), true);
    addEventListener('focusin', e => {
      const el = e.target.closest && e.target.closest('[data-testid]');
      const id = el ? el.dataset.testid : null;
      const at = performance.now();
      if (!p.firstAlbum && id && id.startsWith('album-card-')) p.firstAlbum = at;
      // The frame that shows the move starts at the next animation frame
      requestAnimationFrame(frame => p.moves.push({ id, at, frame }));
    }, true);
  })()`,
});

const pct = (values, q) => {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))],
  );
};
const stats = values => ({
  n: values.length,
  p50: pct(values, 0.5),
  p95: pct(values, 0.95),
  p99: pct(values, 0.99),
});
const focusedId = () =>
  evaluate(
    `(document.activeElement && document.activeElement.closest('[data-testid]') || {dataset:{}}).dataset.testid || null`,
  );
async function waitFor(test, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await test()) {
      return true;
    }
    await sleep(100);
  }
  return false;
}
const heap = async () => {
  const { metrics } = await send('Performance.getMetrics');
  const get = name => metrics.find(m => m.name === name)?.value ?? 0;
  return {
    jsHeapMB: Math.round(get('JSHeapUsedSize') / 1e5) / 10,
    domNodes: get('Nodes'),
  };
};

let loads = 0;
async function open(hash = '') {
  await send('Page.navigate', { url: `${base}/?perf=${++loads}${hash}` });
  await waitFor(async () => (await focusedId()) !== null);
}

// Presses `key` `count` times, `gapMs` apart; frame intervals meanwhile
async function hold(key, count, gapMs) {
  await evaluate(
    '__perf.frames.length = 0; __perf.moves.length = 0; __perf.keys.length = 0',
  );
  for (let i = 0; i < count; i++) {
    const next = Date.now() + gapMs;
    await press(key);
    await sleep(Math.max(0, next - Date.now()));
  }
  await sleep(600);
  const { frames, moves, keys } = await evaluate('__perf');
  const intervals = frames.slice(1).map((t, i) => t - frames[i]);
  return {
    presses: count,
    moves: moves.length,
    frames: stats(intervals),
    // A frame longer than 25 ms missed at least one 60 Hz vsync
    missedFrames: `${Math.round(
      (100 * intervals.filter(d => d > 25).length) / intervals.length,
    )}%`,
    over33ms: `${Math.round(
      (100 * intervals.filter(d => d > 33.4).length) / intervals.length,
    )}%`,
    keys: keys.length,
  };
}

// Press to the first frame after focus moved, one press at a time
async function keyToFocus(key, count) {
  const delays = [];
  for (let i = 0; i < count; i++) {
    await evaluate('__perf.moves.length = 0; __perf.keys.length = 0');
    await press(key);
    await sleep(350);
    const { moves, keys } = await evaluate('__perf');
    if (moves.length && keys.length) {
      delays.push(moves[0].frame - keys[0]);
    }
  }
  return { ...stats(delays), movedOf: `${delays.length}/${count}` };
}

const missed = intervals =>
  `${Math.round(
    (100 * intervals.filter(d => d > 25).length) / intervals.length,
  )}%`;

const result = {
  target: 'web',
  browser: chrome.browser,
  size: `${width}x${height}`,
  cpuSlowdown: cpu,
  at: new Date().toISOString(),
};

// Startup: the first load has an empty HTTP cache
result.startup = [];
for (let run = 0; run < 5; run++) {
  await open();
  await waitFor(() => evaluate('!!__perf.firstAlbum'));
  result.startup.push(
    await evaluate(`({
      firstPaint: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || -1),
      firstAlbumFocused: Math.round(__perf.firstAlbum),
    })`),
  );
}
result.memoryHome = await heap();

// A Home rail holds 10 albums: 9 moves from the first to the last
result.keyToFocusRail = await keyToFocus('right', 9);
await open();
result.holdRight = await hold('right', 9, 50);

await open(`#/album/${BIG}`);
await waitFor(async () => (await focusedId())?.startsWith('photo-card-'));
result.memoryAlbumOpen = await heap();
result.keyToFocusGrid = await keyToFocus('down', 20);
await open(`#/album/${BIG}`);
await waitFor(async () => (await focusedId())?.startsWith('photo-card-'));
result.holdDown = await hold('down', 60, 50);

// Down held from the first photo until the last row of the 2,000
await open(`#/album/${BIG}`);
await waitFor(async () => (await focusedId())?.startsWith('photo-card-'));
const started = Date.now();
let presses = 0;
let last = null;
let afterRows = null;
await evaluate('__perf.frames.length = 0');
while (Date.now() - started < 240000) {
  await press('down');
  presses += 1;
  await sleep(50);
  if (presses === 180) {
    afterRows = await heap();
  }
  if (presses % 20 === 0) {
    last = await focusedId();
    const index = Number(/big(\d+)/.exec(last ?? '')?.[1] ?? -1);
    if (index >= BIG_SIZE - 5) {
      break;
    }
  }
}
const { frames } = await evaluate('__perf');
const intervals = frames.slice(1).map((t, i) => t - frames[i]);
result.bigAlbum = {
  lastFocused: last,
  reachedEnd: Number(/big(\d+)/.exec(last ?? '')?.[1] ?? -1) >= BIG_SIZE - 5,
  seconds: Math.round((Date.now() - started) / 1000),
  presses,
  frames: stats(intervals),
  missedFrames: missed(intervals),
};
result.memoryAfter180Rows = afterRows;

if (args.soak) {
  // Slideshow of the big album at 3 s, JS heap once a minute
  await evaluate(
    `localStorage.setItem('settings', JSON.stringify({ slideshowIntervalMs: 3000, language: 'en' }))`,
  );
  await open(`#/album/${BIG}`);
  await waitFor(async () => (await focusedId())?.startsWith('photo-card-'));
  // Header: Back, Search, Slideshow
  await press('up');
  await sleep(500);
  await press('right');
  await sleep(500);
  await press('right');
  await sleep(500);
  await press('select');
  result.soak = [];
  for (let minute = 0; minute <= Number(args.soak); minute++) {
    result.soak.push({ minute, ...(await heap()), slide: await focusedId() });
    console.log(`soak ${minute} min`, JSON.stringify(result.soak.at(-1)));
    await sleep(60000);
  }
}

result.missingFixtures = chrome.missing();
console.log(JSON.stringify(result, null, 1));
if (args.out) {
  writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
}
await chrome.close();
