# OSS Token Platform

GitHubとXRPLを連携したオープンソースプロジェクト向けトークン化プラットフォーム

## 📝 概要

本プロジェクトは、OSSプロジェクト向けにトークンを活用した資金調達・貢献者報酬・ユーティリティ提供を行うWeb3プラットフォームです。OSSリポジトリごとにトークンを発行し、そのトークンを通じて支援・参加・インセンティブ循環を行い、OSSの持続的な発展を支えます。

## 🎯 主な機能

- **トークン発行**: OSSプロジェクト毎にXRPL上のトークンを発行
- **資金調達**: プレマネー評価に基づくトークン価格算出と支援金受付
- **貢献者報酬**: コントリビュータへのトークン報酬配布（即時/ベスティング）
- **ユーティリティ**: トークン保有者向け特典（優先サポート、商用ライセンス等）

## 🛠 技術スタック

- **フロントエンド**: Next.js, Firebase Auth, Storybook
- **バックエンド**: Vercel Edge Functions, Firebase (Firestore)
- **ブロックチェーン**: XRPL, Xaman SDK
- **テスト**: Bun Test, Firebase Emulator
- **CI/CD**: GitHub Actions, Vercel

## Vercelのプロジェクト

プロジェクトのURLはこちらです: <https://vercel.com/nrhrhysd616-personal/oss-token-platform>

## Firebaseのプロジェクト

プロジェクトのURLはこちらです: <https://console.firebase.google.com/u/0/project/oss-token-platform/overview>

## ⚙️ 環境設定

### 1. 環境変数の設定

`.env.example`ファイルをコピーして`.env`ファイルを作成し、実際の値を設定してください。

```bash
cp .env.example .env
```

### 2. Firebase Admin SDK設定

1. [Firebase Console](https://console.firebase.google.com/u/0/project/oss-token-platform/overview)にアクセス
2. プロジェクト設定 → サービスアカウント
3. 「新しい秘密鍵の生成」をクリック
4. ダウンロードしたJSONファイルから以下の値を`.env`に設定：
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

### 3. GitHub App設定

1. [GitHub Developer Settings](https://github.com/settings/apps)でGitHub Appを作成
2. 以下の権限を設定：
   - Repository metadata: Read
   - Repository contents: Read
   - Issues: Read
   - Pull requests: Read
3. Private keyを生成・ダウンロード
4. `.env`ファイルに設定：
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_APP_CLIENT_ID`
   - `GITHUB_APP_CLIENT_SECRET`
   - `GITHUB_WEBHOOK_SECRET`

### 4. Xaman API設定

1. [Xaman Developer Portal](https://apps.xaman.dev/)でアプリを作成
2. API KeyとAPI Secretを取得
3. `.env`ファイルに設定：
   - `XAMAN_API_KEY`
   - `XAMAN_API_SECRET`
   - `XAMAN_WEBHOOK_URL`

### 5. 開発サーバーの起動

```bash
# 依存関係のインストール
bun install

# Firebase Emulatorの起動
bun run firebase:emulators:start

# 開発サーバーの起動
bun run dev
```

## 🧪 テスト

### テストの実行

```bash
# 全テストの実行
bun run test

# カバレッジ付きテスト実行
bun run test:coverage

# LCOVレポート生成
bun run test:coverage:lcov
```

### テストカバレッジ

現在のテストカバレッジ対象：

- `src/lib/**/*.ts` - ユーティリティ関数、設定ファイル
- `src/app/api/**/*.ts` - APIルート
- `scripts/**/*.ts` - スクリプトファイル
- `index.ts` - ルートファイル

除外対象：

- `**/*.tsx` - Reactコンポーネント（別途テスト予定）
- `**/*.test.ts` - テストファイル
- 設定ファイル類

カバレッジレポートは`coverage/`ディレクトリに生成されます。

<!-- ## 📚 Storybook

UIコンポーネントの開発とドキュメント化にはStorybookを使用しています。

```bash
# 開発サーバーの起動
bun run storybook

# 静的ビルド
bun run build-storybook
```

Storybookは以下のURLで確認できます：

- 開発環境: <http://localhost:6006>
- 本番環境: <https://oss-token-platform.vercel.app/storybook> -->

## 🚀 開発ロードマップ

現在、4週間のMVP開発フェーズを進行中です。詳細は[MVP.md](./docs/MVP.md)をご参照ください。

<!-- ## 🔍 アーキテクチャ

システム設計の詳細については[Architecture.md](Architecture.md)をご参照ください。 -->

## 📋 仕様

詳細な仕様については[Specification.md](./docs/Specification.md)をご参照ください。
