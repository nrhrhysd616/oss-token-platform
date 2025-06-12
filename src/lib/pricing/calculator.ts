/**
 * 価格計算ロジック
 */

import type { PricingParameters, TokenPrice, ExchangeRate } from '@/types/pricing'

/**
 * RLUSD建てトークン価格を算出
 * 価格式: P_RL = P0 + αQ + β*log(1 + F_RL/F0)
 */
export function calculateRLUSDPrice(
  qualityScore: number,
  totalDonationsXRP: number,
  parameters: PricingParameters,
  xrpToRlusdRate: number
): number {
  const { basePrice, qualityCoefficient, donationCoefficient, referenceDonation } = parameters

  // XRP寄付をRLUSD換算
  // TODO: 現在のレートを常に利用しているが、当時のRLUSD量で算出するべき。ADRに起票済み
  const totalDonationsRLUSD = totalDonationsXRP * xrpToRlusdRate

  // 価格式の計算
  // P_RL = P0 + αQ + β*log(1 + F_RL/F0)
  const qualityTerm = qualityCoefficient * qualityScore
  const donationTerm = donationCoefficient * Math.log(1 + totalDonationsRLUSD / referenceDonation)

  const priceRLUSD = basePrice + qualityTerm + donationTerm

  // 価格は正の値を保証し、小数点以下4桁で丸める
  const finalPrice = Math.max(priceRLUSD, basePrice)
  return Math.round(finalPrice * 10000) / 10000
}

/**
 * RLUSD価格をXRP価格に変換
 */
export function convertRLUSDToXRP(rlusdPrice: number, xrpToRlusdRate: number): number {
  if (xrpToRlusdRate <= 0) {
    throw new Error('Invalid XRP to RLUSD rate')
  }

  const xrpPrice = rlusdPrice / xrpToRlusdRate
  // XRP価格は小数点以下6桁で丸める（XRPの一般的な精度）
  return Math.round(xrpPrice * 1000000) / 1000000
}

/**
 * トークン価格を計算（RLUSD・XRP両方）
 */
export function calculateTokenPrice(
  qualityScore: number,
  totalDonationsXRP: number,
  parameters: PricingParameters,
  exchangeRate: ExchangeRate
): TokenPrice {
  const rlusdPrice = calculateRLUSDPrice(
    qualityScore,
    totalDonationsXRP,
    parameters,
    exchangeRate.rate
  )

  const xrpPrice = convertRLUSDToXRP(rlusdPrice, exchangeRate.rate)

  return {
    rlusd: rlusdPrice,
    xrp: xrpPrice,
    lastUpdated: new Date(),
  }
}

/**
 * 価格計算のバリデーション
 */
export function validatePricingInputs(
  qualityScore: number,
  totalDonationsXRP: number,
  parameters: PricingParameters,
  exchangeRate: ExchangeRate
): void {
  if (qualityScore < 0 || qualityScore > 1) {
    throw new Error('Quality score must be between 0 and 1')
  }

  if (totalDonationsXRP < 0) {
    throw new Error('Total donations must be non-negative')
  }

  if (parameters.basePrice <= 0) {
    throw new Error('Base price must be positive')
  }

  if (parameters.referenceDonation <= 0) {
    throw new Error('Reference donation must be positive')
  }

  if (exchangeRate.rate <= 0) {
    throw new Error('Exchange rate must be positive')
  }

  // レートの有効期限チェック（1時間以内）
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  if (exchangeRate.timestamp < oneHourAgo) {
    throw new Error('Exchange rate is too old')
  }
}
