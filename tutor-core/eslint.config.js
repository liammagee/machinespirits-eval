// Lint policy for the in-housed tutor-core module.
//
// This config lives inside tutor-core/ rather than in the eval repo's root
// config on purpose: the module is vendored from @machinespirits/tutor-core
// (see TUTOR-CORE-INHOUSING.md) and has to stay re-extractable. A policy that
// travels with the module keeps working the day it is pulled back out; one
// held in the parent repo would not.
//
// The eval repo's root config ignores tutor-core/ so nothing is linted twice
// under two rule sets. The root lint lane invokes this config instead
// (`npm run lint:tutor-core`), so no file here escapes checking.
//
// The rules match the eval repo's, so a contributor moving between the two
// trees meets one style. Nothing is ignored beyond build output — a broad
// exclusion is what let these files drift in the first place.

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettier,
  {
    ignores: ['node_modules/', 'data/', 'logs/'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Matches the eval repo's root config: these two landed in ESLint 10's
      // recommended preset and are adopted separately, with their own gates.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
  {
    // Vitest suites run under the test runner's globals.
    files: ['**/__tests__/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
