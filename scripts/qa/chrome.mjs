// A headless Chrome driven over the DevTools protocol, shared by the QA
// and performance runners. Unsplash API answers come from the recorded
// fixtures (or `generate`), so runs are repeatable and spend no quota.
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURES = new URL('../../qa/fixtures/unsplash.json', import.meta.url);

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function parseArgs(argv) {
  return Object.fromEntries(
    argv.reduce((pairs, arg, i, all) => {
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
}

const KEYS = {
  up: ['ArrowUp', 38],
  down: ['ArrowDown', 40],
  left: ['ArrowLeft', 37],
  right: ['ArrowRight', 39],
  select: ['Enter', 13],
  back: ['Escape', 27],
};

// The key: path and query, without the access key the request carries
const fixtureKey = url => url.replace(/^https:\/\/api\.unsplash\.com/, '');
const cors = [
  { name: 'Access-Control-Allow-Origin', value: '*' },
  { name: 'Access-Control-Expose-Headers', value: 'X-Total' },
  { name: 'Content-Type', value: 'application/json' },
];

// `generate(key)` may answer a request no fixture holds: { total, body }.
// `devtools` (http://host:port) attaches to a running browser, e.g. a TV
// through `ares-inspect`, instead of starting one.
export async function openChrome({
  chrome = 'google-chrome',
  devtools,
  width,
  height,
  record = false,
  pageConsole = false,
  generate = () => undefined,
}) {
  const fixtures =
    !record && existsSync(FIXTURES) ? JSON.parse(readFileSync(FIXTURES)) : {};
  const recorded = {};
  let profile = null;
  let child = null;
  let endpoint = devtools;
  if (!devtools) {
    profile = mkdtempSync(join(tmpdir(), 'qa-chrome-'));
    const port = 9400 + Math.floor(Math.random() * 400);
    endpoint = `http://127.0.0.1:${port}`;
    child = spawn(
      chrome,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        `--user-data-dir=${profile}`,
        `--remote-debugging-port=${port}`,
        `--window-size=${width},${height}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    );
  }

  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try {
      targets = await (await fetch(`${endpoint}/json`)).json();
    } catch {
      await sleep(200);
    }
  }
  const socket = new WebSocket(
    targets.find(t => t.type === 'page').webSocketDebuggerUrl,
  );
  await new Promise(r => socket.addEventListener('open', r));
  let nextId = 0;
  const pending = new Map();
  const events = [];
  socket.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.method) {
      events.forEach(handler => handler(msg));
      return;
    }
    pending.get(msg.id)?.(msg.result);
    pending.delete(msg.id);
  });
  const send = (method, params = {}) =>
    new Promise(r => {
      const id = ++nextId;
      pending.set(id, r);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async expression =>
    (
      await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
    )?.result?.value;

  let missing = 0;
  if (record) {
    // Live requests, copied as they complete
    const seen = new Map();
    await send('Network.enable');
    events.push(async msg => {
      if (msg.method === 'Network.responseReceived') {
        const { requestId, response } = msg.params;
        if (
          response.url.startsWith('https://api.unsplash.com/') &&
          response.status === 200
        ) {
          const total =
            Object.entries(response.headers).find(
              ([k]) => k.toLowerCase() === 'x-total',
            )?.[1] ?? '0';
          seen.set(requestId, { key: fixtureKey(response.url), total });
        }
      } else if (
        msg.method === 'Network.loadingFinished' &&
        seen.has(msg.params.requestId)
      ) {
        const { key, total } = seen.get(msg.params.requestId);
        const body = await send('Network.getResponseBody', {
          requestId: msg.params.requestId,
        });
        if (body) {
          recorded[key] = {
            total,
            body: body.base64Encoded
              ? Buffer.from(body.body, 'base64').toString()
              : body.body,
          };
        }
      }
    });
  } else {
    await send('Fetch.enable', {
      patterns: [{ urlPattern: 'https://api.unsplash.com/*' }],
    });
    events.push(async msg => {
      if (msg.method !== 'Fetch.requestPaused') {
        return;
      }
      const { requestId, request } = msg.params;
      const key = fixtureKey(request.url);
      const answer = generate(key) ?? fixtures[key];
      if (request.method === 'OPTIONS') {
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 204,
          responseHeaders: [
            ...cors,
            { name: 'Access-Control-Allow-Headers', value: '*' },
          ],
        });
      } else if (answer) {
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [...cors, { name: 'X-Total', value: answer.total }],
          body: Buffer.from(answer.body).toString('base64'),
        });
      } else {
        missing += 1;
        console.log(`  no fixture for ${key}: answering 404`);
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 404,
          responseHeaders: cors,
          body: '',
        });
      }
    });
  }

  if (pageConsole) {
    await send('Runtime.enable');
    events.push(msg => {
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log(
          `  [page] ${msg.params.args
            .map(a => a.value ?? a.description)
            .join(' ')}`,
        );
      }
    });
  }

  await send('Page.enable');
  if (devtools) {
    // A real screen keeps its size; start clean, as a new profile would
    await send('Network.clearBrowserCache');
    await evaluate('localStorage.clear()');
  } else {
    // A headless page is never the focused window, so it would get no focus
    // events; a TV app always has them
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  return {
    send,
    evaluate,
    events,
    browser: await evaluate('navigator.userAgent'),
    missing: () => missing,
    async press(key) {
      const [name, code] = KEYS[key];
      // Enter needs its character too, as a real key press sends it
      const text = key === 'select' ? '\r' : undefined;
      for (const type of [text ? 'keyDown' : 'rawKeyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', {
          type,
          key: name,
          code: name,
          windowsVirtualKeyCode: code,
          ...(text && type === 'keyDown' ? { text, unmodifiedText: text } : {}),
        });
      }
    },
    async close() {
      if (record) {
        writeFileSync(
          FIXTURES,
          `${JSON.stringify({ ...fixtures, ...recorded }, null, 1)}\n`,
        );
        console.log(`recorded ${Object.keys(recorded).length} API answers`);
      }
      if (!child) {
        // The browser isn't ours to stop: hand its requests back to it
        await send('Fetch.disable');
        socket.close();
        return;
      }
      socket.close();
      child.kill();
      await sleep(500);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}
