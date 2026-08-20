import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}', '*.{ts,mts}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'grimore-v2/prototypes/**',
  ]),
])
