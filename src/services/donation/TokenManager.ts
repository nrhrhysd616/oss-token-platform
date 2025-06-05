/**
 * トークン発行専用マネージャー
 */

import { Payment, IssuedCurrencyAmount } from 'xrpl'
import { getXRPLClient } from '@/lib/xrpl/client'
import { getXRPLConfig } from '@/lib/xrpl/config'
import { convertTokenCodeToXRPLFormat } from '@/lib/xrpl/token-utils'
import { BaseService } from '../shared/BaseService'
import { DonationServiceError } from '../shared/ServiceError'
import type { DonationRecord, TokenIssueStatus } from '@/types/donation'

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
   * トークンを発行して受信者に送付
   */
  static async issueTokenToRecipient(
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

      // Paymentトランザクションの作成
      const paymentTransaction: Payment = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: request.recipientAddress,
        Amount: tokenAmount,
      }

      // メモフィールドの追加（オプション）
      if (request.memo) {
        paymentTransaction.Memos = [
          {
            Memo: {
              MemoType: Buffer.from('token_issue', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(request.memo, 'utf8').toString('hex').toUpperCase(),
            },
          },
        ]
      }

      // トランザクションの送信
      const result = await this.xrplClient.submitTransaction(paymentTransaction, issuerWallet)

      // メタデータから結果を確認
      const meta = result.result.meta as any
      if (meta.TransactionResult === 'tesSUCCESS') {
        return {
          success: true,
          txHash: result.result.hash,
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
      console.error('Token issue error:', error)

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
   * 寄付完了時のトークン自動発行処理
   */
  static async processTokenIssueForDonation(
    donationRecord: DonationRecord,
    tokenCode: string,
    issuerAddress: string
  ): Promise<void> {
    try {
      // トークン発行量を計算（寄付額と同額のトークンを発行）
      const tokenAmount = donationRecord.amount

      // トークン発行リクエストを作成
      const tokenRequest: TokenIssueRequest = {
        projectId: donationRecord.projectId,
        amount: tokenAmount,
        recipientAddress: donationRecord.donorAddress,
        memo: `Donation reward for ${donationRecord.amount} XRP donation`,
      }

      // トークンを発行
      const issueResult = await this.issueTokenToRecipient(tokenRequest, tokenCode, issuerAddress)

      // 寄付記録を更新
      const updateData: Partial<DonationRecord> = {
        tokenIssued: issueResult.success,
        tokenAmount: issueResult.success ? tokenAmount : undefined,
        tokenTxHash: issueResult.txHash,
        tokenIssuedAt: issueResult.success ? new Date() : undefined,
        tokenIssueStatus: issueResult.success ? 'completed' : 'failed',
        tokenIssueError: issueResult.error,
      }

      await this.updateDocument<DonationRecord>('donationRecords', donationRecord.id, updateData)

      console.log(
        `✅ Token issue ${issueResult.success ? 'completed' : 'failed'} for donation ${donationRecord.id}`
      )
    } catch (error) {
      console.error('Token issue processing error:', error)

      // エラー時も記録を更新
      await this.updateDocument<DonationRecord>('donationRecords', donationRecord.id, {
        tokenIssued: false,
        tokenIssueStatus: 'failed' as TokenIssueStatus,
        tokenIssueError: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  /**
   * トークン発行可能性の確認
   */
  static async validateTokenIssue(
    request: TokenIssueRequest,
    tokenCode: string,
    issuerAddress: string
  ): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    try {
      // issuerAddressの検証とウォレット取得
      let issuerWallet
      try {
        issuerWallet = this.validateAndGetIssuerWallet(issuerAddress)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Issuer wallet validation failed')
        return { valid: false, errors }
      }

      // 発行者ウォレットの確認
      try {
        const issuerInfo = await this.xrplClient.getAccountInfo(issuerWallet.address)
        if (!issuerInfo.result.account_data) {
          errors.push('Issuer account not found')
        }
      } catch (error) {
        errors.push('Unable to verify issuer account')
      }

      // 受信者アドレスの形式確認
      if (!request.recipientAddress.startsWith('r') || request.recipientAddress.length < 25) {
        errors.push('Invalid recipient address format')
      }

      // 受信者アカウントの存在確認
      try {
        await this.xrplClient.getAccountInfo(request.recipientAddress)
      } catch (error) {
        errors.push('Recipient account not found or not activated')
      }

      // トークンコードの確認
      if (!tokenCode || tokenCode.length > 10) {
        errors.push('Invalid token code')
      }

      // 金額の確認
      if (!request.amount || request.amount <= 0 || !Number.isFinite(request.amount)) {
        errors.push('Invalid token amount')
      }

      // 受信者のトラストライン確認
      try {
        const trustLines = await this.xrplClient.getTrustLines(request.recipientAddress)
        const currencyCode = convertTokenCodeToXRPLFormat(tokenCode)
        const hasTrustLine = trustLines.result.lines.some(
          line =>
            line.currency === currencyCode &&
            line.account === issuerWallet.address &&
            parseFloat(line.limit) >= request.amount
        )

        if (!hasTrustLine) {
          errors.push('Recipient does not have sufficient trust line for this token')
        }
      } catch (error) {
        errors.push('Unable to verify recipient trust lines')
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    } catch (error) {
      console.error('Token issue validation error:', error)
      return {
        valid: false,
        errors: ['Validation failed due to network error'],
      }
    }
  }

  /**
   * 発行済みトークンの残高確認
   */
  static async getTokenBalance(
    holderAddress: string,
    tokenCode: string,
    issuerAddress: string
  ): Promise<number> {
    try {
      const trustLines = await this.xrplClient.getTrustLines(holderAddress)
      const currencyCode = convertTokenCodeToXRPLFormat(tokenCode)

      const tokenLine = trustLines.result.lines.find(
        line => line.currency === currencyCode && line.account === issuerAddress
      )

      return tokenLine ? parseFloat(tokenLine.balance) : 0
    } catch (error) {
      console.error('Token balance check error:', error)
      return 0
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

  // === PRIVATE UTILITIES ===

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
