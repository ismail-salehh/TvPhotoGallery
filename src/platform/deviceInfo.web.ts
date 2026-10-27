import { version } from '../../package.json';

export type DeviceDetails = {
  model: string;
  system: string;
  appVersion: string;
};

type WebOSSystem = { deviceInfo?: string };

// An LG TV describes itself through webOSSystem (PalmSystem before webOS 4)
function webOSDetails(): Omit<DeviceDetails, 'appVersion'> | null {
  const g = globalThis as {
    webOSSystem?: WebOSSystem;
    PalmSystem?: WebOSSystem;
  };
  try {
    const info = JSON.parse(
      (g.webOSSystem ?? g.PalmSystem)?.deviceInfo || 'null',
    );
    return info?.modelName
      ? {
          model: `LG ${info.modelName}`,
          system: `webOS ${
            info.platformVersion ?? info.sdkVersion ?? ''
          }`.trim(),
        }
      : null;
  } catch {
    return null;
  }
}

const SYSTEMS: [RegExp, (match: RegExpExecArray) => string][] = [
  [/Web0S|webOS/, () => 'webOS'],
  [/Tizen ([\d.]+)/, m => `Tizen ${m[1]}`],
  [/Android ([\d.]+)/, m => `Android ${m[1]}`],
  [/(?:iPhone|CPU) OS ([\d_]+)/, m => `iOS ${m[1].replace(/_/g, '.')}`],
  [/Mac OS X ([\d_.]+)/, m => `macOS ${m[1].replace(/_/g, '.')}`],
  [/Windows NT ([\d.]+)/, m => `Windows NT ${m[1]}`],
  [/CrOS/, () => 'ChromeOS'],
  [/Linux/, () => 'Linux'],
];

const BROWSERS: [RegExp, string][] = [
  [/Edg\/(\d+)/, 'Edge'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, 'Safari'],
];

// A browser doesn't reveal the device, so the browser stands in for it.
// "" where the user agent doesn't say: the UI fills in its own word.
export function detailsFromUserAgent(
  ua: string,
): Omit<DeviceDetails, 'appVersion'> {
  const system = SYSTEMS.map(([re, name]) => {
    const match = re.exec(ua);
    return match && name(match);
  }).find(Boolean);
  const browser = BROWSERS.map(([re, name]) => {
    const match = re.exec(ua);
    return match && `${name} ${match[1]}`;
  }).find(Boolean);
  return { model: browser || '', system: system || '' };
}

export function getDeviceDetails(): DeviceDetails {
  const ua = (globalThis as { navigator?: { userAgent?: string } }).navigator
    ?.userAgent;
  return {
    ...(webOSDetails() ?? detailsFromUserAgent(ua ?? '')),
    appVersion: version,
  };
}
