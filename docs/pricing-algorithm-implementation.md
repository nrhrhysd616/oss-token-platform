# 価格算出アルゴリズム実装ドキュメント

## 概要

MVPの価格算出アルゴリズムを実装しました。RLUSD建ての価格式を使用し、品質スコアと寄付累計額に基づいてトークン価格を動的に算出します。

## 価格算出式

```math
P_RL = P0 + αQ + β*log(1 + F_RL/F0)
```

### パラメータ

| 記号   | 初期値         | 説明                                                                |
| ------ | -------------- | ------------------------------------------------------------------- |
| `P0`   | **0.2 RLUSD**  | 寄付ゼロでも付く床価格                                              |
| `α`    | **0.45**       | 品質スコア `Q` の影響係数                                           |
| `β`    | **0.075**      | 寄付累計 `F_RL` の影響係数                                          |
| `F0`   | **3000 RLUSD** | ログ曲線の緩さ（基準寄付額）                                        |
| `Q`    | 0〜1           | ⭐、DL、コミット更新度、Issue、Discussion、Docs、サポートの加重平均 |
| `F_RL` | —              | XRP寄付をRLUSD換算した累積額                                        |

## ファイル構成と処理内容

### 型定義

#### `src/types/pricing.ts`

- **処理内容**: 価格算出関連の型定義
- **主要な型**:
  - `PricingParameters`: 価格算出パラメータ（P0, α, β, F0）
  - `QualityParameter`: 品質指標パラメータ（重み、正規化設定）
  - `QualityScore`: 品質スコア（総合スコアと内訳）
  - `TokenPrice`: トークン価格（RLUSD・XRP）
  - `PriceHistoryRecord`: 価格履歴レコード
  - `GitHubMetrics`: GitHub指標の生データ

#### `src/types/project.ts`（拡張）

- **処理内容**: Project型に品質スコアと価格情報を追加
- **追加フィールド**:
  - `qualityScore?: QualityScore`
  - `currentPrice?: TokenPrice`

### 価格計算ロジック

#### `src/lib/pricing/calculator.ts`

- **処理内容**: 価格算出の核となる計算ロジック
- **主要な関数**:
  - `calculateRLUSDPrice()`: RLUSD建て価格算出
  - `convertRLUSDToXRP()`: RLUSD→XRP変換
  - `calculateTokenPrice()`: 統合価格計算
  - `validatePricingInputs()`: 入力値バリデーション

#### `src/lib/pricing/normalizer.ts`

- **処理内容**: 品質指標の正規化処理
- **主要な関数**:
  - `normalizeMetric()`: 指標値の正規化（線形・対数・逆数）
  - `createQualityScoreBreakdown()`: GitHub指標→品質スコア内訳変換
  - `calculateOverallQualityScore()`: 総合品質スコア計算
  - `validateNormalizationConfig()`: 正規化設定バリデーション

#### `src/lib/pricing/rate-converter.ts`

- **処理内容**: XRP/RLUSDレート変換機能
- **主要な関数**:
  - `getXRPToRLUSDRate()`: レート取得（モック実装）
  - `getCachedXRPToRLUSDRate()`: キャッシュ機能付きレート取得
  - `convertXRPToRLUSD()`: XRP→RLUSD変換
  - `convertRLUSDToXRP()`: RLUSD→XRP変換

#### `src/lib/pricing/quality-metrics.ts`

- **処理内容**: GitHub品質指標取得機能
- **主要な関数**:
  - `fetchGitHubMetrics()`: GitHubリポジトリの品質指標取得
  - `fetchRecentCommits()`: 最近のコミット情報取得
  - `fetchIssueMetrics()`: Issue関連指標取得
  - `fetchReleaseMetrics()`: リリース・ダウンロード指標取得

### サービス層

#### `src/services/QualityScoreService.ts`

- **処理内容**: 品質スコア管理サービス
- **主要な機能**:
  - `updateQualityScore()`: プロジェクトの品質スコア更新
  - `getQualityScore()`: 品質スコア取得
  - `calculateQualityScore()`: 品質スコア計算
  - `getQualityParameters()`: 品質パラメータ取得
  - `updateAllQualityScores()`: 全プロジェクト一括更新
  - `getStaleQualityScores()`: 古い品質スコアの検出
  - `getQualityScoreStats()`: 品質スコア統計情報

#### `src/services/PricingService.ts`

- **処理内容**: 価格算出サービス
- **主要な機能**:
  - `calculateTokenPrice()`: トークン価格計算
  - `updatePriceHistory()`: 価格履歴更新
  - `getTotalDonations()`: 寄付総額取得
  - `getPricingParameters()`: 価格算出パラメータ取得
  - `getPriceHistory()`: 価格履歴取得
  - `updateMultiplePrices()`: 複数プロジェクト価格一括更新
  - `getStalePrices()`: 古い価格の検出
  - `getPriceStats()`: 価格統計情報

#### `src/services/DonationService.ts`（拡張）

- **処理内容**: 寄付完了時の価格更新トリガー追加
- **追加機能**:
  - `completeDonationRequest()`内で`PricingService.updatePriceHistory()`を非同期実行
  - 寄付完了→価格自動更新の連携

