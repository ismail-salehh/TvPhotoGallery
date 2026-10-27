import AsyncStorage from '@react-native-async-storage/async-storage';

type Diagnostics = typeof import('../../src/diagnostics/diagnostics');

const DEVICE = {
  model: 'Sony BRAVIA',
  system: 'Android 12',
  appVersion: '1.0.0 (1)',
};

let mockReportUrl = '';
jest.mock('../../src/diagnostics/config', () => ({
  get REPORT_URL() {
    return mockReportUrl;
  },
}));

// A fresh module per test, as each app launch is
function launch(): Diagnostics {
  let mod!: Diagnostics;
  jest.isolateModules(() => {
    mod = require('../../src/diagnostics/diagnostics');
  });
  return mod;
}

const stored = async () =>
  JSON.parse((await AsyncStorage.getItem('diagnostics')) as string);
const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

let logs: { level: string; line: string }[];
beforeEach(async () => {
  await AsyncStorage.clear();
  mockReportUrl = '';
  logs = [];
  for (const level of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push({ level, line: String(args[0]) });
    });
  }
  (globalThis.fetch as jest.Mock).mockReset();
});
afterEach(() => jest.restoreAllMocks());

const reports = () =>
  logs
    .filter(l => l.line.startsWith('[report] '))
    .map(l => ({ level: l.level, ...JSON.parse(l.line.slice(9)) }));

describe('the launch log line', () => {
  it('names the app version and the device', async () => {
    await launch().startDiagnostics(DEVICE);
    expect(logs[0]).toEqual({
      level: 'log',
      line: '[app] TvPhotoGallery 1.0.0 (1) on Sony BRAVIA, Android 12',
    });
  });
});

describe('recent keys and focus', () => {
  it('counts a held or repeated key once, with how many times', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    d.recordKey('right', 1000);
    d.recordKey('right', 1300);
    d.recordKey('right', 1900);
    d.recordKey('select', 2000);
    d.recordKey('right', 5000);
    expect(d.diagnosticsSnapshot().keys).toEqual([
      { key: 'right', at: new Date(1000).toISOString(), count: 3 },
      { key: 'select', at: new Date(2000).toISOString(), count: 1 },
      { key: 'right', at: new Date(5000).toISOString(), count: 1 },
    ]);
  });

  it('keeps the last 30 presses and the last 10 focused items', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    for (let i = 0; i < 35; i++) {
      d.recordKey(`k${i}`, i * 5000);
      d.recordFocus(`item-${i}`);
    }
    d.recordFocus('item-34');
    const snap = d.diagnosticsSnapshot();
    expect(snap.keys).toHaveLength(30);
    expect(snap.keys[0].key).toBe('k5');
    expect(snap.focus).toEqual(
      Array.from({ length: 10 }, (_, i) => `item-${25 + i}`),
    );
  });

  it('reaches storage within a second, so a native crash leaves them behind', async () => {
    jest.useFakeTimers();
    const d = launch();
    await d.startDiagnostics(DEVICE);
    d.recordKey('up');
    d.recordFocus('home-settings');
    expect((await stored()).keys).toEqual([]);
    jest.advanceTimersByTime(1000);
    jest.useRealTimers();
    await flush();
    expect((await stored()).keys.map((k: { key: string }) => k.key)).toEqual([
      'up',
    ]);
    expect((await stored()).focus).toEqual(['home-settings']);
  });
});

