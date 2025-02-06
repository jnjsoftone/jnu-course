import baseConfig from './jest.config.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
  displayName: 'Unit Tests',
  setupFilesAfterEnv: ['<rootDir>/tests/utils/unit.setup.ts'],
};
