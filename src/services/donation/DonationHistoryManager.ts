/**
 * 寄付履歴管理専用マネージャー
 */

import { BaseService, type PaginatedResult, type PaginationOptions } from '../shared/BaseService'
import { DonationServiceError } from '../shared/ServiceError'
import { convertTimestamps } from '@/lib/firebase/utils'
import { donationHistoryQuerySchema, type DonationHistoryQuery } from '@/validations/donation'
import type { DonationRecord } from '@/types/donation'
import type { Query, DocumentData } from 'firebase-admin/firestore'

/**
 * 寄付履歴管理クラス
 */
export class DonationHistoryManager extends BaseService {
  // === READ ===

  /**
   * 寄付履歴を取得（ページネーション付き）
   */
  static async getDonationHistory(
    queryParams: DonationHistoryQuery
  ): Promise<PaginatedResult<DonationRecord>> {
    try {
      // バリデーション
      const validatedParams = donationHistoryQuerySchema.parse(queryParams)

      // ベースクエリを構築
      let baseQuery: Query<DocumentData> = this.db.collection('donationRecords')

      // フィルタリング条件を追加
      if (validatedParams.projectId) {
        baseQuery = baseQuery.where('projectId', '==', validatedParams.projectId)
      }

      if (validatedParams.donorAddress) {
        baseQuery = baseQuery.where('donorAddress', '==', validatedParams.donorAddress)
      }

      if (validatedParams.donorUid) {
        baseQuery = baseQuery.where('donorUid', '==', validatedParams.donorUid)
      }

      if (validatedParams.status) {
        baseQuery = baseQuery.where('tokenIssueStatus', '==', validatedParams.status)
      }

      // 日付範囲フィルタリング
      if (validatedParams.startDate) {
        baseQuery = baseQuery.where('createdAt', '>=', new Date(validatedParams.startDate))
      }

      if (validatedParams.endDate) {
        baseQuery = baseQuery.where('createdAt', '<=', new Date(validatedParams.endDate))
      }

      // ページネーションオプションを準備
      const paginationOptions: PaginationOptions = {
        limit: validatedParams.limit,
        offset: (validatedParams.page - 1) * validatedParams.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }

      // ページネーション付きクエリを実行
      return await this.executePaginatedQuery<DonationRecord>(baseQuery, paginationOptions)
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('寄付履歴取得エラー:', error)
      throw new DonationServiceError('寄付履歴の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * プロジェクト別寄付統計を取得
   */
  static async getProjectDonationStats(projectId: string): Promise<{
    totalDonations: number
    totalAmount: number
    donorCount: number
    totalTokensIssued: number
    lastDonationAt?: Date
  }> {
    try {
      const snapshot = await this.db
        .collection('donationRecords')
        .where('projectId', '==', projectId)
        .get()

      if (snapshot.empty) {
        return {
          totalDonations: 0,
          totalAmount: 0,
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
      const totalAmount = donations.reduce((sum, donation) => sum + donation.amount, 0)
      const uniqueDonors = new Set(donations.map(donation => donation.donorAddress))
      const donorCount = uniqueDonors.size
      const totalTokensIssued = donations
        .filter(donation => donation.tokenIssued && donation.tokenAmount)
        .reduce((sum, donation) => sum + (donation.tokenAmount || 0), 0)

      // 最新の寄付日時を取得
      const sortedDonations = donations.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )
      const lastDonationAt = sortedDonations.length > 0 ? sortedDonations[0].createdAt : undefined

      return {
        totalDonations,
        totalAmount,
        donorCount,
        totalTokensIssued,
        lastDonationAt,
      }
    } catch (error) {
      console.error('プロジェクト寄付統計取得エラー:', error)
      throw new DonationServiceError(
        'プロジェクト寄付統計の取得に失敗しました',
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 寄付者別寄付履歴を取得
   */
  static async getDonorDonationHistory(
    donorAddress: string,
    options: {
      limit?: number
      offset?: number
      projectId?: string
    } = {}
  ): Promise<PaginatedResult<DonationRecord>> {
    try {
      let baseQuery: Query<DocumentData> = this.db
        .collection('donationRecords')
        .where('donorAddress', '==', donorAddress)

      // プロジェクトフィルタリング
      if (options.projectId) {
        baseQuery = baseQuery.where('projectId', '==', options.projectId)
      }

      const paginationOptions: PaginationOptions = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }

      return await this.executePaginatedQuery<DonationRecord>(baseQuery, paginationOptions)
    } catch (error) {
      console.error('寄付者履歴取得エラー:', error)
      throw new DonationServiceError('寄付者履歴の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * 寄付記録を取得
   */
  static async getDonationRecord(recordId: string): Promise<DonationRecord | null> {
    return this.getDocument<DonationRecord>('donationRecords', recordId)
  }

  /**
   * 最近の寄付を取得
   */
  static async getRecentDonations(limit: number = 10): Promise<DonationRecord[]> {
    try {
      const snapshot = await this.db
        .collection('donationRecords')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()

      return snapshot.docs.map(doc =>
        convertTimestamps({
          id: doc.id,
          ...doc.data(),
        })
      ) as DonationRecord[]
    } catch (error) {
      console.error('最近の寄付取得エラー:', error)
      throw new DonationServiceError('最近の寄付の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * 寄付記録の検索
   */
  static async searchDonationRecords(searchParams: {
    txHash?: string
    requestId?: string
    tokenTxHash?: string
  }): Promise<DonationRecord[]> {
    try {
      let query: Query<DocumentData> = this.db.collection('donationRecords')

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
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('寄付記録検索エラー:', error)
      throw new DonationServiceError('寄付記録の検索に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }
}
