type Native = typeof import('../../src/platform/crashHooks');
type Web = typeof import('../../src/platform/crashHooks.web');

const g = globalThis as Record<string, unknown>;

describe('native crashHooks', () => {
  let previous: jest.Mock;
  let current: (error: unknown, fatal?: boolean) => void;
  let tracker:
    | { onUnhandled: (id: number, e: unknown) => void; allRejections: boolean }
    | undefined;
  let native: Native;
  const original = g.ErrorUtils;

  beforeEach(() => {
    previous = jest.fn();
    current = previous;
    tracker = undefined;
    g.ErrorUtils = {
      getGlobalHandler: () => current,
      setGlobalHandler: (h: typeof current) => {
        current = h;
      },
    };
    g.HermesInternal = {
      enablePromiseRejectionTracker: (o: typeof tracker) => {
        tracker = o;
      },
    };
    jest.isolateModules(() => {
      native = require('../../src/platform/crashHooks');
    });
  });
  afterEach(() => {
    g.ErrorUtils = original;
    delete g.HermesInternal;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('saves the report first, then lets React Native handle the error', async () => {
    let saved!: () => void;
    const onError = jest.fn(() => new Promise<void>(r => (saved = r)));
    const remove = native.addCrashListener(onError);
    const error = new Error('fatal');
    current(error, true);
    expect(onError).toHaveBeenCalledWith(error, true);
    await Promise.resolve();
    expect(previous).not.toHaveBeenCalled();
    saved();
    await new Promise<void>(r => setImmediate(() => r()));
    expect(previous).toHaveBeenCalledWith(error, true);
    remove();
    expect(current).toBe(previous);
  });

  it('does not hold a fatal error longer than a second', async () => {
    jest.useFakeTimers();
    native.addCrashListener(() => new Promise<void>(() => {}));
    current(new Error('stuck'));
    jest.advanceTimersByTime(1000);
    jest.useRealTimers();
    await new Promise<void>(r => setImmediate(() => r()));
    expect(previous).toHaveBeenCalledWith(expect.any(Error), undefined);
  });

  it('passes the error on even if saving its report fails', async () => {
    native.addCrashListener(() => Promise.reject(new Error('disk')));
    current('x', false);
    await new Promise<void>(r => setImmediate(() => r()));
    expect(previous).toHaveBeenCalledWith('x', false);
  });

  it('reports unhandled promise rejections, with the dev warning kept', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = jest.fn(() => Promise.reject(new Error('ignored')));
    native.addCrashListener(onError);
    expect(tracker?.allRejections).toBe(true);
    tracker?.onUnhandled(1, 'nope');
    expect(onError).toHaveBeenCalledWith('nope', false);
    expect(warn).toHaveBeenCalledWith(
      'Possible unhandled promise rejection:',
      'nope',
    );
  });

  it('in a release build, reports rejections without the dev warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const dev = g.__DEV__;
    g.__DEV__ = false;
    const onError = jest.fn(() => Promise.resolve());
    native.addCrashListener(onError);
    tracker?.onUnhandled(2, 'quiet');
    g.__DEV__ = dev;
    expect(onError).toHaveBeenCalledWith('quiet', false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('works on an engine without a rejection tracker', () => {
    delete g.HermesInternal;
    expect(() => native.addCrashListener(jest.fn())).not.toThrow();
  });
});

describe('web crashHooks', () => {
  let handlers: Record<string, ((e: object) => void)[]>;
  let web: Web;
  beforeEach(() => {
    handlers = {};
    g.addEventListener = (t: string, h: (e: object) => void) => {
      (handlers[t] ??= []).push(h);
    };
    g.removeEventListener = (t: string, h: (e: object) => void) => {
      handlers[t] = handlers[t].filter(x => x !== h);
    };
    jest.isolateModules(() => {
      web = require('../../src/platform/crashHooks.web');
    });
  });
  afterEach(() => {
    delete g.addEventListener;
    delete g.removeEventListener;
  });

  it('reports page errors as fatal and unhandled rejections as not', () => {
    const onError = jest.fn(() => Promise.reject(new Error('ignored')));
    const remove = web.addCrashListener(onError);
    const error = new Error('page');
    handlers.error[0]({ error });
    handlers.error[0]({ message: 'Script error.' });
    handlers.unhandledrejection[0]({ reason: 'later' });
    expect(onError.mock.calls).toEqual([
      [error, true],
      [new Error('Script error.'), true],
      ['later', false],
    ]);
    remove();
    expect(handlers.error).toEqual([]);
    expect(handlers.unhandledrejection).toEqual([]);
  });
});

// A module, so its types stay local to this file
export {};
