import z from 'zod'
import { projectIdSchema } from './project'

/**
 * XRP金額のバリデーション（寄付用）
 */
export const donationXrpAmountSchema = z
  .number()
  .min(1, '寄付金額は1XRP以上である必要があります')
  .max(10000, '寄付金額は10,000XRP以下である必要があります')

/**
 * 寄付セッション作成API用バリデーションスキーマ
 */
export const donationCreateApiSchema = z.object({
  projectId: projectIdSchema,
  xrpAmount: donationXrpAmountSchema,
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
  donorUid: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().optional(),
})

export type DonationQueryParams = z.infer<typeof donationQuerySchema>
