import { getXRPLClient } from '../../src/lib/xrpl/client'
import { getXRPLConfig } from '../../src/lib/xrpl/config'

/**
 * テストアカウントの残高チェック結果
 */
export type BalanceCheckResult = {
  address: string
  balance: number
  isLow: boolean
  warning?: string
}

/**
 * テストアカウントの残高をチェックし、不足時は警告を表示
 */
export async function checkTestAccountBalances(minBalanceXRP = 100): Promise<BalanceCheckResult[]> {
  const client = getXRPLClient()
  const config = getXRPLConfig()

  try {
    await client.connect()

    const results: BalanceCheckResult[] = []

    // Issuerウォレットの残高チェック
    for (const wallet of config.issuerWallets) {
      if (wallet.isActive) {
        try {
          const balanceDrops = await client.getAccountBalance(wallet.address)
          const balanceXRP = parseInt(balanceDrops) / 1000000 // dropsをXRPに変換
          const isLow = balanceXRP < minBalanceXRP

          const result: BalanceCheckResult = {
            address: wallet.address,
            balance: balanceXRP,
            isLow,
          }

          if (isLow) {
            result.warning = `Issuer wallet ${wallet.id} balance is low: ${balanceXRP} XRP (minimum: ${minBalanceXRP} XRP)`
            console.warn(`⚠️  ${result.warning}`)
          } else {
            console.log(`✅ Issuer wallet ${wallet.id} balance: ${balanceXRP} XRP`)
          }

          results.push(result)
        } catch (error) {
          const result: BalanceCheckResult = {
            address: wallet.address,
            balance: 0,
            isLow: true,
            warning: `Failed to check balance for issuer wallet ${wallet.id}: ${error}`,
          }
          console.warn(`❌ ${result.warning}`)
          results.push(result)
        }
      }
    }

    // Treasuryウォレットの残高チェック
    for (const wallet of config.treasuryWallets) {
      if (wallet.isActive) {
        try {
          const balanceDrops = await client.getAccountBalance(wallet.address)
          const balanceXRP = parseInt(balanceDrops) / 1000000
          const isLow = balanceXRP < minBalanceXRP

          const result: BalanceCheckResult = {
            address: wallet.address,
            balance: balanceXRP,
            isLow,
          }

          if (isLow) {
            result.warning = `Treasury wallet ${wallet.id} balance is low: ${balanceXRP} XRP (minimum: ${minBalanceXRP} XRP)`
            console.warn(`⚠️  ${result.warning}`)
          } else {
            console.log(`✅ Treasury wallet ${wallet.id} balance: ${balanceXRP} XRP`)
          }

          results.push(result)
        } catch (error) {
          const result: BalanceCheckResult = {
            address: wallet.address,
            balance: 0,
            isLow: true,
            warning: `Failed to check balance for treasury wallet ${wallet.id}: ${error}`,
          }
          console.warn(`❌ ${result.warning}`)
          results.push(result)
        }
      }
    }

    return results
  } catch (error) {
    console.warn(`❌ Failed to connect to XRPL testnet: ${error}`)
    return []
  }
}

/**
 * テスト実行時間が長い場合の警告表示
 */
export function warnIfLongRunning(startTime: number, thresholdMs = 120000): void {
  const elapsed = Date.now() - startTime
  if (elapsed > thresholdMs) {
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    console.warn(
      `⚠️  Test execution time is long: ${minutes}m ${seconds}s (threshold: ${Math.floor(thresholdMs / 60000)}m)`
    )
  }
}

/**
 * テスト開始時の警告表示
 */
export function showTestnetWarning(): void {
  console.log('🌐 Running tests against XRPL Testnet')
  console.log('⚠️  These tests will consume actual testnet XRP')
  console.log('⏱️  Tests may take several minutes to complete due to network latency')
  console.log('🔄 Rate limiting is applied to prevent API throttling')
  console.log('')
}

/**
 * テスト完了時のサマリー表示
 */
export function showTestSummary(startTime: number, testCount: number): void {
  const elapsed = Date.now() - startTime
  const minutes = Math.floor(elapsed / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)

  console.log('')
  console.log('📊 Test Summary:')
  console.log(`   Tests completed: ${testCount}`)
  console.log(`   Total time: ${minutes}m ${seconds}s`)
  console.log(`   Average time per test: ${Math.floor(elapsed / testCount)}ms`)

  if (elapsed > 120000) {
    console.log('⚠️  Consider running fewer tests or using mocks for faster feedback')
  }
}
