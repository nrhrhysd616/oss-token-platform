import { z } from 'zod'

/**
 * XRPLアドレスのバリデーション
 */
export const xrplAddressSchema = z
  .string()
  .min(25, '有効なXRPLアドレスが必要です')
  .max(34, '有効なXRPLアドレスが必要です')
  .regex(/^r[a-zA-Z0-9]{24,33}$/, 'XRPLアドレスの形式が正しくありません')

export type XrplAddress = z.infer<typeof xrplAddressSchema>
