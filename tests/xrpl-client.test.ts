import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { XRPLClient, getXRPLClient, closeXRPLClient } from '../src/lib/xrpl/client'
import type { XRPLWallet } from '../src/lib/xrpl/config'
import { getActiveIssuerWallet, getActiveTreasuryWallet } from '../src/lib/xrpl/config'
import type { Payment } from 'xrpl'
import { globalRateLimiter } from './helpers/rate-limiter'
import {
  checkTestAccountBalances,
  showTestnetWarning,
  showTestSummary,
  warnIfLongRunning,
} from './helpers/balance-checker'

describe('XRPL Client Tests (Testnet)', () => {
  let startTime: number
  let testCount = 0
  let issuerWallet: XRPLWallet
  let treasuryWallet: XRPLWallet
  let client: XRPLClient

  beforeAll(async () => {
    startTime = Date.now()
    showTestnetWarning()

    // テスト用ウォレットを取得
    try {
      issuerWallet = getActiveIssuerWallet()
      treasuryWallet = getActiveTreasuryWallet()
      console.log(`📝 Using issuer wallet: ${issuerWallet.address}`)
      console.log(`📝 Using treasury wallet: ${treasuryWallet.address}`)
    } catch (error) {
      console.error('❌ Failed to get test wallets:', error)
      throw error
    }

    // 残高チェック
    await checkTestAccountBalances(50) // 最低50 XRP

    // テストファイル全体で一つのクライアントを使用
    client = getXRPLClient()
    await client.connect()
    console.log('🔗 Connected to XRPL Testnet')
  })

  afterAll(async () => {
    await closeXRPLClient()
    console.log('🔌 Disconnected from XRPL Testnet')
    showTestSummary(startTime, testCount)
  })

  beforeEach(async () => {
    testCount++
    await globalRateLimiter.wait()
    warnIfLongRunning(startTime)
  })

  describe('XRPLClient', () => {
    it('インスタンスを正常に作成', () => {
      const newClient = new XRPLClient()
      expect(newClient).toBeInstanceOf(XRPLClient)
    })
  })

  describe('connect', () => {
    it('XRPLテストネットに接続済み', () => {
      // 接続状態を確認（内部のclientオブジェクトにアクセス）
      const internalClient = (client as any).client
      expect(internalClient).toBeDefined()
      expect(internalClient.isConnected()).toBe(true)
    })

    it('既に接続済みの場合は再接続しない', async () => {
      const internalClient = (client as any).client
      const firstClient = internalClient

      await client.connect() // 再度接続を試行

      // 同じクライアントインスタンスが使用されることを確認
      expect((client as any).client).toBe(firstClient)
    })
  })

  describe('getAccountInfo', () => {
    it('実際のアカウント情報を取得', async () => {
      const result = await client.getAccountInfo(issuerWallet.address)

      expect(result.result.account_data).toBeDefined()
      expect(result.result.account_data.Account).toBe(issuerWallet.address)
      expect(result.result.account_data.Balance).toBeDefined()
      expect(typeof result.result.account_data.Sequence).toBe('number')
    })

    it('存在しないアカウントでエラー', async () => {
      const invalidAddress = 'rInvalidAddress123456789012345678'
      await expect(client.getAccountInfo(invalidAddress)).rejects.toThrow()
    })
  })

  describe('getAccountBalance', () => {
    it('実際のアカウント残高を取得', async () => {
      const balance = await client.getAccountBalance(issuerWallet.address)

      expect(typeof balance).toBe('string')
      expect(parseInt(balance)).toBeGreaterThan(0)
    })
  })

  describe('getTransactionHistory', () => {
    it('実際のトランザクション履歴を取得', async () => {
      const result = await client.getTransactionHistory(issuerWallet.address, 5)

      expect(result.result.transactions).toBeDefined()
      expect(Array.isArray(result.result.transactions)).toBe(true)
    })

    it('デフォルトのlimitを使用', async () => {
      const result = await client.getTransactionHistory(issuerWallet.address)

      expect(result.result.transactions).toBeDefined()
      expect(Array.isArray(result.result.transactions)).toBe(true)
    })
  })

  describe('getTrustLines', () => {
    it('実際のトラストラインを取得', async () => {
      const result = await client.getTrustLines(issuerWallet.address)

      expect(result.result.lines).toBeDefined()
      expect(Array.isArray(result.result.lines)).toBe(true)
    })
  })

  describe('getLedgerInfo', () => {
    it('現在のレジャー情報を取得', async () => {
      const result = await client.getLedgerInfo()

      expect(result.result.ledger).toBeDefined()
      expect(result.result.ledger.ledger_index).toBeDefined()
      expect(typeof result.result.ledger.ledger_index).toBe('number')
    })
  })

  describe('getNetworkFee', () => {
    it('実際のネットワーク手数料を取得', async () => {
      const fee = await client.getNetworkFee()

      expect(typeof fee).toBe('number')
      expect(fee).toBeGreaterThan(0)
      expect(fee).toBeLessThan(1) // 通常1 XRP未満
    })
  })

  describe('submitTransaction', () => {
    it('実際のトランザクションを送信（小額XRP送金）', async () => {
      const testTransaction: Payment = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: treasuryWallet.address,
        Amount: '1000000', // 1 XRP
      }

      const result = await client.submitTransaction(testTransaction, issuerWallet)

      expect(result.result.hash).toBeDefined()
      expect(typeof result.result.hash).toBe('string')
      expect(result.result.meta).toBeDefined()

      // メタデータの型チェック
      const meta = result.result.meta as any
      expect(meta.TransactionResult).toBe('tesSUCCESS')

      console.log(`✅ Transaction submitted: ${result.result.hash}`)
    })

    it('無効なトランザクションでエラー', async () => {
      const invalidTransaction: Payment = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: 'rInvalidDestination123456789012345',
        Amount: '1000000',
      }

      await expect(client.submitTransaction(invalidTransaction, issuerWallet)).rejects.toThrow()
    })
  })

  describe('getTransaction', () => {
    it('実際のトランザクションを取得', async () => {
      // まず小額の送金を実行
      const testTransaction: Payment = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: treasuryWallet.address,
        Amount: '1000000', // 1 XRP
      }

      const submitResult = await client.submitTransaction(testTransaction, issuerWallet)
      const txHash = submitResult.result.hash

      // 少し待機してからトランザクションを取得
      await new Promise(resolve => setTimeout(resolve, 2000))

      const result = await client.getTransaction(txHash)

      expect(result.result.tx_json).toBeDefined()
      expect(result.result.tx_json.TransactionType).toBe('Payment')
      expect(result.result.tx_json.Account).toBe(issuerWallet.address)

      // Paymentトランザクションとして型キャスト
      const paymentTx = result.result.tx_json as Payment
      expect(paymentTx.Destination).toBe(treasuryWallet.address)
    })

    it('存在しないトランザクションでエラー', async () => {
      const invalidTxHash = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      await expect(client.getTransaction(invalidTxHash)).rejects.toThrow()
    })
  })

  describe('シングルトンパターン', () => {
    it('getXRPLClientで同じインスタンスを返す', () => {
      const client1 = getXRPLClient()
      const client2 = getXRPLClient()

      expect(client1).toBe(client2)
    })
  })

  describe('エラーハンドリング', () => {
    it('ネットワークエラーを適切に処理', async () => {
      // 存在しないアカウントでのAPI呼び出しエラーをテスト
      await expect(client.getAccountInfo('rInvalidAccount123456789012345678')).rejects.toThrow()
    })
  })
})
