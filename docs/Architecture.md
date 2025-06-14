# OSS Token Platform - アーキテクチャドキュメント

## 概要

OSS Token Platformは、GitHubとXRPLを連携したオープンソースプロジェクト向けトークン化プラットフォームです。OSSプロジェクトごとにトークンを発行し、寄付・貢献者報酬・ユーティリティ提供を通じてOSSの持続的な発展を支援します。

## システム全体アーキテクチャ

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js UI]
        Auth[Firebase Auth]
        Wallet[Xaman Wallet]
    end

    subgraph "API Layer"
        API[Next.js API Routes]
        Middleware[認証・認可ミドルウェア]
    end

    subgraph "Service Layer"
        PS[ProjectService]
        DS[DonationService]
        PRS[PricingService]
        QS[QualityScoreService]
        WS[WalletLinkService]
    end

    subgraph "Data Layer"
        FB[Firestore]
        Cache[キャッシュ層]
    end

    subgraph "External Services"
        GH[GitHub API]
        XRPL[XRPL Network]
        Xaman[Xaman API]
    end

    UI --> Auth
    UI --> API
    Auth --> Middleware
    API --> Middleware
    Middleware --> PS
    Middleware --> DS
    Middleware --> PRS
    Middleware --> QS
    Middleware --> WS

    PS --> FB
    DS --> FB
    PRS --> FB
    QS --> FB
    WS --> FB

    PS --> GH
    DS --> XRPL
    DS --> Xaman
    WS --> Xaman

    FB --> Cache
