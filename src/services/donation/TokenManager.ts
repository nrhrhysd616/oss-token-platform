/**
 * トークン発行専用マネージャー
 */

import { CheckCreate, IssuedCurrencyAmount } from 'xrpl'
import { XummTypes } from 'xumm-sdk'
import { getXRPLClient } from '@/lib/xrpl/client'
import { getXRPLConfig } from '@/lib/xrpl/config'
import { convertTokenCodeToXRPLFormat } from '@/lib/xrpl/token-utils'
import { generateCheckId } from '@/lib/xrpl/check-utils'
import { BaseService } from '../shared/BaseService'
import { PricingService } from '../PricingService'
import type { DonationRecord, TokenIssueStatus } from '@/types/donation'
import type { CheckCashNotificationData, XamanUserToken } from '@/types/xaman'
import { docPath } from '@/lib/firebase/collections'
import { DonationServiceError } from '../DonationService'

/**
 * トークン発行リクエスト
 */
export type TokenIssueRequest = {
  projectId: string
  amount: number
  recipientAddress: string
  memo?: string
}

/**
 * トークン発行結果
 */
export type TokenIssueResult = {
  success: boolean
  txHash?: string
  checkId?: string
  error?: string
  amount: string
  tokenCode: string
  recipientAddress: string
}

/**
 * トークン発行管理クラス
 */
export class TokenManager extends BaseService {
  private static xrplClient = getXRPLClient()

  // === TOKEN OPERATIONS ===

