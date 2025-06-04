import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { DonationService } from '../src/lib/xrpl/donation-service'
import type { DonationSession, TrustLinePayload, DonationPayload } from '../src/types/donation'
import { getActiveIssuerWallet, getActiveTreasuryWallet } from '../src/lib/xrpl/config'
import type { XRPLWallet } from '../src/lib/xrpl/config'
import { getXRPLClient, closeXRPLClient } from '../src/lib/xrpl/client'
import { globalRateLimiter } from './helpers/rate-limiter'
import {
  checkTestAccountBalances,
  showTestnetWarning,
  showTestSummary,
  warnIfLongRunning,
} from './helpers/balance-checker'

// XamanClientのモック（外部サービスのため）
const mockXamanClient = {
  createPayload: mock(() =>
    Promise.resolve({
      uuid: 'test-uuid-123',
      refs: {
        qr_png: 'https://xumm.app/qr/test.png',
        qr_matrix: 'https://xumm.app/qr/test',
        websocket_status: 'wss://xumm.app/ws/test',
      },
    })
  ),
  getPayloadStatus: mock(() =>
    Promise.resolve({
      meta: {
        exists: true,
        uuid: 'test-uuid-123',
        multisign: false,
        submit: true,
        destination: '',
        resolved_destination: '',
        signed: true,
        cancelled: false,
        expired: false,
        pushed: true,
        app_opened: true,
        return_url_app: null,
        return_url_web: null,
      },
      application: {
        name: 'Test App',
        description: 'Test Description',
        disabled: 0,
        uuidv4: 'test-app-uuid',
        icon_url: 'https://example.com/icon.png',
        issued_user_token: null,
      },
      payload: {
        tx_type: 'Payment',
        tx_destination: 'rTestDestination123',
        tx_destination_tag: 12345,
        request_json: {},
        created_at: '2023-01-01T00:00:00.000Z',
        expires_at: '2023-01-01T01:00:00.000Z',
        expires_in_seconds: 3600,
      },
      response: {
        hex: 'test-hex',
        txid: 'test-txid-123',
        resolved_at: '2023-01-01T00:30:00.000Z',
        dispatched_to: 'test-node',
        dispatched_result: 'tesSUCCESS',
        multisign_account: '',
        account: 'rTestAccount123',
      },
      custom_meta: {
        identifier: null,
        blob: null,
        instruction: null,
      },
    })
  ),
}

// XamanClientモジュールのモック
mock.module('../src/lib/xaman/client', () => ({
  XamanClient: mock(() => mockXamanClient),
}))

