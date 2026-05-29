import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.vite-cache', 'eslint-report.json', 'summarize-eslint.mjs', 'knip-report.txt']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Treat unused locals/imports as errors so dead code surfaces.
      // Allow leading-underscore names for intentional placeholders.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // `any` is widespread in legacy code - keep it visible as a warning
      // until it is gradually replaced with `unknown` or proper types.
      '@typescript-eslint/no-explicit-any': 'warn',
      // The standard "fetch on mount" pattern triggers this rule even though
      // it is the documented React way. Keep it as a warning for awareness
      // without blocking builds.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
