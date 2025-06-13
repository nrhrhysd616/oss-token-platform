/**
 * ウォレット連携関連の共通サービス
 */

import { BaseService } from './shared/BaseService'
import { ServiceError } from './shared/ServiceError'
import { convertTimestamps } from '@/lib/firebase/utils'
import { collectionPath, docPath } from '@/lib/firebase/collections'
import type { XummTypes } from 'xumm-sdk'
import type { WalletLinkRequest } from '@/types/xaman'
import type { Wallet } from '@/types/user'

/**
 * ウォレット連携サービスエラークラス
 */
export class WalletLinkServiceError extends ServiceError {
  public readonly name = 'WalletLinkServiceError'
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
    // Xaman payload作成
    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: 'SignIn',
      },
      options: {
        submit: false,
        multisign: false,
        expire: 5, // 5分
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

    return await this.createDocumentByPath<WalletLinkRequest>(
      collectionPath.walletLinkRequests(),
      linkRequest,
      xamanResponse.uuid
    )
  }

  // === READ ===

  /**
   * ウォレット連携リクエストの状態を取得
   */
  static async getWalletLinkRequest(payloadUuid: string): Promise<WalletLinkRequest | null> {
    return this.getDocumentByPath<WalletLinkRequest>(docPath.walletLinkRequest(payloadUuid))
  }

  /**
   * ユーザーのウォレット一覧を取得
   */
  static async getUserWallets(userId: string): Promise<Wallet[]> {
    // 新しいパス文字列ベースのメソッドを使用してベースクエリを作成
    const baseQuery = this.createQueryByPath(collectionPath.userWallets(userId)).where(
      'status',
      '==',
      'linked'
    )
    const snapshot = await baseQuery.get()

    return snapshot.docs.map(doc => {
      return convertTimestamps({
        id: doc.id,
        ...doc.data(),
      }) as Wallet
    })
  }

  /**
   * Xamanペイロードの状態をチェック
   */
  static async checkPayloadStatus(payloadUuid: string): Promise<XummTypes.XummGetPayloadResponse> {
    return super.checkXamanPayloadStatus(payloadUuid)
  }

  /**
   * ウォレット連携が完了しているかチェック
   * payloadUuidをドキュメントIDとして直接検索
   */
  static async isWalletLinkCompleted(
    payloadUuid: string
  ): Promise<{ completed: boolean; wallet?: Wallet }> {
    const linkRequest = await this.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      return { completed: false }
    }

    // パス文字列を使用してウォレットを取得
    const wallet = await this.getDocumentByPath<Wallet>(
      docPath.userWallet(linkRequest.userId, payloadUuid)
    )

    if (wallet && wallet.status === 'linked') {
      return {
        completed: true,
        wallet,
      }
    }
    return { completed: false }
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
    const linkRequest = await this.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      throw new WalletLinkServiceError('ウォレット連携リクエストが見つかりません', 'NOT_FOUND', 404)
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
    const sameAddressWalletsSnapshot = await this.createQueryByPath(
      collectionPath.userWallets(userId)
    )
      .where('address', '==', walletAddress)
      .get()

    // 現在のウォレット数を取得
    const allWalletsSnapshot = await this.createQueryByPath(collectionPath.userWallets(userId))
      .where('status', '==', 'linked')
      .get()

    // プライマリウォレット判定（初回連携または既存プライマリがない場合）
    const hasExistingPrimary = allWalletsSnapshot.docs
      .filter(doc => !sameAddressWalletsSnapshot.docs.some(sameDoc => sameDoc.id === doc.id))
      .some(doc => doc.data().isPrimary)
    const isPrimary = !hasExistingPrimary

    // Firestoreトランザクションで冪等性を確保
    const updatedWallet = await this.runTransaction<Wallet>(async transaction => {
      // === すべての読み取り操作を最初に実行 ===

      // payloadUuidをドキュメントIDとして使用
      const walletRef = this.getDocumentRefByPath(docPath.userWallet(userId, payloadUuid))

      // 既存ウォレット（payloadUuid）をチェック
      const existingWallet = await transaction.get(walletRef)
      if (existingWallet.exists) {
        const walletData = existingWallet.data()

        // 既にリンク完了している場合のみ早期リターン
        if (walletData?.status === 'linked') {
          return convertTimestamps({
            id: payloadUuid,
            ...walletData,
          })
        }
      }

      // ユーザードキュメントを読み取り
      const userRef = this.getDocumentRefByPath(docPath.user(userId))
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
    // ウォレット連携リクエストを完了状態に更新（トランザクション外で実行）
    try {
      await this.updateDocumentByPath<WalletLinkRequest>(docPath.walletLinkRequest(payloadUuid), {
        status: 'signed',
        completedAt: new Date(),
        walletAddress: xamanStatus.response?.account!,
      })
    } catch (error) {
      console.error('ウォレット連携リクエスト更新エラー:', error)
      // リクエスト更新の失敗はウォレット連携全体を失敗させない
    }
    return updatedWallet
  }
}
