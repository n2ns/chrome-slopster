import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output/', '.wxt/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Playwright fixtures pass values with a `use` callback, which is not a React hook.
    files: ['e2e/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    files: ['*.config.{js,ts}', 'tests/**', 'e2e/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