  /**
   * 寄付完了時のトークン自動発行処理
   */
  static async processTokenIssueForDonation(
    donationRecord: DonationRecord,
    tokenCode: string,
    issuerAddress: string
  ): Promise<void> {
    try {
      // プロジェクトのトークン価格を取得
      const tokenPrice = await PricingService.calculateTokenPrice(donationRecord.projectId)

      // トークン価格の妥当性チェック
      if (!tokenPrice.xrp || tokenPrice.xrp <= 0) {
        throw new Error(`Invalid token price: ${tokenPrice.xrp} XRP`)
      }

      // トークン発行量を計算（寄付額 ÷ トークン単価）
      const tokenAmount = donationRecord.xrpAmount / tokenPrice.xrp

      // XRPLトークンの精度に合わせて小数点以下6桁で丸める
      const roundedTokenAmount = Math.round(tokenAmount * 1000000) / 1000000

      // 発行枚数の妥当性チェック
      if (roundedTokenAmount <= 0 || !Number.isFinite(roundedTokenAmount)) {
        throw new Error(`Invalid calculated token amount: ${roundedTokenAmount}`)
      }

      console.log(
        `💰 Token calculation: ${donationRecord.xrpAmount} XRP ÷ ${tokenPrice.xrp} XRP/token = ${roundedTokenAmount} tokens`
      )

      // トークン発行リクエストを作成
      const tokenRequest: TokenIssueRequest = {
        projectId: donationRecord.projectId,
        amount: roundedTokenAmount,
        recipientAddress: donationRecord.donorAddress,
        memo: `Donation reward: ${donationRecord.xrpAmount} XRP → ${roundedTokenAmount} tokens (rate: ${tokenPrice.xrp} XRP/token)`,
      }

      // トークンを発行
      const issueResult = await this.issueTokenToRecipient(tokenRequest, tokenCode, issuerAddress)

      // 寄付記録を更新
      const updateData: Partial<DonationRecord> = {
        tokenIssued: issueResult.success,
        tokenAmount: issueResult.success ? roundedTokenAmount : undefined,
        tokenTxHash: issueResult.txHash,
        tokenIssuedAt: issueResult.success ? new Date() : undefined,
        tokenIssueStatus: issueResult.success ? 'completed' : 'failed',
        tokenIssueError: issueResult.error,
      }

      await this.updateDocumentByPath<DonationRecord>(
        docPath.donationRecord(donationRecord.id),
        updateData
      )

      // CreateCheck成功時にCheckCash通知を送信
      if (issueResult.success && issueResult.checkId && donationRecord.xamanPayloadUuid) {
        const userToken = await this.getDocumentByPath<XamanUserToken>(
          docPath.xamanUserToken(donationRecord.xamanPayloadUuid)
        )

        if (userToken) {
          // CheckCash通知を送信（正しいCheckIDを使用）
          const notificationData: CheckCashNotificationData = {
            checkId: issueResult.checkId, // 正しく生成されたCheckID
            tokenAmount: roundedTokenAmount,
            tokenCode,
            // recipientAddress: donationRecord.donorAddress,
            projectId: donationRecord.projectId,
          }

          await this.sendCheckCashNotification(userToken.token, notificationData)
        } else {
          console.warn(
            `⚠️ No valid user token found for payload: ${donationRecord.xamanPayloadUuid} (donation: ${donationRecord.id})`
          )
        }
      } else if (issueResult.success && issueResult.checkId && !donationRecord.xamanPayloadUuid) {
        console.warn(
          `⚠️ No payload UUID found in donation record: ${donationRecord.id} - CheckCash notification skipped`
        )
      }

      console.log(
        `✅ Token issue ${issueResult.success ? 'completed' : 'failed'} for donation record id: ${donationRecord.id} (${roundedTokenAmount} tokens)`
      )
    } catch (error) {
      console.error('Token issue processing error:', error)

      // エラー時も記録を更新
      await this.updateDocumentByPath<DonationRecord>(docPath.donationRecord(donationRecord.id), {
        tokenIssued: false,
        tokenIssueStatus: 'failed' as TokenIssueStatus,
        tokenIssueError: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  /**
   * トークンの総発行量確認
   */
  static async getTotalTokenSupply(tokenCode: string, issuerAddress: string): Promise<number> {
    try {
      const issuerLines = await this.xrplClient.getTrustLines(issuerAddress)
      const currencyCode = convertTokenCodeToXRPLFormat(tokenCode)

      // 発行者の負債として表示される総発行量を計算
      const totalSupply = issuerLines.result.lines
        .filter(line => line.currency === currencyCode)
        .reduce((sum, line) => sum + Math.abs(parseFloat(line.balance)), 0)

      return totalSupply
    } catch (error) {
      console.error('Total supply check error:', error)
      return 0
    }
  }

  // === CHECK CASH OPERATIONS ===

  /**
   * CheckCash署名依頼通知を送信
   */
  private static async sendCheckCashNotification(
    userToken: string,
    notificationData: CheckCashNotificationData
  ): Promise<void> {
    const checkCashTx: XummTypes.XummJsonTransaction = {
      TransactionType: 'CheckCash',
      CheckID: notificationData.checkId,
    }

    const pushPayload: XummTypes.XummPostPayloadBodyJson = {
      user_token: userToken,
      txjson: checkCashTx,
    }

    const result = await this.createXamanPayload(pushPayload)

    console.log('CheckCash notification result:', result)
  }

  // === PRIVATE UTILITIES ===

  /**
   * CreateCheckトランザクションでトークンを発行
   */
  private static async issueTokenToRecipient(
    request: TokenIssueRequest,
    tokenCode: string,
    issuerAddress: string
  ): Promise<TokenIssueResult> {
    try {
      // issuerAddressの検証とウォレット取得
      const issuerWallet = this.validateAndGetIssuerWallet(issuerAddress)

      // トークン金額の設定
      const currencyCode = convertTokenCodeToXRPLFormat(tokenCode)

      const tokenAmount: IssuedCurrencyAmount = {
        currency: currencyCode,
        issuer: issuerWallet.address,
        value: request.amount.toString(),
      }

      // CheckCreateトランザクションの作成
      const checkTransaction: CheckCreate = {
        TransactionType: 'CheckCreate',
        Account: issuerWallet.address,
        Destination: request.recipientAddress,
        SendMax: tokenAmount,
        Expiration: Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60, // 60日後
      }

      // メモフィールドの追加（オプション）
      if (request.memo) {
        checkTransaction.Memos = [
          {
            Memo: {
              MemoType: Buffer.from('token_check', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(request.memo, 'utf8').toString('hex').toUpperCase(),
            },
          },
        ]
      }

      // トランザクションの送信
      const result = await this.xrplClient.submitTransaction(checkTransaction, issuerWallet)

      // メタデータから結果を確認
      const meta = result.result.meta as any
      if (meta.TransactionResult === 'tesSUCCESS') {
        // 送信されたトランザクションからシーケンス番号を取得
        const sequence = result.result.tx_json.Sequence

        // 正しいCheckIDを生成
        const checkId = generateCheckId(issuerWallet.address, sequence!)

        console.log(
          `✅ CheckCreate successful. TxHash: ${result.result.hash}, CheckID: ${checkId}, Sequence: ${sequence}`
        )

        return {
          success: true,
          txHash: result.result.hash,
          checkId: checkId,
          amount: request.amount.toString(),
          tokenCode,
          recipientAddress: request.recipientAddress,
        }
      } else {
        return {
          success: false,
          error: `Transaction failed: ${meta.TransactionResult}`,
          amount: request.amount.toString(),
          tokenCode,
          recipientAddress: request.recipientAddress,
        }
      }
    } catch (error) {
      console.error('Token check creation error:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        amount: request.amount.toString(),
        tokenCode,
        recipientAddress: request.recipientAddress,
      }
    }
  }

  /**
   * issuerAddressの検証とウォレット取得
   */
  private static validateAndGetIssuerWallet(issuerAddress: string) {
    const config = getXRPLConfig()
    const issuerWallet = config.issuerWallets.find(wallet => wallet.address === issuerAddress)

    if (!issuerWallet) {
      throw new DonationServiceError(
        `指定されたIssuerアドレスはシステムで管理されていません: ${issuerAddress}`,
        'VALIDATION_ERROR',
        400
      )
    }

    if (!issuerWallet.isActive) {
      throw new DonationServiceError(
        `指定されたIssuerウォレットは非アクティブです: ${issuerAddress}`,
        'VALIDATION_ERROR',
        400
      )
    }

    return issuerWallet
  }
}
