# Firestore インデックス設定ドキュメント

このドキュメントでは、`firestore.indexes.json`で定義されているインデックスの用途と使用箇所を説明します。

## インデックス一覧

### 1. ownerUid + createdAt (DESC)

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

### 2. status + createdAt (DESC)

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
- API: `GET /api/projects` - 公開プロジェクト一覧

**クエリ例**:

```typescript
db.collection(FIRESTORE_COLLECTIONS.PROJECTS)
  .where('status', '==', 'active')
  .orderBy('createdAt', 'desc')
```

### 3. ownerUid + status + createdAt (DESC)

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

### 4. name + ownerUid

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

### 5. repositoryUrl (単一フィールドインデックス)

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

## 関連ファイル

- `firestore.indexes.json` - インデックス定義
- `src/services/ProjectService.ts` - 主要な使用箇所
- `src/validations/project.ts` - クエリパラメータの定義
- `src/app/api/projects/route.ts` - 公開API
- `src/app/api/management/projects/route.ts` - 管理API