describe('reports', () => {
  it('carry version, device, the error, where, and the keys before it', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    d.recordKey('down', 1000);
    d.recordFocus('album-card-x');
    await d.reportError(new Error('boom'), 'contained', 'album-grid');
    const [report] = reports();
    expect(report).toMatchObject({
      level: 'warn',
      kind: 'contained',
      app: '1.0.0 (1)',
      device: 'Sony BRAVIA',
      system: 'Android 12',
      message: 'boom',
      where: 'album-grid',
      keys: [{ key: 'down', count: 1 }],
      focus: ['album-card-x'],
    });
    expect(report.stack).toContain('boom');
    expect(report.sessionStartedAt).not.toBe('');
    expect((await stored()).reports).toHaveLength(1);
  });

  it('add the component stack after the error’s own', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    const error = new Error('no stack');
    delete error.stack;
    await d.reportError(error, 'contained', 'hero', '\n    in Hero');
    expect(reports()[0].stack).toBe('\nComponents:\n    in Hero');
  });

  it('logs uncaught errors as errors, whatever was thrown', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    await d.reportError('a string', 'error');
    expect(reports()[0]).toMatchObject({
      level: 'error',
      kind: 'error',
      message: 'a string',
      stack: '',
      where: '',
    });
  });

  it('are still logged when the device storage fails', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('full'),
    );
    await d.reportError(new Error('logged anyway'), 'error', '', null);
    expect(reports()[0]).toMatchObject({ message: 'logged anyway' });
    expect(reports()[0].stack).not.toContain('Components:');
  });

  it('keep only the last 5 on the device', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    for (let i = 0; i < 7; i++) {
      await d.reportError(new Error(`e${i}`), 'error');
    }
    expect(
      (await stored()).reports.map((r: { message: string }) => r.message),
    ).toEqual(['e2', 'e3', 'e4', 'e5', 'e6']);
  });

  it('are not sent anywhere without a report URL', async () => {
    const d = launch();
    await d.startDiagnostics(DEVICE);
    await d.reportError(new Error('x'), 'error');
    await flush();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('are POSTed when a URL is set, and dropped from the device once accepted', async () => {
    mockReportUrl = 'https://reports.test/tv';
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const d = launch();
    await d.startDiagnostics(DEVICE);
    await d.reportError(new Error('sent'), 'error');
    await flush();
    expect(globalThis.fetch).toHaveBeenCalledWith('https://reports.test/tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"message":"sent"'),
    });
    await flush();
    expect((await stored()).reports).toEqual([]);
  });

  it('stay on the device when sending fails, and go at the next launch', async () => {
    mockReportUrl = 'https://reports.test/tv';
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    const first = launch();
    await first.startDiagnostics(DEVICE);
    await first.reportError(new Error('kept'), 'error');
    await flush();
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(
      new TypeError('offline'),
    );
    await first.reportError(new Error('kept 2'), 'error');
    await flush();
    expect((await stored()).reports).toHaveLength(2);

    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
    first.setSessionOpen(false);
    await flush();
    await launch().startDiagnostics(DEVICE);
    await flush();
    await flush();
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    expect((await stored()).reports).toEqual([]);
  });
});

describe('a session that ended without leaving the app', () => {
  it('is reported at the next launch, with the keys pressed before it', async () => {
    const first = launch();
    await first.startDiagnostics(DEVICE);
    first.recordKey('right', 1000);
    first.recordFocus('album-card-a');
    await first.reportError(new Error('noise'), 'contained', 'x');
    // The app dies here: nothing more is written
    logs = [];
    await launch().startDiagnostics(DEVICE);
    const [report] = reports();
    expect(report).toMatchObject({
      kind: 'unexpected-exit',
      level: 'error',
      app: '1.0.0 (1)',
      keys: [{ key: 'right', count: 1 }],
      focus: ['album-card-a'],
    });
    expect(report.sessionStartedAt).not.toBe('');
  });

  it('is not reported when the app was left normally', async () => {
    const first = launch();
    await first.startDiagnostics(DEVICE);
    first.setSessionOpen(false);
    await flush();
    logs = [];
    await launch().startDiagnostics(DEVICE);
    expect(reports()).toEqual([]);
  });

  it('is reported when the app came back to the front and then died', async () => {
    const first = launch();
    await first.startDiagnostics(DEVICE);
    first.setSessionOpen(false);
    first.setSessionOpen(true);
    await flush();
    logs = [];
    await launch().startDiagnostics(DEVICE);
    expect(reports().map(r => r.kind)).toEqual(['unexpected-exit']);
  });

  it('is not reported twice after a fatal error that was', async () => {
    const first = launch();
    await first.startDiagnostics(DEVICE);
    await first.reportError(new Error('fatal'), 'fatal');
    logs = [];
    await launch().startDiagnostics(DEVICE);
    expect(reports()).toEqual([]);
  });

  it('a first launch, or unreadable storage, reports nothing', async () => {
    await launch().startDiagnostics(DEVICE);
    await AsyncStorage.setItem('diagnostics', '{broken');
    await launch().startDiagnostics(DEVICE);
    await AsyncStorage.setItem('diagnostics', JSON.stringify({ reports: 'x' }));
    const d = launch();
    await d.startDiagnostics(DEVICE);
    expect(reports()).toEqual([]);
    expect(d.diagnosticsSnapshot().reports).toEqual([]);
  });

  it('nothing is recorded about a session before diagnostics started', () => {
    const d = launch();
    d.setSessionOpen(false);
    expect(d.diagnosticsSnapshot().session).toBeNull();
  });

  it('a report made before start still says what it can', async () => {
    const d = launch();
    await d.reportError(new Error('early'), 'fatal');
    expect(reports()[0]).toMatchObject({ app: '', sessionStartedAt: '' });
  });
});
