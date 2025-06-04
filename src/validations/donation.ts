/**
 * 寄付関連のバリデーションスキーマ
 */

import { z } from 'zod'
import {
  projectIdSchema,
  xrplAddressSchema,
  donationAmountSchema,
  statusSchema,
  xamanPayloadUuidSchema,
  transactionHashSchema,
} from './common'

/**
 * 寄付セッション作成リクエストのバリデーション
 */
export const createDonationSchema = z.object({
  projectId: projectIdSchema,
  donorAddress: xrplAddressSchema,
  amount: donationAmountSchema,
})

// FIXME: 現状未使用
/**
 * 寄付セッション取得リクエストのバリデーション
 */
export const getDonationSessionSchema = z.object({
  sessionId: z.string().min(1, 'セッションIDが必要です'),
})

// FIXME: 現状未使用
/**
 * 寄付セッションレスポンスのバリデーション
 */
export const donationSessionResponseSchema = z.object({
  session: z.object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string().optional(),
    amount: z.number(),
    status: statusSchema,
    destinationTag: z.number(),
    createdAt: z.date(),
    expiresAt: z.date(),
    txHash: z.string().optional(),
  }),
  xamanPayload: z
    .object({
      uuid: xamanPayloadUuidSchema,
      qr_png: z.string(),
      qr_uri: z.string(),
      websocket_status: z.string(),
    })
    .optional(),
})

// FIXME: 現状未使用
/**
 * 寄付記録のバリデーション
 */
export const donationRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  donorAddress: xrplAddressSchema,
  donorUid: z.string().nullable(),
  amount: z.number(),
  txHash: transactionHashSchema,
  destinationTag: z.number(),
  verificationHash: z.string(),
  tokenCode: z.string(),
  tokenIssued: z.boolean(),
  tokenAmount: z.number().optional(),
  tokenTxHash: transactionHashSchema.optional(),
  tokenIssuedAt: z.date().optional(),
  tokenIssueStatus: z.enum(['pending', 'pending_trustline', 'failed', 'completed']).optional(),
  tokenIssueError: z.string().optional(),
  createdAt: z.date(),
})

// FIXME: 現状未使用
/**
 * 寄付統計のバリデーション
 */
export const donationStatsSchema = z.object({
  projectId: z.string(),
  totalDonations: z.number().min(0),
  donorCount: z.number().min(0),
  totalTokensIssued: z.number().min(0),
  lastDonationAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// FIXME: 現状未使用
/**
 * 寄付履歴取得のクエリパラメータ
 */
export const donationHistoryQuerySchema = z.object({
  projectId: z.string().optional(),
  donorAddress: xrplAddressSchema.optional(),
  donorUid: z.string().optional(),
  status: statusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
})

// FIXME: 現状未使用
/**
 * 認証ヘッダーのバリデーション
 */
export const authHeaderSchema = z.object({
  authorization: z
    .string()
    .regex(/^Bearer .+/, '認証ヘッダーの形式が正しくありません')
    .transform(header => header.replace('Bearer ', '')),
})

// FIXME: 現状未使用
/**
 * 寄付金額の妥当性チェック
 */
export const validateDonationAmount = (amount: number): boolean => {
  try {
    donationAmountSchema.parse(amount)
    return true
  } catch {
    return false
  }
}

// FIXME: 現状未使用
/**
 * XRPLアドレスの妥当性チェック
 */
export const validateXrplAddress = (address: string): boolean => {
  try {
    xrplAddressSchema.parse(address)
    return true
  } catch {
    return false
  }
}

// 型エクスポート
export type CreateDonationRequest = z.infer<typeof createDonationSchema>
export type GetDonationSessionRequest = z.infer<typeof getDonationSessionSchema>
export type DonationSessionResponse = z.infer<typeof donationSessionResponseSchema>
export type DonationRecord = z.infer<typeof donationRecordSchema>
export type DonationStats = z.infer<typeof donationStatsSchema>
export type DonationHistoryQuery = z.infer<typeof donationHistoryQuerySchema>
export type AuthHeader = z.infer<typeof authHeaderSchema>
