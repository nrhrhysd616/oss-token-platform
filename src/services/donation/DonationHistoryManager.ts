/**
 * 寄付履歴管理専用マネージャー
 */

import { BaseService } from '../shared/BaseService'
import { DonationServiceError } from '../DonationService'
import { convertTimestamps } from '@/lib/firebase/utils'
import { donationQuerySchema, type DonationQueryParams } from '@/validations'
import type { DonationRecord, ProjectDonationStats } from '@/types/donation'
import { collectionPath, docPath } from '@/lib/firebase/collections'

/**
 * 寄付履歴管理クラス
 */
export class DonationHistoryManager extends BaseService {
  // === READ ===

  /**
   * 寄付履歴を取得
   *
   * createdAtフィールドの降順(最新順)でソートされ、トークン発行ステータスが「完了」のもののみを対象とする。
   *
   * インデックス設定済み
   */
  static async getDonationHistory(queryParams: DonationQueryParams): Promise<DonationRecord[]> {
    // バリデーション
    const validatedParams = donationQuerySchema.parse(queryParams)

    // ベースクエリを構築
    let baseQuery = this.createQueryByPath(collectionPath.donationRecords())

    // 寄付履歴はトークン発行ステータスが「完了」のもののみを対象
    baseQuery = baseQuery.where('tokenIssueStatus', '==', 'completed')

    // フィルタリング条件を追加
    if (validatedParams.projectId) {
      baseQuery = baseQuery.where('projectId', '==', validatedParams.projectId)
    }

    if (validatedParams.donorUid) {
      baseQuery = baseQuery.where('donorUid', '==', validatedParams.donorUid)
    }

    // 日付範囲フィルタリング
    if (validatedParams.startDate) {
      baseQuery = baseQuery.where('createdAt', '>=', new Date(validatedParams.startDate))
    }

    if (validatedParams.endDate) {
      baseQuery = baseQuery.where('createdAt', '<=', new Date(validatedParams.endDate))
    }

    // 作成日時の降順でソート
    baseQuery = baseQuery.orderBy('createdAt', 'desc')

    if (validatedParams.limit) {
      // リミットが指定されている場合は適用
      baseQuery = baseQuery.limit(validatedParams.limit)
    }

    // クエリを実行
    const snapshot = await baseQuery.get()

    return snapshot.docs.map(doc =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    ) as DonationRecord[]
  }

  /**
   * プロジェクト別寄付統計を取得
   */
  static async getProjectDonationStats(projectId: string): Promise<ProjectDonationStats> {
    const snapshot = await this.createQueryByPath(collectionPath.donationRecords())
      .where('projectId', '==', projectId)
      .where('tokenIssueStatus', '==', 'completed')
      .get()

    if (snapshot.empty) {
      return {
        totalDonations: 0,
        totalXrpAmount: 0,
        donorCount: 0,
        totalTokensIssued: 0,
      }
    }

    const donations = snapshot.docs.map(doc =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    ) as DonationRecord[]

    // 統計を計算
    const totalDonations = donations.length
    const totalXrpAmount = donations.reduce((sum, donation) => sum + donation.xrpAmount, 0)
    const donorCount = new Set(donations.map(donation => donation.donorUid)).size
    const totalTokensIssued = donations
      .filter(donation => donation.tokenIssued && donation.tokenAmount)
      .reduce((sum, donation) => sum + (donation.tokenAmount || 0), 0)

    // 最新の寄付日時を取得
    const sortedDonations = donations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const lastDonationAt = sortedDonations.length > 0 ? sortedDonations[0].createdAt : undefined

    return {
      totalDonations,
      totalXrpAmount,
      donorCount,
      totalTokensIssued,
      lastDonationAt,
    }
  }

  /**
   * 寄付記録を取得
   */
  static async getDonationRecord(recordId: string): Promise<DonationRecord | null> {
    return this.getDocumentByPath<DonationRecord>(docPath.donationRecord(recordId))
  }

  /**
   * 最近の寄付を取得
   */
  static async getRecentGlobalDonations(limit: number = 10): Promise<DonationRecord[]> {
    const snapshot = await this.createQueryByPath(collectionPath.donationRecords())
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    return snapshot.docs.map(doc =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    ) as DonationRecord[]
  }

  /**
   * 寄付記録の検索
   *
   * 現在未使用
   */
  static async searchDonationRecords(searchParams: {
    txHash?: string
    requestId?: string
    tokenTxHash?: string
  }): Promise<DonationRecord[]> {
    let query = this.createQueryByPath(collectionPath.donationRecords())

    if (searchParams.txHash) {
      query = query.where('txHash', '==', searchParams.txHash)
    } else if (searchParams.requestId) {
      query = query.where('requestId', '==', searchParams.requestId)
    } else if (searchParams.tokenTxHash) {
      query = query.where('tokenTxHash', '==', searchParams.tokenTxHash)
    } else {
      throw new DonationServiceError('検索条件が指定されていません', 'VALIDATION_ERROR', 400)
    }

    const snapshot = await query.get()

    return snapshot.docs.map(doc =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    ) as DonationRecord[]
  }
}
