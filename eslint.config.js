import js from '@eslint/js';
import globals from 'globals';

/**
 * ESLint v9 扁平配置
 *
 * 范围：scripts/、hooks/、bin/（与 package.json 的 lint 脚本一致）
 * 约定对齐：
 * - 本仓库用 `_` 前缀（如 `_error`）标记有意忽略的变量/捕获，豁免 no-unused-vars
 * - 引擎为 Node >= 18 ESM（package.json "type": "module"）
 */
export default [
  {
    ignores: ['node_modules/**', '.test-*/**', '.requirements/**', 'docs/**', 'tests/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // `_` 前缀 = 有意忽略（仓库既有约定）
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
