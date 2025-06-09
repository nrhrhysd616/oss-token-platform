/**
 * 寄付取引専用マネージャー
 */

import { getXRPLClient } from '@/lib/xrpl/client'
import {
  getActiveTreasuryWallet,
  generateDestinationTag,
  generateVerificationHash,
} from '@/lib/xrpl/config'
import { BaseService } from '../shared/BaseService'
import { DonationServiceError } from '../shared/ServiceError'
import type { XummTypes } from 'xumm-sdk'
import type {
  DonationRequest,
  DonationRecord,
  DonationPayload,
  DonationStatus,
} from '@/types/donation'
import { FIRESTORE_COLLECTIONS } from '@/lib/firebase/collections'

/**
 * 寄付取引管理クラス
 */
export class DonationManager extends BaseService {
  private static xrplClient = getXRPLClient()

  // === CREATE ===

  /**
   * 寄付リクエスト作成とXamanペイロード生成を統合実行
   */
  static async createDonationRequestWithPayload(
    projectId: string,
    amount: number,
    donorUid?: string
  ): Promise<{ request: DonationRequest; payload: DonationPayload }> {
    try {
      // 寄付金額の妥当性確認
      if (!this.validateDonationAmount(amount)) {
        throw new DonationServiceError('寄付金額が無効です', 'VALIDATION_ERROR', 400)
      }

      const timestamp = Date.now()
      const destinationTag = generateDestinationTag(projectId)
      const verificationHash = generateVerificationHash(projectId, 'donation', amount, timestamp)
      const treasuryWallet = getActiveTreasuryWallet()

      // リクエストデータ準備
      const requestId = `donation_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
      const request: Omit<DonationRequest, 'id'> = {
        projectId,
        donorUid,
        amount,
        destinationTag,
        verificationHash,
        status: 'pending',
        createdAt: new Date(timestamp),
        expiresAt: new Date(timestamp + 10 * 60 * 1000), // 10分後に期限切れ
      }

      // Xamanペイロード準備
      const paymentTransaction: XummTypes.XummJsonTransaction = {
        TransactionType: 'Payment',
        Destination: treasuryWallet.address,
        DestinationTag: destinationTag,
        Amount: (amount * 1000000).toString(), // XRPをdropsに変換
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('donation_verification', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(verificationHash, 'utf8').toString('hex').toUpperCase(),
            },
          },
        ],
      }

      const payloadRequest: XummTypes.XummPostPayloadBodyJson = {
        txjson: paymentTransaction,
        options: {
          submit: true,
          multisign: false,
          expire: 10, // 10分で期限切れ
        },
        custom_meta: {
          identifier: this.generateIdentifier('dn-', requestId),
          blob: {
            purpose: 'donation',
            requestId,
          },
        },
      }

      // Xamanペイロード作成
      const xamanResponse = await this.createXamanPayload(payloadRequest)

      // リクエストにXamanペイロードUUIDを追加
      const requestWithPayload = {
        ...request,
        xamanPayloadUuid: xamanResponse.uuid,
        status: 'payload_created' as const,
      }

      // Firestoreに保存
      const createdRequest = await this.createDocument<DonationRequest>(
        FIRESTORE_COLLECTIONS.DONATION_REQUESTS,
        requestWithPayload,
        requestId
      )

      const payload: DonationPayload = {
        uuid: xamanResponse.uuid,
        qrPng: xamanResponse.refs.qr_png,
        websocketUrl: xamanResponse.refs.websocket_status,
        destinationTag,
        verificationHash,
      }

      return {
        request: createdRequest,
        payload,
      }
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('寄付リクエスト・ペイロード作成エラー:', error)
      throw new DonationServiceError('寄付リクエストの作成に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === READ ===

  /**
   * 寄付セッション取得
   */
  static async getDonationRequest(requestId: string): Promise<DonationRequest | null> {
    return this.getDocument<DonationRequest>(FIRESTORE_COLLECTIONS.DONATION_REQUESTS, requestId)
  }

  /**
   * 寄付が完了しているかチェック
   */
  static async isDonationCompleted(
    requestId: string
  ): Promise<{ completed: boolean; record?: DonationRecord }> {
    try {
      const request = await this.getDonationRequest(requestId)
      if (!request) {
        requestId
        return { completed: false }
      }

      // セッションが既に完了状態かチェック
      if (request.status === 'completed' && request.txHash) {
        // 対応する寄付記録を取得
        const recordsSnapshot = await this.db
          .collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
          .where('requestId', '==', requestId)
          .where('txHash', '==', request.txHash)
          .get()

        if (!recordsSnapshot.empty) {
          const doc = recordsSnapshot.docs[0]
          return {
            completed: true,
            record: {
              id: doc.id,
              ...doc.data(),
            } as DonationRecord,
          }
        }
      }

      return { completed: false }
    } catch (error) {
      console.error('寄付完了チェックエラー:', error)
      throw new DonationServiceError('寄付状態の確認に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === UPDATE ===

  /**
   * 寄付リクエスト完了処理
   */
  static async completeDonationRequest(
    requestId: string,
    xamanStatus: XummTypes.XummGetPayloadResponse
  ): Promise<DonationRecord> {
    try {
      const request = await this.getDonationRequest(requestId)
      if (!request) {
        throw new DonationServiceError('寄付セッションが見つかりません', 'NOT_FOUND', 404)
      }

      if (!xamanStatus.response?.txid) {
        throw new DonationServiceError(
          'トランザクションハッシュがありません',
          'VALIDATION_ERROR',
          400
        )
      }

      // 実際の署名者アドレスを取得
      const donorAddress = xamanStatus.response?.account || xamanStatus.response?.signer
      if (!donorAddress) {
        throw new DonationServiceError('署名者アドレスが取得できません', 'VALIDATION_ERROR', 400)
      }

      // トランザクションの検証
      const isValid = await this.verifyDonationTransaction(
        xamanStatus.response.txid,
        request,
        donorAddress
      )
      if (!isValid) {
        throw new DonationServiceError(
          '寄付トランザクションの検証に失敗しました',
          'VALIDATION_ERROR',
          400
        )
      }

      // 寄付記録を作成
      const recordId = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const record: Omit<DonationRecord, 'id'> = {
        requestId,
        projectId: request.projectId,
        donorAddress, // 実際の署名者アドレスを記録
        donorUid: request.donorUid,
        amount: request.amount,
        txHash: xamanStatus.response.txid,
        destinationTag: request.destinationTag,
        verificationHash: request.verificationHash,
        tokenIssued: false,
        tokenIssueStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Firestoreに保存（トランザクション使用）
      return await this.runTransaction(async transaction => {
        // 寄付記録を保存
        const recordRef = this.db.collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS).doc(recordId)
        transaction.set(recordRef, record)

        // セッションを完了状態に更新
        transaction.update(
          this.db.collection(FIRESTORE_COLLECTIONS.DONATION_REQUESTS).doc(requestId),
          {
            status: 'completed' as DonationStatus,
            txHash: xamanStatus.response.txid,
            completedAt: new Date(),
          }
        )

        return {
          id: recordId,
          ...record,
        } as DonationRecord
      })
    } catch (error) {
      if (error instanceof DonationServiceError) {
        throw error
      }
      console.error('寄付セッション完了エラー:', error)
      throw new DonationServiceError('寄付セッションの完了に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === VALIDATION ===

  /**
   * 寄付リクエストの期限確認
   */
  static isRequestExpired(request: DonationRequest): boolean {
    return this.isExpired(request.expiresAt)
  }

  /**
   * 寄付金額の妥当性確認
   */
  static validateDonationAmount(amount: number): boolean {
    // 最小寄付額: 1 XRP
    const minAmount = 1
    // 最大寄付額: 10,000 XRP
    const maxAmount = 10000

    return amount >= minAmount && amount <= maxAmount && Number.isFinite(amount)
  }

  /**
   * 寄付トランザクションの検証
   */
  private static async verifyDonationTransaction(
    txHash: string,
    expectedRequest: DonationRequest,
    donorAddress: string
  ): Promise<boolean> {
    try {
      console.log(`🔍 Verifying transaction: ${txHash}`)
      const txResponse = await this.xrplClient.getTransaction(txHash)
      const tx = txResponse.result

      console.log(`📋 Transaction found, validating details...`)

      // トランザクションデータの取得
      const txData = tx.tx_json || tx

      // トランザクション基本情報の検証
      if (txData.TransactionType !== 'Payment') {
        console.log(`❌ Invalid transaction type: ${txData.TransactionType}`)
        return false
      }

      // 送信者の検証
      if (txData.Account !== donorAddress) {
        console.log(`❌ Invalid sender: expected ${donorAddress}, got ${txData.Account}`)
        return false
      }

      // 受信者の検証
      const treasuryWallet = getActiveTreasuryWallet()
      if (txData.Destination !== treasuryWallet.address) {
        console.log(
          `❌ Invalid destination: expected ${treasuryWallet.address}, got ${txData.Destination}`
        )
        return false
      }

      // 宛先タグの検証
      if (txData.DestinationTag !== expectedRequest.destinationTag) {
        console.log(
          `❌ Invalid destination tag: expected ${expectedRequest.destinationTag}, got ${txData.DestinationTag}`
        )
        return false
      }

      // 金額の検証
      const expectedAmount = (expectedRequest.amount * 1000000).toString()
      const actualAmount =
        (txData as any).DeliverMax || (txData as any).Amount || (tx.meta as any)?.delivered_amount
      if (actualAmount !== expectedAmount) {
        console.log(`❌ Invalid amount: expected ${expectedAmount}, got ${actualAmount}`)
        return false
      }

      // メモフィールドの検証
      if (!txData.Memos || txData.Memos.length === 0) {
        console.log(`❌ No memos found`)
        return false
      }

      const memo = txData.Memos[0].Memo
      const memoData = Buffer.from(memo.MemoData!, 'hex').toString('utf8')
      if (memoData !== expectedRequest.verificationHash) {
        console.log(
          `❌ Invalid memo data: expected ${expectedRequest.verificationHash}, got ${memoData}`
        )
        return false
      }

      console.log(`✅ Transaction verification successful`)
      return true
    } catch (error: any) {
      if (error.data?.error === 'txnNotFound') {
        console.log(`⚠️ Transaction not found yet: ${txHash}`)
      } else {
        console.error('Transaction verification error:', error.message || error)
      }
      return false
    }
  }
}
