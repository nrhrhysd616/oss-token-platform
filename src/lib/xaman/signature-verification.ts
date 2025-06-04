/**
 * Xaman Webhook署名検証ユーティリティ
 * https://docs.xaman.dev/concepts/payloads-sign-requests/status-updates/webhooks/signature-verification
 */

import crypto from 'crypto'
import { xamanConfig } from './config'

/**
 * Xamanからのwebhook署名を検証する
 * @param timestamp リクエストのタイムスタンプ（x-xumm-request-timestampヘッダー）
 * @param body リクエストボディ（JSON）
 * @param signature 受信した署名（x-xumm-request-signatureヘッダー）
 * @returns 署名が有効かどうか
 */
export function verifyXamanWebhookSignature(
  timestamp: string,
  body: any,
  signature: string
): boolean {
  try {
    // Xamanアプリシークレットからハイフンを除去
    const secret = xamanConfig.apiSecret.replace(/-/g, '')

    // HMAC-SHA1で署名を生成
    const expectedSignature = crypto
      .createHmac('sha1', secret)
      .update(timestamp + JSON.stringify(body))
      .digest('hex')

    // 署名を比較（タイミング攻撃を防ぐため、crypto.timingSafeEqualを使用）
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * リクエストヘッダーから署名情報を抽出する
 * @param headers リクエストヘッダー
 * @returns 署名情報
 */
export function extractSignatureHeaders(headers: Headers): {
  timestamp: string | null
  signature: string | null
} {
  return {
    timestamp: headers.get('x-xumm-request-timestamp'),
    signature: headers.get('x-xumm-request-signature'),
  }
}

/**
 * Xamanからのwebhookリクエストを検証する
 * @param request NextRequestオブジェクト
 * @param body パースされたリクエストボディ
 * @returns 検証結果
 */
export async function verifyXamanWebhookRequest(
  request: Request,
  body: any
): Promise<{
  isValid: boolean
  error?: string
}> {
  const { timestamp, signature } = extractSignatureHeaders(request.headers)

  // 必要なヘッダーが存在するかチェック
  if (!timestamp) {
    return {
      isValid: false,
      error: 'Missing x-xumm-request-timestamp header',
    }
  }

  if (!signature) {
    return {
      isValid: false,
      error: 'Missing x-xumm-request-signature header',
    }
  }

  // タイムスタンプの形式チェック（数値であることを確認）
  if (!/^\d+$/.test(timestamp)) {
    return {
      isValid: false,
      error: 'Invalid timestamp format',
    }
  }

  // 署名の形式チェック（16進数文字列であることを確認）
  if (!/^[a-fA-F0-9]+$/.test(signature)) {
    return {
      isValid: false,
      error: 'Invalid signature format',
    }
  }

  // タイムスタンプの有効性チェック（5分以内のリクエストのみ受け入れ）
  const requestTime = parseInt(timestamp, 10) * 1000 // ミリ秒に変換
  const currentTime = Date.now()
  const timeDifference = Math.abs(currentTime - requestTime)
  const maxTimeDifference = 5 * 60 * 1000 // 5分

  if (timeDifference > maxTimeDifference) {
    return {
      isValid: false,
      error: 'Request timestamp is too old or too far in the future',
    }
  }

  // 署名検証
  const isSignatureValid = verifyXamanWebhookSignature(timestamp, body, signature)

  if (!isSignatureValid) {
    return {
      isValid: false,
      error: 'Invalid signature',
    }
  }

  return {
    isValid: true,
  }
}
