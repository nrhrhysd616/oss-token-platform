/**
 * XRP/RLUSD レート変換機能
 */

import type { ExchangeRate } from '@/types/pricing'
import { getXRPLClient } from '@/lib/xrpl/client'

/**
 * XRP/RLUSD レートを取得（XRPL Order Bookから実際のレートを取得）
 */
export async function getXRPToRLUSDRate(): Promise<ExchangeRate> {
  const xrplClient = getXRPLClient()

  try {
    let rate = await xrplClient.getXRPToRLUSDRate()

    // 2025/06/14現在、テストネットとメインネットでRLUSDの価格が2100倍異なるため、
    // テストネットでは価格を2100倍してメインネットと同じスケールに調整
    if (process.env.XRPL_NETWORK === 'testnet') {
      rate = rate * 2100
    }

    return {
      rate,
      timestamp: new Date(),
      source: 'xrpl-orderbook',
    }
  } catch (error) {
    console.error('Failed to fetch XRP/RLUSD rate from XRPL:', error)

    // レート取得に失敗した場合はエラーを投げる（寄付を停止）
    throw new Error('XRP/RLUSDレートの取得に失敗しました。現在寄付を受け付けることができません。')
  }
}

/**
 * キャッシュされたレートを管理するクラス
 */
class RateCache {
  private cache: ExchangeRate | null = null
  private readonly cacheValidityMs = 5 * 60 * 1000 // 5分間有効

  /**
   * キャッシュからレートを取得（有効期限内の場合）
   */
  get(): ExchangeRate | null {
    if (!this.cache) {
      return null
    }

    const now = new Date()
    const cacheAge = now.getTime() - this.cache.timestamp.getTime()

    if (cacheAge > this.cacheValidityMs) {
      this.cache = null
      return null
    }

    return this.cache
  }

  /**
   * レートをキャッシュに保存
   */
  set(rate: ExchangeRate): void {
    this.cache = rate
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache = null
  }
}

// グローバルキャッシュインスタンス
const rateCache = new RateCache()

/**
 * キャッシュ機能付きレート取得
 */
export async function getCachedXRPToRLUSDRate(): Promise<ExchangeRate> {
  // キャッシュから取得を試行
  const cachedRate = rateCache.get()
  if (cachedRate) {
    return cachedRate
  }

  // キャッシュにない場合は新しく取得
  const freshRate = await getXRPToRLUSDRate()
  rateCache.set(freshRate)

  return freshRate
}

/**
 * XRP金額をRLUSDに変換
 */
export function convertXRPToRLUSD(xrpAmount: number, rate: ExchangeRate): number {
  if (xrpAmount < 0) {
    throw new Error('XRP amount must be non-negative')
  }

  if (rate.rate <= 0) {
    throw new Error('Exchange rate must be positive')
  }

  return xrpAmount * rate.rate
}

/**
 * RLUSD金額をXRPに変換
 */
export function convertRLUSDToXRP(rlusdAmount: number, rate: ExchangeRate): number {
  if (rlusdAmount < 0) {
    throw new Error('RLUSD amount must be non-negative')
  }

  if (rate.rate <= 0) {
    throw new Error('Exchange rate must be positive')
  }

  return rlusdAmount / rate.rate
}

/**
 * レートの有効性をチェック
 */
export function isRateValid(rate: ExchangeRate, maxAgeMs: number = 60 * 60 * 1000): boolean {
  const now = new Date()
  const rateAge = now.getTime() - rate.timestamp.getTime()

  return rateAge <= maxAgeMs && rate.rate > 0
}
