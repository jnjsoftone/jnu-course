import baseConfig from './jest.config.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
  displayName: 'E2E Tests',
  setupFilesAfterEnv: ['<rootDir>/tests/utils/e2e.setup.ts'],
  testTimeout: 60000,
};
