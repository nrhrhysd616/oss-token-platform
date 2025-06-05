/**
 * ウォレット連携関連の共通サービス
 */

import { BaseService, type PaginatedResult } from './shared/BaseService'
import { ServiceError } from './shared/ServiceError'
import { convertTimestamps } from '@/lib/firebase/utils'
import type { XummTypes } from 'xumm-sdk'
import type { WalletLinkRequest } from '@/types/xaman'
import type { Wallet } from '@/types/user'
import type { Query, DocumentData } from 'firebase-admin/firestore'

/**
 * ウォレット連携サービスエラークラス
 */
export class WalletLinkServiceError extends ServiceError {
  constructor(
    message: string,
    code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'VALIDATION_ERROR'
      | 'DUPLICATE'
      | 'EXPIRED'
      | 'INTERNAL_ERROR',
    statusCode: number
  ) {
    super(message, code, statusCode)
    this.name = 'WalletLinkServiceError'
  }
}

/**
 * ウォレット連携サービスクラス
 */
export class WalletLinkService extends BaseService {
  // === CREATE ===

  /**
   * ウォレット連携リクエストを作成
   */
  static async createWalletLinkRequest(userId: string): Promise<WalletLinkRequest> {
    try {
      // Xaman payload作成
      const payload: XummTypes.XummPostPayloadBodyJson = {
        txjson: {
          TransactionType: 'SignIn',
        },
        options: {
          submit: false,
          multisign: false,
          expire: 300, // 5分
        },
        custom_meta: {
          identifier: this.generateIdentifier('wl-', userId),
          blob: {
            purpose: 'wallet-link',
            userId,
          },
        },
      }

      const xamanResponse = await this.createXamanPayload(payload)

      // Firestore に保存
      const linkRequest: Omit<WalletLinkRequest, 'id'> = {
        userId,
        xamanPayloadUuid: xamanResponse.uuid,
        qrPng: xamanResponse.refs.qr_png,
        websocketUrl: xamanResponse.refs.websocket_status,
        status: 'created',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分後
      }

      return await this.createDocument<WalletLinkRequest>(
        'walletLinkRequests',
        linkRequest,
        xamanResponse.uuid
      )
    } catch (error) {
      if (error instanceof WalletLinkServiceError) {
        throw error
      }
      console.error('ウォレット連携リクエスト作成エラー:', error)
      throw new WalletLinkServiceError(
        'ウォレット連携リクエストの作成に失敗しました',
        'INTERNAL_ERROR',
        500
      )
    }
  }

  // === READ ===

  /**
   * ウォレット連携リクエストの状態を取得
   */
  static async getWalletLinkRequest(payloadUuid: string): Promise<WalletLinkRequest | null> {
    return this.getDocument<WalletLinkRequest>('walletLinkRequests', payloadUuid)
  }

