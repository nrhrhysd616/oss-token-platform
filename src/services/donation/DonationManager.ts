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
import { DonationServiceError } from '../DonationService'
import type { XummTypes } from 'xumm-sdk'
import type {
  DonationRequest,
  DonationRecord,
  DonationPayload,
  DonationStatus,
} from '@/types/donation'
import { collectionPath, docPath, FIRESTORE_COLLECTIONS } from '@/lib/firebase/collections'

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
    xrpAmount: number,
    donorUid?: string
  ): Promise<{ request: DonationRequest; payload: DonationPayload }> {
    const timestamp = Date.now()
    const destinationTag = generateDestinationTag(projectId)
    const verificationHash = generateVerificationHash(projectId, 'donation', xrpAmount, timestamp)
    const treasuryWallet = getActiveTreasuryWallet()

    const expiresMinutes = 10 // ペイロードの有効期限（分）

    // リクエストデータ準備（IDは後でXamanペイロードUUIDを使用）
    const request: Omit<DonationRequest, 'id'> = {
      projectId,
      donorUid,
      xrpAmount,
      destinationTag,
      verificationHash,
      status: 'pending',
      createdAt: new Date(timestamp),
      expiresAt: new Date(timestamp + expiresMinutes * 60 * 1000), // 10分後に期限切れ
    }

    // Xamanペイロード準備
    const paymentTransaction: XummTypes.XummJsonTransaction = {
      TransactionType: 'Payment',
      Destination: treasuryWallet.address,
      DestinationTag: destinationTag,
      Amount: (xrpAmount * 1000000).toString(), // XRPをdropsに変換
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
        expire: expiresMinutes, // 10分で期限切れ
      },
      custom_meta: {
        identifier: this.generateIdentifier('dn-', verificationHash),
        blob: {
          purpose: 'donation',
          projectId,
          xrpAmount,
          verificationHash,
          timestamp,
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

    // FirestoreにXamanペイロードUUIDをIDとして保存
    const createdRequest = await this.createDocumentByPath<DonationRequest>(
      collectionPath.donationRequests(),
      requestWithPayload,
      xamanResponse.uuid
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
  }

  // === READ ===

  /**
   * 寄付セッション取得
   */
  static async getDonationRequest(requestId: string): Promise<DonationRequest | null> {
    return this.getDocumentByPath<DonationRequest>(docPath.donationRequest(requestId))
  }

  /**
   * 寄付が完了しているかチェック
   */
  static async isDonationCompleted(
    requestId: string
  ): Promise<{ completed: boolean; record?: DonationRecord }> {
    const request = await this.getDonationRequest(requestId)
    if (!request) {
      return { completed: false }
    }

    // セッションが既に完了状態かチェック
    if (request.status === 'completed' && request.txHash) {
      // verificationHashをIDとして直接寄付記録を取得
      const record = await this.getDocumentByPath<DonationRecord>(
        docPath.donationRecord(request.verificationHash)
      )

      if (record) {
        return {
          completed: true,
          record,
        }
      }
    }

    return { completed: false }
  }

  // === UPDATE ===

  /**
   * 寄付リクエスト完了処理
   */
  static async completeDonationRequest(
    requestId: string,
    xamanStatus: XummTypes.XummGetPayloadResponse
  ): Promise<DonationRecord> {
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

    // 寄付記録を作成（verificationHashをIDとして使用）
    const record: Omit<DonationRecord, 'id'> = {
      requestId,
      projectId: request.projectId,
      donorAddress, // 実際の署名者アドレスを記録
      donorUid: request.donorUid,
      xrpAmount: request.xrpAmount,
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
      // 寄付記録をverificationHashをIDとして保存
      const recordRef = this.db
        .collection(FIRESTORE_COLLECTIONS.DONATION_RECORDS)
        .doc(request.verificationHash)
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
        id: request.verificationHash,
        ...record,
      } as DonationRecord
    })
  }

  // === VALIDATION ===

  /**
   * 寄付リクエストの期限確認
   */
  static isRequestExpired(request: DonationRequest): boolean {
    return this.isExpired(request.expiresAt)
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
      console.log(`🔍 Verifying transaction hash: ${txHash}`)
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
      const expectedAmount = (expectedRequest.xrpAmount * 1000000).toString()
      const actualAmount =
        (txData as any).DeliverMax || (txData as any).Amount || (tx.meta as any)?.delivered_amount
      if (actualAmount !== expectedAmount) {
        console.log(`❌ Invalid XRP amount: expected ${expectedAmount}, got ${actualAmount}`)
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
