module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.js'],
  coverageDirectory: '<rootDir>/../coverage',
  collectCoverageFrom: [
    'config/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    '!utils/keys.js',
    '!utils/redis.js',
  ],
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  testTimeout: 10000,
};
