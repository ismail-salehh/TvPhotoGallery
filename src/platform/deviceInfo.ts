import DeviceInfo from 'react-native-device-info';

export type DeviceDetails = {
  model: string;
  system: string;
  appVersion: string;
};

// Brand first unless the model already says it ("Apple TV")
function withBrand(brand: string, model: string) {
  return model.toLowerCase().startsWith(brand.toLowerCase())
    ? model
    : `${brand} ${model}`;
}

// What the About section shows. Web version: deviceInfo.web.ts.
export function getDeviceDetails(): DeviceDetails {
  return {
    model: withBrand(DeviceInfo.getBrand(), DeviceInfo.getModel()),
    system: `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`,
    appVersion: `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`,
  };
}
