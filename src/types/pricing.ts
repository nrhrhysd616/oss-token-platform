/**
 * 価格算出関連の型定義
 */

/**
 * 価格算出パラメータ（グローバル設定）
 */
export type PricingParameters = {
  basePrice: number // P0 = 1.0 RLUSD - 寄付ゼロでも付く床価格
  qualityCoefficient: number // α = 3.0 - 品質スコアQの影響係数
  donationCoefficient: number // β = 1.0 - 寄付累計F_RLの影響係数
  referenceDonation: number // F0 = 5000 RLUSD - ログ曲線の緩さ（基準寄付額）
  lastUpdated: Date
}

/**
 * 品質指標パラメータ（マスタ設定）
 */
export type QualityParameter = {
  id: string // 'stars', 'downloads', 'commits', 'issues'
  name: string
  weight: number
  normalizationConfig: {
    maxValue: number
    minValue: number
    type: 'linear' | 'logarithmic' | 'inverse'
  }
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 品質指標の実数値と正規化値
 */
export type QualityMetricValue = {
  value: number
  normalized: number
}

/**
 * 品質スコアの内訳
 */
export type QualityScoreBreakdown = {
  stars: QualityMetricValue
  downloads: QualityMetricValue
  commits: QualityMetricValue
  issues: QualityMetricValue
}

/**
 * 品質スコア
 */
export type QualityScore = {
  overall: number // 0-1の範囲
  breakdown: QualityScoreBreakdown
  lastUpdated: Date
}

/**
 * トークン価格
 */
export type TokenPrice = {
  rlusd: number
  xrp: number
  lastUpdated: Date
}

/**
 * 価格履歴レコード
 */
export type PriceHistoryRecord = {
  id: string
  date: Date
  priceRLUSD: number
  priceXRP: number
  qualityScore: number
  totalDonations: number
  trigger: PriceTrigger
  createdAt: Date
}

/**
 * 価格更新トリガー
 */
export type PriceTrigger = 'donation' | 'github_update' | 'manual'

/**
 * XRP/RLUSD レート
 */
export type ExchangeRate = {
  rate: number
  timestamp: Date
  source: string
}

/**
 * GitHub指標の生データ
 */
export type GitHubMetrics = {
  stars: number
  weeklyDownloads: number
  lastCommitDays: number
  openIssues: number
  fetchedAt: Date
}
