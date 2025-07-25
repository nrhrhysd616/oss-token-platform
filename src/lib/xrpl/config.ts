/**
 * XRPL設定管理
 */

import crypto from 'crypto'

export type XRPLWallet = {
  id: string
  address: string
  secret: string
  isActive: boolean
}

export type XRPLConfig = {
  network: 'testnet' | 'mainnet'
  server: string
  issuerWallets: XRPLWallet[]
  treasuryWallets: XRPLWallet[]
}

/**
 * XRPL設定を取得
 */
export function getXRPLConfig(): XRPLConfig {
  const network = (process.env.XRPL_NETWORK as 'testnet' | 'mainnet') || 'testnet'

  // Issuer Wallets設定（環境変数から複数取得）
  const issuerWallets: XRPLWallet[] = []
  let issuerIndex = 1
  while (process.env[`XRPL_ISSUER_${issuerIndex}_ADDRESS`]) {
    issuerWallets.push({
      id: `issuer-${issuerIndex}`,
      address: process.env[`XRPL_ISSUER_${issuerIndex}_ADDRESS`] || '',
      secret: process.env[`XRPL_ISSUER_${issuerIndex}_SECRET`] || '',
      isActive: process.env[`XRPL_ISSUER_${issuerIndex}_ACTIVE`] === 'true',
    })
    issuerIndex++
  }

  // Treasury Wallets設定（環境変数から複数取得）
  const treasuryWallets: XRPLWallet[] = []
  let treasuryIndex = 1
  while (process.env[`XRPL_TREASURY_${treasuryIndex}_ADDRESS`]) {
    treasuryWallets.push({
      id: `treasury-${treasuryIndex}`,
      address: process.env[`XRPL_TREASURY_${treasuryIndex}_ADDRESS`] || '',
      secret: process.env[`XRPL_TREASURY_${treasuryIndex}_SECRET`] || '',
      isActive: process.env[`XRPL_TREASURY_${treasuryIndex}_ACTIVE`] === 'true',
    })
    treasuryIndex++
  }

  const config: XRPLConfig = {
    network,
    server: network === 'testnet' ? 'wss://s.altnet.rippletest.net:51233' : 'wss://xrplcluster.com',
    issuerWallets,
    treasuryWallets,
  }

  return config
}

/**
 * アクティブなIssuerウォレットを取得
 */
export function getActiveIssuerWallet(): XRPLWallet {
  const config = getXRPLConfig()
  const activeWallet = config.issuerWallets.find(wallet => wallet.isActive)

  if (!activeWallet) {
    throw new Error('No active XRPL Issuer wallet found')
  }

  return activeWallet
}

/**
 * アクティブなTreasuryウォレットを取得
 */
export function getActiveTreasuryWallet(): XRPLWallet {
  const config = getXRPLConfig()
  const activeWallet = config.treasuryWallets.find(wallet => wallet.isActive)

  if (!activeWallet) {
    throw new Error('No active XRPL Treasury wallet found')
  }

  return activeWallet
}

/**
 * 特定のIssuerウォレットを取得
 */
export function getIssuerWallet(walletId: string): XRPLWallet {
  const config = getXRPLConfig()
  const wallet = config.issuerWallets.find(w => w.id === walletId)

  if (!wallet) {
    throw new Error(`XRPL Issuer wallet not found: ${walletId}`)
  }

  return wallet
}

/**
 * 特定のTreasuryウォレットを取得
 */
export function getTreasuryWallet(walletId: string): XRPLWallet {
  const config = getXRPLConfig()
  const wallet = config.treasuryWallets.find(w => w.id === walletId)

  if (!wallet) {
    throw new Error(`XRPL Treasury wallet not found: ${walletId}`)
  }

  return wallet
}

/**
 * XRPL設定の検証
 */
export function validateXRPLConfig(): void {
  const config = getXRPLConfig()

  if (config.issuerWallets.length === 0) {
    throw new Error('No XRPL Issuer wallets configured')
  }

  if (config.treasuryWallets.length === 0) {
    throw new Error('No XRPL Treasury wallets configured')
  }

  // アクティブなウォレットが存在するかチェック
  const hasActiveIssuer = config.issuerWallets.some(wallet => wallet.isActive)
  const hasActiveTreasury = config.treasuryWallets.some(wallet => wallet.isActive)

  if (!hasActiveIssuer) {
    throw new Error('No active XRPL Issuer wallet found')
  }

  if (!hasActiveTreasury) {
    throw new Error('No active XRPL Treasury wallet found')
  }

  // 各ウォレットの形式検証
  for (const wallet of [...config.issuerWallets, ...config.treasuryWallets]) {
    if (!wallet.address || !wallet.secret) {
      throw new Error(`XRPL wallet configuration is incomplete: ${wallet.id}`)
    }

    if (!wallet.address.startsWith('r') || wallet.address.length < 25) {
      throw new Error(`Invalid XRPL wallet address format: ${wallet.id}`)
    }
  }
}

/**
 * 宛先タグ生成
 * プロジェクトIDから一意の宛先タグを生成
 */
export function generateDestinationTag(projectId: string): number {
  // プロジェクトIDのハッシュから32bit整数を生成
  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    const char = projectId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 32bit整数に変換
  }

  // 正の値に変換し、宛先タグの範囲内に収める
  return Math.abs(hash) % 4294967295 // 2^32 - 1
}

/**
 * 寄付検証用ハッシュ生成
 * SHA-256を使用した暗号学的に安全なハッシュ生成
 */
export function generateVerificationHash(
  projectId: string,
  type: 'donation' | 'license',
  amount: number,
  timestamp: number
): string {
  const salt = process.env.TX_VERIFICATION_HASH_SALT || 'default-salt'
  const data = `${salt}:${projectId}:${type}:${amount}:${timestamp}`
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex').substring(0, 32) // XRPLメモサイズ制限を考慮して32文字に制限
}

/**
 * プロジェクトIDに基づいてIssuerウォレットを割り当て
 * ハッシュベース方式で決定論的に選択
 */
export function assignIssuerWallet(projectId: string): XRPLWallet {
  const config = getXRPLConfig()
  const activeIssuers = config.issuerWallets.filter(wallet => wallet.isActive)

  if (activeIssuers.length === 0) {
    throw new Error('利用可能なIssuerウォレットがありません')
  }

  // プロジェクトIDのハッシュ値でIssuerを選択
  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    const char = projectId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  const index = Math.abs(hash) % activeIssuers.length
  return activeIssuers[index]
}

/**
 * 現在のネットワークに対応するRLUSDのIssuerアドレスを取得
 */
export function getRLUSDIssuerAddress(): string {
  const config = getXRPLConfig()

  if (config.network === 'mainnet') {
    const issuer = process.env.XRPL_RLUSD_ISSUER_MAINNET
    if (!issuer) {
      throw new Error('XRPL_RLUSD_ISSUER_MAINNET environment variable is not set')
    }
    return issuer
  } else {
    const issuer = process.env.XRPL_RLUSD_ISSUER_TESTNET
    if (!issuer) {
      throw new Error('XRPL_RLUSD_ISSUER_TESTNET environment variable is not set')
    }
    return issuer
  }
}
