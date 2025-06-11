/**
 * XRP/RLUSD レート変換機能
 */

import type { ExchangeRate } from '@/types/pricing'

/**
 * XRP/RLUSD レートを取得（モック実装）
 * 実際の実装では外部APIからレートを取得
 */
export async function getXRPToRLUSDRate(): Promise<ExchangeRate> {
  try {
    // TODO: 実際のレート取得APIに置き換える
    // 例: CoinGecko API, XRPL DEX, etc.

    // モック実装: 固定レート（1 XRP = 0.5 RLUSD）
    // 2025/06/11 22:40現在
    const mockRate = 2.32 // 例: 1 XRP = 2.32 RLUSD

    return {
      rate: mockRate,
      timestamp: new Date(),
      source: 'mock',
    }
  } catch (error) {
    console.error('Failed to fetch XRP/RLUSD rate:', error)

    // フォールバック: デフォルトレート
    return {
      rate: 0.5, // デフォルト値
      timestamp: new Date(),
      source: 'fallback',
    }
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

/**
 * 複数のレートソースから最適なレートを選択
 */
export async function getBestXRPToRLUSDRate(sources: string[] = ['mock']): Promise<ExchangeRate> {
  const rates: ExchangeRate[] = []

  // 各ソースからレートを取得
  for (const source of sources) {
    try {
      let rate: ExchangeRate

      switch (source) {
        case 'mock':
          rate = await getXRPToRLUSDRate()
          break
        // TODO: 他のソースを追加
        // case 'coingecko':
        //   rate = await getCoinGeckoRate()
        //   break
        // case 'xrpl-dex':
        //   rate = await getXRPLDEXRate()
        //   break
        default:
          continue
      }

      if (isRateValid(rate)) {
        rates.push(rate)
      }
    } catch (error) {
      console.warn(`Failed to get rate from ${source}:`, error)
    }
  }

  if (rates.length === 0) {
    throw new Error('No valid exchange rates available')
  }

  // 最新のレートを選択（より高度なロジックも可能）
  return rates.reduce((latest, current) =>
    current.timestamp > latest.timestamp ? current : latest
  )
}
