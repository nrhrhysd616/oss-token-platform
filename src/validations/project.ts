/**
 * GitHub関連のバリデーション
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
 * プロジェクト名の重複チェック用バリデーション
 */
export async function validateProjectNameUnique(
  name: string,
  excludeId?: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/projects/validate-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, excludeId }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.isUnique
  } catch {
    return false
  }
}