```

## 技術スタック

### フロントエンド

- **Next.js**: React フレームワーク（App Router使用）
- **TypeScript**: 型安全性の確保
- **Tailwind CSS**: スタイリング
- **React Hot Toast**: 通知システム

### バックエンド

- **Next.js API Routes**: サーバーサイドAPI
- **Firebase Admin SDK**: サーバーサイド認証・データベース操作

### データベース・認証

- **Firebase Firestore**: NoSQLデータベース
- **Firebase Auth**: 認証システム（GitHub OAuth）

### ブロックチェーン

- **XRPL (XRP Ledger)**: トークン発行・送金
- **Xaman SDK**: ウォレット連携・署名

### 開発・テスト

- **Bun**: パッケージマネージャー・テストランナー
- **ESLint + Prettier**: コード品質・フォーマット
- **Playwright**: E2Eテスト
- **Husky + Commitlint**: Git フック・コミット規約

### CI/CD・インフラ

- **Vercel**: ホスティング・デプロイ

## データベース設計

### Firestoreコレクション構造

```mermaid
erDiagram
    users {
        string uid PK
        string email
        string githubId
        string displayName
        string avatarUrl
        timestamp createdAt
        timestamp updatedAt
    }

    wallets {
        string id PK
        string userId FK
        string address
        boolean isActive
        timestamp linkedAt
        timestamp createdAt
    }

    projects {
        string id PK
        string name
        string description
        string repositoryUrl
        string ownerUid FK
        string githubOwner
        string githubRepo
        number githubInstallationId
        string tokenCode
        string issuerAddress
        array donationUsages
        string status
        timestamp createdAt
        timestamp updatedAt
    }

    donationRequests {
        string id PK
        string projectId FK
        string donorUid FK
        number xrpAmount
        number destinationTag
        string verificationHash
        string status
        string xamanPayloadUuid
        string txHash
        timestamp createdAt
        timestamp expiresAt
        timestamp completedAt
    }

    donationRecords {
        string id PK
        string requestId FK
        string projectId FK
        string donorAddress
        string donorUid FK
        number xrpAmount
        string txHash
        number destinationTag
        string verificationHash
        boolean tokenIssued
        number tokenAmount
        string tokenTxHash
        timestamp tokenIssuedAt
        string tokenIssueStatus
        timestamp createdAt
        timestamp updatedAt
    }

    qualityScores {
        string id PK
        string projectId FK
        number totalScore
        number starScore
        number commitScore
        number issueScore
        number prScore
        number contributorScore
        timestamp calculatedAt
        timestamp createdAt
        timestamp updatedAt
    }

    tokenPrices {
        string id PK
        string projectId FK
        number basePrice
        number currentPrice
        number totalDonationAmount
        number qualityMultiplier
        timestamp calculatedAt
        timestamp createdAt
    }

    users ||--o{ wallets : "has"
    users ||--o{ projects : "owns"
    users ||--o{ donationRequests : "creates"
    projects ||--o{ donationRequests : "receives"
    projects ||--o{ donationRecords : "receives"
    projects ||--o{ qualityScores : "has"
    projects ||--o{ tokenPrices : "has"
    donationRequests ||--o| donationRecords : "completes"
```

## API設計

### 認証・認可フロー

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Firebase Auth
    participant API
    participant Firestore

    User->>Frontend: アクセス
    Frontend->>Firebase Auth: 認証状態確認
    Firebase Auth-->>Frontend: 認証トークン
    Frontend->>API: リクエスト（Bearer Token）
    API->>Firebase Auth: トークン検証
    Firebase Auth-->>API: ユーザー情報
    API->>Firestore: データ操作
    Firestore-->>API: レスポンス
    API-->>Frontend: APIレスポンス
    Frontend-->>User: 画面表示
```

### 主要APIエンドポイント

#### プロジェクト管理

- `GET /api/projects` - 公開プロジェクト一覧
- `POST /api/projects` - プロジェクト作成
- `GET /api/projects/[id]` - プロジェクト詳細
- `PUT /api/projects/[id]` - プロジェクト更新
- `GET /api/management/projects` - メンテナー向けプロジェクト一覧

#### 寄付システム

- `POST /api/xaman/donations/create` - 寄付セッション作成
- `GET /api/xaman/donations/[requestId]` - 寄付ステータス確認
- `POST /api/xaman/callback` - Xamanコールバック処理

#### ウォレット連携

- `POST /api/xaman/wallets` - ウォレット連携開始
- `GET /api/xaman/wallets/link-status` - 連携ステータス確認

#### 統計・分析

- `GET /api/donor/stats` - 寄付者統計
- `GET /api/maintainer/stats` - メンテナー統計

## 寄付フロー

```mermaid
sequenceDiagram
    participant Donor
    participant Frontend
    participant API
    participant Xaman
    participant XRPL
    participant Firestore

    Donor->>Frontend: 寄付金額入力
    Frontend->>API: POST /api/xaman/donations/create
    API->>Firestore: DonationRequest作成
    API->>Xaman: ペイロード作成
    Xaman-->>API: QRコード・WebSocket URL
    API-->>Frontend: 寄付セッション情報
    Frontend-->>Donor: QRコード表示

    Donor->>Xaman: QRコードスキャン
    Xaman->>Donor: 署名確認
    Donor->>Xaman: 署名実行
    Xaman->>XRPL: トランザクション送信
    XRPL-->>Xaman: トランザクション確認
    Xaman->>API: POST /api/xaman/callback

    API->>Firestore: DonationRecord作成
    API->>XRPL: トークン発行・送付
    XRPL-->>API: トークン送付完了
    API->>Firestore: トークン発行記録更新
    API-->>Frontend: WebSocket通知
    Frontend-->>Donor: 寄付完了通知
```

## トークン価格算出システム

### 価格算出アルゴリズム

```mermaid
graph TD
    A[プロジェクト情報] --> B[基準価格取得]
    C[寄付総額] --> D[寄付係数計算]
    E[GitHub統計] --> F[品質係数計算]

    B --> G[価格算出]
    D --> G
    F --> G

    G --> H[トークン価格]

    subgraph "価格算出式"
        I["価格 = 基準価格 × (1 + 寄付係数) × (1 + 品質係数)"]
    end
```

### 品質スコア計算

```typescript
// 品質スコア算出ロジック
const qualityScore = {
  starScore: Math.min(stars / 1000, 1.0) * 20,
  commitScore: Math.min(commits / 100, 1.0) * 15,
  issueScore: Math.min(issues / 50, 1.0) * 10,
  prScore: Math.min(pullRequests / 20, 1.0) * 10,
  contributorScore: Math.min(contributors / 10, 1.0) * 15,
}
```

## セキュリティ設計

### 認証・認可

- Firebase Auth による GitHub OAuth 認証
- JWT トークンベースの API 認証
- Firestore セキュリティルールによるデータアクセス制御

### XRPL セキュリティ

- マルチシグネチャウォレット対応
- 秘密鍵の暗号化保存
- トランザクション署名の検証

### API セキュリティ

- CORS 設定
- レート制限
- 入力値検証（Zod スキーマ）
- SQL インジェクション対策（NoSQL使用）

## パフォーマンス最適化

### フロントエンド

- Next.js App Router による自動コード分割

### データベース

- Firestore インデックス最適化
- クエリ最適化

## デプロイメント

### 環境構成

```mermaid
graph LR
    A[開発環境] --> B[ステージング環境]
    B --> C[本番環境]

    subgraph "開発環境"
        D[localhost:3000]
        E[Firebase Development]
        F[XRPL Testnet]
    end

    subgraph "ステージング環境"
        G[Vercel Preview]
        H[Firebase Staging]
        I[XRPL Testnet]
    end

    subgraph "本番環境"
        J[Vercel Production]
        K[Firebase Production]
        L[XRPL Mainnet]
    end
```

## 拡張性・スケーラビリティ

### 水平スケーリング

- Vercel の自動スケーリング
- Firebase の自動スケーリング
- XRPL の分散処理

### 垂直スケーリング

- Edge Functions の活用
- データベースクエリ最適化
- キャッシュ戦略の改善

## 開発ガイドライン

### コーディング規約

- TypeScript strict モード
- ESLint + Prettier による自動フォーマット
- Conventional Commits
- 関数型プログラミングの推奨

### テスト戦略

- 単体テスト（Bun Test）
- 統合テスト
- E2E テスト（Playwright）
- パフォーマンステスト

### ドキュメント管理

- ADR（Architecture Decision Record）
- API ドキュメント
- 運用手順書
- トラブルシューティングガイド

## トラブルシューティング

### よくある問題と解決方法

#### Firebase 接続エラー

```bash
# 環境変数の確認
echo $FIREBASE_PROJECT_ID

# Firebase プロジェクト接続確認
firebase projects:list
```

#### XRPL 接続エラー

```bash
# ネットワーク状態確認
curl -X POST https://s.altnet.rippletest.net:51234 \
  -H "Content-Type: application/json" \
  -d '{"method":"server_info","params":[]}'
```

#### Xaman 連携エラー

```bash
# ngrok の起動確認（開発環境）
ngrok http 3000

# コールバック URL の確認
echo $XUMM_CALLBACK_URL
```

## 参考資料

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [XRPL Documentation](https://xrpl.org/docs.html)
- [Xaman Developer Documentation](https://docs.xaman.app/)
- [Vercel Documentation](https://vercel.com/docs)

---

このドキュメントは継続的に更新され、システムの成長とともに進化していきます。
