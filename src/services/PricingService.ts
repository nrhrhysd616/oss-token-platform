/**
 * 価格算出サービス
 */

import { BaseService } from './shared/BaseService'
import { ServiceError } from './shared/ServiceError'
import { collectionPath, docPath } from '@/lib/firebase/collections'
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
import type { Project } from '@/types/project'
import { DonationService } from './DonationService'
import { convertTimestamps } from '@/lib/firebase/utils'

export class PricingServiceError extends ServiceError {
  public readonly name = 'PricingServiceError'
}

export class PricingService extends BaseService {
  /**
   * プロジェクトのトークン価格を計算
   */
  static async calculateTokenPrice(projectId: string): Promise<TokenPrice> {
    const project = await this.getDocumentByPath<Project>(docPath.project(projectId))
    if (!project) {
      throw new PricingServiceError(`Project not found: ${projectId}`, 'NOT_FOUND', 404)
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
    const totalDonationXrpAmount = await this.getTotalDonationXrpAmount(projectId)

    // 価格算出パラメータを取得
    const pricingParameters = await this.getPricingParameters()

    // XRP/RLUSDレートを取得
    let exchangeRate: ExchangeRate
    try {
      exchangeRate = await getCachedXRPToRLUSDRate()
    } catch (error) {
      console.error(`XRP/RLUSDレート取得エラー (${projectId}):`, error)
      throw new PricingServiceError(
        `Failed to get exchange rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }

    // バリデーション
    validatePricingInputs(
      qualityScore.overall,
      totalDonationXrpAmount,
      pricingParameters,
      exchangeRate
    )

    // 価格算出に必要なパラメータをログ出力（デバッグ用）
    console.debug('Calculating token price with parameters:', {
      qualityScore: qualityScore.overall,
      totalDonationXrpAmount,
      pricingParameters,
      exchangeRate,
    })

    // 価格を計算
    const tokenPrice = calculateTokenPrice(
      qualityScore.overall,
      totalDonationXrpAmount,
      pricingParameters,
      exchangeRate
    )

    return tokenPrice
  }

  /**
   * プロジェクトの価格履歴を更新
   */
  static async updatePriceHistory(
    projectId: string,
    trigger: PriceTrigger = 'manual'
  ): Promise<void> {
    // プロジェクトの存在確認
    const projectExists = await this.documentExistsByPath(docPath.project(projectId))
    if (!projectExists) {
      throw new PricingServiceError(`Project not found: ${projectId}`, 'NOT_FOUND', 404)
    }

    // 現在の価格を計算
    const tokenPrice = await this.calculateTokenPrice(projectId)

    // 品質スコアを取得
    const qualityScore = await QualityScoreService.getQualityScore(projectId)
    if (!qualityScore) {
      throw new PricingServiceError('Quality score not found', 'VALIDATION_ERROR', 400)
    }

    // 寄付総額を取得
    const totalDonations = await this.getTotalDonationXrpAmount(projectId)

    // 価格履歴レコードを作成
    const priceHistoryRecord: Omit<PriceHistoryRecord, 'id'> = {
      priceRLUSD: tokenPrice.rlusd,
      priceXRP: tokenPrice.xrp,
      qualityScore: qualityScore.overall,
      totalDonations,
      trigger,
      createdAt: new Date(),
    }

    // BaseServiceのrunTransactionを使用してトランザクション処理
    await this.runTransaction(async transaction => {
      const projectRef = this.getDocumentRefByPath(docPath.project(projectId))
      const priceHistoryRef = projectRef.collection('priceHistory').doc()

      // プロジェクトの現在価格を更新
      transaction.update(projectRef, {
        currentPrice: {
          rlusd: tokenPrice.rlusd,
          xrp: tokenPrice.xrp,
          lastUpdated: tokenPrice.lastUpdated,
        },
        updatedAt: new Date(),
      })

      // 価格履歴を追加
      transaction.set(priceHistoryRef, priceHistoryRecord)
    })
  }

  /**
   * プロジェクトの寄付総額を取得
   */
  private static async getTotalDonationXrpAmount(projectId: string): Promise<number> {
    const allRecords = await DonationService.getDonationHistory({ projectId })
    return allRecords.reduce((sum, record) => sum + record.xrpAmount, 0)
  }

  /**
   * 価格算出パラメータを取得
   */
  static async getPricingParameters(): Promise<PricingParameters> {
    const parametersData = await this.getDocumentByPath<PricingParameters>(
      docPath.settingsPricingParameters()
    )

    if (!parametersData) {
      // デフォルトパラメータを返す
      return {
        basePrice: 0.2,
        qualityCoefficient: 0.45,
        donationCoefficient: 0.075,
        referenceDonation: 3000,
        lastUpdated: new Date(),
      }
    }

    return convertTimestamps(parametersData) as PricingParameters
  }

  /**
   * プロジェクトの価格履歴を取得
   */
  static async getPriceHistory(
    projectId: string,
    limit: number = 30
  ): Promise<PriceHistoryRecord[]> {
    // プロジェクトの存在確認
    const projectExists = await this.documentExistsByPath(docPath.project(projectId))
    if (!projectExists) {
      throw new PricingServiceError(`Project not found: ${projectId}`, 'NOT_FOUND', 404)
    }

    // パス文字列を使用してベースクエリを作成
    const baseQuery = this.createQueryByPath(collectionPath.projectPriceHistory(projectId))

    const snapshot = await baseQuery.limit(limit).orderBy('createdAt', 'desc').get()

    return snapshot.docs.map(doc =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    ) as PriceHistoryRecord[]
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
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)

    // BaseServiceのexecutePaginatedQueryを使用してアクティブプロジェクトを取得
    const baseQuery = this.createQueryByPath(collectionPath.projects()).where(
      'status',
      '==',
      'active'
    )

    const snapshot = await baseQuery.orderBy('createdAt', 'desc').get()
    const staleProjectIds: string[] = []
    snapshot.docs.forEach(doc => {
      const project = convertTimestamps({
        id: doc.id,
        ...doc.data(),
      }) as Project
      const lastUpdated = project.currentPrice?.lastUpdated
      if (!lastUpdated || lastUpdated < cutoffTime) {
        staleProjectIds.push(project.id)
      }
    })
    return staleProjectIds
  }
}
