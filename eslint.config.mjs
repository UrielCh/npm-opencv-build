// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "test/**/*.ts",
      "**/*.js",
      "types/**/*.d.ts",
      "src/lib/meta.ts",
    ],
  }
  ,
  {"rules": {
    "linebreak-style": 0,
    "comma-dangle": ["error", "always-multiline"],
    "no-plusplus": "off",
    "import/no-unresolved": 0,
    "import/extensions": 0,
    "import/no-extraneous-dependencies": 0,
    "no-async-promise-executor": 0,
    "radix": 1,
    "no-undef": 0,
    "no-case-declarations": 0,
    // unit tests only
    // "max-len" : 0,
    // "no-new" : 0,
    // "no-unused-expressions": 0,
    // "prefer-spread": 0,
    // "@typescript-eslint/ban-ts-comment": 0,
    // "@typescript-eslint/no-explicit-any": 0
  }},
);
