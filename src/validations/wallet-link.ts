/**
 * ウォレット連携関連のバリデーション
 */

import { z } from 'zod'
import { xrplAddressSchema, xamanPayloadUuidSchema, transactionHashSchema } from './common'

/**
 * ウォレット連携リクエストのバリデーション
 */
export const walletLinkRequestSchema = z.object({
  // 認証が必要なため、リクエストボディは基本的に空
})

export type WalletLinkRequestData = z.infer<typeof walletLinkRequestSchema>

/**
 * ウォレット連携クエリパラメータのバリデーション
 */
export const walletLinkQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['linked', 'pending', 'expired', 'cancelled']).optional(),
  sortBy: z.enum(['linkedAt', 'createdAt', 'updatedAt']).default('linkedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type WalletLinkQueryParams = z.infer<typeof walletLinkQuerySchema>

/**
 * ウォレット連携ステータス確認のクエリパラメータ
 */
export const walletLinkStatusQuerySchema = z.object({
  payloadUuid: xamanPayloadUuidSchema,
})

export type WalletLinkStatusQuery = z.infer<typeof walletLinkStatusQuerySchema>

/**
 * ウォレット情報のバリデーション
 */
export const walletInfoSchema = z.object({
  address: xrplAddressSchema,
  linkedAt: z.date(),
  xamanPayloadUuid: xamanPayloadUuidSchema,
  verificationTxHash: transactionHashSchema,
  status: z.enum(['linked', 'unlinked']),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type WalletInfo = z.infer<typeof walletInfoSchema>

/**
 * ウォレット連携レスポンスのバリデーション
 */
export const walletLinkResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    payloadUuid: xamanPayloadUuidSchema,
    qrPng: z.string(),
    expiresAt: z.date(),
    websocketUrl: z.string(),
  }),
})

export type WalletLinkResponse = z.infer<typeof walletLinkResponseSchema>

/**
 * ウォレット連携ステータスレスポンスのバリデーション
 */
export const walletLinkStatusResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    status: z.enum(['pending', 'completed', 'cancelled', 'expired']),
    wallet: z
      .object({
        address: xrplAddressSchema,
        linkedAt: z.date(),
        isPrimary: z.boolean(),
      })
      .optional(),
  }),
})

export type WalletLinkStatusResponse = z.infer<typeof walletLinkStatusResponseSchema>

/**
 * ウォレット一覧レスポンスのバリデーション
 */
export const walletListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(walletInfoSchema),
})

export type WalletListResponse = z.infer<typeof walletListResponseSchema>
