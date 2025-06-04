/**
 * トークン発行・送付サービス
 */

import { Payment, IssuedCurrencyAmount, TxResponse } from 'xrpl'
import { getXRPLClient } from './client'
import { getActiveIssuerWallet, getXRPLConfig } from './config'
import { ProjectService } from '../project/service'

export type TokenIssueResult = {
  success: boolean
  txHash?: string
  error?: string
  amount: string
  tokenCode: string
  recipientAddress: string
}

export type TokenIssueRequest = {
  projectId: string
  amount: number
  recipientAddress: string
  memo?: string
}

/**
 * トークン発行・送付サービスクラス
 */
export class TokenIssueService {
  private xrplClient = getXRPLClient()

  /**
   * tokenCodeをXRPL形式に変換
   * 3文字以下はそのまま、4文字以上は16進数形式に変換
   */
  private convertTokenCodeToXRPLFormat(tokenCode: string): string {
    if (tokenCode.length <= 3) {
      return tokenCode
    }

    return Buffer.from(tokenCode, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
  }

  /**
   * issuerAddressの検証とウォレット取得
   */
  private validateAndGetIssuerWallet(issuerAddress: string) {
    const config = getXRPLConfig()
    const issuerWallet = config.issuerWallets.find(wallet => wallet.address === issuerAddress)

    if (!issuerWallet) {
      throw new Error(`指定されたIssuerアドレスはシステムで管理されていません: ${issuerAddress}`)
    }

    if (!issuerWallet.isActive) {
      throw new Error(`指定されたIssuerウォレットは非アクティブです: ${issuerAddress}`)
    }

    return issuerWallet
  }

  /**
   * トークンを発行して寄付者に送付
   */
  async issueTokenToRecipient(request: TokenIssueRequest): Promise<TokenIssueResult> {
    try {
      // 1. プロジェクト情報を取得
      const project = await ProjectService.getProjectById(request.projectId)
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${request.projectId}`)
      }

      // 2. プロジェクトの基本検証
      ProjectService.validateProject(project)

      // 3. issuerAddressの検証（システム管理ウォレットかチェック）
      const issuerWallet = this.validateAndGetIssuerWallet(project.issuerAddress)

      // 4. トークン金額の設定
      const currencyCode = this.convertTokenCodeToXRPLFormat(project.tokenCode)

      const tokenAmount: IssuedCurrencyAmount = {
        currency: currencyCode,
        issuer: issuerWallet.address,
        value: request.amount.toString(),
      }

      // 5. Paymentトランザクションの作成
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

      // 6. トランザクションの送信
      const result = await this.xrplClient.submitTransaction(paymentTransaction, issuerWallet)

      // メタデータから結果を確認
      const meta = result.result.meta as any
      if (meta.TransactionResult === 'tesSUCCESS') {
        return {
          success: true,
          txHash: result.result.hash,
          amount: request.amount.toString(),
          tokenCode: project.tokenCode,
          recipientAddress: request.recipientAddress,
        }
      } else {
        return {
          success: false,
          error: `Transaction failed: ${meta.TransactionResult}`,
          amount: request.amount.toString(),
          tokenCode: project.tokenCode,
          recipientAddress: request.recipientAddress,
        }
      }
    } catch (error) {
      console.error('Token issue error:', error)

      // プロジェクト情報からtokenCodeを取得を試行
      let tokenCode = 'UNKNOWN'
      try {
        const project = await ProjectService.getProjectById(request.projectId)
        if (project) {
          tokenCode = project.tokenCode
        }
      } catch (projectError) {
        console.error('Failed to get project info for error response:', projectError)
      }

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
   * 複数の寄付者に一括でトークンを発行
   */
  async batchIssueTokens(requests: TokenIssueRequest[]): Promise<TokenIssueResult[]> {
    const results: TokenIssueResult[] = []

    for (const request of requests) {
      try {
        const result = await this.issueTokenToRecipient(request)
        results.push(result)

        // 連続送信による負荷軽減のため少し待機
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Batch token issue error for ${request.recipientAddress}:`, error)

        // エラー時もプロジェクト情報からtokenCodeを取得を試行
        let tokenCode = 'UNKNOWN'
        try {
          const project = await ProjectService.getProjectById(request.projectId)
          if (project) {
            tokenCode = project.tokenCode
          }
        } catch (projectError) {
          console.error('Failed to get project info for error response:', projectError)
        }

        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          amount: request.amount.toString(),
          tokenCode,
          recipientAddress: request.recipientAddress,
        })
      }
    }

    return results
  }

  /**
   * トークン発行可能性の確認
   */
  async validateTokenIssue(request: TokenIssueRequest): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    try {
      // 1. プロジェクト情報を取得
      const project = await ProjectService.getProjectById(request.projectId)
      if (!project) {
        errors.push(`プロジェクトが見つかりません: ${request.projectId}`)
        return { valid: false, errors }
      }

      // 2. プロジェクトの基本検証
      try {
        ProjectService.validateProject(project)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Project validation failed')
      }

      // 3. issuerAddressの検証とウォレット取得
      let issuerWallet
      try {
        issuerWallet = this.validateAndGetIssuerWallet(project.issuerAddress)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Issuer wallet validation failed')
        return { valid: false, errors }
      }

      // 4. 発行者ウォレットの確認
      const issuerInfo = await this.xrplClient.getAccountInfo(issuerWallet.address)
      if (!issuerInfo.result.account_data) {
        errors.push('Issuer account not found')
      }

      // 5. 受信者アドレスの形式確認
      if (!request.recipientAddress.startsWith('r') || request.recipientAddress.length < 25) {
        errors.push('Invalid recipient address format')
      }

      // 6. 受信者アカウントの存在確認
      try {
        await this.xrplClient.getAccountInfo(request.recipientAddress)
      } catch (error) {
        errors.push('Recipient account not found or not activated')
      }

      // 7. トークンコードの確認
      if (!project.tokenCode || project.tokenCode.length > 10) {
        errors.push('Invalid token code')
      }

      // 8. 金額の確認
      if (!request.amount || request.amount <= 0 || !Number.isFinite(request.amount)) {
        errors.push('Invalid token amount')
      }

      // 9. 受信者のトラストライン確認
      try {
        const trustLines = await this.xrplClient.getTrustLines(request.recipientAddress)
        const currencyCode = this.convertTokenCodeToXRPLFormat(project.tokenCode)
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
  async getTokenBalance(
    holderAddress: string,
    tokenCode: string,
    issuerAddress?: string
  ): Promise<number> {
    try {
      const issuer = issuerAddress || getActiveIssuerWallet().address
      const trustLines = await this.xrplClient.getTrustLines(holderAddress)
      const currencyCode = this.convertTokenCodeToXRPLFormat(tokenCode)

      const tokenLine = trustLines.result.lines.find(
        line => line.currency === currencyCode && line.account === issuer
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
  async getTotalTokenSupply(tokenCode: string, issuerAddress?: string): Promise<number> {
    try {
      const issuer = issuerAddress || getActiveIssuerWallet().address
      const issuerLines = await this.xrplClient.getTrustLines(issuer)
      const currencyCode = this.convertTokenCodeToXRPLFormat(tokenCode)

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

  /**
   * トークン発行履歴の取得
   */
  async getTokenIssueHistory(
    tokenCode: string,
    issuerAddress?: string,
    limit = 50
  ): Promise<
    Array<{
      txHash: string
      recipient: string
      amount: number
      timestamp: string
    }>
  > {
    try {
      const issuer = issuerAddress || getActiveIssuerWallet().address
      const history = await this.xrplClient.getTransactionHistory(issuer, limit)
      const currencyCode = this.convertTokenCodeToXRPLFormat(tokenCode)

      const tokenIssues = history.result.transactions
        .filter(tx => {
          const transaction = tx.tx as any
          return (
            transaction?.TransactionType === 'Payment' &&
            transaction.Account === issuer &&
            typeof transaction.Amount === 'object' &&
            transaction.Amount.currency === currencyCode
          )
        })
        .map(tx => {
          const transaction = tx.tx_json as any
          const amount = transaction.Amount as IssuedCurrencyAmount
          return {
            txHash: transaction.hash,
            recipient: transaction.Destination,
            amount: parseFloat(amount.value),
            timestamp: new Date((transaction.date + 946684800) * 1000).toISOString(),
          }
        })

      return tokenIssues
    } catch (error) {
      console.error('Token issue history error:', error)
      return []
    }
  }
}
