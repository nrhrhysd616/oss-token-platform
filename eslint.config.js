import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.git/**', '.next/**', 'tests/**'],
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // 基本的なTypeScriptルールのみ適用
      // '@typescript-eslint/no-unused-vars': 'warn',
      // '@typescript-eslint/no-explicit-any': 'warn',
      // カスタムルールをここに追加
    },
  },
  eslintConfigPrettier,
]
