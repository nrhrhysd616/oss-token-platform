/**
 * Xaman関連のバリデーションスキーマ
 */

import { z } from 'zod'
import {
  projectIdSchema,
  xrplAddressSchema,
  xamanPayloadUuidSchema,
  transactionHashSchema,
  statusSchema,
  tokenCodeSchema,
} from './common'

/**
 * トラストライン設定リクエストのバリデーション
 */
export const trustlineRequestSchema = z.object({
  projectId: projectIdSchema,
  donorAddress: xrplAddressSchema,
})

// FIXME: 現状未使用
/**
 * トラストライン設定レスポンスのバリデーション
 */
export const trustlineResponseSchema = z.object({
  request: z.object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    tokenCode: tokenCodeSchema,
    expiresAt: z.string().datetime(),
  }),
  xamanPayload: z.object({
    uuid: xamanPayloadUuidSchema,
    qr_png: z.string(),
    qr_uri: z.string(),
    websocket_status: z.string(),
  }),
})

/**
 * トラストライン状態確認のクエリパラメータ
 */
export const trustlineStatusQuerySchema = z.object({
  requestId: z.string().optional(),
  donorAddress: xrplAddressSchema.optional(),
  projectId: z.string().optional(),
})

// FIXME: 現状未使用
/**
 * トラストライン状態レスポンスのバリデーション
 */
export const trustlineStatusResponseSchema = z.object({
  donorAddress: xrplAddressSchema.optional(),
  projectId: z.string().optional(),
  tokenCode: tokenCodeSchema.optional(),
  hasTrustLine: z.boolean().optional(),
  issuerAddress: xrplAddressSchema.optional(),
  request: z
    .object({
      id: z.string(),
      projectId: z.string(),
      projectName: z.string(),
      tokenCode: tokenCodeSchema,
      status: statusSchema,
      createdAt: z.date(),
      expiresAt: z.date(),
    })
    .optional(),
  xamanStatus: z.any().optional(), // Xamanのステータスは動的なため
})

// FIXME: 現状未使用
/**
 * Xamanペイロードステータスのバリデーション
 */
export const xamanPayloadStatusSchema = z.object({
  meta: z.object({
    exists: z.boolean(),
    uuid: xamanPayloadUuidSchema,
    multisign: z.boolean(),
    submit: z.boolean(),
    destination: z.string(),
    resolved_destination: z.string(),
    signed: z.boolean(),
    cancelled: z.boolean(),
    expired: z.boolean(),
    pushed: z.boolean(),
    app_opened: z.boolean(),
    return_url_app: z.string().optional(),
    return_url_web: z.string().optional(),
  }),
  application: z.object({
    name: z.string(),
    description: z.string(),
    disabled: z.number(),
    uuidv4: z.string(),
    icon_url: z.string(),
    issued_user_token: z.string().optional(),
  }),
  payload: z.object({
    tx_type: z.string(),
    tx_destination: z.string(),
    tx_destination_tag: z.number().optional(),
    request_json: z.any(),
    created_at: z.string(),
    expires_at: z.string(),
    expires_in_seconds: z.number(),
  }),
  response: z
    .object({
      hex: z.string(),
      txid: transactionHashSchema,
      resolved_at: z.string(),
      dispatched_to: z.string(),
      dispatched_result: z.string(),
      multisign_account: z.string().optional(),
      account: xrplAddressSchema,
    })
    .optional(),
})

// FIXME: 現状未使用
/**
 * トラストライン設定記録のバリデーション
 */
export const trustlineRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  tokenCode: tokenCodeSchema,
  issuerAddress: xrplAddressSchema,
  donorAddress: xrplAddressSchema,
  donorUid: z.string().nullable(),
  xamanPayloadId: xamanPayloadUuidSchema,
  status: statusSchema,
  txHash: transactionHashSchema.optional(),
  createdAt: z.date(),
  expiresAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
})

// バリデーション関数
// FIXME: 現状未使用
export const validateXamanPayloadUuid = (uuid: string): boolean => {
  try {
    xamanPayloadUuidSchema.parse(uuid)
    return true
  } catch {
    return false
  }
}

// FIXME: 現状未使用
export const validateTransactionHash = (hash: string): boolean => {
  try {
    transactionHashSchema.parse(hash)
    return true
  } catch {
    return false
  }
}

// 型エクスポート
// export type TrustlineRequest = z.infer<typeof trustlineRequestSchema>
// export type TrustlineResponse = z.infer<typeof trustlineResponseSchema>
// export type TrustlineStatusQuery = z.infer<typeof trustlineStatusQuerySchema>
// export type TrustlineStatusResponse = z.infer<typeof trustlineStatusResponseSchema>
// export type WalletLinkResponse = z.infer<typeof walletLinkResponseSchema>
// export type WalletLinkStatusQuery = z.infer<typeof walletLinkStatusQuerySchema>
// export type WalletLinkStatusResponse = z.infer<typeof walletLinkStatusResponseSchema>
// export type WalletInfo = z.infer<typeof walletInfoSchema>
// export type WalletListResponse = z.infer<typeof walletListResponseSchema>
// export type XamanPayloadStatus = z.infer<typeof xamanPayloadStatusSchema>
// export type TrustlineRecord = z.infer<typeof trustlineRecordSchema>
