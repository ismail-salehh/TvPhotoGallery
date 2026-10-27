// The QA walk must find defects it is meant to find, not just pass
import {
  matches,
  physicalKey,
  runAll,
  runCheck,
  walkScreen,
  wentTheRightWay,
} from '../../scripts/qa/lib.mjs';

type Rect = { x: number; y: number; width: number; height: number };
type Screen = {
  start: string;
  rects: Record<string, Rect>;
  // id -> key -> next id (null: focus lost); missing: stays
  moves: Record<string, Record<string, string | null>>;
};

const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 100 });

function fakeDriver(screen: Screen) {
  let current: string | null = screen.start;
  return {
    open: async () => {
      current = screen.start;
    },
    press: async (key: string) => {
      if (current !== null) {
        const next = screen.moves[current]?.[key];
        current = next === undefined ? current : next;
      }
    },
    focus: async () =>
      current === null ? null : { id: current, rect: screen.rects[current] },
    focusables: async () =>
      Object.entries(screen.rects).map(([id, rect]) => ({ id, rect })),
    viewport: async () => ({ width: 1000, height: 1000 }),
    setLanguage: async () => {},
  };
}

// a b  in a row; c below a
const healthy: Screen = {
  start: 'a',
  rects: { a: box(0, 0), b: box(200, 0), c: box(0, 200) },
  moves: {
    a: { right: 'b', down: 'c' },
    b: { left: 'a', down: 'c' },
    c: { up: 'a' },
  },
};

const walk = (screen: Screen) =>
  walkScreen(
    fakeDriver(screen),
    { name: 't', start: 'home' },
    { rtl: false, links: {} },
  );

describe('walkScreen', () => {
  it('passes a screen where everything is reachable, and tries every arrow on every item', async () => {
    const result = await walk(healthy);
    expect(result).toMatchObject({ ok: true, items: 3, edges: 12 });
  });

  it('finds an item no key reaches', async () => {
    const result = await walk({
      ...healthy,
      rects: { ...healthy.rects, d: box(400, 400) },
    });
    expect(result.issues).toEqual(['not reachable: d']);
  });

  it('finds a move that loses focus', async () => {
    const result = await walk({
      ...healthy,
      moves: { ...healthy.moves, c: { up: 'a', right: null } },
    });
    expect(result.issues).toContain('focus lost: right from c');
  });

  it('finds a move that goes the wrong way', async () => {
    const result = await walk({
      ...healthy,
      moves: { ...healthy.moves, b: { left: 'a', down: 'c', up: 'c' } },
    });
    expect(result.issues).toContain('wrong way: up from b to c');
  });

  it('finds left/right jumping to another row', async () => {
    const result = await walk({
      ...healthy,
      rects: { ...healthy.rects, b: box(200, 150) },
    });
    expect(result.issues).toContain('left the row: right from a to b');
  });

  it('finds focus landing off screen', async () => {
    const result = await walk({
      start: 'a',
      rects: { a: box(0, 0), z: box(950, 0) },
      moves: { a: { right: 'z' }, z: { left: 'a' } },
    });
    expect(result.issues).toContain('off screen: right from a to z');
  });

  it('reports a screen with nothing focused', async () => {
    const driver = fakeDriver(healthy);
    driver.focus = async () => null;
    const result = await walkScreen(
      driver,
      { name: 't', start: 'home' },
      { rtl: false, links: {} },
    );
    expect(result).toMatchObject({
      ok: false,
      issues: ['nothing focused at the start'],
    });
  });

  it('says when its budget ran out before every item was tried', async () => {
    const result = await walkScreen(
      fakeDriver(healthy),
      { name: 't', start: 'home' },
      {
        rtl: false,
        links: {},
        budget: 3,
      },
    );
    expect(result.issues.join()).toMatch(/budget spent before testing/);
  });
});

describe('key-sequence checks', () => {
  it('fail at the first step whose focus is not the one written', async () => {
    const result = await runCheck(
      fakeDriver(healthy),
      {
        name: 'x',
        start: 'home',
        steps: [
          { expect: 'a', capture: 'first' },
          { key: 'end', expect: 'b', notExpect: '$first' },
          { key: 'down', expect: 'a' },
        ],
      },
      { rtl: false, links: {} },
    );
    expect(result.failures).toEqual(['step 3 (down): expected a, focus on c']);
  });

  it('fail when focus was meant to move and did not', async () => {
    const result = await runCheck(
      fakeDriver(healthy),
      { name: 'x', start: 'home', steps: [{ expect: 'c', capture: 'c' }] },
      { rtl: false, links: {} },
    );
    expect(result.ok).toBe(false);
    const stuck = await runCheck(
      fakeDriver(healthy),
      {
        name: 'x',
        start: 'home',
        steps: [
          { expect: '*', capture: 'f' },
          { key: 'up', expect: '*', notExpect: '$f' },
        ],
      },
      { rtl: false, links: {} },
    );
    expect(stuck.failures).toEqual(['step 2 (up): focus did not move from a']);
  });

  it('read start and end as the layout direction does', () => {
    expect([physicalKey('start', false), physicalKey('end', false)]).toEqual([
      'left',
      'right',
    ]);
    expect([physicalKey('start', true), physicalKey('end', true)]).toEqual([
      'right',
      'left',
    ]);
    expect(physicalKey('up', true)).toBe('up');
  });

  it('match ids with * and captured names, and nothing for no focus', () => {
    expect(matches('album-card-x1', 'album-card-*')).toBe(true);
    expect(matches('photo-card-x1', 'album-card-*')).toBe(false);
    expect(matches('a.b', 'a*b')).toBe(true);
    expect(matches('axb', 'a.b')).toBe(false);
    expect(matches('k', '$saved', { saved: 'k' })).toBe(true);
    expect(matches(null, '*')).toBe(false);
  });

  it('judge direction by centres, with a small tolerance', () => {
    expect(wentTheRightWay(box(0, 0), box(200, 0), 'right')).toBe(true);
    expect(wentTheRightWay(box(200, 0), box(0, 0), 'right')).toBe(false);
    expect(wentTheRightWay(box(0, 0), box(2, 300), 'down')).toBe(true);
    expect(wentTheRightWay(box(0, 300), box(0, 0), 'down')).toBe(false);
  });
});

describe('runAll', () => {
  it('runs a check with "languages" only in those languages', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const check = (name: string, languages?: string[]) => ({
      name,
      start: 'home',
      steps: [{ expect: 'a' }],
      ...(languages ? { languages } : {}),
    });
    const results = await runAll(
      fakeDriver(healthy),
      {
        checks: [check('everywhere'), check('arabic', ['ar'])],
        walks: [],
        links: {},
      },
      { languages: ['en', 'ar'], only: 'checks' },
    );
    log.mockRestore();
    expect(results.map(r => `${r.language}:${r.name}`)).toEqual([
      'en:everywhere',
      'ar:everywhere',
      'ar:arabic',
    ]);
  });
});
