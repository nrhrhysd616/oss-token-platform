import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  getXRPLConfig,
  getActiveIssuerWallet,
  getActiveTreasuryWallet,
  getIssuerWallet,
  getTreasuryWallet,
  validateXRPLConfig,
  generateDestinationTag,
  generateVerificationHash,
} from '../src/lib/xrpl/config'

describe('XRPL Config Tests', () => {
  // 元の環境変数を保存
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // テスト用環境変数を設定
    process.env.XRPL_NETWORK = 'testnet'
    process.env.XRPL_ISSUER_1_ADDRESS = 'rTestIssuer1Address123456789'
    process.env.XRPL_ISSUER_1_SECRET = 'sTestIssuer1Secret123456789'
    process.env.XRPL_ISSUER_1_ACTIVE = 'true'
    process.env.XRPL_ISSUER_2_ADDRESS = 'rTestIssuer2Address123456789'
    process.env.XRPL_ISSUER_2_SECRET = 'sTestIssuer2Secret123456789'
    process.env.XRPL_ISSUER_2_ACTIVE = 'false'
    process.env.XRPL_TREASURY_1_ADDRESS = 'rTestTreasury1Address123456789'
    process.env.XRPL_TREASURY_1_SECRET = 'sTestTreasury1Secret123456789'
    process.env.XRPL_TREASURY_1_ACTIVE = 'true'
    process.env.XRPL_TREASURY_2_ADDRESS = 'rTestTreasury2Address123456789'
    process.env.XRPL_TREASURY_2_SECRET = 'sTestTreasury2Secret123456789'
    process.env.XRPL_TREASURY_2_ACTIVE = 'false'
  })

  afterEach(async () => {
    // 環境変数を元に戻す
    process.env = { ...originalEnv }

    try {
      // 少し待機してすべての非同期処理が完了するのを待つ
      await new Promise(resolve => setTimeout(resolve, 10))
    } catch (error) {
      // クリーンアップエラーは無視
      console.warn('Cleanup error:', error)
    }
  })

  describe('getXRPLConfig', () => {
    it('testnet設定を正しく読み込む', () => {
      const config = getXRPLConfig()

      expect(config.network).toBe('testnet')
      expect(config.server).toBe('wss://s.altnet.rippletest.net:51233')
      expect(config.issuerWallets).toHaveLength(2)
      expect(config.treasuryWallets).toHaveLength(2)
    })

    it('mainnet設定を正しく読み込む', () => {
      process.env.XRPL_NETWORK = 'mainnet'
      const config = getXRPLConfig()

      expect(config.network).toBe('mainnet')
      expect(config.server).toBe('wss://xrplcluster.com')
    })

    it('デフォルトでtestnetを使用', () => {
      delete process.env.XRPL_NETWORK
      const config = getXRPLConfig()

      expect(config.network).toBe('testnet')
    })

    it('issuerウォレットを正しく設定', () => {
      const config = getXRPLConfig()
      const issuer1 = config.issuerWallets[0]

      expect(issuer1.id).toBe('issuer-1')
      expect(issuer1.address).toBe('rTestIssuer1Address123456789')
      expect(issuer1.secret).toBe('sTestIssuer1Secret123456789')
      expect(issuer1.isActive).toBe(true)
    })

    it('treasuryウォレットを正しく設定', () => {
      const config = getXRPLConfig()
      const treasury1 = config.treasuryWallets[0]

      expect(treasury1.id).toBe('treasury-1')
      expect(treasury1.address).toBe('rTestTreasury1Address123456789')
      expect(treasury1.secret).toBe('sTestTreasury1Secret123456789')
      expect(treasury1.isActive).toBe(true)
    })
  })

  describe('getActiveIssuerWallet', () => {
    it('アクティブなissuerウォレットを取得', () => {
      const wallet = getActiveIssuerWallet()

      expect(wallet.id).toBe('issuer-1')
      expect(wallet.isActive).toBe(true)
    })

    it('アクティブなissuerウォレットが存在しない場合エラー', () => {
      process.env.XRPL_ISSUER_1_ACTIVE = 'false'

      expect(() => getActiveIssuerWallet()).toThrow('No active XRPL Issuer wallet found')
    })
  })

  describe('getActiveTreasuryWallet', () => {
    it('アクティブなtreasuryウォレットを取得', () => {
      const wallet = getActiveTreasuryWallet()

      expect(wallet.id).toBe('treasury-1')
      expect(wallet.isActive).toBe(true)
    })

    it('アクティブなtreasuryウォレットが存在しない場合エラー', () => {
      process.env.XRPL_TREASURY_1_ACTIVE = 'false'

      expect(() => getActiveTreasuryWallet()).toThrow('No active XRPL Treasury wallet found')
    })
  })

  describe('getIssuerWallet', () => {
    it('指定されたIDのissuerウォレットを取得', () => {
      const wallet = getIssuerWallet('issuer-2')

      expect(wallet.id).toBe('issuer-2')
      expect(wallet.address).toBe('rTestIssuer2Address123456789')
    })

    it('存在しないIDの場合エラー', () => {
      expect(() => getIssuerWallet('issuer-999')).toThrow(
        'XRPL Issuer wallet not found: issuer-999'
      )
    })
  })

  describe('getTreasuryWallet', () => {
    it('指定されたIDのtreasuryウォレットを取得', () => {
      const wallet = getTreasuryWallet('treasury-2')

      expect(wallet.id).toBe('treasury-2')
      expect(wallet.address).toBe('rTestTreasury2Address123456789')
    })

    it('存在しないIDの場合エラー', () => {
      expect(() => getTreasuryWallet('treasury-999')).toThrow(
        'XRPL Treasury wallet not found: treasury-999'
      )
    })
  })

  describe('validateXRPLConfig', () => {
    it('正常な設定で検証成功', () => {
      expect(() => validateXRPLConfig()).not.toThrow()
    })

    it('issuerウォレットが存在しない場合エラー', () => {
      delete process.env.XRPL_ISSUER_1_ADDRESS
      delete process.env.XRPL_ISSUER_2_ADDRESS

      expect(() => validateXRPLConfig()).toThrow('No XRPL Issuer wallets configured')
    })

    it('treasuryウォレットが存在しない場合エラー', () => {
      delete process.env.XRPL_TREASURY_1_ADDRESS
      delete process.env.XRPL_TREASURY_2_ADDRESS

      expect(() => validateXRPLConfig()).toThrow('No XRPL Treasury wallets configured')
    })

    it('アクティブなissuerウォレットが存在しない場合エラー', () => {
      process.env.XRPL_ISSUER_1_ACTIVE = 'false'

      expect(() => validateXRPLConfig()).toThrow('No active XRPL Issuer wallet found')
    })

    it('アクティブなtreasuryウォレットが存在しない場合エラー', () => {
      process.env.XRPL_TREASURY_1_ACTIVE = 'false'

      expect(() => validateXRPLConfig()).toThrow('No active XRPL Treasury wallet found')
    })

    it('不完全なウォレット設定でエラー', () => {
      process.env.XRPL_ISSUER_1_SECRET = ''

      expect(() => validateXRPLConfig()).toThrow(
        'XRPL wallet configuration is incomplete: issuer-1'
      )
    })

    it('無効なアドレス形式でエラー', () => {
      process.env.XRPL_ISSUER_1_ADDRESS = 'invalid_address'

      expect(() => validateXRPLConfig()).toThrow('Invalid XRPL wallet address format: issuer-1')
    })

    it('短すぎるアドレスでエラー', () => {
      process.env.XRPL_ISSUER_1_ADDRESS = 'rShort'

      expect(() => validateXRPLConfig()).toThrow('Invalid XRPL wallet address format: issuer-1')
    })
  })

  describe('generateDestinationTag', () => {
    it('プロジェクトIDから一意の宛先タグを生成', () => {
      const projectId = 'test-project-123'
      const tag = generateDestinationTag(projectId)

      expect(typeof tag).toBe('number')
      expect(tag).toBeGreaterThan(0)
      expect(tag).toBeLessThan(4294967295)
    })

    it('同じプロジェクトIDで同じタグを生成', () => {
      const projectId = 'test-project-123'
      const tag1 = generateDestinationTag(projectId)
      const tag2 = generateDestinationTag(projectId)

      expect(tag1).toBe(tag2)
    })

    it('異なるプロジェクトIDで異なるタグを生成', () => {
      const tag1 = generateDestinationTag('project-1')
      const tag2 = generateDestinationTag('project-2')

      expect(tag1).not.toBe(tag2)
    })

    it('空文字列でも有効なタグを生成', () => {
      const tag = generateDestinationTag('')

      expect(typeof tag).toBe('number')
      expect(tag).toBeGreaterThanOrEqual(0)
    })
  })

  describe('generateVerificationHash', () => {
    it('検証ハッシュを正しく生成', () => {
      const hash = generateVerificationHash('project-1', 'rDonorAddress123', 100, 1234567890)

      expect(typeof hash).toBe('string')
      expect(hash).toHaveLength(32)
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
    })

    it('同じパラメータで同じハッシュを生成', () => {
      const params = ['project-1', 'rDonorAddress123', 100, 1234567890] as const
      const hash1 = generateVerificationHash(...params)
      const hash2 = generateVerificationHash(...params)

      expect(hash1).toBe(hash2)
    })

    it('異なるパラメータで異なるハッシュを生成', () => {
      const hash1 = generateVerificationHash('project-1', 'rDonorAddress123', 100, 1234567890)
      const hash2 = generateVerificationHash('project-2', 'rDonorAddress123', 100, 1234567890)

      expect(hash1).not.toBe(hash2)
    })

    it('金額の違いで異なるハッシュを生成', () => {
      const hash1 = generateVerificationHash('project-1', 'rDonorAddress123', 100, 1234567890)
      const hash2 = generateVerificationHash('project-1', 'rDonorAddress123', 200, 1234567890)

      expect(hash1).not.toBe(hash2)
    })

    it('タイムスタンプの違いで異なるハッシュを生成', () => {
      const hash1 = generateVerificationHash('project-1', 'rDonorAddress123', 100, 1234567890)
      const hash2 = generateVerificationHash('project-1', 'rDonorAddress123', 100, 1234567891)

      expect(hash1).not.toBe(hash2)
    })
  })
})
