import { AppState } from 'react-native';

jest.mock('../../src/diagnostics/diagnostics', () => ({
  startDiagnostics: jest.fn(),
  recordKey: jest.fn(),
  recordFocus: jest.fn(),
  reportError: jest.fn(),
  setSessionOpen: jest.fn(),
}));
const mockDiag = jest.requireMock(
  '../../src/diagnostics/diagnostics',
) as Record<string, jest.Mock>;
let mockKey: (k: string) => void = () => {};
jest.mock('../../src/platform/keyLog', () => ({
  addKeyListener: (l: (k: string) => void) => {
    mockKey = l;
  },
}));
let mockCrash: (e: unknown, fatal: boolean) => void = () => {};
jest.mock('../../src/platform/crashHooks', () => ({
  addCrashListener: (l: typeof mockCrash) => {
    mockCrash = l;
  },
}));
jest.mock('../../src/platform/deviceInfo', () => ({
  getDeviceDetails: () => ({ model: 'M', system: 'S', appVersion: 'V' }),
}));

import { installDiagnostics } from '../../src/diagnostics/install';
import { useFocusStore } from '../../src/ui-kit/focus/focusStore';

describe('installDiagnostics', () => {
  it('starts once and connects keys, errors, focus and app state', () => {
    let onChange: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, l) => {
      onChange = l as typeof onChange;
      return { remove: () => {} } as never;
    });
    installDiagnostics();
    installDiagnostics();
    expect(mockDiag.startDiagnostics).toHaveBeenCalledTimes(1);
    expect(mockDiag.startDiagnostics).toHaveBeenCalledWith({
      model: 'M',
      system: 'S',
      appVersion: 'V',
    });

    mockKey('left');
    expect(mockDiag.recordKey).toHaveBeenCalledWith('left');

    const e = new Error('x');
    mockCrash(e, true);
    mockCrash(e, false);
    expect(mockDiag.reportError.mock.calls).toEqual([
      [e, 'fatal'],
      [e, 'error'],
    ]);

    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1234);
    useFocusStore.getState().setFocusedId('home-settings');
    expect(mockDiag.recordFocus).toHaveBeenCalledWith('home-settings');
    useFocusStore.getState().setFocusedId('home-search-bar');
    // Logged once: the first focus is when the app became usable
    expect(log.mock.calls).toEqual([
      [
        expect.stringMatching(
          /^\[app\] first focus on home-settings after \d+ ms$/,
        ),
      ],
    ]);
    expect(
      Number(/after (\d+) ms/.exec(log.mock.calls[0][0])![1]),
    ).toBeGreaterThanOrEqual(1234);
    mockDiag.recordFocus.mockClear();
    useFocusStore.setState({ focusedId: null });
    expect(mockDiag.recordFocus).not.toHaveBeenCalled();

    onChange('background');
    onChange('active');
    expect(mockDiag.setSessionOpen.mock.calls).toEqual([[false], [true]]);
  });
});
