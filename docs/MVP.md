# MVP開発タスク一覧 — 4週間・詳細版

> **目的**: 4 週間で実動可能な最小機能 (MVP) をローンチするため、週次および日次レベルまでタスクを細分化します。各タスクは **Issue** 化し、GitHub Projects で進捗管理します。

## Week 0 ─ Kick‑off & 基盤整備

| No.  | カテゴリ   | タスク                                            | 担当  | 完了条件                                      |
| ---- | ---------- | ------------------------------------------------- | ----- | --------------------------------------------- |
| 0‑1  | DevOps     | **リポジトリ戦略決定** (mono vs multi)            | PM    | 決定事項を ADR に記録                         |
| 0‑2  | DevOps     | GitHub Org & Repo 作成                            | PM    | `main` ブランチ保護 & CODEOWNERS 設定         |
| 0‑3  | DevOps     | ESLint + Prettier + Stylelint + TypeScript 導入   | FE    | `bun run lint` でエラー 0                     |
| 0‑4  | DevOps     | Commitlint + Husky 設定                           | FE    | PR で Conventional Commit 強制                |
| 0‑5  | CI         | GitHub Actions: **Lint / Unit / Build** Workflow  | BE    | main への PR で全ジョブ成功                   |
| 0‑6  | CI         | GitHub Actions: **Vercel Preview** Workflow       | BE    | PR に Preview URL が自動コメント              |
| 0‑7  | Cloud      | Firebase プロジェクト作成 & Firestore 有効化      | Infra | Emulator Suite 起動 & read/write OK           |
| 0‑8  | Cloud      | Firestore セキュリティルール v0                   | BE    | `firebase deploy --only firestore:rules` 成功 |
| 0‑9  | Cloud      | Vercel プロジェクト作成                           | Infra | Preview & Prod 環境 URL 発行                  |
| 0‑10 | Blockchain | XRPL Testnet **Issuer / Treasury** ウォレット生成 | BE    | 残高取得 & 秘密鍵を 1Password 登録            |
| 0‑11 | PM         | GitHub Projects ボード & Issue テンプレ作成       | PM    | テンプレートが選択可能                        |
| 0‑12 | PM         | すべての Week0 タスクを Issue 化 & アサイン       | PM    | Projects カンバンに反映                       |

## Week 1 ─ 認証 & ウォレット連携

### フロントエンド

| No. | タスク                              | 完了条件                                           |
| --- | ----------------------------------- | -------------------------------------------------- |
| 1‑1 | Next.js に Firebase Auth 導入       | GitHub OAuth認証フロー成功                         |
| 1‑2 | Firestore ユーザー管理実装          | ユーザードキュメント `{uid, githubId, email}` 保存 |
| 1‑3 | ヘッダーナビ + サインイン/アウト UI | auth状態変化をリアルタイム反映                     |
| 1‑4 | Wallet Link ステッパー UI           | 未連携時に Xaman QR モーダル誘導                   |

### バックエンド / XRPL

| No. | タスク                                               | 完了条件                       |
| --- | ---------------------------------------------------- | ------------------------------ |
| 1‑5 | Xaman Dev App 登録 & API Key 取得                    | `.env` に保存                  |
| 1‑6 | `/api/xaman/create` Edge Function                    | QR payload JSON 返却           |
| 1‑7 | `/api/xaman/callback` Edge Function                  | 署名検証 → wallet address 保存 |
| 1‑8 | Firestore users: `wallet`, `linkedAt` フィールド追加 | Link 時に更新                  |

### テスト

| No. | タスク                       | 完了条件            |
| --- | ---------------------------- | ------------------- |
| 1‑9 | Jest 単体テスト (auth utils) | `bun run test` pass |

## Week 2 ─ プロジェクト登録 & トークン発行

### フロントエンド

| No. | タスク                                          | 完了条件                               |
| --- | ----------------------------------------------- | -------------------------------------- |
| 2‑1 | プロジェクト登録フォーム (Repo URL, name, desc) | フォームバリデーション・プレビュー完了 |
| 2‑2 | プロジェクト一覧 & 詳細ページ scaffold          | `/projects/[id]` ルート動作            |

### バックエンド

