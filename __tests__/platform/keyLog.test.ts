import { TVEventHandler } from 'react-native';

import * as native from '../../src/platform/keyLog';

describe('native keyLog', () => {
  it('passes on each press once, by name, and stops when removed', () => {
    const remove = jest.fn();
    let emit: (event: object) => void = () => {};
    const spy = jest
      .spyOn(
        TVEventHandler as { addListener: (cb: never) => unknown },
        'addListener',
      )
      .mockImplementation(cb => {
        emit = cb as typeof emit;
        return { remove };
      });
    const keys: string[] = [];
    const stop = native.addKeyListener(k => keys.push(k));
    emit({ eventType: 'right', eventKeyAction: 0 }); // key down: skipped
    emit({ eventType: 'right', eventKeyAction: 1 }); // key up: the press
    emit({ eventType: 'select' }); // tvOS: no action
    emit({ eventType: 'playPause', eventKeyAction: -1 });
    for (const eventType of ['focus', 'blur', 'back', 'menu', 'pan']) {
      emit({ eventType, eventKeyAction: 1 });
    }
    emit({});
    emit(undefined as never);
    expect(keys).toEqual(['right', 'select', 'playPause']);
    stop();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('web keyLog', () => {
  type Web = typeof import('../../src/platform/keyLog.web');
  const g = globalThis as Record<string, unknown>;
  let handlers: ((e: object) => void)[];
  let capture: unknown[];
  let web: Web;
  beforeEach(() => {
    handlers = [];
    capture = [];
    g.addEventListener = (_t: string, h: (e: object) => void, c: unknown) => {
      handlers.push(h);
      capture.push(c);
    };
    g.removeEventListener = (_t: string, h: (e: object) => void) => {
      handlers = handlers.filter(x => x !== h);
    };
    jest.isolateModules(() => {
      web = require('../../src/platform/keyLog.web');
    });
  });
  afterEach(() => {
    delete g.addEventListener;
    delete g.removeEventListener;
  });
  const press = (key: string, repeat = false) =>
    handlers.forEach(h => h({ key, repeat }));

  it('names keys as the remote does, and never logs what was typed', () => {
    const keys: string[] = [];
    const stop = web.addKeyListener(k => keys.push(k));
    expect(capture).toEqual([true]);
    for (const key of [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Enter',
      ' ',
      'q',
      '7',
    ]) {
      press(key);
    }
    press('ArrowRight', true); // held: the first press is enough
    press('Escape'); // Back: recorded by BackHandlerProvider
    press('Shift');
    expect(keys).toEqual([
      'up',
      'down',
      'left',
      'right',
      'select',
      'space',
      'char',
      'char',
    ]);
    stop();
    expect(handlers).toEqual([]);
  });
});
