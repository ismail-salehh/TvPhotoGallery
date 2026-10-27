import { Linking } from 'react-native';

import * as native from '../../src/platform/deepLink';

const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

describe('native deepLink', () => {
  it('gives the launch link, or null for none or a failure', async () => {
    const spy = jest.spyOn(Linking, 'getInitialURL');
    spy.mockResolvedValueOnce('tvphotogallery://photo/a');
    await expect(native.getInitialLink()).resolves.toBe(
      'tvphotogallery://photo/a',
    );
    spy.mockResolvedValueOnce(null);
    await expect(native.getInitialLink()).resolves.toBeNull();
    spy.mockResolvedValueOnce(undefined as never);
    await expect(native.getInitialLink()).resolves.toBeNull();
    spy.mockRejectedValueOnce(new Error('no activity'));
    await expect(native.getInitialLink()).resolves.toBeNull();
    spy.mockRestore();
  });

  it('passes on links opened while running, until removed', () => {
    const remove = jest.fn();
    let handler: (event: { url: string }) => void = () => {};
    const spy = jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, h) => {
        handler = h as typeof handler;
        return { remove } as never;
      });
    const listener = jest.fn();
    const stop = native.addLinkListener(listener);
    expect(spy).toHaveBeenCalledWith('url', expect.any(Function));
    handler({ url: 'tvphotogallery://album/b' });
    expect(listener).toHaveBeenCalledWith('tvphotogallery://album/b');
    stop();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('web deepLink', () => {
  type Web = typeof import('../../src/platform/deepLink.web');
  type Handler = () => void;
  let windowHandlers: Record<string, Handler[]>;
  let documentHandlers: Record<string, Handler[]>;
  let location: {
    hash: string;
    href: string;
    pathname: string;
    search: string;
  };
  let replaceState: jest.Mock;
  const g = globalThis as Record<string, unknown>;

  function load(): Web {
    windowHandlers = {};
    documentHandlers = {};
    location = {
      hash: '',
      href: 'https://tv.test/app/?x=1',
      pathname: '/app/',
      search: '?x=1',
    };
    replaceState = jest.fn((_s, _t, url: string) => {
      location.hash = '';
      location.href = `https://tv.test${url}`;
    });
    const listen = (map: Record<string, Handler[]>) => ({
      addEventListener: (type: string, h: Handler) => {
        (map[type] ??= []).push(h);
      },
      removeEventListener: (type: string, h: Handler) => {
        map[type] = (map[type] ?? []).filter(x => x !== h);
      },
    });
    g.location = location;
    g.history = { replaceState };
    Object.assign(g, listen(windowHandlers));
    g.document = listen(documentHandlers);
    let mod!: Web;
    jest.isolateModules(() => {
      mod = require('../../src/platform/deepLink.web');
    });
    return mod;
  }

  const go = (hash: string) => {
    location.hash = hash;
    location.href = `https://tv.test/app/?x=1${hash}`;
  };

  afterEach(() => {
    for (const key of [
      'location',
      'history',
      'addEventListener',
      'removeEventListener',
      'document',
      'webOSSystem',
      'PalmSystem',
    ]) {
      delete g[key];
    }
  });

  it('opens with the link in the address, then clears it from the address', async () => {
    const web = load();
    go('#/photo/abc');
    await expect(web.getInitialLink()).resolves.toBe(
      'https://tv.test/app/?x=1#/photo/abc',
    );
    expect(replaceState).toHaveBeenCalledWith(null, '', '/app/?x=1');
    expect(location.hash).toBe('');
  });

  it('opens with no link when the address has none, or an ordinary anchor', async () => {
    const web = load();
    await expect(web.getInitialLink()).resolves.toBeNull();
    go('#section');
    await expect(web.getInitialLink()).resolves.toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('prefers the LG TV launch target', async () => {
    const web = load();
    g.webOSSystem = {
      launchParams: JSON.stringify({ target: 'tvphotogallery://album/z' }),
    };
    go('#/photo/abc');
    await expect(web.getInitialLink()).resolves.toBe(
      'tvphotogallery://album/z',
    );
  });

  it('reads PalmSystem on older webOS and survives bad launch params', async () => {
    const web = load();
    g.PalmSystem = {
      launchParams: JSON.stringify({ target: 'tvphotogallery://photo/p' }),
    };
    await expect(web.getInitialLink()).resolves.toBe(
      'tvphotogallery://photo/p',
    );
    g.PalmSystem = { launchParams: '{not json' };
    await expect(web.getInitialLink()).resolves.toBeNull();
    g.PalmSystem = { launchParams: JSON.stringify({ target: 7 }) };
    await expect(web.getInitialLink()).resolves.toBeNull();
    g.PalmSystem = {};
    await expect(web.getInitialLink()).resolves.toBeNull();
  });

  it('hears links opened while running, each time, until removed', async () => {
    const web = load();
    const listener = jest.fn();
    const stop = web.addLinkListener(listener);

    go('#/album/one');
    windowHandlers.hashchange.forEach(h => h());
    expect(listener).toHaveBeenLastCalledWith(
      'https://tv.test/app/?x=1#/album/one',
    );
    // Cleared, so the same link again is a change
    go('#/album/one');
    windowHandlers.hashchange.forEach(h => h());
    expect(listener).toHaveBeenCalledTimes(2);

    // A hash change that is not a link (or our own clearing) is ignored
    go('');
    windowHandlers.hashchange.forEach(h => h());
    expect(listener).toHaveBeenCalledTimes(2);

    g.webOSSystem = {
      launchParams: JSON.stringify({ target: 'tvphotogallery://photo/r' }),
    };
    documentHandlers.webOSRelaunch.forEach(h => h());
    expect(listener).toHaveBeenLastCalledWith('tvphotogallery://photo/r');
    g.webOSSystem = { launchParams: '{}' };
    documentHandlers.webOSRelaunch.forEach(h => h());
    expect(listener).toHaveBeenCalledTimes(3);

    stop();
    expect(windowHandlers.hashchange).toEqual([]);
    expect(documentHandlers.webOSRelaunch).toEqual([]);
    await flush();
  });
});
