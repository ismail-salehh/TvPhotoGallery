import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  BackHandlerProvider,
  useBackDispatch,
  useBackHandler,
} from '../../src/app/context/BackHandler';

const mockWanted = jest.fn();
jest.mock('../../src/platform/backPress', () => ({
  addBackPressListener: () => () => {},
  setBackPressWanted: (wanted: boolean) => mockWanted(wanted),
}));

let now = 0;
beforeEach(() => {
  now = 10_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockWanted.mockClear();
});
afterEach(() => jest.restoreAllMocks());

function setup(handlers: (() => boolean)[]) {
  let dispatch!: () => boolean;
  function Handler({ fn }: { fn: () => boolean }) {
    useBackHandler(fn);
    return null;
  }
  function Probe() {
    dispatch = useBackDispatch();
    return null;
  }
  let r!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    r = ReactTestRenderer.create(
      <BackHandlerProvider>
        {handlers.map((fn, i) => (
          <Handler key={i} fn={fn} />
        ))}
        <Probe />
      </BackHandlerProvider>,
    );
  });
  return { dispatch: () => dispatch(), r };
}

describe('BackHandlerProvider', () => {
  it('asks the newest handler first, falling through when it declines', () => {
    const order: string[] = [];
    const { dispatch } = setup([
      () => {
        order.push('old');
        return true;
      },
      () => {
        order.push('new');
        return false;
      },
    ]);
    expect(dispatch()).toBe(true);
    expect(order).toEqual(['new', 'old']);
  });

  it('passes the press on to the OS when nobody handles it', () => {
    const { dispatch } = setup([() => false]);
    expect(dispatch()).toBe(false);
  });

  it('swallows a second press within the cooldown', () => {
    const fn = jest.fn(() => true);
    const { dispatch } = setup([fn]);
    dispatch();
    now += 100;
    expect(dispatch()).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    now += 1000;
    dispatch();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('wants the back key only while a handler is registered', () => {
    const { r } = setup([() => true]);
    expect(mockWanted).toHaveBeenLastCalledWith(true);
    act(() => r.unmount());
    expect(mockWanted).toHaveBeenLastCalledWith(false);
  });

  it('refuses to be used outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useBackDispatch();
      return null;
    }
    expect(() =>
      act(() => {
        ReactTestRenderer.create(<Orphan />);
      }),
    ).toThrow('useBackHandler must be used inside a BackHandlerProvider.');
  });
});
