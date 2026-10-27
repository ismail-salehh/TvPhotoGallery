import DeviceInfo from 'react-native-device-info';

import { getDeviceDetails } from '../../src/platform/deviceInfo';
import { version } from '../../package.json';

describe('native deviceInfo', () => {
  function stub(brand: string, model: string) {
    jest.spyOn(DeviceInfo, 'getBrand').mockReturnValue(brand);
    jest.spyOn(DeviceInfo, 'getModel').mockReturnValue(model);
    jest.spyOn(DeviceInfo, 'getSystemName').mockReturnValue('Android');
    jest.spyOn(DeviceInfo, 'getSystemVersion').mockReturnValue('14');
    jest.spyOn(DeviceInfo, 'getVersion').mockReturnValue('1.0');
    jest.spyOn(DeviceInfo, 'getBuildNumber').mockReturnValue('7');
  }
  afterEach(() => jest.restoreAllMocks());

  it('reports the installed app, the OS and the device', () => {
    stub('Sony', 'BRAVIA 4K VH2');
    expect(getDeviceDetails()).toEqual({
      model: 'Sony BRAVIA 4K VH2',
      system: 'Android 14',
      appVersion: '1.0 (7)',
    });
  });

  it('does not repeat a brand the model already names', () => {
    stub('Apple', 'Apple TV');
    expect(getDeviceDetails().model).toBe('Apple TV');
    stub('google', 'Google TV Streamer');
    expect(getDeviceDetails().model).toBe('Google TV Streamer');
  });
});

describe('web deviceInfo', () => {
  type Web = typeof import('../../src/platform/deviceInfo.web');
  const g = globalThis as Record<string, unknown>;
  let web: Web;
  beforeAll(() => {
    jest.isolateModules(() => {
      web = require('../../src/platform/deviceInfo.web');
    });
  });
  afterEach(() => {
    delete g.webOSSystem;
    delete g.PalmSystem;
  });

  const UAS: [string, string, string][] = [
    [
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 WebAppManager',
      'Chrome 87',
      'webOS',
    ],
    [
      'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36',
      '',
      'Tizen 6.0',
    ],
    [
      'Mozilla/5.0 (Linux; Android 12; BRAVIA 4K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Chrome 120',
      'Android 12',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Safari 17',
      'iOS 17.4',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Safari 17',
      'macOS 10.15.7',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Edge 120',
      'Windows NT 10.0',
    ],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Chrome 119',
      'ChromeOS',
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
      'Firefox 128',
      'Linux',
    ],
    ['curl/8.0', '', ''],
  ];

  it.each(UAS)('reads the browser and system from %s', (ua, model, system) => {
    expect(web.detailsFromUserAgent(ua)).toEqual({ model, system });
  });

  it('names an LG TV by its model and webOS version', () => {
    g.webOSSystem = {
      deviceInfo: JSON.stringify({
        modelName: 'OLED55C2',
        platformVersion: '7.3.0',
      }),
    };
    expect(web.getDeviceDetails()).toEqual({
      model: 'LG OLED55C2',
      system: 'webOS 7.3.0',
      appVersion: version,
    });
    g.webOSSystem = {
      deviceInfo: JSON.stringify({ modelName: 'X', sdkVersion: '6.0' }),
    };
    expect(web.getDeviceDetails().system).toBe('webOS 6.0');
    g.webOSSystem = { deviceInfo: JSON.stringify({ modelName: 'X' }) };
    expect(web.getDeviceDetails().system).toBe('webOS');
  });

  it('falls back to the user agent when the TV says nothing usable', () => {
    const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: UAS[0][0] },
      configurable: true,
    });
    for (const info of [undefined, '{bad', 'null', JSON.stringify({ x: 1 })]) {
      g.PalmSystem = info === undefined ? undefined : { deviceInfo: info };
      expect(web.getDeviceDetails()).toEqual({
        model: 'Chrome 87',
        system: 'webOS',
        appVersion: version,
      });
    }
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
    });
    expect(web.getDeviceDetails()).toEqual({
      model: '',
      system: '',
      appVersion: version,
    });
    if (navigator) {
      Object.defineProperty(globalThis, 'navigator', navigator);
    }
  });
});
