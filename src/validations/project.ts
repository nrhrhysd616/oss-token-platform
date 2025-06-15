/**
 * プロジェクト関連のバリデーション
 */

import { z } from 'zod'

/**
 * プロジェクトIDのバリデーション
 */
export const projectIdSchema = z.string().min(1, 'プロジェクトIDが必要です')

/**
 * トークンコードのバリデーション
 */
export const tokenCodeSchema = z
  .string()
  .min(1, 'トークンコードが必要です')
  .max(40, 'トークンコードは40文字以内である必要があります')
  .regex(/^[A-Z0-9]+$/, 'トークンコードは大文字の英数字のみ使用可能です')

/**
 * プロジェクト作成フォーム用バリデーションスキーマ
 * ユーザーが直接入力する項目のみ
 */
export const projectCreateFormSchema = z.object({
  name: z
    .string()
    .min(1, 'プロジェクト名は必須です')
    .max(50, 'プロジェクト名は50文字以内で入力してください')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'プロジェクト名は英数字、スペース、ハイフン、アンダースコアのみ使用可能です'
    ),
  description: z.string().min(1, '説明は必須です').max(500, '説明は500文字以内で入力してください'),
  status: z.enum(['draft', 'active', 'suspended']),
  tokenCode: z
    .string()
    .min(1, 'トークンコードは必須です')
    .max(40, 'トークンコードは40文字以内で入力してください')
    .regex(/^[A-Z0-9]+$/, 'トークンコードは大文字の英数字のみ使用可能です'),
  donationUsages: z
    .array(
      z
        .string()
        .min(1, '使い道の項目は空にできません')
        .max(40, '各項目は40文字以内で入力してください')
    )
    .max(10, '使い道は最大10項目まで設定できます')
    .default([]),
})

export type ProjectCreateFormData = z.infer<typeof projectCreateFormSchema>

/**
 * プロジェクト作成API用バリデーションスキーマ
 * フォームスキーマを拡張して内部フィールドを追加
 */
export const projectCreateApiSchema = projectCreateFormSchema.extend({
  repositoryUrl: z.string().url('有効なURLを入力してください'),
  githubOwner: z.string().min(1, 'GitHubオーナーは必須です'),
  githubRepo: z.string().min(1, 'GitHubリポジトリ名は必須です'),
  githubInstallationId: z.number().min(1, 'GitHub Installation IDは必須です'),
})

export type ProjectCreateApiData = z.infer<typeof projectCreateApiSchema>

/**
 * プロジェクト更新フォーム用バリデーションスキーマ
 * tokenCodeは変更不可のため除外
 */
export const projectUpdateFormSchema = projectCreateFormSchema.omit({ tokenCode: true }).partial()

export type ProjectUpdateFormData = z.infer<typeof projectUpdateFormSchema>

/**
 * プロジェクト更新API用バリデーションスキーマ
 */
export const projectUpdateApiSchema = projectUpdateFormSchema

export type ProjectUpdateApiData = z.infer<typeof projectUpdateApiSchema>

/**
 * プロジェクト一覧取得用クエリパラメータバリデーションスキーマ
 */
export const projectQuerySchema = z.object({
  limit: z
    .string()
    .nullable()
    .transform(val => (val ? parseInt(val, 10) : 100))
    .pipe(z.number().min(1).max(100)),
  offset: z
    .string()
    .nullable()
    .transform(val => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().min(0)),
  status: z.enum(['draft', 'active', 'suspended']).optional(),
  sortBy: z
    .string()
    .nullable()
    .transform(val => val || 'createdAt')
    .pipe(z.enum(['createdAt', 'updatedAt', 'name'])),
  sortOrder: z
    .string()
    .nullable()
    .transform(val => val || 'desc')
    .pipe(z.enum(['asc', 'desc'])),
})

export type ProjectQueryParams = z.infer<typeof projectQuerySchema>

/**
 * 公開プロジェクト一覧取得用クエリパラメータバリデーションスキーマ
 */
export const projectPublicQuerySchema = projectQuerySchema.extend({
  status: z.literal('active').default('active'), // 公開プロジェクトはactiveのみ
})

export type ProjectPublicQueryParams = z.infer<typeof projectPublicQuerySchema>
