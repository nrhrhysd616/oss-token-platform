/**
 * 寄付・トラストライン・トークン発行統合サービス
 * 各専用マネージャーを統合するファサードクラス
 */

import { ProjectService } from './ProjectService'
import { TrustLineManager } from './donation/TrustLineManager'
import { DonationManager } from './donation/DonationManager'
import {
  TokenManager,
  type TokenIssueRequest,
  type TokenIssueResult,
} from './donation/TokenManager'
import { DonationHistoryManager } from './donation/DonationHistoryManager'
import { BaseService, type PaginatedResult } from './shared/BaseService'
import { DonationServiceError } from './shared/ServiceError'
import { getXRPLClient } from '@/lib/xrpl/client'
import { dropsToXrp } from 'xrpl'
import type { XummTypes } from 'xumm-sdk'
import type {
  DonationRequest,
  DonationRecord,
  DonationPayload,
  TrustLineRequest,
  TrustLinePayload,
} from '@/types/donation'
import type { DonationQueryParams } from '@/validations'

/**
 * 寄付サービス統合クラス
 */
export class DonationService extends BaseService {
  // === TRUSTLINE OPERATIONS ===

  /**
   * トラストライン設定リクエスト作成
   */
  static async createTrustLineRequest(
    projectId: string,
    donorAddress: string,
    donorUid?: string
  ): Promise<{ request: TrustLineRequest; payload: TrustLinePayload }> {
    try {
      // プロジェクト情報を取得
      const project = await ProjectService.getProjectById(projectId)
      if (!project) {
        throw new DonationServiceError(
          `プロジェクトが見つかりません: ${projectId}`,
          'NOT_FOUND',
          404
        )
      }

      // プロジェクトの基本検証
      ProjectService.validateProject(project)

      return await TrustLineManager.createTrustLineRequest(
        projectId,
        project.name,
        project.tokenCode,
        project.issuerAddress,
        donorAddress,
        donorUid
      )
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('トラストライン設定リクエスト作成エラー:', error)
      throw new DonationServiceError(
        'トラストライン設定リクエストの作成に失敗しました',
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * トラストライン設定リクエスト取得
   */
  static async getTrustLineRequest(requestId: string): Promise<TrustLineRequest | null> {
    return TrustLineManager.getTrustLineRequest(requestId)
  }

  /**
   * トラストライン設定完了処理
   */
  static async completeTrustLineRequest(
    requestId: string,
    xamanStatus: XummTypes.XummGetPayloadResponse
  ): Promise<void> {
    return TrustLineManager.completeTrustLineRequest(requestId, xamanStatus)
  }

  /**
   * トラストライン存在確認
   */
  static async checkTrustLineStatus(
    donorAddress: string,
    tokenCode: string,
    issuerAddress: string
  ): Promise<boolean> {
    return TrustLineManager.checkTrustLineExists(donorAddress, tokenCode, issuerAddress)
  }

  /**
   * XRP残高取得
   */
  static async getXrpBalance(address: string): Promise<number> {
    try {
      const client = getXRPLClient()
      const balanceInDrops = await client.getAccountBalance(address)
      return dropsToXrp(parseInt(balanceInDrops))
    } catch (error) {
      console.error('XRP残高取得エラー:', error)
      return 0
    }
  }

  // === DONATION OPERATIONS ===

  /**
   * 寄付リクエスト作成とXamanペイロード生成を統合実行
   */
  static async createDonationRequestWithPayload(
    projectId: string,
    donorAddress: string,
    amount: number,
    donorUid?: string
  ): Promise<{ request: DonationRequest; payload: DonationPayload }> {
    try {
      // プロジェクトの存在確認
      const project = await ProjectService.getProjectById(projectId)
      if (!project) {
        throw new DonationServiceError(
          `プロジェクトが見つかりません: ${projectId}`,
          'NOT_FOUND',
          404
        )
      }

      // プロジェクトの基本検証
      ProjectService.validateProject(project)

      return await DonationManager.createDonationRequestWithPayload(
        projectId,
        donorAddress,
        amount,
        donorUid
      )
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('寄付リクエスト・ペイロード作成エラー:', error)
      throw new DonationServiceError('寄付リクエストの作成に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * 寄付リクエスト取得
   */
  static async getDonationRequest(requestId: string): Promise<DonationRequest | null> {
    return DonationManager.getDonationRequest(requestId)
  }

  /**
   * 寄付完了チェック
   */
  static async isDonationCompleted(
    requestId: string
  ): Promise<{ completed: boolean; record?: DonationRecord }> {
    return DonationManager.isDonationCompleted(requestId)
  }

  /**
   * 寄付セッション完了処理
   */
  static async completeDonationRequest(
    requestId: string,
    xamanStatus: XummTypes.XummGetPayloadResponse
  ): Promise<DonationRecord> {
    try {
      const donationRecord = await DonationManager.completeDonationRequest(requestId, xamanStatus)

      // 寄付完了後、トークン自動発行処理を実行（非同期）
      // エラーが発生しても寄付完了処理は成功とする
      this.processTokenIssueForDonation(donationRecord).catch(error => {
        console.error('Token auto-issue failed for donation:', donationRecord.id, error)
      })

      return donationRecord
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('寄付リクエスト完了エラー:', error)
      throw new DonationServiceError('寄付セッションの完了に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === TOKEN OPERATIONS ===

  /**
   * トークンを発行して受信者に送付
   */
  static async issueTokenToRecipient(request: TokenIssueRequest): Promise<TokenIssueResult> {
    try {
      // プロジェクト情報を取得
      const project = await ProjectService.getProjectById(request.projectId)
      if (!project) {
        throw new DonationServiceError(
          `プロジェクトが見つかりません: ${request.projectId}`,
          'NOT_FOUND',
          404
        )
      }

      // プロジェクトの基本検証
      ProjectService.validateProject(project)

      return await TokenManager.issueTokenToRecipient(
        request,
        project.tokenCode,
        project.issuerAddress
      )
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('トークン発行エラー:', error)
      throw new DonationServiceError('トークンの発行に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * トークン発行可能性の確認
   */
  static async validateTokenIssue(request: TokenIssueRequest): Promise<{
    valid: boolean
    errors: string[]
  }> {
    try {
      // プロジェクト情報を取得
      const project = await ProjectService.getProjectById(request.projectId)
      if (!project) {
        return {
          valid: false,
          errors: [`プロジェクトが見つかりません: ${request.projectId}`],
        }
      }

      // プロジェクトの基本検証
      try {
        ProjectService.validateProject(project)
      } catch (error) {
        return {
          valid: false,
          errors: [error instanceof Error ? error.message : 'Project validation failed'],
        }
      }

      return await TokenManager.validateTokenIssue(
        request,
        project.tokenCode,
        project.issuerAddress
      )
    } catch (error) {
      console.error('トークン発行検証エラー:', error)
      return {
        valid: false,
        errors: ['Validation failed due to network error'],
      }
    }
  }

  /**
   * トークン残高確認
   */
  static async getTokenBalance(holderAddress: string, projectId: string): Promise<number> {
    try {
      // プロジェクト情報を取得
      const project = await ProjectService.getProjectById(projectId)
      if (!project) {
        throw new DonationServiceError(
          `プロジェクトが見つかりません: ${projectId}`,
          'NOT_FOUND',
          404
        )
      }

      return await TokenManager.getTokenBalance(
        holderAddress,
        project.tokenCode,
        project.issuerAddress
      )
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('トークン残高確認エラー:', error)
      return 0
    }
  }

  /**
   * トークン総発行量確認
   */
  static async getTotalTokenSupply(projectId: string): Promise<number> {
    try {
      // プロジェクト情報を取得
      const project = await ProjectService.getProjectById(projectId)
      if (!project) {
        throw new DonationServiceError(
          `プロジェクトが見つかりません: ${projectId}`,
          'NOT_FOUND',
          404
        )
      }

      return await TokenManager.getTotalTokenSupply(project.tokenCode, project.issuerAddress)
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('トークン総発行量確認エラー:', error)
      return 0
    }
  }

  // === HISTORY OPERATIONS ===

  /**
   * 寄付履歴を取得
   */
  static async getDonationHistory(
    queryParams: DonationQueryParams
  ): Promise<PaginatedResult<DonationRecord>> {
    return DonationHistoryManager.getDonationHistory(queryParams)
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
    return DonationHistoryManager.getProjectDonationStats(projectId)
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
    return DonationHistoryManager.getDonorDonationHistory(donorAddress, options)
  }

  /**
   * 寄付記録を取得
   */
  static async getDonationRecord(recordId: string): Promise<DonationRecord | null> {
    return DonationHistoryManager.getDonationRecord(recordId)
  }

  /**
   * 最近の寄付を取得
   */
  static async getRecentDonations(limit: number = 10): Promise<DonationRecord[]> {
    return DonationHistoryManager.getRecentDonations(limit)
  }

  // === COMMON OPERATIONS ===

  /**
   * Xamanペイロードの状態をチェック
   */
  static async checkPayloadStatus(payloadUuid: string): Promise<XummTypes.XummGetPayloadResponse> {
    return super.checkPayloadStatus(payloadUuid)
  }

  /**
   * ペイロードをキャンセル
   */
  static async cancelPayload(payloadUuid: string): Promise<void> {
    return super.cancelPayload(payloadUuid)
  }

  // === VALIDATION & UTILITIES ===

  /**
   * 寄付リクエストの期限確認
   */
  static isDonationRequestExpired(request: DonationRequest): boolean {
    return DonationManager.isRequestExpired(request)
  }

  /**
   * 寄付金額の妥当性確認
   */
  static validateDonationAmount(amount: number): boolean {
    return DonationManager.validateDonationAmount(amount)
  }

  /**
   * トラストライン設定リクエストの期限確認
   */
  static isTrustLineRequestExpired(request: TrustLineRequest): boolean {
    return TrustLineManager.isRequestExpired(request)
  }

  // === PRIVATE METHODS ===

  /**
   * 寄付完了時のトークン自動発行処理
   */
  private static async processTokenIssueForDonation(donationRecord: DonationRecord): Promise<void> {
    try {
      // プロジェクト情報を取得
      const project = await ProjectService.getProjectById(donationRecord.projectId)
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${donationRecord.projectId}`)
      }

      await TokenManager.processTokenIssueForDonation(
        donationRecord,
        project.tokenCode,
        project.issuerAddress
      )
    } catch (error) {
      console.error('Token issue processing error:', error)
      throw error
    }
  }
}

// 旧DonationServiceとの互換性のためのエクスポート
export { DonationServiceError } from './shared/ServiceError'
export type { PaginatedResult } from './shared/BaseService'
export type { TokenIssueRequest, TokenIssueResult } from './donation/TokenManager'
