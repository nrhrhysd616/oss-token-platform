import { xamanConfig, validateXamanConfig } from './config'

/**
 * xaman API レスポンスの型定義
 */
export interface XamanPayloadResponse {
  uuid: string
  next: {
    always: string
    no_push_msg_received?: string
  }
  refs: {
    qr_png: string
    qr_matrix: string
    qr_uri_quality_opts: string[]
    websocket_status: string
  }
  pushed: boolean
}

export interface XamanPayloadStatus {
  meta: {
    exists: boolean
    uuid: string
    multisign: boolean
    submit: boolean
    destination: string
    resolved_destination: string
    resolved: boolean
    signed: boolean
    cancelled: boolean
    expired: boolean
    pushed: boolean
    app_opened: boolean
    return_url_app?: string
    return_url_web?: string
  }
  application: {
    name: string
    description: string
    disabled: number
    uuidv4: string
    icon_url: string
    issued_user_token?: string
  }
  payload: {
    tx_type: string
    tx_destination: string
    tx_destination_tag?: number
    request_json: Record<string, any>
    created_at: string
    expires_at: string
    expires_in_seconds: number
  }
  response?: {
    hex: string
    txid: string
    resolved_at: string
    dispatched_to: string
    multisign_account: string
    account: string
  }
}

/**
 * xaman APIクライアント
 */
export class XamanClient {
  private readonly apiKey: string
  private readonly apiSecret: string
  private readonly baseUrl: string

  constructor() {
    validateXamanConfig()
    this.apiKey = xamanConfig.apiKey
    this.apiSecret = xamanConfig.apiSecret
    this.baseUrl = xamanConfig.baseUrl
  }

  /**
   * APIリクエストのヘッダーを生成
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-API-Secret': this.apiSecret,
    }
  }

  /**
   * ペイロードを作成
   */
  async createPayload(payload: Record<string, any>): Promise<XamanPayloadResponse> {
    const response = await fetch(`${this.baseUrl}/platform/payload`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`xaman API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  /**
   * ペイロードのステータスを取得
   */
  async getPayloadStatus(uuid: string): Promise<XamanPayloadStatus> {
    const response = await fetch(`${this.baseUrl}/platform/payload/${uuid}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`xaman API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  /**
   * ペイロードをキャンセル
   */
  async cancelPayload(uuid: string): Promise<{ cancelled: boolean }> {
    const response = await fetch(`${this.baseUrl}/platform/payload/${uuid}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`xaman API error: ${response.status} ${error}`)
    }

    return response.json()
  }
}
