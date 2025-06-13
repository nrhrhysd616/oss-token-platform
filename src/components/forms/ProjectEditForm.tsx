/**
 * プロジェクト編集フォームコンポーネント
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/firebase/auth-context'
import { projectUpdateFormSchema, ProjectUpdateFormData } from '@/validations/project'
import { Project } from '@/types/project'
import { setToastCookie } from '@/lib/toast-utils'

type ProjectEditFormProps = {
  project: Project
}

export default function ProjectEditForm({ project }: ProjectEditFormProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 寄付の使い道を独立したstateで管理（文字列配列）
  const [donationUsages, setDonationUsages] = useState<string[]>(
    project.donationUsages.length > 0 ? project.donationUsages : ['']
  )

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, isDirty },
    setValue,
  } = useForm({
    resolver: zodResolver(projectUpdateFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: project.name,
      description: project.description,
      status: project.status,
      donationUsages: project.donationUsages,
    },
  })

  // 寄付の使い道の管理関数
  const addDonationUsage = () => {
    if (donationUsages.length < 10) {
      setDonationUsages([...donationUsages, ''])
    }
  }

  const removeDonationUsage = (index: number) => {
    if (donationUsages.length > 1) {
      const newUsages = donationUsages.filter((_, i) => i !== index)
      setDonationUsages(newUsages)
      setValue('donationUsages', newUsages, { shouldDirty: true })
    }
  }

  const updateDonationUsage = (index: number, value: string) => {
    const newUsages = [...donationUsages]
    newUsages[index] = value
    setDonationUsages(newUsages)
    setValue('donationUsages', newUsages, { shouldDirty: true })
  }

  const onSubmit = async (data: ProjectUpdateFormData) => {
    if (!user) {
      toast.error('ログインが必要です')
      return
    }

    setIsSubmitting(true)

    try {
      // 空の項目を除外した文字列配列を使用
      const filteredDonationUsages = donationUsages.filter(usage => usage.trim() !== '')

      const response = await fetch(`/api/management/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          ...data,
          donationUsages: filteredDonationUsages,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'プロジェクトの更新に失敗しました')
      }

      const result = await response.json()

      // cookieに成功メッセージを保存
      setToastCookie('success', 'プロジェクトが正常に更新されました！')
      router.push(`/maintainer/projects/${project.id}`)
    } catch (error) {
      console.error('Project update error:', error)

      // エラー時は現在のページでトーストを表示
      const errorMessage =
        error instanceof Error ? error.message : 'プロジェクトの更新に失敗しました'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* プロジェクト基本情報（読み取り専用） */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            📦 プロジェクト基本情報（読み取り専用）
          </h2>

          <div className="space-y-6">
            {/* リポジトリ情報 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GitHubリポジトリ
              </label>
              <div className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                <a
                  href={project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  {project.githubOwner}/{project.githubRepo}
                </a>
              </div>
              <p className="mt-2 text-sm text-gray-400">リポジトリは変更できません</p>
            </div>

            {/* トークンコード */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">トークンコード</label>
              <div className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 font-mono text-lg">
                {project.tokenCode}
              </div>
              <p className="mt-2 text-sm text-gray-400">トークンコードは変更できません</p>
            </div>
          </div>
        </div>

        {/* 編集可能なプロジェクト情報 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">✏️ 編集可能な情報</h2>

          <div className="space-y-6">
            {/* プロジェクト名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                プロジェクト名 <span className="text-red-400">*</span>
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="例: my-awesome-project"
              />
              {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
            </div>

            {/* 説明 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                プロジェクト説明 <span className="text-red-400">*</span>
              </label>
              <textarea
                {...register('description')}
                id="description"
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="プロジェクトの概要や目的を説明してください..."
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>
              )}
            </div>

            {/* ステータス */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-2">
                プロジェクトステータス <span className="text-red-400">*</span>
              </label>
              <select
                {...register('status')}
                id="status"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="draft">📝 下書き（Draft）</option>
                <option value="active">✅ アクティブ（Active）</option>
                <option value="suspended">⏸️ 一時停止（Suspended）</option>
              </select>
              {errors.status && (
                <p className="mt-2 text-sm text-red-400">{errors.status.message}</p>
              )}
              <p className="mt-2 text-sm text-gray-400">
                下書き: プロジェクトを非公開で準備 | アクティブ: 公開して支援を受け取り可能 |
                一時停止: 一時的に非公開
              </p>
            </div>
          </div>
        </div>

        {/* 寄付の使い道 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">🎯 寄付の使い道</h2>
          <p className="text-sm text-gray-400 mb-4">
            寄付者に向けて、寄付がどのように使われるかを説明する項目を設定できます（任意）
          </p>

          <div className="space-y-4">
            {donationUsages.map((usage, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-300">
                    項目 {index + 1}
                  </label>
                  {donationUsages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDonationUsage(index)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      削除
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={usage}
                    onChange={e => updateDonationUsage(index, e.target.value)}
                    placeholder="例: 新機能の開発と改善"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-16"
                    maxLength={40}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                    {usage.length}/40
                  </div>
                </div>
              </div>
            ))}

            {donationUsages.length < 10 && (
              <button
                type="button"
                onClick={addDonationUsage}
                className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 px-4 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>項目を追加 ({donationUsages.length}/10)</span>
              </button>
            )}

            {/* プレビュー */}
            {donationUsages.some(usage => usage.trim()) && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-4">
                <h3 className="text-blue-400 font-semibold mb-2">プレビュー</h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  {donationUsages
                    .filter(usage => usage.trim())
                    .map((usage, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-400 mr-2">•</span>
                        <span>{usage}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!isValid || !isDirty || isSubmitting}
            className="px-8 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>更新中...</span>
              </>
            ) : (
              <span>プロジェクトを更新</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
