import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
  {
    // techne-doc browser assets (notes/poetics/assets/*.js) run in the browser, not Node.
    files: ['notes/poetics/assets/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Served front-end assets (public/components/*.js etc.) run in the browser, not Node.
    files: ['public/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // tutor-core/ is vendored (in-housed from @machinespirits/tutor-core, see
    // TUTOR-CORE-INHOUSING.md) — keep it under its own upstream lint rules, not the eval repo's.
    // *.workflow.js are Workflow-tool scripts: they use top-level await/return and injected
    // globals (agent/phase/pipeline/args), valid in the Workflow runtime but not parseable as
    // plain modules — exclude them rather than lint them under app rules.
    ignores: [
      'node_modules/',
      'tutor-core/',
      'data/',
      'logs/',
      'exports/',
      'docs/',
      'content/',
      'public/chat/vendor/',
      '.test-tmp/',
      '.codex-tmp/',
      '.venv/',
      '**/*.workflow.js',
    ],
  },
];
