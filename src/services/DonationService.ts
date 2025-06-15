/**
 * 寄付・トラストライン・トークン発行統合サービス
 * 各専用マネージャーを統合するファサードクラス
 */

import { ProjectService } from './ProjectService'
import { PricingService } from './PricingService'
import { DonationManager } from './donation/DonationManager'
import { TokenManager } from './donation/TokenManager'
import { DonationHistoryManager } from './donation/DonationHistoryManager'
import { BaseService } from './shared/BaseService'
import { getXRPLClient } from '@/lib/xrpl/client'
import { dropsToXrp } from 'xrpl'
import type { XummTypes } from 'xumm-sdk'
import type {
  DonationRequest,
  DonationRecord,
  DonationPayload,
  ProjectDonationStats,
} from '@/types/donation'
import type { DonationQueryParams } from '@/validations'
import { ServiceError } from './shared/ServiceError'

/**
 * 寄付サービス専用エラークラス
 * donationのManager類でも利用しているためここで定義
 */
export class DonationServiceError extends ServiceError {
  public readonly name = 'DonationServiceError'
}

/**
 * 寄付サービス統合クラス
 */
export class DonationService extends BaseService {
  // === DONATION OPERATIONS ===

  /**
   * 寄付リクエスト作成とXamanペイロード生成を統合実行
   */
  static async createDonationRequestWithPayload(
    projectId: string,
    xrpAmount: number,
    donorUid?: string
  ): Promise<{ request: DonationRequest; payload: DonationPayload }> {
    // プロジェクトの存在確認
    const project = await ProjectService.getProjectById(projectId)
    if (!project) {
      throw new DonationServiceError(`プロジェクトが見つかりません: ${projectId}`, 'NOT_FOUND', 404)
    }

    // プロジェクトの基本検証
    ProjectService.validateProject(project)
    return await DonationManager.createDonationRequestWithPayload(projectId, xrpAmount, donorUid)
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
    const donationRecord = await DonationManager.completeDonationRequest(requestId, xamanStatus)

    // 寄付完了後、トークン自動発行処理を実行
    // エラーが発生しても寄付完了処理は成功とする
    await this.processTokenIssueForDonation(donationRecord).catch(error => {
      console.error('Token auto-issue failed for donation:', donationRecord.id, error)
    })

    // 寄付完了後、価格履歴を更新
    // エラーが発生しても寄付完了処理は成功とする
    await PricingService.updatePriceHistory(donationRecord.projectId, 'donation').catch(error => {
      console.error('Price update failed for donation:', donationRecord.id, error)
    })
    return donationRecord
  }

  // === TOKEN OPERATIONS ===

  /**
   * トークン総発行量確認
   */
  static async getTotalTokenSupply(projectId: string): Promise<number> {
    // プロジェクト情報を取得
    const project = await ProjectService.getProjectById(projectId)
    if (!project) {
      throw new DonationServiceError(`プロジェクトが見つかりません: ${projectId}`, 'NOT_FOUND', 404)
    }
    return await TokenManager.getTotalTokenSupply(project.tokenCode, project.issuerAddress)
  }

  // === HISTORY OPERATIONS ===

  /**
   * 寄付履歴を取得
   *
   * createdAtフィールドの降順(最新順)でソートされ、トークン発行ステータスが「完了」のもののみを対象とする。
   */
  static async getDonationHistory(queryParams: DonationQueryParams): Promise<DonationRecord[]> {
    return DonationHistoryManager.getDonationHistory(queryParams)
  }

  /**
   * プロジェクト別寄付統計を取得
   */
  static async getProjectDonationStats(projectId: string): Promise<ProjectDonationStats> {
    return DonationHistoryManager.getProjectDonationStats(projectId)
  }

  /**
   * 寄付記録を取得
   */
  static async getDonationRecord(recordId: string): Promise<DonationRecord | null> {
    return DonationHistoryManager.getDonationRecord(recordId)
  }

  /**
   * 最近の寄付を取得
   *
   * なんの条件もなく、グローバルに最新の寄付を取得する。
   */
  static async getRecentGlobalDonations(limit: number = 10): Promise<DonationRecord[]> {
    return DonationHistoryManager.getRecentGlobalDonations(limit)
  }

  // === COMMON OPERATIONS ===

  /**
   * Xamanペイロードの状態をチェック
   */
  static async checkXamanPayloadStatus(
    payloadUuid: string
  ): Promise<XummTypes.XummGetPayloadResponse> {
    return super.checkXamanPayloadStatus(payloadUuid)
  }

  /**
   * ペイロードをキャンセル
   */
  static async cancelXamanPayload(payloadUuid: string): Promise<void> {
    return super.cancelXamanPayload(payloadUuid)
  }

  // === VALIDATION & UTILITIES ===

  /**
   * 寄付リクエストの期限確認
   */
  static isDonationRequestExpired(request: DonationRequest): boolean {
    return DonationManager.isRequestExpired(request)
  }

  // === PRIVATE METHODS ===

  /**
   * 寄付完了時のトークン自動発行処理
   */
  private static async processTokenIssueForDonation(donationRecord: DonationRecord): Promise<void> {
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
  }
}
