/**
 * プロジェクト関連のバリデーション
 */

import { z } from 'zod'

/**
 * プロジェクト登録フォームのバリデーションスキーマ
 */
export const projectRegistrationSchema = z.object({
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
    .max(10, 'トークンコードは10文字以内で入力してください')
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
  // repositoryUrlとgithubInstallationIdは内部的に設定されるため、バリデーションスキーマからは削除
  // リポジトリ選択時に自動的に設定される
})

export type ProjectRegistrationFormData = z.infer<typeof projectRegistrationSchema>

/**
 * プロジェクト更新用バリデーションスキーマ
 * tokenCodeは変更不可のため除外
 */
export const projectUpdateSchema = projectRegistrationSchema.omit({ tokenCode: true }).partial()

export type ProjectUpdateData = z.infer<typeof projectUpdateSchema>

/**
 * プロジェクト作成用の完全なスキーマ
 * APIで受け取る際に使用
 */
export const projectCreateSchema = projectRegistrationSchema.extend({
  repositoryUrl: z.string().url('有効なURLを入力してください'),
  githubOwner: z.string().min(1, 'GitHubオーナーは必須です'),
  githubRepo: z.string().min(1, 'GitHubリポジトリ名は必須です'),
  githubInstallationId: z.string().min(1, 'GitHub Installation IDは必須です'),
})

export type ProjectCreateData = z.infer<typeof projectCreateSchema>

/**
 * クエリパラメータ用バリデーションスキーマ
 */
export const projectQuerySchema = z.object({
  limit: z
    .string()
    .nullable()
    .transform(val => (val ? parseInt(val, 10) : 10))
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
 * 公開プロジェクト用クエリパラメータ
 */
export const publicProjectQuerySchema = projectQuerySchema.extend({
  status: z.literal('active').default('active'), // 公開プロジェクトはactiveのみ
})

export type PublicProjectQueryParams = z.infer<typeof publicProjectQuerySchema>
