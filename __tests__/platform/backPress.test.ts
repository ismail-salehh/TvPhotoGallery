import { Platform, TVEventControl } from 'react-native';

import * as native from '../../src/platform/backPress';
import * as web from '../../src/platform/backPress.web';

describe('setBackPressWanted', () => {
  const descriptors = {
    isTV: Object.getOwnPropertyDescriptor(Platform, 'isTV')!,
    OS: Object.getOwnPropertyDescriptor(Platform, 'OS')!,
  };
  let enable: jest.SpyInstance;
  let disable: jest.SpyInstance;
  beforeEach(() => {
    enable = jest
      .spyOn(TVEventControl, 'enableTVMenuKey')
      .mockImplementation(() => {});
    disable = jest
      .spyOn(TVEventControl, 'disableTVMenuKey')
      .mockImplementation(() => {});
  });
  afterEach(() => {
    Object.defineProperties(Platform, descriptors);
    jest.restoreAllMocks();
  });
  const on = (isTV: boolean, OS: string) =>
    Object.defineProperties(Platform, {
      isTV: { get: () => isTV, configurable: true },
      OS: { get: () => OS, configurable: true },
    });

  it('turns the tvOS menu key on only while someone listens', () => {
    on(true, 'ios');
    native.setBackPressWanted(true);
    expect(enable).toHaveBeenCalledTimes(1);
    native.setBackPressWanted(false);
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it('leaves Android TV and iPhone alone', () => {
    on(true, 'android');
    native.setBackPressWanted(true);
    on(false, 'ios');
    native.setBackPressWanted(true);
    expect(enable).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
  });

  it('has nothing to do in a browser', () => {
    expect(() => web.setBackPressWanted(true)).not.toThrow();
  });
});

describe('modalRequestCloseIsBack', () => {
  it('counts a native Modal’s close request as Back, but not the web one', () => {
    expect(native.modalRequestCloseIsBack).toBe(true);
    expect(web.modalRequestCloseIsBack).toBe(false);
  });
});
