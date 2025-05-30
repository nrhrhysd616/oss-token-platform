import { xamanConfig, validateXamanConfig } from './config'

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
    result.apiKeyPresent = !!xamanConfig.apiKey
    result.apiSecretPresent = !!xamanConfig.apiSecret
    result.webhookUrlPresent = !!xamanConfig.webhookUrl

    // 必須項目の検証
    validateXamanConfig()

    result.configured = result.apiKeyPresent && result.apiSecretPresent
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

/**
 * Xaman APIの基本的な接続テスト
 * 注意: この関数は実際のAPI呼び出しを行うため、有効なAPI認証情報が必要
 */
export async function testXamanConnection(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    validateXamanConfig()

    // Ping エンドポイントをテスト
    const response = await fetch(`${xamanConfig.baseUrl}/platform/ping`, {
      method: 'GET',
      headers: {
        'X-API-Key': xamanConfig.apiKey,
        'X-API-Secret': xamanConfig.apiSecret,
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `API connection failed: ${response.status} ${response.statusText}`,
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
