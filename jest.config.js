const preset = require('@react-native/jest-preset');

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // A suite's first render compiles React Native; under coverage on a busy
  // machine that alone passed the 5 s default
  testTimeout: 20000,
  // The preset's list, plus the tvOS fork's own packages
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-tvos)?)/)',
  ],
  // scripts/qa is plain Node ESM; its tests import it
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'mjs'],
  transform: { ...preset.transform, '^.+\\.mjs$': 'babel-jest' },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
    '/__tests__/e2e/',
  ],
};
