# 寄付履歴におけるRLUSD換算方式の改善について

価格計算における寄付総額のRLUSD換算方式を、現在レート一括換算から履歴ベース換算に改善する提案

## ステータス

Proposed

## コンテキスト

現在の価格計算システムでは、`calculateRLUSDPrice`関数において以下の処理を行っている：

```typescript
// XRP寄付をRLUSD換算
const totalDonationsRLUSD = totalDonationsXRP * xrpToRlusdRate
```

この実装では、過去の全てのXRP寄付を現在のXRP/RLUSDレートで一括換算している。

### 問題点

1. **XRP価格変動による歪み**

   - XRPが大幅に上昇した場合：過去の寄付が実際より高く評価される
   - XRPが大幅に下落した場合：過去の寄付が実際より低く評価される

2. **価格計算の不正確性**

   - 寄付時点での実際の価値と現在の換算価値に乖離が生じる
   - 長期間にわたって寄付が蓄積されたプロジェクトで影響が顕著

3. **価格式の設計意図との乖離**
   - RLUSD建て価格式はXRPボラティリティ対策として設計されている
   - しかし寄付総額の換算で再びボラティリティの影響を受けている

### 現在の実装箇所

- `src/lib/pricing/calculator.ts` - `calculateRLUSDPrice`関数
- `src/services/PricingService.ts` - `getTotalDonations`メソッド

## 決定内容

寄付履歴におけるRLUSD換算方式を以下のように改善する：

### 1. 寄付記録時の改善

寄付完了時に当時のXRP/RLUSDレートでRLUSD換算値を記録する：

```typescript
// DonationRecord型の拡張
type DonationRecord = {
  // 既存フィールド
  amount: number // XRP金額

  // 追加フィールド
  amountRLUSD: number // 寄付時点でのRLUSD換算額
  exchangeRate: number // 寄付時点でのXRP/RLUSDレート
  exchangeRateTimestamp: Date // レート取得時刻
}
```

### 2. 価格計算時の改善

`PricingService.getTotalDonations()`を履歴ベースの計算に変更する：

```typescript
static async getTotalDonations(projectId: string): Promise<number> {
  const donationsSnapshot = await db
    .collection('donationRecords')
    .where('projectId', '==', projectId)
    .where('status', '==', 'completed')
    .get()

  let totalDonationsRLUSD = 0
  donationsSnapshot.forEach(doc => {
    const donation = doc.data()
    // 履歴に保存されたRLUSD換算額を使用
    totalDonationsRLUSD += donation.amountRLUSD || 0
  })

  return totalDonationsRLUSD
}
```

### 3. 既存データの移行処理

既存の寄付記録に対して、記録時点での推定レートでRLUSD換算値を補完する移行スクリプトを作成する。

### 4. 実装順序

1. `DonationRecord`型の拡張
2. 寄付完了処理での換算値記録機能追加
3. `getTotalDonations`メソッドの変更
4. 既存データ移行スクリプト作成・実行
5. テスト・検証

## 影響

### 良い影響

1. **価格計算の正確性向上**

   - 寄付時点での実際の価値を正確に反映
   - XRP価格変動による歪みを排除

2. **システムの一貫性向上**

   - RLUSD建て価格式の設計意図と実装が一致
   - 長期的な価格安定性の向上

3. **監査性の向上**
   - 各寄付の換算レートが記録され、計算過程が透明

### 悪い影響・課題

1. **実装複雑性の増加**

   - 寄付記録時の処理が複雑化
   - レート取得失敗時のエラーハンドリングが必要

2. **データ移行の必要性**

   - 既存の寄付記録への対応が必要
   - 移行処理の設計・実装・検証コスト

3. **ストレージ使用量の増加**

   - 各寄付記録にRLUSD換算値とレート情報を保存

4. **後方互換性への配慮**
   - 移行期間中の新旧データ混在への対応

### リスク軽減策

1. **段階的移行**

   - 新規寄付から新方式を適用
   - 既存データは別途移行処理で対応

2. **フォールバック機能**

   - RLUSD換算値が存在しない場合は現在の方式を使用
   - 移行期間中の安定性を確保

3. **十分なテスト**
   - 移行前後での価格計算結果の検証
   - エッジケースでの動作確認

## 参照

- `docs/pricing-algorithm-implementation.md` - 価格算出アルゴリズム実装ドキュメント
- `src/lib/pricing/calculator.ts` - 現在の価格計算実装
- `src/services/PricingService.ts` - 価格算出サービス
- `src/services/DonationService.ts` - 寄付サービス
- `src/types/donation.ts` - 寄付関連型定義
