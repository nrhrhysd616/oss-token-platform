/**
 * Xaman Webhook署名検証ユーティリティ
 * https://docs.xaman.dev/concepts/payloads-sign-requests/status-updates/webhooks/signature-verification
 */

import crypto from 'crypto'

/**
 * Xamanからのwebhook署名を検証する（公式ドキュメントに準拠）
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
    // Xamanアプリシークレットからハイフンを除去（公式ドキュメントに準拠）
    const secret = process.env.XUMM_API_SECRET!.replace('-', '')

    // HMAC-SHA1で署名を生成
    const hmac = crypto
      .createHmac('sha1', secret)
      .update(timestamp + JSON.stringify(body))
      .digest('hex')

    // 署名を比較
    return hmac === signature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Xamanからのwebhookリクエストを検証する
 * @param request NextRequestオブジェクト
 * @param body パースされたリクエストボディ
 * @returns 検証結果
 */
export function verifyXamanWebhookRequest(request: Request, body: any): boolean {
  const timestamp = request.headers.get('x-xumm-request-timestamp')
  const signature = request.headers.get('x-xumm-request-signature')

  // 必要なヘッダーが存在するかチェック
  if (!timestamp || !signature) {
    return false
  }

  // 署名検証
  return verifyXamanWebhookSignature(timestamp, body, signature)
}
