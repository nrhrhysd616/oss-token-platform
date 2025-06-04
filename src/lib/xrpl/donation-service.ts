/**
 * 寄付・トラストライン統合サービス
 */

import { TrustSet, Payment } from 'xrpl'
import { getXRPLClient } from './client'
import { getActiveTreasuryWallet, generateDestinationTag, generateVerificationHash } from './config'
import { XamanClient } from '../xaman/client'
import { ProjectService } from '../project/service'
import type { DonationSession, TrustLinePayload, DonationPayload } from '../../types/donation'
import type { Project } from '../../types/project'

/**
 * 寄付・トラストライン統合サービスクラス
 */
export class DonationService {
  private xamanClient: XamanClient
  private xrplClient = getXRPLClient()

  constructor() {
    this.xamanClient = new XamanClient()
  }

  /**
   * トラストライン設定用Xamanペイロード生成
   */
  async createTrustLinePayload(projectId: string, donorAddress: string): Promise<TrustLinePayload> {
    // Firestoreからプロジェクト情報を取得
    const project = await ProjectService.getProjectById(projectId)
    if (!project) {
      throw new Error(`プロジェクトが見つかりません: ${projectId}`)
    }

    // issuerAddressの検証
    if (!project.issuerAddress) {
      throw new Error(`プロジェクトのIssuerアドレスが設定されていません: ${projectId}`)
    }

    return this.createTrustLinePayloadInternal(
      project.tokenCode,
      project.issuerAddress,
      donorAddress
    )
  }

  /**
   * トラストライン設定用Xamanペイロード生成（内部処理）
   */
  private async createTrustLinePayloadInternal(
    tokenCode: string,
    issuerAddress: string,
    donorAddress: string
  ): Promise<TrustLinePayload> {
    const trustSetTransaction: TrustSet = {
      TransactionType: 'TrustSet',
      Account: donorAddress,
      LimitAmount: {
        currency: tokenCode,
        issuer: issuerAddress,
        value: '1000000', // 最大信頼限度額
      },
    }

    const payload = {
      txjson: trustSetTransaction,
      options: {
        submit: true,
        multisign: false,
        expire: 5, // 5分で期限切れ
      },
    }

    const response = await this.xamanClient.createPayload(payload)

    return {
      uuid: response.uuid,
      qr_png: response.refs.qr_png,
      qr_uri: response.refs.qr_matrix,
      websocket_status: response.refs.websocket_status,
    }
  }

  /**
   * 寄付セッション作成
   */
  async createDonationSession(
    projectId: string,
    donorAddress: string,
    amount: number
  ): Promise<DonationSession> {
    const timestamp = Date.now()
    const destinationTag = generateDestinationTag(projectId)
    const verificationHash = generateVerificationHash(projectId, donorAddress, amount, timestamp)

    const session: DonationSession = {
      id: `donation_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      donorAddress,
      amount,
      destinationTag,
      verificationHash,
      status: 'pending',
      createdAt: new Date(timestamp),
      expiresAt: new Date(timestamp + 10 * 60 * 1000), // 10分後に期限切れ
    }

    return session
  }

  /**
   * 寄付用Xamanペイロード生成
   */
  async createDonationPayload(session: DonationSession): Promise<DonationPayload> {
    const treasuryWallet = getActiveTreasuryWallet()

    const paymentTransaction: Payment = {
      TransactionType: 'Payment',
      Account: session.donorAddress,
      Destination: treasuryWallet.address,
      DestinationTag: session.destinationTag,
      Amount: (session.amount * 1000000).toString(), // XRPをdropsに変換
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('donation_verification', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(session.verificationHash, 'utf8').toString('hex').toUpperCase(),
          },
        },
      ],
    }

    const payload = {
      txjson: paymentTransaction,
      options: {
        submit: true,
        multisign: false,
        expire: 10, // 10分で期限切れ
      },
    }

    const response = await this.xamanClient.createPayload(payload)

    return {
      uuid: response.uuid,
      qr_png: response.refs.qr_png,
      qr_uri: response.refs.qr_matrix,
      websocket_status: response.refs.websocket_status,
      destinationTag: session.destinationTag,
      verificationHash: session.verificationHash,
    }
  }

  /**
   * Xamanペイロードのステータス確認
   */
  async checkPayloadStatus(uuid: string) {
    return await this.xamanClient.getPayloadStatus(uuid)
  }

  /**
   * 寄付トランザクションの検証
   */
  async verifyDonationTransaction(
    txHash: string,
    expectedSession: DonationSession
  ): Promise<boolean> {
    try {
      console.log(`🔍 Verifying transaction: ${txHash}`)
      const txResponse = await this.xrplClient.getTransaction(txHash)
      const tx = txResponse.result

      console.log(`📋 Transaction found, validating details...`)
      console.log(`🔍 Transaction structure:`, JSON.stringify(tx, null, 2))

      // トランザクションデータの取得（tx_jsonまたは直接のフィールドを確認）
      const txData = tx.tx_json || tx

      // トランザクション基本情報の検証
      if (txData.TransactionType !== 'Payment') {
        console.log(`❌ Invalid transaction type: ${txData.TransactionType}`)
        return false
      }

      // 送信者の検証
      if (txData.Account !== expectedSession.donorAddress) {
        console.log(
          `❌ Invalid sender: expected ${expectedSession.donorAddress}, got ${txData.Account}`
        )
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
      if (txData.DestinationTag !== expectedSession.destinationTag) {
        console.log(
          `❌ Invalid destination tag: expected ${expectedSession.destinationTag}, got ${txData.DestinationTag}`
        )
        return false
      }

      // 金額の検証（DeliverMaxまたはmeta.delivered_amountを確認）
      const expectedAmount = (expectedSession.amount * 1000000).toString()
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
      if (memoData !== expectedSession.verificationHash) {
        console.log(
          `❌ Invalid memo data: expected ${expectedSession.verificationHash}, got ${memoData}`
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

  /**
   * 寄付者のトラストライン確認
   */
  async checkTrustLine(
    donorAddress: string,
    tokenCode: string,
    issuerAddress: string
  ): Promise<boolean> {
    try {
      const trustLines = await this.xrplClient.getTrustLines(donorAddress)

      return trustLines.result.lines.some(
        line =>
          line.currency === tokenCode &&
          line.account === issuerAddress &&
          parseFloat(line.limit) > 0
      )
    } catch (error) {
      console.error('TrustLine check error:', error)
      return false
    }
  }

  /**
   * 寄付セッションの期限確認
   */
  isSessionExpired(session: DonationSession): boolean {
    return new Date() > session.expiresAt
  }

  /**
   * 寄付金額の妥当性確認
   */
  validateDonationAmount(amount: number): boolean {
    // 最小寄付額: 1 XRP
    const minAmount = 1
    // 最大寄付額: 10,000 XRP
    const maxAmount = 10000

    return amount >= minAmount && amount <= maxAmount && Number.isFinite(amount)
  }
}
