import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

// Renders `hook` in a component; `result.current` is its latest return
// value and `history` every value it returned, render by render
export function renderHook<P, R>(hook: (props: P) => R, initialProps: P) {
  const history: R[] = [];
  const result = { current: undefined as unknown as R };
  function Probe(props: { hookProps: P }) {
    result.current = hook(props.hookProps);
    history.push(result.current);
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe hookProps={initialProps} />);
  });
  return {
    result,
    history,
    rerender: (props: P) =>
      act(() => renderer.update(<Probe hookProps={props} />)),
    unmount: () => act(() => renderer.unmount()),
  };
}

// Lets pending promises (and the state updates they cause) settle
export async function settle() {
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(() => resolve()));
  });
}

// A promise to resolve or reject from the test
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
