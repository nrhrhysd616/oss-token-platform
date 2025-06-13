# Firestore インデックス設定ドキュメント

このドキュメントでは、`firestore.indexes.json`で定義されているインデックスの用途と使用箇所を説明します。

## インデックス一覧

### Projects コレクション

#### 1. ownerUid + createdAt (DESC)

```json
{
  "collectionGroup": "projects",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerUid", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: メンテナーのプロジェクト一覧取得（作成日時降順）

**使用箇所**:

- `ProjectService.getMaintainerProjects()` - statusフィルタなしの場合
- API: `GET /api/management/projects` - メンテナー向けプロジェクト一覧

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS)
  .where('ownerUid', '==', userId)
  .orderBy('createdAt', 'desc')
```

#### 2. status + createdAt (DESC)

```json
{
  "collectionGroup": "projects",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 公開プロジェクト一覧取得（ステータス別、作成日時降順）

**使用箇所**:

- `ProjectService.getPublicProjects()` - status='active'でフィルタ
- `PricingService.getStalePrices()` - status='active'でフィルタ
- `PricingService.getPriceStats()` - status='active'でフィルタ
- API: `GET /api/projects` - 公開プロジェクト一覧

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS)
  .where('status', '==', 'active')
  .orderBy('createdAt', 'desc')
```

#### 3. ownerUid + status + createdAt (DESC)

```json
{
  "collectionGroup": "projects",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ownerUid", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: メンテナーのプロジェクト一覧取得（ステータス別フィルタ付き）

**使用箇所**:

- `ProjectService.getMaintainerProjects()` - statusフィルタありの場合
- API: `GET /api/management/projects?status=active` - ステータス指定時

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS)
  .where('ownerUid', '==', userId)
  .where('status', '==', 'active')
  .orderBy('createdAt', 'desc')
```

#### 4. name + ownerUid

```json
{
  "collectionGroup": "projects",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "name", "order": "ASCENDING" },
    { "fieldPath": "ownerUid", "order": "ASCENDING" }
  ]
}
```

**用途**: プロジェクト名の重複チェック（同一オーナー内）

**使用箇所**:

- `ProjectService.validateUniqueConstraints()` - プロジェクト作成・更新時
- API: `POST /api/management/projects` - プロジェクト作成時
- API: `PUT /api/management/projects/[id]` - プロジェクト更新時

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS)
  .where('name', '==', projectName)
  .where('ownerUid', '==', userId)
```

#### 5. repositoryUrl (単一フィールドインデックス)

```json
{
  "collectionGroup": "projects",
  "fieldPath": "repositoryUrl",
  "indexes": [
    {
      "order": "ASCENDING",
      "queryScope": "COLLECTION"
    }
  ]
}
```

**用途**: リポジトリURLの重複チェック（全体）

**使用箇所**:

- `ProjectService.validateUniqueConstraints()` - プロジェクト作成・更新時
- API: `POST /api/management/projects` - プロジェクト作成時
- API: `PUT /api/management/projects/[id]` - プロジェクト更新時

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS).where('repositoryUrl', '==', repoUrl)
```

### DonationRecords コレクション

#### 6. projectId + status

```json
{
  "collectionGroup": "donationRecords",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "projectId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

**用途**: プロジェクト別寄付総額取得（完了ステータスのみ）

**使用箇所**:

- `PricingService.getTotalDonations()` - プロジェクト別寄付総額計算

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
  .where('projectId', '==', projectId)
  .where('status', '==', 'completed')
```

#### 7. projectId + createdAt (DESC)

```json
{
  "collectionGroup": "donationRecords",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "projectId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: プロジェクト別寄付履歴取得

**使用箇所**:

- `DonationHistoryManager.getDonationHistory()` - プロジェクトフィルタ付き
- `DonationHistoryManager.getProjectDonationStats()` - プロジェクト統計

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
  .where('projectId', '==', projectId)
  .orderBy('createdAt', 'desc')
```

#### 8. donorAddress + createdAt (DESC)

```json
{
  "collectionGroup": "donationRecords",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "donorAddress", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 寄付者別寄付履歴取得

**使用箇所**:

- `DonationHistoryManager.getDonationHistory()` - 寄付者フィルタ付き
- `DonationHistoryManager.getDonorDonationHistory()` - 寄付者履歴

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
  .where('donorAddress', '==', donorAddress)
  .orderBy('createdAt', 'desc')
```

#### 9. donorUid + createdAt (DESC)

