import crypto from 'crypto'
import { XamanClient } from './client'
import { getAdminDb } from '@/lib/firebase/admin'
import { convertWalletTimestamps } from '@/lib/firebase/utils'
import type { WalletLinkPayload, XamanPayloadResponse, XamanPayloadStatus } from '@/types/xaman'
import type { WalletLinkRequest, Wallet } from '@/types/user'

/**
 * ウォレット連携サービス
 *
 * ⚠️ 注意: このクラスはサーバーサイド専用です。
 * XamanのAPIキーとシークレットを使用するため、クライアントサイドでは使用できません。
 * クライアントサイドからは /api/xaman/wallets エンドポイント経由でアクセスしてください。
 */
export class WalletService {
  private xamanClient: XamanClient
  private db: FirebaseFirestore.Firestore

  constructor() {
    this.xamanClient = new XamanClient()
    this.db = getAdminDb()
  }

  /**
   * ウォレット連携リクエストを作成
   */
  async createWalletLinkRequest(userId: string): Promise<WalletLinkRequest> {
    // Xaman payload作成
    const payload: WalletLinkPayload = {
      txjson: {
        TransactionType: 'SignIn',
      },
      options: {
        submit: false,
        multisign: false,
        expire: 300, // 5分
      },
      custom_meta: {
        identifier: this.generateIdentifier(userId),
        blob: {
          purpose: 'wallet-link',
          userId,
        },
      },
    }

    const xamanResponse: XamanPayloadResponse = await this.xamanClient.createPayload(payload)

    // Firestore に保存
    const linkRequest: WalletLinkRequest = {
      id: xamanResponse.uuid,
      userId,
      xamanPayloadUuid: xamanResponse.uuid,
      qrData: {
        qr_png: xamanResponse.refs.qr_png,
        qr_matrix: xamanResponse.refs.qr_matrix,
        websocket_status: xamanResponse.refs.websocket_status,
      },
      status: 'created',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分後
    }

    await this.db.collection('walletLinkRequests').doc(xamanResponse.uuid).set(linkRequest)

    return linkRequest
  }

  /**
   * ウォレット連携リクエストの状態を取得
   */
  async getWalletLinkRequest(payloadUuid: string): Promise<WalletLinkRequest | null> {
    const docSnap = await this.db.collection('walletLinkRequests').doc(payloadUuid).get()

    if (!docSnap.exists) {
      return null
    }

    return docSnap.data() as WalletLinkRequest
  }

  /**
   * Xamanペイロードの状態をチェック
   */
  async checkPayloadStatus(payloadUuid: string): Promise<XamanPayloadStatus> {
    return await this.xamanClient.getPayloadStatus(payloadUuid)
  }

  /**
   * ウォレット連携が完了しているかチェック
   */
  async isWalletLinkCompleted(
    payloadUuid: string
  ): Promise<{ completed: boolean; wallet?: Wallet }> {
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
          wallet: convertWalletTimestamps({
            id: doc.id,
            ...doc.data(),
          }) as Wallet,
        }
      }
    }

    return { completed: false }
  }

  /**
   * ウォレット連携を完了
   */
  async completeWalletLink(
    payloadUuid: string,
    xamanStatus: XamanPayloadStatus
  ): Promise<Wallet | null> {
    const linkRequest = await this.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      throw new Error('Wallet link request not found')
    }

    if (!xamanStatus.response?.account) {
      throw new Error('No wallet address in Xaman response')
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
      throw new Error('This wallet is already linked')
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
      verificationTxHash: xamanStatus.response.txid,
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
        primaryWalletId: isPrimary ? walletRef.id : userDoc.data()?.walletSummary?.primaryWalletId,
        totalWallets: currentWalletCount,
        lastLinkedAt: new Date(),
      },
    })

    // ウォレット連携リクエストを完了状態に更新
    await this.db.collection('walletLinkRequests').doc(payloadUuid).update({
      status: 'signed',
      completedAt: new Date(),
      walletAddress,
    })

    return {
      id: walletRef.id,
      ...newWallet,
    }
  }

  /**
   * ユーザーのウォレット一覧を取得
   */
  async getUserWallets(userId: string): Promise<Wallet[]> {
    const walletsSnapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('wallets')
      .where('status', '==', 'linked')
      .get()

    return walletsSnapshot.docs.map(
      doc =>
        convertWalletTimestamps({
          id: doc.id,
          ...doc.data(),
        }) as Wallet
    )
  }

  /**
   * 40文字以内のidentifierを生成
   * プレフィックス「wl-」+ SHA-256ハッシュの最初の32文字 = 35文字
   */
  private generateIdentifier(userId: string): string {
    const prefix = 'wl-'
    const timestamp = Date.now().toString()
    const combined = `${userId}-${timestamp}`
    // SHA-256ハッシュの最初の32文字を使用
    const hash = crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32)
    return `${prefix}${hash}`
  }
}
