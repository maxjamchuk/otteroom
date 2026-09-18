export default {
  preset: 'jest-expo',
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/decisions/test-setup.ts'],
  testTimeout: 30000,
};
