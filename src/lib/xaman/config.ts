/**
 * Xaman API設定
 */
export const xamanConfig = {
  apiKey: process.env.XAMAN_API_KEY!,
  apiSecret: process.env.XAMAN_API_SECRET!,
  webhookUrl: process.env.XAMAN_WEBHOOK_URL,
  baseUrl: 'https://xaman.app/api/v1',
} as const

/**
 * 環境変数の検証
 */
export function validateXamanConfig() {
  const missing: string[] = []

  if (!xamanConfig.apiKey) {
    missing.push('XAMAN_API_KEY')
  }

  if (!xamanConfig.apiSecret) {
    missing.push('XAMAN_API_SECRET')
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required Xaman environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file and ensure all Xaman API credentials are set.'
    )
  }
}
