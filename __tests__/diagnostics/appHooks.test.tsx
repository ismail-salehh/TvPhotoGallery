import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ErrorBoundary } from '../../src/app/components/common/ErrorBoundary';
import {
  BackHandlerProvider,
  useBackDispatch,
} from '../../src/app/context/BackHandler';
import { renderInApp } from '../helpers/renderApp';

const mockReport = jest.fn();
const mockKey = jest.fn();
jest.mock('../../src/diagnostics/diagnostics', () => ({
  reportError: (...a: unknown[]) => mockReport(...a),
  recordKey: (...a: unknown[]) => mockKey(...a),
}));

describe('diagnostics in the app', () => {
  it('a contained crash is reported with the boundary and component stack', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): null {
      throw new Error('render failed');
    }
    await renderInApp(
      <ErrorBoundary id="album-grid">
        <Broken />
      </ErrorBoundary>,
    );
    const [error, kind, where, componentStack] = mockReport.mock.calls[0];
    expect(kind).toBe('contained');
    expect(where).toBe('album-grid');
    expect(error.message).toBe('render failed');
    expect(componentStack).toMatch(/Broken/);
  });

  it('something thrown that is not an Error is reported, and Retry recovers', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockReport.mockClear();
    let fail = true;
    function Flaky() {
      if (fail) {
        throw 'a string';
      }
      const { Text } = require('react-native');
      return <Text>recovered</Text>;
    }
    const r = await renderInApp(
      <ErrorBoundary id="hero">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(mockReport.mock.calls[0].slice(0, 3)).toEqual([
      'a string',
      'contained',
      'hero',
    ]);
    fail = false;
    const retry = r.root.find(
      n =>
        typeof n.props.onPress === 'function' &&
        n.props.testID === 'hero-crash-retry',
    );
    act(() => retry.props.onPress());
    expect(
      r.root.findAll(n => n.props.children === 'recovered').length,
    ).toBeGreaterThan(0);
  });

  it('every Back is recorded, including ones nobody handles', () => {
    let dispatch!: () => boolean;
    function Probe() {
      dispatch = useBackDispatch();
      return null;
    }
    act(() => {
      ReactTestRenderer.create(
        <BackHandlerProvider>
          <Probe />
        </BackHandlerProvider>,
      );
    });
    dispatch();
    expect(mockKey).toHaveBeenCalledWith('back');
  });
});
