import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  expoConfig,
]);