| No. | タスク                                   | 完了条件                                                    |
| --- | ---------------------------------------- | ----------------------------------------------------------- |
| 2‑3 | `/api/projects` POST                     | GitHub API で URL 存在チェック & Firestore 保存             |
| 2‑4 | Firestore `projects` コレクション設計    | `ownerUid, repo, tokenCode, ...` 定義                       |
| 2‑5 | XRPL Token Issue Service                 | `TrustSet` + `AccountSet` + `Payment` tx 発行 & TxHash 保存 |
| 2‑6 | `/api/projects/{id}/issueToken` Function | プロジェクト登録後に呼ばれ TX 完了                          |

### テスト / QA

| No. | タスク                                      | 完了条件 |
| --- | ------------------------------------------- | -------- |
| 2‑7 | mocha + xrpl-mock で Token Issue 単体テスト | pass     |

### フロントエンド（追加）

| No. | タスク                      | 完了条件      |
| --- | --------------------------- | ------------- |
| 2‑9 | Xaman WebSocket待機処理実装 | Issue #49参照 |

## Week 3 ─ 寄付受付 & 価格アルゴリズム基盤

### フロントエンド

| No. | タスク                           | 完了条件                  |
| --- | -------------------------------- | ------------------------- |
| 3‑1 | 寄付ページ UI (XRP address + QR) | Copy & Explorer link 有効 |
| 3‑2 | リアルタイム寄付ステータス表示   | listener で更新           |

### バックエンド

| No. | タスク                                             | 完了条件                                                |
| --- | -------------------------------------------------- | ------------------------------------------------------- |
| 3‑3 | XRPL Payment Webhook Listener (websocket)          | 寄付 TX → Firestore `donations` 保存                    |
| 3‑4 | 価格算出アルゴリズム API `/api/price`              | `P = base * (1 + donation/softCap)^k` 算出 & 単体テスト |
| 3‑5 | Mint & Transfer Worker                             | donation イベントでトークン発行 → donor address へ送付  |
| 3‑6 | Firestore `tokenStats` サマリー更新 Cloud Function | supply, price, donors 集計                              |

### テスト

| No. | タスク                                               | 完了条件 |
| --- | ---------------------------------------------------- | -------- |
| 3‑7 | 統合テストスクリプト: テスト送金 3 件 → 自動配布検証 | pass     |

## Week 4 ─ UI/UX 仕上げ & デプロイ

### フロントエンド

| No. | タスク                                         | 完了条件                       |
| --- | ---------------------------------------------- | ------------------------------ |
| 4‑1 | ダッシュボード: 残高 / 寄付履歴 / 価格チャート | Recharts で表示 & モバイル対応 |
| 4‑2 | プロジェクト公開ページ: 寄付ボタン & Stats     | SEO meta & OG 設定             |

### QA & リリース

| No. | タスク                              | 完了条件                                                              |
| --- | ----------------------------------- | --------------------------------------------------------------------- |
| 4‑3 | 基本動作確認テスト                  | 主要機能の動作確認完了                                                |
| 4‑4 | Lighthouse Performance Audit (>85)  | レポート添付                                                          |
| 4‑5 | Vercel Prod デプロイ & 独自ドメイン | [https://oss-token.example.com](https://oss-token.example.com) で稼働 |
| 4‑6 | README + Architecture 図 (Mermaid)  | `docs/architecture.md` 完成                                           |
| 4‑7 | Git タグ v0.1.0 + GitHub Release    | Changelog 追加                                                        |

## クロスカッティング / 継続タスク

- **セキュリティ**: Helmet, CSRF, Upstash Rate Limit, Firebase Rules Harden。
- **ロギング**: Vercel Analytics + Sentry SDK + XRPL tx logger。
- **モニタリング**: Healthcheck Endpoint `/api/health` + Slack Webhook 通知。
- **ドキュメント**: API仕様書作成。
- **デザイン**: シンプルで実用的なUI設計。

> **次アクション**
>
> 1. チームメンバーへタスク割当 (0‑12)。
> 2. 価格決定ロジック詳細は別スレッドで要件整理 → 3‑4 を確定化。
> 3. Week 0 タスク実行を直ちに開始。
