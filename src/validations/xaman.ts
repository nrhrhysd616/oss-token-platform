import z from 'zod'

import { projectIdSchema } from './project'
import { xrplAddressSchema } from './xrpl'

/**
 * XamanペイロードUUIDのバリデーション
 */
export const xamanPayloadUuidSchema = z.string().uuid('有効なペイロードUUIDが必要です')

/**
 * ウォレット連携API用バリデーションスキーマ
 */
export const walletLinkApiSchema = z.object({
  // 認証が必要なため、リクエストボディは基本的に空
})

export type WalletLinkApiData = z.infer<typeof walletLinkApiSchema>

/**
 * ウォレット連携ステータス確認用クエリパラメータバリデーションスキーマ
 */
export const walletLinkQuerySchema = z.object({
  payloadUuid: xamanPayloadUuidSchema,
})

export type WalletLinkQueryParams = z.infer<typeof walletLinkQuerySchema>

/**
 * XRP金額のバリデーション（寄付用）
 */
export const donationAmountSchema = z
  .number()
  .min(1, '寄付金額は1XRP以上である必要があります')
  .max(10000, '寄付金額は10,000XRP以下である必要があります')

/**
 * 寄付セッション作成API用バリデーションスキーマ
 */
export const donationCreateApiSchema = z.object({
  projectId: projectIdSchema,
  amount: donationAmountSchema,
})

export type DonationCreateApiData = z.infer<typeof donationCreateApiSchema>

/**
 * 寄付セッション取得API用バリデーションスキーマ
 */
export const donationGetApiSchema = z.object({
  requestId: z.string().min(1, 'リクエストIDが必要です'),
})

export type DonationGetApiData = z.infer<typeof donationGetApiSchema>

/**
 * 寄付履歴取得用クエリパラメータバリデーションスキーマ
 */
export const donationQuerySchema = z.object({
  projectId: z.string().optional(),
  donorAddress: xrplAddressSchema.optional(),
  donorUid: z.string().optional(),
  status: z.enum(['pending', 'failed', 'completed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
})

export type DonationQueryParams = z.infer<typeof donationQuerySchema>
