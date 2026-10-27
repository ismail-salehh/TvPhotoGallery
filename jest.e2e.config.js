// Real requests to Unsplash (about 10 per run, of 50 an hour): npm run test:e2e
module.exports = {
  ...require('./jest.config'),
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
  testMatch: ['<rootDir>/__tests__/e2e/**/*.test.ts'],
  testTimeout: 30000,
};
