import { Xumm } from 'xumm'

/**
 * Xaman API接続テスト結果
 */
export interface XamanHealthCheck {
  configured: boolean
  apiKeyPresent: boolean
  apiSecretPresent: boolean
  webhookUrlPresent: boolean
  errors: string[]
}

/**
 * Xaman APIの設定状況をチェック
 */
export function checkXamanHealth(): XamanHealthCheck {
  const result: XamanHealthCheck = {
    configured: false,
    apiKeyPresent: false,
    apiSecretPresent: false,
    webhookUrlPresent: false,
    errors: [],
  }

  try {
    // 環境変数の存在チェック
    result.apiKeyPresent = !!process.env.XUMM_API_KEY
    result.apiSecretPresent = !!process.env.XUMM_API_SECRET
    result.webhookUrlPresent = !!process.env.XUMM_WEBHOOK_URL

    result.configured = result.apiKeyPresent && result.apiSecretPresent
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

/**
 * Xaman APIの基本的な接続テスト
 * xumm SDKのping機能を使用
 */
export async function testXamanConnection(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
      throw new Error('Missing required Xaman environment variables: XUMM_API_KEY, XUMM_API_SECRET')
    }

    const xumm = new Xumm(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET)

    // xumm SDKのping機能を使用
    const pingResult = await xumm.ping()

    if (!pingResult) {
      return {
        success: false,
        error: 'Ping failed: No response from Xaman API',
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
