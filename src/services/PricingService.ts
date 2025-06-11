/**
 * 価格算出サービス
 */

import { BaseService } from './shared/BaseService'
import { ServiceError } from './shared/ServiceError'
import { getAdminDb } from '@/lib/firebase/admin'
import { FIRESTORE_COLLECTIONS } from '@/lib/firebase/collections'
import { QualityScoreService } from './QualityScoreService'
import { calculateTokenPrice, validatePricingInputs } from '@/lib/pricing/calculator'
import { getCachedXRPToRLUSDRate } from '@/lib/pricing/rate-converter'
import type {
  TokenPrice,
  PricingParameters,
  PriceHistoryRecord,
  PriceTrigger,
  ExchangeRate,
} from '@/types/pricing'

export class PricingServiceError extends ServiceError {
  constructor(
    message: string,
    code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'VALIDATION_ERROR'
      | 'DUPLICATE'
      | 'EXPIRED'
      | 'INTERNAL_ERROR' = 'INTERNAL_ERROR',
    statusCode: number = 500
  ) {
    super(message, code, statusCode)
    this.name = 'PricingServiceError'
  }
}

export class PricingService extends BaseService {
  /**
   * プロジェクトのトークン価格を計算
   */
  static async calculateTokenPrice(projectId: string): Promise<TokenPrice> {
    try {
      const db = getAdminDb()

      // プロジェクト情報を取得
      const projectDoc = await db.collection(FIRESTORE_COLLECTIONS.PROJECTS).doc(projectId).get()
      if (!projectDoc.exists) {
        throw new PricingServiceError(`Project not found: ${projectId}`, 'NOT_FOUND', 404)
      }

      const project = projectDoc.data()
      if (!project) {
        throw new PricingServiceError('Project data is empty', 'VALIDATION_ERROR', 400)
      }

      // 品質スコアを取得
      const qualityScore = await QualityScoreService.getQualityScore(projectId)
      if (!qualityScore) {
        throw new PricingServiceError(
          'Quality score not found. Please update quality score first.',
          'VALIDATION_ERROR',
          400
        )
      }

      // 寄付総額を取得
      const totalDonations = await this.getTotalDonations(projectId)

      // 価格算出パラメータを取得
      const pricingParameters = await this.getPricingParameters()

      // XRP/RLUSDレートを取得
      const exchangeRate = await getCachedXRPToRLUSDRate()

      // バリデーション
      validatePricingInputs(qualityScore.overall, totalDonations, pricingParameters, exchangeRate)

      // 価格を計算
      const tokenPrice = calculateTokenPrice(
        qualityScore.overall,
        totalDonations,
        pricingParameters,
        exchangeRate
      )

      return tokenPrice
    } catch (error) {
      if (error instanceof PricingServiceError) {
        throw error
      }
      throw new PricingServiceError(
        `Failed to calculate token price: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * プロジェクトの価格履歴を更新
   */
  static async updatePriceHistory(
    projectId: string,
    trigger: PriceTrigger = 'manual'
  ): Promise<void> {
    try {
      const db = getAdminDb()

      // 現在の価格を計算
      const tokenPrice = await this.calculateTokenPrice(projectId)

      // 品質スコアを取得
      const qualityScore = await QualityScoreService.getQualityScore(projectId)
      if (!qualityScore) {
        throw new PricingServiceError('Quality score not found', 'VALIDATION_ERROR', 400)
      }

      // 寄付総額を取得
      const totalDonations = await this.getTotalDonations(projectId)

      // 価格履歴レコードを作成
      const priceHistoryRecord: Omit<PriceHistoryRecord, 'id'> = {
        date: new Date(),
        priceRLUSD: tokenPrice.rlusd,
        priceXRP: tokenPrice.xrp,
        qualityScore: qualityScore.overall,
        totalDonations,
        trigger,
        createdAt: new Date(),
      }

      // プロジェクトの現在価格を更新
      await db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .doc(projectId)
        .update({
          currentPrice: {
            rlusd: tokenPrice.rlusd,
            xrp: tokenPrice.xrp,
            lastUpdated: tokenPrice.lastUpdated,
          },
        })

      // 価格履歴を追加
      await db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .doc(projectId)
        .collection(FIRESTORE_COLLECTIONS.PRICE_HISTORY)
        .add(priceHistoryRecord)
    } catch (error) {
      if (error instanceof PricingServiceError) {
        throw error
      }
      throw new PricingServiceError(
        `Failed to update price history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * プロジェクトの寄付総額を取得
   */
  static async getTotalDonations(projectId: string): Promise<number> {
    try {
      const db = getAdminDb()

      const donationsSnapshot = await db
        .collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
        .where('projectId', '==', projectId)
        .where('status', '==', 'completed')
        .get()

      let totalDonations = 0
      donationsSnapshot.forEach(doc => {
        const donation = doc.data()
        totalDonations += donation.amount || 0
      })

      return totalDonations
    } catch (error) {
      throw new PricingServiceError(
        `Failed to get total donations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 価格算出パラメータを取得
   */
  static async getPricingParameters(): Promise<PricingParameters> {
    try {
      const db = getAdminDb()

      const doc = await db
        .collection(FIRESTORE_COLLECTIONS.SETTINGS)
        .doc('pricing')
        .collection('parameters')
        .doc('global')
        .get()
      if (!doc.exists) {
        // デフォルトパラメータを返す
        return {
          basePrice: 0.2,
          qualityCoefficient: 0.45,
          donationCoefficient: 0.075,
          referenceDonation: 3000,
          lastUpdated: new Date(),
        }
      }

      const data = doc.data()
      if (!data) {
        throw new PricingServiceError('Pricing parameters data is empty', 'VALIDATION_ERROR', 400)
      }

      return {
        basePrice: data.basePrice,
        qualityCoefficient: data.qualityCoefficient,
        donationCoefficient: data.donationCoefficient,
        referenceDonation: data.referenceDonation,
        lastUpdated: data.lastUpdated.toDate(),
      }
    } catch (error) {
      if (error instanceof PricingServiceError) {
        throw error
      }
      throw new PricingServiceError(
        `Failed to get pricing parameters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * プロジェクトの価格履歴を取得
   */
  static async getPriceHistory(
    projectId: string,
    limit: number = 30
  ): Promise<PriceHistoryRecord[]> {
    try {
      const db = getAdminDb()

      const snapshot = await db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .doc(projectId)
        .collection(FIRESTORE_COLLECTIONS.PRICE_HISTORY)
        .orderBy('date', 'desc')
        .limit(limit)
        .get()

      const priceHistory: PriceHistoryRecord[] = []
      snapshot.forEach(doc => {
        const data = doc.data()
        priceHistory.push({
          id: doc.id,
          date: data.date.toDate(),
          priceRLUSD: data.priceRLUSD,
          priceXRP: data.priceXRP,
          qualityScore: data.qualityScore,
          totalDonations: data.totalDonations,
          trigger: data.trigger,
          createdAt: data.createdAt.toDate(),
        })
      })

      return priceHistory
    } catch (error) {
      throw new PricingServiceError(
        `Failed to get price history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 複数プロジェクトの価格を一括更新
   */
  static async updateMultiplePrices(
    projectIds: string[],
    trigger: PriceTrigger = 'manual'
  ): Promise<{
    success: number
    failed: number
    errors: Array<{ projectId: string; error: string }>
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ projectId: string; error: string }>,
    }

    // 並行処理でレート制限を考慮
    const batchSize = 3
    for (let i = 0; i < projectIds.length; i += batchSize) {
      const batch = projectIds.slice(i, i + batchSize)

      await Promise.allSettled(
        batch.map(async projectId => {
          try {
            await this.updatePriceHistory(projectId, trigger)
            results.success++
          } catch (error) {
            results.failed++
            results.errors.push({
              projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        })
      )

      // バッチ間で少し待機
      if (i + batchSize < projectIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return results
  }

  /**
   * 価格が古いプロジェクトを取得
   */
  static async getStalePrices(maxAgeHours: number = 1): Promise<string[]> {
    try {
      const db = getAdminDb()
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)

      const snapshot = await db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('status', '==', 'active')
        .get()

      const staleProjectIds: string[] = []

      snapshot.forEach(doc => {
        const project = doc.data()
        const lastUpdated = project.currentPrice?.lastUpdated?.toDate()

        if (!lastUpdated || lastUpdated < cutoffTime) {
          staleProjectIds.push(doc.id)
        }
      })

      return staleProjectIds
    } catch (error) {
      throw new PricingServiceError(
        `Failed to get stale prices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 価格統計情報を取得
   */
  static async getPriceStats(): Promise<{
    totalProjects: number
    averagePriceRLUSD: number
    averagePriceXRP: number
    priceRange: { min: number; max: number }
    lastUpdated: Date | null
  }> {
    try {
      const db = getAdminDb()
      const snapshot = await db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('status', '==', 'active')
        .get()

      const pricesRLUSD: number[] = []
      const pricesXRP: number[] = []
      let latestUpdate: Date | null = null

      snapshot.forEach(doc => {
        const project = doc.data()
        const currentPrice = project.currentPrice

        if (currentPrice?.rlusd !== undefined && currentPrice?.xrp !== undefined) {
          pricesRLUSD.push(currentPrice.rlusd)
          pricesXRP.push(currentPrice.xrp)

          const lastUpdated = currentPrice.lastUpdated?.toDate()
          if (lastUpdated && (!latestUpdate || lastUpdated > latestUpdate)) {
            latestUpdate = lastUpdated
          }
        }
      })

      const averagePriceRLUSD =
        pricesRLUSD.length > 0
          ? pricesRLUSD.reduce((sum, price) => sum + price, 0) / pricesRLUSD.length
          : 0

      const averagePriceXRP =
        pricesXRP.length > 0
          ? pricesXRP.reduce((sum, price) => sum + price, 0) / pricesXRP.length
          : 0

      const priceRange = {
        min: pricesRLUSD.length > 0 ? Math.min(...pricesRLUSD) : 0,
        max: pricesRLUSD.length > 0 ? Math.max(...pricesRLUSD) : 0,
      }

      return {
        totalProjects: snapshot.size,
        averagePriceRLUSD,
        averagePriceXRP,
        priceRange,
        lastUpdated: latestUpdate,
      }
    } catch (error) {
      throw new PricingServiceError(
        `Failed to get price stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }
}
