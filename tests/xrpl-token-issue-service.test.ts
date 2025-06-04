import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import {
  TokenIssueService,
  type TokenIssueResult,
  type TokenIssueRequest,
} from '../src/lib/xrpl/token-issue-service'
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
import { ProjectService } from '../src/lib/project/service'
import type { Project } from '../src/types/project'

describe('Token Issue Service Tests (Testnet)', () => {
  let startTime: number
  let testCount = 0
  let tokenIssueService: TokenIssueService
  let issuerWallet: XRPLWallet
  let treasuryWallet: XRPLWallet
  let client: any
  let mockProject: Project

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

    // テスト用モックプロジェクトを作成
    mockProject = {
      id: 'test-project-id',
      name: 'Test Project',
      description: 'Test project for token issue service',
      repositoryUrl: 'https://github.com/test/repo',
      ownerUid: 'test-uid',
      githubOwner: 'test',
      githubRepo: 'repo',
      githubInstallationId: 'test-installation',
      tokenCode: 'TEST',
      issuerAddress: issuerWallet.address,
      donationUsages: ['development', 'maintenance'],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    }

    // ProjectService.getProjectByIdをモック化
    mock.module('../src/lib/project/service', () => ({
      ProjectService: {
        getProjectById: mock((projectId: string) => {
          if (
            projectId === 'test-project-id' ||
            projectId === 'test-project-id-1' ||
            projectId === 'test-project-id-2'
          ) {
            return Promise.resolve(mockProject)
          }
          return Promise.resolve(null)
        }),
        validateProject: mock((project: Project) => {
          if (!project.tokenCode) {
            throw new Error(`プロジェクトのトークンコードが設定されていません: ${project.id}`)
          }
          if (!project.issuerAddress) {
            throw new Error(`プロジェクトのIssuerアドレスが設定されていません: ${project.id}`)
          }
          if (project.status !== 'active') {
            throw new Error(
              `プロジェクトがアクティブではありません: ${project.id} (status: ${project.status})`
            )
          }
        }),
      },
    }))

    // 残高チェック
    await checkTestAccountBalances(50) // 最低50 XRP

    // XRPLクライアントに接続
    client = getXRPLClient()
    await client.connect()
    console.log('🔗 Connected to XRPL Testnet')

    tokenIssueService = new TokenIssueService()
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

  describe('TokenIssueService', () => {
    it('インスタンスを正常に作成', () => {
      expect(tokenIssueService).toBeInstanceOf(TokenIssueService)
    })
  })

  describe('validateTokenIssue', () => {
    const testRequest: TokenIssueRequest = {
      projectId: 'test-project-id',
      amount: 100,
      recipientAddress: treasuryWallet.address, // 実際に存在するアドレスを使用
    }

    it('有効なリクエストで検証成功（トラストライン不足は許容）', async () => {
      const validation = await tokenIssueService.validateTokenIssue(testRequest)

      // トラストラインが設定されていない場合は失敗するが、それ以外のエラーがないことを確認
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain(
        'Recipient does not have sufficient trust line for this token'
      )

      // トラストライン以外のエラーがないことを確認
      const nonTrustLineErrors = validation.errors.filter(error => !error.includes('trust line'))
      expect(nonTrustLineErrors).toHaveLength(0)
    })

    it('存在しないアカウントでエラー', async () => {
      const invalidRequest = {
        ...testRequest,
        recipientAddress: 'rInvalidAddress123456789012345678',
      }

      const validation = await tokenIssueService.validateTokenIssue(invalidRequest)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors.some(error => error.includes('not found'))).toBe(true)
    })

    it('存在しないプロジェクトIDでエラー', async () => {
      const invalidRequest = {
        ...testRequest,
        projectId: 'non-existent-project-id',
      }

      const validation = await tokenIssueService.validateTokenIssue(invalidRequest)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some(error => error.includes('プロジェクトが見つかりません'))).toBe(
        true
      )
    })

    it('無効な金額でエラー', async () => {
      const invalidRequest = {
        ...testRequest,
        amount: -100,
      }

      const validation = await tokenIssueService.validateTokenIssue(invalidRequest)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Invalid token amount')
    })

    it('無効なアドレス形式でエラー', async () => {
      const invalidRequest = {
        ...testRequest,
        recipientAddress: 'invalid_address',
      }

      const validation = await tokenIssueService.validateTokenIssue(invalidRequest)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Invalid recipient address format')
    })
  })

  describe('getTokenBalance', () => {
    it('実際のトークン残高を取得', async () => {
      const balance = await tokenIssueService.getTokenBalance(
        issuerWallet.address,
        'TEST',
        issuerWallet.address
      )

      expect(typeof balance).toBe('number')
      expect(balance).toBeGreaterThanOrEqual(0)
    })

    it('存在しないトラストラインで0を返す', async () => {
      const balance = await tokenIssueService.getTokenBalance(
        treasuryWallet.address,
        'NONEXISTENT',
        issuerWallet.address
      )

      expect(balance).toBe(0)
    })
  })

  describe('getTotalTokenSupply', () => {
    it('実際の総発行量を取得', async () => {
      const totalSupply = await tokenIssueService.getTotalTokenSupply('TEST')

      expect(typeof totalSupply).toBe('number')
      expect(totalSupply).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getTokenIssueHistory', () => {
    it('実際のトークン発行履歴を取得', async () => {
      const history = await tokenIssueService.getTokenIssueHistory('TEST', issuerWallet.address, 5)

      expect(Array.isArray(history)).toBe(true)
      // 履歴が存在する場合の検証
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('txHash')
        expect(history[0]).toHaveProperty('recipient')
        expect(history[0]).toHaveProperty('amount')
        expect(history[0]).toHaveProperty('timestamp')
      }
    })

    it('デフォルトパラメータで履歴を取得', async () => {
      const history = await tokenIssueService.getTokenIssueHistory('TEST')

      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('issueTokenToRecipient', () => {
    it('トークン発行を試行（トラストライン不足のため失敗予想）', async () => {
      const testRequest: TokenIssueRequest = {
        projectId: 'test-project-id',
        amount: 1, // 小額でテスト
        recipientAddress: treasuryWallet.address,
        memo: 'Test token issue from integration test',
      }

      const result = await tokenIssueService.issueTokenToRecipient(testRequest)

      // トラストラインが設定されていないため失敗することを期待
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.amount).toBe('1')
      expect(result.tokenCode).toBe('TEST')
      expect(result.recipientAddress).toBe(treasuryWallet.address)

      console.log(`✅ Token issue failed as expected (trust line issue): ${result.error}`)
    })

    it('メモなしでトークン発行を試行（トラストライン不足のため失敗予想）', async () => {
      const testRequest: TokenIssueRequest = {
        projectId: 'test-project-id',
        amount: 1,
        recipientAddress: treasuryWallet.address,
      }

      const result = await tokenIssueService.issueTokenToRecipient(testRequest)

      // トラストラインが設定されていないため失敗することを期待
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.amount).toBe('1')
      expect(result.tokenCode).toBe('TEST')

      console.log(`✅ Token issue failed as expected (trust line issue): ${result.error}`)
    })

    it('無効な受信者アドレスでエラー', async () => {
      const testRequest: TokenIssueRequest = {
        projectId: 'test-project-id',
        amount: 1,
        recipientAddress: 'rInvalidAddress123456789012345678',
        memo: 'This should fail',
      }

      const result = await tokenIssueService.issueTokenToRecipient(testRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.amount).toBe('1')
      expect(result.tokenCode).toBe('TEST')
      expect(result.recipientAddress).toBe('rInvalidAddress123456789012345678')
    })
  })

  describe('batchIssueTokens', () => {
    it('複数のトークンを一括発行（トラストライン不足のため失敗予想）', async () => {
      const testRequests: TokenIssueRequest[] = [
        {
          projectId: 'test-project-id-1',
          amount: 1,
          recipientAddress: treasuryWallet.address,
          memo: 'Batch issue 1',
        },
        {
          projectId: 'test-project-id-2',
          amount: 2,
          recipientAddress: treasuryWallet.address,
          memo: 'Batch issue 2',
        },
      ]

      const results = await tokenIssueService.batchIssueTokens(testRequests)

      expect(results).toHaveLength(2)
      // トラストラインが設定されていないため失敗することを期待
      expect(results[0].success).toBe(false)
      expect(results[1].success).toBe(false)
      expect(results[0].amount).toBe('1')
      expect(results[1].amount).toBe('2')
      expect(results[0].tokenCode).toBe('TEST')
      expect(results[1].tokenCode).toBe('TEST')

      console.log(`✅ Batch tokens failed as expected: ${results[0].error}, ${results[1].error}`)
    })

    it('一部失敗を含む一括発行', async () => {
      const testRequests: TokenIssueRequest[] = [
        {
          projectId: 'test-project-id-1',
          amount: 1,
          recipientAddress: treasuryWallet.address,
          memo: 'Valid request',
        },
        {
          projectId: 'test-project-id-2',
          amount: 1,
          recipientAddress: 'rInvalidAddress123456789012345678',
          memo: 'Invalid request',
        },
      ]

      const results = await tokenIssueService.batchIssueTokens(testRequests)

      expect(results).toHaveLength(2)
      // 両方とも失敗することを期待（トラストライン不足と無効アドレス）
      expect(results[0].success).toBe(false)
      expect(results[1].success).toBe(false)
      expect(results[0].tokenCode).toBe('TEST')
      expect(results[1].tokenCode).toBe('TEST')
      expect(results[1].error).toBeDefined()

      console.log(
        `✅ Batch with expected failures: error1=${results[0].error}, error2=${results[1].error}`
      )
    })
  })

  describe('エラーハンドリング', () => {
    it('ネットワークエラーを適切に処理', async () => {
      // 存在しないプロジェクトでエラーをテスト
      const testRequest: TokenIssueRequest = {
        projectId: 'non-existent-project',
        amount: 1,
        recipientAddress: 'rNonExistentAccount123456789012345',
        memo: 'This should fail',
      }

      const result = await tokenIssueService.issueTokenToRecipient(testRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
