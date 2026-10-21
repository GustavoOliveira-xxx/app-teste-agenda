// Regras de qualidade de código (lint). Rode com: npm run lint
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/*',
      'dist-ci/*',
      'dist-e2e/*',
      'dist-site/*',
      'android/*',
      'ios/*',
      'coverage/*',
      '.expo/*',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