describe('Donation Service Tests (Testnet)', () => {
  let startTime: number
  let testCount = 0
  let donationService: DonationService
  let issuerWallet: XRPLWallet
  let treasuryWallet: XRPLWallet
  let client: any

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

    // XRPLクライアントに接続
    client = getXRPLClient()
    await client.connect()
    console.log('🔗 Connected to XRPL Testnet')

    donationService = new DonationService()
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

    // モックをリセット
    mockXamanClient.createPayload.mockClear()
    mockXamanClient.getPayloadStatus.mockClear()

    // デフォルトの成功レスポンスを設定
    mockXamanClient.createPayload.mockResolvedValue({
      uuid: 'test-uuid-123',
      refs: {
        qr_png: 'https://xumm.app/qr/test.png',
        qr_matrix: 'https://xumm.app/qr/test',
        websocket_status: 'wss://xumm.app/ws/test',
      },
    })

    mockXamanClient.getPayloadStatus.mockResolvedValue({
      meta: {
        exists: true,
        uuid: 'test-uuid-123',
        multisign: false,
        submit: true,
        destination: '',
        resolved_destination: '',
        signed: true,
        cancelled: false,
        expired: false,
        pushed: true,
        app_opened: true,
        return_url_app: null,
        return_url_web: null,
      },
      application: {
        name: 'Test App',
        description: 'Test Description',
        disabled: 0,
        uuidv4: 'test-app-uuid',
        icon_url: 'https://example.com/icon.png',
        issued_user_token: null,
      },
      payload: {
        tx_type: 'Payment',
        tx_destination: treasuryWallet.address,
        tx_destination_tag: 12345,
        request_json: {},
        created_at: '2023-01-01T00:00:00.000Z',
        expires_at: '2023-01-01T01:00:00.000Z',
        expires_in_seconds: 3600,
      },
      response: {
        hex: 'test-hex',
        txid: 'test-txid-123',
        resolved_at: '2023-01-01T00:30:00.000Z',
        dispatched_to: 'test-node',
        dispatched_result: 'tesSUCCESS',
        multisign_account: '',
        account: issuerWallet.address,
      },
      custom_meta: {
        identifier: null,
        blob: null,
        instruction: null,
      },
    })
  })

  describe('DonationService', () => {
    it('インスタンスを正常に作成', () => {
      expect(donationService).toBeInstanceOf(DonationService)
    })
  })

  describe('createTrustLinePayload', () => {
    it('プロジェクトが見つからない場合はエラー', async () => {
      // 存在しないプロジェクトIDでテスト
      await expect(
        donationService.createTrustLinePayload('nonexistent-project', treasuryWallet.address)
      ).rejects.toThrow('プロジェクトが見つかりません: nonexistent-project')
    })

    // 注意: 実際のFirestoreプロジェクトが必要なため、統合テストでのみ有効
    // it('トラストライン設定用ペイロードを作成', async () => {
    //   // 実際のプロジェクトIDが必要
    //   const payload = await donationService.createTrustLinePayload(
    //     'real-project-id',
    //     treasuryWallet.address
    //   )
    //
    //   expect(mockXamanClient.createPayload).toHaveBeenCalledWith({
    //     txjson: {
    //       TransactionType: 'TrustSet',
    //       Account: treasuryWallet.address,
    //       LimitAmount: {
    //         currency: 'TEST', // プロジェクトのtokenCode
    //         issuer: 'issuer-address', // プロジェクトのissuerAddress
    //         value: '1000000',
    //       },
    //     },
    //     options: {
    //       submit: true,
    //       multisign: false,
    //       expire: 5,
    //     },
    //   })
    //
    //   expect(payload).toEqual({
    //     uuid: 'test-uuid-123',
    //     qr_png: 'https://xumm.app/qr/test.png',
    //     qr_uri: 'https://xumm.app/qr/test',
    //     websocket_status: 'wss://xumm.app/ws/test',
    //   })
    // })
  })

  describe('createDonationSession', () => {
    it('寄付セッションを作成', async () => {
      const session = await donationService.createDonationSession(
        'project-123',
        issuerWallet.address,
        100
      )

      expect(session.projectId).toBe('project-123')
      expect(session.donorAddress).toBe(issuerWallet.address)
      expect(session.amount).toBe(100)
      expect(session.status).toBe('pending')
      expect(typeof session.destinationTag).toBe('number')
      expect(typeof session.verificationHash).toBe('string')
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.expiresAt).toBeInstanceOf(Date)
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime())
    })

    it('一意のセッションIDを生成', async () => {
      const session1 = await donationService.createDonationSession(
        'project-123',
        issuerWallet.address,
        100
      )
      const session2 = await donationService.createDonationSession(
        'project-123',
        issuerWallet.address,
        100
      )

      expect(session1.id).not.toBe(session2.id)
    })
  })

  describe('createDonationPayload', () => {
    it('寄付用ペイロードを作成', async () => {
      const session: DonationSession = {
        id: 'test-session-123',
        projectId: 'project-123',
        donorAddress: issuerWallet.address,
        amount: 100,
        destinationTag: 12345,
        verificationHash: 'test-hash',
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }

      const payload = await donationService.createDonationPayload(session)

      expect(mockXamanClient.createPayload).toHaveBeenCalledWith({
        txjson: {
          TransactionType: 'Payment',
          Account: issuerWallet.address,
          Destination: treasuryWallet.address,
          DestinationTag: 12345,
          Amount: '100000000',
          Memos: [
            {
              Memo: {
                MemoType: Buffer.from('donation_verification', 'utf8')
                  .toString('hex')
                  .toUpperCase(),
                MemoData: Buffer.from('test-hash', 'utf8').toString('hex').toUpperCase(),
              },
            },
          ],
        },
        options: {
          submit: true,
          multisign: false,
          expire: 10,
        },
      })

      expect(payload).toEqual({
        uuid: 'test-uuid-123',
        qr_png: 'https://xumm.app/qr/test.png',
        qr_uri: 'https://xumm.app/qr/test',
        websocket_status: 'wss://xumm.app/ws/test',
        destinationTag: 12345,
        verificationHash: 'test-hash',
      })
    })
  })

  describe('checkPayloadStatus', () => {
    it('ペイロードステータスを確認', async () => {
      const status = await donationService.checkPayloadStatus('test-uuid-123')

      expect(mockXamanClient.getPayloadStatus).toHaveBeenCalledWith('test-uuid-123')
      expect(status.meta.uuid).toBe('test-uuid-123')
      expect(status.response?.txid).toBe('test-txid-123')
    })
  })

  describe('checkTrustLine', () => {
    it('実際のトラストラインをチェック', async () => {
      const hasTrustLine = await donationService.checkTrustLine(
        issuerWallet.address,
        'TEST',
        issuerWallet.address
      )

      expect(typeof hasTrustLine).toBe('boolean')
    })

    it('存在しないトラストラインでfalse', async () => {
      const hasTrustLine = await donationService.checkTrustLine(
        treasuryWallet.address,
        'NONEXISTENT',
        issuerWallet.address
      )

      expect(hasTrustLine).toBe(false)
    })
  })

  describe('verifyDonationTransaction', () => {
    it('実際の寄付トランザクションを作成して検証', async () => {
      // 実際の寄付セッションを作成
      const session = await donationService.createDonationSession(
        'test-project-123',
        issuerWallet.address,
        1 // 1 XRP
      )

      // 実際のトランザクションを送信
      const testTransaction = {
        TransactionType: 'Payment' as const,
        Account: issuerWallet.address,
        Destination: treasuryWallet.address,
        DestinationTag: session.destinationTag,
        Amount: '1000000', // 1 XRP in drops
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('donation_verification', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(session.verificationHash, 'utf8').toString('hex').toUpperCase(),
            },
          },
        ],
      }

      const submitResult = await client.submitTransaction(testTransaction, issuerWallet)
      const txHash = submitResult.result.hash

      console.log(`✅ Donation transaction submitted: ${txHash}`)

      // トランザクションの確認をリトライロジックで実装
      console.log(`⏳ Waiting for transaction confirmation...`)

      let isValid = false
      let attempts = 0
      const maxAttempts = 6 // 最大6回試行

      while (attempts < maxAttempts && !isValid) {
        attempts++
        console.log(`🔄 Verification attempt ${attempts}/${maxAttempts}`)

        // 3秒待機してから検証
        await new Promise(resolve => setTimeout(resolve, 3000))

        try {
          isValid = await donationService.verifyDonationTransaction(txHash, session)

          if (isValid) {
            console.log(`✅ Transaction verified successfully on attempt ${attempts}`)
            break
          } else {
            console.log(`⚠️ Verification attempt ${attempts} failed, retrying...`)
          }
        } catch (error: any) {
          console.log(`❌ Verification attempt ${attempts} error:`, error.message)
        }
      }

      if (!isValid) {
        console.log(`❌ All ${maxAttempts} verification attempts failed`)
      }

      expect(isValid).toBe(true)
    })

    it('存在しないトランザクションで検証失敗', async () => {
      const session: DonationSession = {
        id: 'test-session-123',
        projectId: 'project-123',
        donorAddress: issuerWallet.address,
        amount: 100,
        destinationTag: 12345,
        verificationHash: 'test-hash',
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }

      const invalidTxHash = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const isValid = await donationService.verifyDonationTransaction(invalidTxHash, session)

      expect(isValid).toBe(false)
    })
  })

  describe('isSessionExpired', () => {
    it('期限内のセッションでfalse', () => {
      const session: DonationSession = {
        id: 'test-session-123',
        projectId: 'project-123',
        donorAddress: issuerWallet.address,
        amount: 100,
        destinationTag: 12345,
        verificationHash: 'test-hash',
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分後
      }

      const isExpired = donationService.isSessionExpired(session)
      expect(isExpired).toBe(false)
    })

    it('期限切れのセッションでtrue', () => {
      const session: DonationSession = {
        id: 'test-session-123',
        projectId: 'project-123',
        donorAddress: issuerWallet.address,
        amount: 100,
        destinationTag: 12345,
        verificationHash: 'test-hash',
        status: 'pending',
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20分前
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // 10分前
      }

      const isExpired = donationService.isSessionExpired(session)
      expect(isExpired).toBe(true)
    })
  })

  describe('validateDonationAmount', () => {
    it('有効な金額でtrue', () => {
      expect(donationService.validateDonationAmount(1)).toBe(true)
      expect(donationService.validateDonationAmount(100)).toBe(true)
      expect(donationService.validateDonationAmount(10000)).toBe(true)
    })

    it('最小額未満でfalse', () => {
      expect(donationService.validateDonationAmount(0.5)).toBe(false)
      expect(donationService.validateDonationAmount(0)).toBe(false)
    })

    it('最大額超過でfalse', () => {
      expect(donationService.validateDonationAmount(10001)).toBe(false)
      expect(donationService.validateDonationAmount(50000)).toBe(false)
    })

    it('無効な値でfalse', () => {
      expect(donationService.validateDonationAmount(NaN)).toBe(false)
      expect(donationService.validateDonationAmount(Infinity)).toBe(false)
      expect(donationService.validateDonationAmount(-Infinity)).toBe(false)
    })
  })

  describe('エラーハンドリング', () => {
    it('ネットワークエラーを適切に処理', async () => {
      // 存在しないアカウントでのトラストラインチェック
      const hasTrustLine = await donationService.checkTrustLine(
        'rInvalidAccount123456789012345678',
        'TEST',
        issuerWallet.address
      )

      expect(hasTrustLine).toBe(false)
    })
  })
})
