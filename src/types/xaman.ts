/**
 * Xaman API関連の型定義
 */

export type XamanPayloadResponse = {
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

export type XamanPayloadStatus = {
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

export type XamanCallback = {
  id: string
  payloadUuid: string
  userId: string
  callbackData: any
  processedAt: Date
  success: boolean
  errorMessage?: string
}

export type WalletLinkPayload = {
  txjson: {
    TransactionType: 'SignIn'
  }
  options: {
    submit: boolean
    multisign: boolean
    expire: number
  }
  custom_meta: {
    identifier: string
    blob: {
      purpose: 'wallet-link'
      userId: string
    }
  }
}
