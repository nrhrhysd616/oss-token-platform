/**
 * 共通バリデーションスキーマ
 */

import { z } from 'zod'

/**
 * XRPLアドレスのバリデーション
 */
export const xrplAddressSchema = z
  .string()
  .min(25, '有効なXRPLアドレスが必要です')
  .max(34, '有効なXRPLアドレスが必要です')
  .regex(/^r[a-zA-Z0-9]{24,33}$/, 'XRPLアドレスの形式が正しくありません')

/**
 * プロジェクトIDのバリデーション
 */
export const projectIdSchema = z.string().min(1, 'プロジェクトIDが必要です')

/**
 * XRP金額のバリデーション（寄付用）
 */
export const donationAmountSchema = z
  .number()
  .min(1, '寄付金額は1XRP以上である必要があります')
  .max(10000, '寄付金額は10,000XRP以下である必要があります')

/**
 * トークンコードのバリデーション
 */
export const tokenCodeSchema = z
  .string()
  .min(1, 'トークンコードが必要です')
  .max(10, 'トークンコードは10文字以内である必要があります')
  .regex(/^[A-Z0-9]+$/, 'トークンコードは大文字の英数字のみ使用可能です')

/**
 * XamanペイロードUUIDのバリデーション
 */
export const xamanPayloadUuidSchema = z.string().uuid('有効なペイロードUUIDが必要です')

/**
 * トランザクションハッシュのバリデーション
 */
export const transactionHashSchema = z
  .string()
  .length(64, 'トランザクションハッシュは64文字である必要があります')
  .regex(/^[A-F0-9]{64}$/i, 'トランザクションハッシュの形式が正しくありません')

/**
 * Firebase認証トークンのバリデーション
 */
export const authTokenSchema = z.string().min(1, '認証トークンが必要です')

// FIXME: 現状未使用
/**
 * ページネーション用のスキーマ
 */
export const paginationSchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
})

// FIXME: 現状未使用
/**
 * 日付範囲のバリデーション
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

/**
 * ステータス共通型
 */
export const statusSchema = z.enum(['pending', 'completed', 'failed', 'expired', 'cancelled'])

export type XrplAddress = z.infer<typeof xrplAddressSchema>
export type ProjectId = z.infer<typeof projectIdSchema>
export type DonationAmount = z.infer<typeof donationAmountSchema>
export type TokenCode = z.infer<typeof tokenCodeSchema>
export type XamanPayloadUuid = z.infer<typeof xamanPayloadUuidSchema>
export type TransactionHash = z.infer<typeof transactionHashSchema>
export type AuthToken = z.infer<typeof authTokenSchema>
export type Pagination = z.infer<typeof paginationSchema>
export type DateRange = z.infer<typeof dateRangeSchema>
export type Status = z.infer<typeof statusSchema>
