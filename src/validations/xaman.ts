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