```json
{
  "collectionGroup": "donationRecords",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "donorUid", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: ユーザーID別寄付履歴取得

**使用箇所**:

- `DonationHistoryManager.getDonationHistory()` - ユーザーIDフィルタ付き

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
  .where('donorUid', '==', donorUid)
  .orderBy('createdAt', 'desc')
```

#### 10. tokenIssueStatus + createdAt (DESC)

```json
{
  "collectionGroup": "donationRecords",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tokenIssueStatus", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: トークン発行ステータス別寄付履歴取得

**使用箇所**:

- `DonationHistoryManager.getDonationHistory()` - ステータスフィルタ付き

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
  .where('tokenIssueStatus', '==', status)
  .orderBy('createdAt', 'desc')
```

### PriceHistory サブコレクション

#### 11. date (DESC)

```json
{
  "collectionGroup": "priceHistory",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "date", "order": "DESCENDING" }]
}
```

**用途**: プロジェクト別価格履歴取得

**使用箇所**:

- `PricingService.getPriceHistory()` - 価格履歴取得

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS)
  .doc(projectId)
  .collection(FIRESTORE_COLLECTIONS.PRICE_HISTORY)
  .orderBy('createdAt', 'desc')
```

## パフォーマンス考慮事項

### ソート対応

現在のインデックス設定では以下のソートパターンに対応：

1. **createdAt降順** - 全てのインデックスで対応済み
2. **name昇順** - name + ownerUidインデックスで部分対応
3. **updatedAt** - 現在インデックス未対応

### 将来の拡張予定

以下のクエリパターンが必要になった場合、追加インデックスが必要：

1. **updatedAt でのソート**:

   ```json
   {
     "fields": [
       { "fieldPath": "status", "order": "ASCENDING" },
       { "fieldPath": "updatedAt", "order": "DESCENDING" }
     ]
   }
   ```

2. **name でのソート（公開プロジェクト）**:

   ```json
   {
     "fields": [
       { "fieldPath": "status", "order": "ASCENDING" },
       { "fieldPath": "name", "order": "ASCENDING" }
     ]
   }
   ```

## 注意事項

- JSONファイル自体にはコメントを記載できないため、このドキュメントで管理
- インデックスの追加・変更時は、このドキュメントも合わせて更新すること
- 新しいクエリパターンを追加する際は、必要なインデックスの確認を行うこと

## 複合クエリの考慮事項

### 日付範囲クエリ

`DonationHistoryManager.getDonationHistory()` で `startDate` と `endDate` を同時に使用する場合、以下のような複合インデックスが必要になる可能性があります：

```json
{
  "collectionGroup": "donationRecords",
  "fields": [
    { "fieldPath": "projectId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### 複数フィルタ組み合わせ

複数の条件を組み合わせる場合（例：`projectId` + `donorAddress` + `createdAt`）、さらに多くのインデックスが必要になります。使用頻度を監視して必要に応じて追加してください。

## インデックス作成手順

### 1. 自動作成（推奨）

Firebase CLI を使用してインデックスを自動作成：

```bash
# インデックス設定をデプロイ
firebase deploy --only firestore:indexes

# インデックス作成状況を確認
firebase firestore:indexes
```

### 2. 手動作成

Firebase Console から手動でインデックスを作成することも可能ですが、設定ファイルとの整合性を保つため推奨しません。

### 3. 作成時間

インデックス作成には時間がかかる場合があります（データ量に依存）。作成中もアプリケーションは動作しますが、該当クエリのパフォーマンスが低下する可能性があります。

## パフォーマンス監視

### 推奨監視項目

1. **クエリ実行時間** - Firebase Console の Performance タブで確認
2. **インデックス使用状況** - 未使用インデックスの特定
3. **エラーログ** - インデックス不足によるエラーの監視

### 最適化のポイント

1. **不要なインデックスの削除** - ストレージコスト削減
2. **クエリパターンの見直し** - より効率的なクエリ設計
3. **ページネーション** - 大量データの効率的な取得

## 関連ファイル

- `firestore.indexes.json` - インデックス定義
- `src/services/ProjectService.ts` - プロジェクト関連クエリ
- `src/services/PricingService.ts` - 価格計算関連クエリ
- `src/services/donation/DonationHistoryManager.ts` - 寄付履歴関連クエリ
- `src/validations/project.ts` - クエリパラメータの定義
- `src/app/api/projects/route.ts` - 公開API
- `src/app/api/management/projects/route.ts` - 管理API
