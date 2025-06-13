/**
 * XRPL接続クライアント
 */

import {
  Client,
  Wallet,
  SubmittableTransaction,
  TxResponse,
  OrderBookStream,
  BookOffersResponse,
} from 'xrpl'
import { getXRPLConfig, validateXRPLConfig, XRPLWallet, getRLUSDIssuerAddress } from './config'
import { convertTokenCodeToXRPLFormat } from './token-utils'

/**
 * XRPLクライアント管理クラス
 */
export class XRPLClient {
  private client: Client | null = null
  private config = getXRPLConfig()

  constructor() {
    validateXRPLConfig()
  }

  /**
   * XRPLネットワークに接続
   */
  async connect(): Promise<void> {
    if (this.client?.isConnected()) {
      return
    }

    this.client = new Client(this.config.server)
    await this.client.connect()
  }

  /**
   * XRPLネットワークから切断
   */
  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect()
    }
    this.client = null
  }

  /**
   * トランザクションを送信
   */
  async submitTransaction(
    transaction: SubmittableTransaction,
    wallet: XRPLWallet
  ): Promise<TxResponse> {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    // ウォレットオブジェクトを作成
    const xrplWallet = Wallet.fromSeed(wallet.secret)

    // トランザクションを準備・署名・送信
    const prepared = await this.client.autofill(transaction)
    const signed = xrplWallet.sign(prepared)
    const result = await this.client.submitAndWait(signed.tx_blob)

    return result
  }

  /**
   * アカウント情報を取得
   */
  async getAccountInfo(address: string) {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    return await this.client.request({
      command: 'account_info',
      account: address,
    })
  }

  /**
   * アカウントの残高を取得
   */
  async getAccountBalance(address: string): Promise<string> {
    const accountInfo = await this.getAccountInfo(address)
    return accountInfo.result.account_data.Balance
  }

  /**
   * トランザクション履歴を取得
   */
  async getTransactionHistory(address: string, limit = 10) {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    return await this.client.request({
      command: 'account_tx',
      account: address,
      limit,
    })
  }

  /**
   * 特定のトランザクションを取得
   */
  async getTransaction(txHash: string) {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    return await this.client.request({
      command: 'tx',
      transaction: txHash,
    })
  }

  /**
   * アカウントのトラストラインを取得
   */
  async getTrustLines(address: string) {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    return await this.client.request({
      command: 'account_lines',
      account: address,
    })
  }

  /**
   * 現在のレジャー情報を取得
   */
  async getLedgerInfo() {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    return await this.client.request({
      command: 'ledger',
      ledger_index: 'current',
    })
  }

  /**
   * ネットワーク手数料を取得
   */
  async getNetworkFee(): Promise<number> {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    const feeInfo = await this.client.request({
      command: 'server_info',
    })

    return feeInfo.result.info.validated_ledger?.base_fee_xrp || 0.00001
  }

  /**
   * XRP/RLUSDの最新取引価格を取得
   */
  async getXRPToRLUSDRate(): Promise<number> {
    if (!this.client?.isConnected()) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('XRPL client is not connected')
    }

    // 現在のネットワークに対応するRLUSDのIssuerアドレスを取得
    const RLUSD_ISSUER = getRLUSDIssuerAddress()

    try {
      // RLUSDを16進数形式に変換
      const rlusdCurrency = convertTokenCodeToXRPLFormat('RLUSD')
      console.debug('RLUSD Currency Code:', rlusdCurrency)

      // Order Bookを取得してbid/askから中間価格を算出
      const orderBook = (await this.client.request({
        command: 'book_offers',
        taker_gets: {
          currency: rlusdCurrency,
          issuer: RLUSD_ISSUER,
        },
        taker_pays: {
          currency: 'XRP',
        },
        limit: 10,
      })) as BookOffersResponse

      const result = orderBook.result
      const offers = result.offers
      if (!offers || offers.length === 0) {
        throw new Error('No XRP/RLUSD offers found in order book')
      }

      // 最良の売り注文から価格を取得
      const bestOffer = offers[0]
      const takerGets = bestOffer.TakerGets
      const takerPays = bestOffer.TakerPays

      let xrpAmount: number
      let rlusdAmount: number

      // XRPの場合は文字列（drops）、RLUSDの場合はオブジェクト
      if (typeof takerPays === 'string') {
        // XRP drops to XRP conversion (1 XRP = 1,000,000 drops)
        xrpAmount = parseInt(takerPays) / 1000000
      } else {
        xrpAmount = parseFloat(takerPays.value)
      }

      if (typeof takerGets === 'string') {
        rlusdAmount = parseInt(takerGets) / 1000000
      } else {
        rlusdAmount = parseFloat(takerGets.value)
      }

      if (xrpAmount <= 0 || rlusdAmount <= 0) {
        throw new Error('Invalid offer amounts in order book')
      }

      console.debug(`Best Offer: ${xrpAmount} XRP for ${rlusdAmount} RLUSD`)

      // 1 XRP = ? RLUSD のレートを計算
      const rate = rlusdAmount / xrpAmount

      return rate
    } catch (error) {
      console.error('Failed to get XRP/RLUSD rate from XRPL:', error)
      throw new Error('XRP/RLUSDレートの取得に失敗しました。現在寄付を受け付けることができません。')
    }
  }
}

/**
 * シングルトンXRPLクライアントインスタンス
 */
let xrplClientInstance: XRPLClient | null = null

/**
 * XRPLクライアントのシングルトンインスタンスを取得
 */
export function getXRPLClient(): XRPLClient {
  if (!xrplClientInstance) {
    xrplClientInstance = new XRPLClient()
  }
  return xrplClientInstance
}

/**
 * XRPLクライアントを閉じる（テスト用）
 */
export async function closeXRPLClient(): Promise<void> {
  if (xrplClientInstance) {
    await xrplClientInstance.disconnect()
    xrplClientInstance = null
  }
}
