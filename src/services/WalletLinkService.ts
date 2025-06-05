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
   * payloadUuidをドキュメントIDとして直接検索
   */
  static async isWalletLinkCompleted(
    payloadUuid: string
  ): Promise<{ completed: boolean; wallet?: Wallet }> {
    try {
      const linkRequest = await this.getWalletLinkRequest(payloadUuid)
      if (!linkRequest) {
        return { completed: false }
      }

      // payloadUuidをドキュメントIDとして直接ウォレットを取得
      const walletDoc = await this.db
        .collection('users')
        .doc(linkRequest.userId)
        .collection('wallets')
        .doc(payloadUuid)
        .get()

      if (walletDoc.exists) {
        const walletData = walletDoc.data()
        if (walletData && walletData.status === 'linked') {
          return {
            completed: true,
            wallet: convertTimestamps({
              id: payloadUuid,
              ...walletData,
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
   * payloadUuidをドキュメントIDとして使用し、冪等性を確保
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

      // === トランザクション外で必要なデータを事前に取得 ===
      // 同じアドレスの他のウォレットをチェック
      const sameAddressWalletsSnapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('wallets')
        .where('address', '==', walletAddress)
        .get()

      // 現在のウォレット数を取得
      const allWalletsSnapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('wallets')
        .where('status', '==', 'linked')
        .get()

      // プライマリウォレット判定（初回連携または既存プライマリがない場合）
      const hasExistingPrimary = allWalletsSnapshot.docs
        .filter(doc => !sameAddressWalletsSnapshot.docs.some(sameDoc => sameDoc.id === doc.id))
        .some(doc => doc.data().isPrimary)
      const isPrimary = !hasExistingPrimary

      // Firestoreトランザクションで冪等性を確保
      return await this.db.runTransaction(async transaction => {
        // === すべての読み取り操作を最初に実行 ===

        // payloadUuidをドキュメントIDとして使用
        const walletRef = this.db
          .collection('users')
          .doc(userId)
          .collection('wallets')
          .doc(payloadUuid)

        // 既存ウォレット（payloadUuid）をチェック
        const existingWallet = await transaction.get(walletRef)
        if (existingWallet.exists) {
          // 冪等性：既に存在する場合はそのまま返す
          return convertTimestamps({
            id: payloadUuid,
            ...existingWallet.data(),
          }) as Wallet
        }

        // ユーザードキュメントを読み取り
        const userRef = this.db.collection('users').doc(userId)
        const userDoc = await transaction.get(userRef)
        const currentData = userDoc.data()

        // === すべての書き込み操作を実行 ===

        // 同じアドレスのウォレットがある場合は削除（重複排除）
        for (const doc of sameAddressWalletsSnapshot.docs) {
          transaction.delete(doc.ref)
        }

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

        transaction.set(walletRef, newWallet)

        // ユーザーのwalletSummaryを更新
        const newTotalWallets = allWalletsSnapshot.size - sameAddressWalletsSnapshot.size + 1

        transaction.update(userRef, {
          walletSummary: {
            primaryWalletId: isPrimary
              ? payloadUuid
              : currentData?.walletSummary?.primaryWalletId || payloadUuid,
            totalWallets: newTotalWallets,
            lastLinkedAt: new Date(),
          },
        })

        return {
          id: payloadUuid,
          ...newWallet,
        }
      })
    } catch (error) {
      if (error instanceof WalletLinkServiceError) {
        throw error
      }
      console.error('ウォレット連携完了エラー:', error)
      throw new WalletLinkServiceError('ウォレット連携の完了に失敗しました', 'INTERNAL_ERROR', 500)
    } finally {
      // ウォレット連携リクエストを完了状態に更新（トランザクション外で実行）
      try {
        await this.updateDocument<WalletLinkRequest>('walletLinkRequests', payloadUuid, {
          status: 'signed',
          completedAt: new Date(),
          walletAddress: xamanStatus.response?.account!,
        })
      } catch (error) {
        console.error('ウォレット連携リクエスト更新エラー:', error)
        // リクエスト更新の失敗はウォレット連携全体を失敗させない
      }
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
