import baseConfig from './jest.config.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  displayName: 'Integration Tests',
  setupFilesAfterEnv: ['<rootDir>/tests/utils/integration.setup.ts'],
  testTimeout: 30000,
};
