// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['components/ui/utils/use-break-point-value.ts'],
    rules: {
      // Vendored Gluestack helper. SDK 57 eslint flags it; do not edit components/ui.
      'import/namespace': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