### API層

#### `src/app/api/projects/[id]/price/route.ts`

- **処理内容**: プロジェクト価格取得・更新API
- **エンドポイント**:
  - `GET /api/projects/[id]/price`: 現在価格取得
    - 現在価格（RLUSD・XRP）
    - 品質スコア
    - 寄付総額
    - 価格履歴（最新10件）
  - `POST /api/projects/[id]/price`: 手動価格更新
    - 価格履歴更新
    - 更新後価格返却

### 初期データ設定

#### `scripts/setup-pricing-data.ts`

- **処理内容**: 価格算出システムの初期データ設定
- **設定内容**:
  - 価格算出パラメータ（P0=1.0, α=3.0, β=1.0, F0=5000）
  - 品質指標パラメータ（7種類の指標と重み設定）
- **実行方法**: `bun run setup:pricing`

#### `package.json`（拡張）

- **追加スクリプト**: `"setup:pricing": "bun scripts/setup-pricing-data.ts"`

## Firestoreコレクション設計

### `pricingParameters`

- **ドキュメントID**: `global`
- **フィールド**:
  - `basePrice`: 床価格（P0）
  - `qualityCoefficient`: 品質係数（α）
  - `donationCoefficient`: 寄付係数（β）
  - `referenceDonation`: 基準寄付額（F0）
  - `lastUpdated`: 最終更新日時

### `qualityParameters`

- **ドキュメントID**: 指標ID（`stars`, `downloads`, `commits`, etc.）
- **フィールド**:
  - `name`: 指標名
  - `weight`: 重み（0-1）
  - `normalizationConfig`: 正規化設定
    - `maxValue`: 最大値
    - `minValue`: 最小値
    - `type`: 正規化タイプ（`linear`, `logarithmic`, `inverse`）
  - `enabled`: 有効フラグ

### `projects`（拡張）

- **追加フィールド**:
  - `qualityScore`: 品質スコア情報
    - `overall`: 総合スコア（0-1）
    - `breakdown`: 各指標の内訳
    - `lastUpdated`: 最終更新日時
  - `currentPrice`: 現在価格
    - `rlusd`: RLUSD価格
    - `xrp`: XRP価格
    - `lastUpdated`: 最終更新日時

### `projects/{projectId}/priceHistory`（サブコレクション）

- **フィールド**:
  - `date`: 日付
  - `priceRLUSD`: RLUSD価格
  - `priceXRP`: XRP価格
  - `qualityScore`: その時点の品質スコア
  - `totalDonations`: その時点の寄付総額
  - `trigger`: 更新トリガー（`donation`, `github_update`, `manual`）

## 品質指標の重み付け設定

| 指標         | 重み | 正規化タイプ | 説明                                         |
| ------------ | ---- | ------------ | -------------------------------------------- |
| スター数     | 0.30 | linear       | GitHub スター数                              |
| 週間DL数     | 0.25 | linear       | 週間ダウンロード数                           |
| コミット鮮度 | 0.25 | inverse      | 最新コミットからの日数（少ないほど高スコア） |
| Issue数      | 0.20 | linear       | オープンなIssue数                            |

## 使用方法

### 1. 初期設定

```bash
bun run setup:pricing
```

### 2. 品質スコア更新

```typescript
import { QualityScoreService } from '@/services/QualityScoreService'
await QualityScoreService.updateQualityScore(projectId)
```

### 3. 価格計算

```typescript
import { PricingService } from '@/services/PricingService'
const price = await PricingService.calculateTokenPrice(projectId)
```

### 4. API使用例

```bash
# 価格取得
GET /api/projects/{projectId}/price

# 手動価格更新
POST /api/projects/{projectId}/price
```

## 自動更新フロー

1. **寄付完了時**: `DonationService.completeDonationRequest()` → `PricingService.updatePriceHistory(projectId, 'donation')`
2. **GitHub更新時**: 定期バッチ処理 → `QualityScoreService.updateAllQualityScores()` → 価格再計算
3. **手動更新時**: API経由 → `PricingService.updatePriceHistory(projectId, 'manual')`

## 特徴

1. **アルゴリズム隠蔽**: パラメータはFirestoreで管理、外部からは詳細が見えない
2. **動的調整**: パラメータをFirestore経由で動的に変更可能
3. **XRPボラティリティ対策**: RLUSD建て価格でボラティリティを軽減
4. **リアルタイム更新**: 寄付完了時に自動価格更新
5. **GitHub連携**: 自動的な品質指標取得と更新
6. **拡張性**: 新しい指標の追加や重み調整が容易
7. **監査性**: 価格履歴とトリガーを記録
8. **エラーハンドリング**: 各段階での適切なエラー処理

## 今後の拡張予定

1. **レート取得の実装**: モック実装から実際のXRP/RLUSDレート取得APIへの置き換え
2. **キャッシュ機能**: 価格計算結果のキャッシュ機能追加
3. **バッチ処理**: GitHub指標の定期更新バッチ処理
4. **アラート機能**: 異常値検出とアラート
5. **A/Bテスト**: 異なるアルゴリズムの比較機能
