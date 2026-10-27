type Web = typeof import('../../src/platform/backPress.web');
type KeyHandler = (event: object) => void;

describe('web addBackPressListener', () => {
  const g = globalThis as Record<string, unknown>;
  let handlers: KeyHandler[];
  let web: Web;
  beforeEach(() => {
    handlers = [];
    g.addEventListener = (_t: string, h: KeyHandler) => handlers.push(h);
    g.removeEventListener = (_t: string, h: KeyHandler) => {
      handlers = handlers.filter(x => x !== h);
    };
    jest.isolateModules(() => {
      web = require('../../src/platform/backPress.web');
    });
  });
  afterEach(() => {
    delete g.addEventListener;
    delete g.removeEventListener;
  });

  const press = (over: object) => {
    const event = {
      key: 'Escape',
      repeat: false,
      target: { tagName: 'DIV' },
      preventDefault: jest.fn(),
      ...over,
    };
    handlers.forEach(h => h(event));
    return event;
  };

  it('Escape and Backspace are Back; the page default is stopped when handled', () => {
    const listener = jest.fn(() => true);
    const stop = web.addBackPressListener(listener);
    expect(press({}).preventDefault).toHaveBeenCalled();
    press({ key: 'Backspace' });
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    expect(handlers).toEqual([]);
  });

  it('an unhandled Back keeps the browser default', () => {
    web.addBackPressListener(() => false);
    expect(press({}).preventDefault).not.toHaveBeenCalled();
  });

  it('ignores other keys, keys typed into a field, and held keys', () => {
    const listener = jest.fn(() => true);
    web.addBackPressListener(listener);
    press({ key: 'Enter' });
    press({ key: 'Backspace', target: { tagName: 'INPUT' } });
    const held = press({ repeat: true });
    expect(listener).not.toHaveBeenCalled();
    expect(held.preventDefault).toHaveBeenCalled();
  });
});

// A module, so its types stay local to this file
export {};
