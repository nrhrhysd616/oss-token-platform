/**
 * トラストライン設定専用マネージャー
 */

import { getXRPLClient } from '@/lib/xrpl/client'
import { convertTokenCodeToXRPLFormat } from '@/lib/xrpl/token-utils'
import { TrustSetFlags } from 'xrpl'
import { BaseService } from '../shared/BaseService'
import { DonationServiceError } from '../shared/ServiceError'
import type { XummTypes } from 'xumm-sdk'
import type { TrustLineRequest, TrustLinePayload, TrustLineStatus } from '@/types/donation'

/**
 * トラストライン管理クラス
 */
export class TrustLineManager extends BaseService {
  private static xrplClient = getXRPLClient()

  // === CREATE ===

  /**
   * トラストライン設定リクエスト作成
   */
  static async createTrustLineRequest(
    projectId: string,
    projectName: string,
    tokenCode: string,
    issuerAddress: string,
    donorAddress: string,
    donorUid?: string
  ): Promise<{ request: TrustLineRequest; payload: TrustLinePayload }> {
    try {
      // 既存のトラストラインをチェック
      const hasTrustLine = await this.checkTrustLineExists(donorAddress, tokenCode, issuerAddress)
      if (hasTrustLine) {
        throw new DonationServiceError(
          'このトークンのトラストラインは既に設定されています',
          'DUPLICATE',
          409
        )
      }

      const timestamp = Date.now()
      const requestId = `trustline_${timestamp}_${Math.random().toString(36).substr(2, 9)}`

      // Xamanペイロード作成
      const payload = await this.createTrustLinePayload(
        tokenCode,
        issuerAddress,
        donorAddress,
        requestId
      )

      // リクエスト作成
      const request: Omit<TrustLineRequest, 'id'> = {
        projectId,
        projectName,
        tokenCode,
        issuerAddress,
        donorAddress,
        donorUid,
        xamanPayloadUuid: payload.uuid,
        status: 'created',
        createdAt: new Date(timestamp),
        expiresAt: new Date(timestamp + 5 * 60 * 1000), // 5分後に期限切れ
      }

      // Firestoreに保存
      const savedRequest = await this.createDocument<TrustLineRequest>(
        'trustLineRequests',
        request,
        requestId
      )

      return { request: savedRequest, payload }
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
   * トラストライン設定用Xamanペイロード生成
   */
  private static async createTrustLinePayload(
    tokenCode: string,
    issuerAddress: string,
    donorAddress: string,
    requestId: string
  ): Promise<TrustLinePayload> {
    const trustSetTransaction: XummTypes.XummJsonTransaction = {
      TransactionType: 'TrustSet',
      Account: donorAddress,
      LimitAmount: {
        currency: convertTokenCodeToXRPLFormat(tokenCode),
        issuer: issuerAddress,
        value: '1000000', // 最大信頼限度額
      },
      Flags: TrustSetFlags.tfSetNoRipple, // リップリングを無効化
    }

    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson: trustSetTransaction,
      options: {
        submit: true,
        multisign: false,
        expire: 5, // 5分で期限切れ
      },
      custom_meta: {
        identifier: this.generateIdentifier('tl-', requestId),
        blob: {
          purpose: 'trustline',
          requestId,
        },
      },
    }

    const response = await this.createXamanPayload(payload)

    return {
      uuid: response.uuid,
      qrPng: response.refs.qr_png,
      websocketUrl: response.refs.websocket_status,
    }
  }

  // === READ ===

  /**
   * トラストライン設定リクエスト取得
   */
  static async getTrustLineRequest(requestId: string): Promise<TrustLineRequest | null> {
    return this.getDocument<TrustLineRequest>('trustLineRequests', requestId)
  }

  /**
   * トラストライン存在確認
   */
  static async checkTrustLineExists(
    walletAddress: string,
    tokenCode: string,
    issuerAddress: string
  ): Promise<boolean> {
    try {
      const trustLines = await this.xrplClient.getTrustLines(walletAddress)

      const currencyCode = convertTokenCodeToXRPLFormat(tokenCode)
      return trustLines.result.lines.some(
        line =>
          line.currency === currencyCode &&
          line.account === issuerAddress &&
          parseFloat(line.limit) > 0
      )
    } catch (error) {
      console.error('トラストライン確認エラー:', error)
      return false
    }
  }

  // === UPDATE ===

  /**
   * トラストライン設定完了処理
   */
  static async completeTrustLineRequest(
    requestId: string,
    xamanStatus: XummTypes.XummGetPayloadResponse
  ): Promise<void> {
    try {
      const request = await this.getTrustLineRequest(requestId)
      if (!request) {
        throw new DonationServiceError(
          'トラストライン設定リクエストが見つかりません',
          'NOT_FOUND',
          404
        )
      }

      if (!xamanStatus.response?.txid) {
        throw new DonationServiceError(
          'トランザクションハッシュがありません',
          'VALIDATION_ERROR',
          400
        )
      }

      // リクエストを完了状態に更新
      await this.updateDocument<TrustLineRequest>('trustLineRequests', requestId, {
        status: 'signed' as TrustLineStatus,
        txHash: xamanStatus.response.txid,
        completedAt: new Date(),
      })
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('トラストライン設定完了エラー:', error)
      throw new DonationServiceError(
        'トラストライン設定の完了に失敗しました',
        'INTERNAL_ERROR',
        500
      )
    }
  }

  // === VALIDATION ===

  /**
   * トラストライン設定リクエストの期限確認
   */
  static isRequestExpired(request: TrustLineRequest): boolean {
    return this.isExpired(request.expiresAt)
  }
}
