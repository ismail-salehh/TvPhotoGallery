// Web target: node scripts/qa/web.mjs [--url http://localhost:8080]
//   [--chrome /path/to/chrome | --devtools http://localhost:<port>]
//   [--size 1920x1080] [--lang en,ar]
//   [--only checks|walks] [--out results.json] [--record] [--console]
// API answers are replayed from qa/fixtures/unsplash.json; --record
// refreshes them live. The keyboard keys stand in for the remote.
import { readFileSync, writeFileSync } from 'node:fs';

import { openChrome, parseArgs, sleep } from './chrome.mjs';
import { pageUrl, runAll } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const base = args.url ?? 'http://localhost:8080';
const [width, height] = (args.size ?? '1920x1080').split('x').map(Number);
const languages = (args.lang ?? 'en,ar').split(',');
const spec = JSON.parse(
  readFileSync(new URL('../../qa/key-sequences.json', import.meta.url)),
);

const chrome = await openChrome({
  chrome: args.chrome,
  devtools: args.devtools,
  width,
  height,
  record: args.record,
  pageConsole: args.console,
});
const { send, evaluate } = chrome;

const FOCUS = `(() => {
  const el = document.activeElement && document.activeElement.closest('[data-testid]');
  if (!el || el === document.body) return null;
  const r = el.getBoundingClientRect();
  return { id: el.dataset.testid, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
})()`;

let loads = 0;
const driver = {
  async setLanguage(language) {
    await send('Page.navigate', { url: base });
    await sleep(1500);
    await evaluate(
      `localStorage.setItem('settings', JSON.stringify({ slideshowIntervalMs: 5000, language: '${language}' }))`,
    );
  },
  // A fresh page each time: a query that changes forces a real load
  async open(start, links) {
    const link = start.startsWith('link:') ? `#/${links[start.slice(5)]}` : '';
    await send('Page.navigate', { url: pageUrl(base, `qa=${++loads}${link}`) });
    await sleep(2500);
  },
  press: chrome.press,
  // Waits `wait` ms, then until two reads 150 ms apart agree
  async focus(wait = 0) {
    await sleep(Math.max(wait, 350));
    let last = await evaluate(FOCUS);
    for (let i = 0; i < 20; i++) {
      await sleep(150);
      const now = await evaluate(FOCUS);
      if (now?.id === last?.id) {
        return now;
      }
      last = now;
    }
    return last;
  },
  viewport: async () => ({ width, height }),
  async focusables() {
    // While a dialog is open only its items count, as only they can be reached
    return evaluate(`[...(([...document.querySelectorAll('[aria-modal="true"]')].pop()) || document).querySelectorAll('[data-testid][tabindex="0"]')]
      .filter(el => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'))
      .map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.testid, rect: { x: r.x, y: r.y, width: r.width, height: r.height } }; })
      .filter(f => f.rect.width > 0 && f.rect.height > 0)`);
  },
};

const results = await runAll(driver, spec, { languages, only: args.only });
const summary = {
  target: 'web',
  browser: chrome.browser,
  size: `${width}x${height}`,
  at: new Date().toISOString(),
  passed: results.filter(r => r.ok).length,
  failed: results.filter(r => !r.ok).length,
  missingFixtures: chrome.missing(),
  results,
};
if (args.out) {
  writeFileSync(args.out, `${JSON.stringify(summary, null, 2)}\n`);
}
console.log(
  `${summary.passed} passed, ${summary.failed} failed (${chrome.browser}, ${summary.size})`,
);
await chrome.close();
process.exit(summary.failed ? 1 : 0);
