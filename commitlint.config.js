export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 必要に応じてルールをカスタマイズできます
    'type-enum': [
      2, // レベル設定: 2 = error, 1 = warning, 0 = off
      'always', // ルールを常に適用するかどうか always = 常に適用, never = 適用しない
      // 設定値
      [
        'build', // ビルド関連の変更
        'chore', // 雑多な変更
        'ci', // CI関連の変更
        'docs', // ドキュメント関連の変更
        'feat', // 新機能の追加
        'fix', // バグ修正
        'perf', // パフォーマンス改善
        'security', // セキュリティ関連の変更
        'refactor', // リファクタリング
        'revert', // 変更の取り消し
        'style', // コードスタイルの変更（コードの意味に影響しない）
        'test', // テスト関連の変更
      ],
    ],
  },
}
