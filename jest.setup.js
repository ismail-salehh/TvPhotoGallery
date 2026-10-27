jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock'),
);

// Unit tests never reach the network; the e2e suite (jest.e2e.config.js)
// makes real requests
if (!process.env.E2E) {
  global.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed (unit test)')),
  );
}