  /**
   * ユーザーのウォレット一覧を取得
   */
  static async getUserWallets(userId: string): Promise<Wallet[]> {
    try {
      let query: Query<DocumentData> = this.db.collection('users').doc(userId).collection('wallets')

      query = query.where('status', '==', 'linked')

      const snapshot = await query.get()
      const wallets: Wallet[] = snapshot.docs.map(doc =>
        convertTimestamps({
          id: doc.id,
          ...doc.data(),
        })
      ) as Wallet[]

      return wallets
    } catch (error) {
      if (error instanceof WalletLinkServiceError) {
        throw error
      }
      console.error('ユーザーウォレット一覧取得エラー:', error)
      throw new WalletLinkServiceError('ウォレット一覧の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * Xamanペイロードの状態をチェック
   */
  static async checkPayloadStatus(payloadUuid: string): Promise<XummTypes.XummGetPayloadResponse> {
    return super.checkPayloadStatus(payloadUuid)
  }

  /**
   * ウォレット連携が完了しているかチェック
   */
  static async isWalletLinkCompleted(
    payloadUuid: string
  ): Promise<{ completed: boolean; wallet?: Wallet }> {
    try {
      const linkRequest = await this.getWalletLinkRequest(payloadUuid)
      if (!linkRequest) {
        return { completed: false }
      }

      // ウォレット連携リクエストが既に完了状態かチェック
      if (linkRequest.status === 'signed' && linkRequest.walletAddress) {
        // 対応するウォレットを取得
        const walletsSnapshot = await this.db
          .collection('users')
          .doc(linkRequest.userId)
          .collection('wallets')
          .where('address', '==', linkRequest.walletAddress)
          .where('xamanPayloadUuid', '==', payloadUuid)
          .get()

        if (!walletsSnapshot.empty) {
          const doc = walletsSnapshot.docs[0]
          return {
            completed: true,
            wallet: convertTimestamps({
              id: doc.id,
              ...doc.data(),
            }) as Wallet,
          }
        }
      }

      return { completed: false }
    } catch (error) {
      console.error('ウォレット連携完了チェックエラー:', error)
      throw new WalletLinkServiceError(
        'ウォレット連携状態の確認に失敗しました',
        'INTERNAL_ERROR',
        500
      )
    }
  }

  // === UPDATE ===

  /**
   * ウォレット連携を完了
   */
  static async completeWalletLink(
    payloadUuid: string,
    xamanStatus: XummTypes.XummGetPayloadResponse
  ): Promise<Wallet | null> {
    try {
      const linkRequest = await this.getWalletLinkRequest(payloadUuid)
      if (!linkRequest) {
        throw new WalletLinkServiceError(
          'ウォレット連携リクエストが見つかりません',
          'NOT_FOUND',
          404
        )
      }

      if (!xamanStatus.response?.account) {
        throw new WalletLinkServiceError(
          'Xamanレスポンスにウォレットアドレスが含まれていません',
          'VALIDATION_ERROR',
          400
        )
      }

      const walletAddress = xamanStatus.response.account
      const userId = linkRequest.userId

      // 既存のウォレットをチェック
      const existingWallets = await this.db
        .collection('users')
        .doc(userId)
        .collection('wallets')
        .where('address', '==', walletAddress)
        .get()

      if (!existingWallets.empty) {
        throw new WalletLinkServiceError('このウォレットは既に連携されています', 'DUPLICATE', 409)
      }

      // プライマリウォレットかどうかを判定（初回連携の場合はプライマリ）
      const userWallets = await this.db
        .collection('users')
        .doc(userId)
        .collection('wallets')
        .where('status', '==', 'linked')
        .get()
      const isPrimary = userWallets.empty

      // 新しいウォレットを作成
      const newWallet: Omit<Wallet, 'id'> = {
        address: walletAddress,
        linkedAt: new Date(),
        xamanPayloadUuid: payloadUuid,
        verificationTxHash: xamanStatus.response.txid || '',
        status: 'linked',
        isPrimary,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Firestoreに保存
      const walletRef = this.db.collection('users').doc(userId).collection('wallets').doc()
      await walletRef.set(newWallet)

      // ユーザーのwalletSummaryを更新
      const userRef = this.db.collection('users').doc(userId)
      const userDoc = await userRef.get()
      const currentWalletCount = userWallets.size + 1

      await userRef.update({
        walletSummary: {
          primaryWalletId: isPrimary
            ? walletRef.id
            : userDoc.data()?.walletSummary?.primaryWalletId,
          totalWallets: currentWalletCount,
          lastLinkedAt: new Date(),
        },
      })

      // ウォレット連携リクエストを完了状態に更新
      await this.updateDocument<WalletLinkRequest>('walletLinkRequests', payloadUuid, {
        status: 'signed',
        completedAt: new Date(),
        walletAddress,
      })

      return {
        id: walletRef.id,
        ...newWallet,
      }
    } catch (error) {
      if (error instanceof WalletLinkServiceError) {
        throw error
      }
      console.error('ウォレット連携完了エラー:', error)
      throw new WalletLinkServiceError('ウォレット連携の完了に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === DELETE ===

  /**
   * ペイロードをキャンセル
   */
  static async cancelPayload(payloadUuid: string): Promise<void> {
    return super.cancelPayload(payloadUuid)
  }
}
