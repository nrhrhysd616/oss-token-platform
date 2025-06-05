/**
 * プロジェクト登録フォームコンポーネント
 */

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/firebase/auth-context'
import { projectCreateFormSchema, ProjectCreateFormData } from '@/validations/project'
import { useGitHubApp } from '@/hooks/useGitHubApp'
import { GitHubRepository } from '@/types/github'
import { Project } from '@/types/project'
import { setToastCookie } from '@/lib/toast-utils'

// Installation IDを含むリポジトリ型
type RepositoryWithInstallation = GitHubRepository & { installationId: number }

export default function ProjectRegistrationForm() {
  const { user } = useAuth()
  const router = useRouter()
  const { allRepositories, allRepositoriesLoading, fetchAllRepositories } = useGitHubApp()
  const [selectedRepository, setSelectedRepository] = useState<RepositoryWithInstallation | null>(
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredProjects, setRegisteredProjects] = useState<Project[]>([])
  const [registeredProjectsLoading, setRegisteredProjectsLoading] = useState(false)
  // 寄付の使い道を独立したstateで管理（文字列配列）
  const [donationUsages, setDonationUsages] = useState<string[]>([''])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
  } = useForm({
    resolver: zodResolver(projectCreateFormSchema),
    mode: 'onChange',
    defaultValues: {
      status: 'draft' as const,
      name: '',
      description: '',
      tokenCode: '',
      donationUsages: [],
    },
  })

  // 登録済みプロジェクトを取得する関数
  const fetchRegisteredProjects = async () => {
    if (!user) return

    setRegisteredProjectsLoading(true)
    try {
      const response = await fetch('/api/management/projects', {
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRegisteredProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to fetch registered projects:', error)
    } finally {
      setRegisteredProjectsLoading(false)
    }
  }

  // コンポーネント初期化時にすべてのリポジトリと登録済みプロジェクトを取得
  useEffect(() => {
    if (user) {
      fetchAllRepositories()
      fetchRegisteredProjects()
    }
  }, [user, fetchAllRepositories])

  // リポジトリが登録済みかどうかをチェックする関数
  const isRepositoryRegistered = (repository: RepositoryWithInstallation): boolean => {
    return registeredProjects.some(
      project =>
        project.repositoryUrl === repository.htmlUrl ||
        (project.githubOwner === repository.owner.login && project.githubRepo === repository.name)
    )
  }

  // 利用可能なリポジトリと登録済みリポジトリを分離
  const availableRepositories = allRepositories.filter(repo => !isRepositoryRegistered(repo))
  const registeredRepositories = allRepositories.filter(repo => isRepositoryRegistered(repo))

  // トークンコード自動生成関数
  const generateTokenCode = (projectName: string): string => {
    // プロジェクト名から英数字のみを抽出し、大文字に変換
    const cleanName = projectName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    // 最大10文字に制限
    return cleanName.substring(0, 10)
  }

  // トークンコード自動生成ボタンのハンドラー
  const handleGenerateTokenCode = () => {
    const currentName = watch('name')
    if (!currentName) {
      toast.error('プロジェクト名を入力してからトークンコードを生成してください')
      return
    }

    const generatedCode = generateTokenCode(currentName)
    setValue('tokenCode', generatedCode)
    toast.success('トークンコードを生成しました')
  }

  // リポジトリ選択時の処理
  const handleRepositorySelect = (repository: RepositoryWithInstallation) => {
    // 登録済みリポジトリは選択不可
    if (isRepositoryRegistered(repository)) {
      return
    }

    setSelectedRepository(repository)

    // リポジトリ名から自動でプロジェクト名を設定（未入力の場合）
    const currentName = watch('name')
    if (!currentName) {
      setValue('name', repository.name)
    }

    // リポジトリの説明から自動で説明を設定（未入力の場合）
    const currentDescription = watch('description')
    if (!currentDescription && repository.description) {
      setValue('description', repository.description)
    }

    // トークンコードを自動生成（未入力の場合）
    const currentTokenCode = watch('tokenCode')
    if (!currentTokenCode) {
      const generatedCode = generateTokenCode(repository.name)
      setValue('tokenCode', generatedCode)
    }
  }

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
    }
  }

  const updateDonationUsage = (index: number, value: string) => {
    const newUsages = [...donationUsages]
    newUsages[index] = value
    setDonationUsages(newUsages)
  }

  const onSubmit = async (data: ProjectCreateFormData) => {
    if (!user) {
      toast.error('ログインが必要です')
      return
    }

    if (!selectedRepository) {
      toast.error('有効なリポジトリを選択してください')
      return
    }

    setIsSubmitting(true)

    try {
      // 空の項目を除外した文字列配列を使用
      const filteredDonationUsages = donationUsages.filter(usage => usage.trim() !== '')

      const response = await fetch('/api/management/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          ...data,
          donationUsages: filteredDonationUsages,
          repositoryUrl: selectedRepository.htmlUrl,
          githubInstallationId: selectedRepository.installationId.toString(),
          githubOwner: selectedRepository.owner.login,
          githubRepo: selectedRepository.name,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'プロジェクトの登録に失敗しました')
      }

      const result = await response.json()

      // cookieに成功メッセージを保存
      setToastCookie('success', 'プロジェクトが正常に登録されました！')
      router.push('/maintainer')
    } catch (error) {
      console.error('Project registration error:', error)

      // cookieにエラーメッセージを保存
      const errorMessage =
        error instanceof Error ? error.message : 'プロジェクトの登録に失敗しました'
      setToastCookie('error', errorMessage)
      router.push('/maintainer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* リポジトリ選択 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">📁 リポジトリ選択</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GitHubリポジトリを選択 <span className="text-red-400">*</span>
              </label>
              {allRepositoriesLoading || registeredProjectsLoading ? (
                <div className="flex items-center space-x-3 text-gray-300 py-4">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                  <span>リポジトリ一覧を取得中...</span>
                </div>
              ) : allRepositories.length > 0 ? (
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {/* 利用可能なリポジトリ */}
                  {availableRepositories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-green-400">
                        📋 選択可能なリポジトリ
                      </h4>
                      {availableRepositories.map(repo => (
                        <div
                          key={repo.id}
                          onClick={() => handleRepositorySelect(repo)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedRepository?.id === repo.id
                              ? 'border-green-500 bg-green-900/20'
                              : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-white">{repo.fullName}</h3>
                              {repo.description && (
                                <p className="text-sm text-gray-300 mt-1">{repo.description}</p>
                              )}
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                                {repo.language && (
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                    <span>{repo.language}</span>
                                  </span>
                                )}
                                <span>⭐ {repo.stargazersCount}</span>
                                <span>🍴 {repo.forksCount}</span>
                                {repo.private && (
                                  <span className="text-yellow-400">🔒 Private</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 登録済みリポジトリ */}
                  {registeredRepositories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-orange-400">🚫 登録済みリポジトリ</h4>
                      {registeredRepositories.map(repo => (
                        <div
                          key={repo.id}
                          className="p-4 border border-gray-600 bg-gray-800/50 rounded-lg opacity-60 cursor-not-allowed"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium text-gray-400">{repo.fullName}</h3>
                                <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">
                                  登録済み
                                </span>
                              </div>
                              {repo.description && (
                                <p className="text-sm text-gray-500 mt-1">{repo.description}</p>
                              )}
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                {repo.language && (
                                  <span className="flex items-center space-x-1">
                                    <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                                    <span>{repo.language}</span>
                                  </span>
                                )}
                                <span>⭐ {repo.stargazersCount}</span>
                                <span>🍴 {repo.forksCount}</span>
                                {repo.private && <span className="text-gray-500">🔒 Private</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* リポジトリがない場合 */}
                  {availableRepositories.length === 0 && registeredRepositories.length === 0 && (
                    <div className="text-gray-400 py-4 text-center">
                      アクセス可能なリポジトリがありません。GitHub Appをインストールしてください。
                    </div>
                  )}

                  {/* 利用可能なリポジトリがない場合 */}
                  {availableRepositories.length === 0 && registeredRepositories.length > 0 && (
                    <div className="text-gray-400 py-4 text-center">
                      新規登録可能なリポジトリがありません。すべてのリポジトリが既に登録済みです。
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 py-4 text-center">
                  アクセス可能なリポジトリがありません。GitHub Appをインストールしてください。
                </div>
              )}
            </div>

            {/* 選択されたリポジトリの確認 */}
            {selectedRepository && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-green-400 mt-0.5">✅</div>
                  <div className="flex-1">
                    <p className="text-green-300 font-medium mb-2">選択されたリポジトリ</p>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p>
                        <span className="font-medium">リポジトリ:</span>{' '}
                        {selectedRepository.fullName}
                      </p>
                      <p>
                        <span className="font-medium">URL:</span>{' '}
                        <a
                          href={selectedRepository.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          {selectedRepository.htmlUrl}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* プロジェクト基本情報 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">📦 プロジェクト基本情報</h2>

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

            {/* トークンコード */}
            <div>
              <label htmlFor="tokenCode" className="block text-sm font-medium text-gray-300 mb-2">
                トークンコード <span className="text-red-400">*</span>
              </label>
              <div className="flex space-x-3">
                <input
                  {...register('tokenCode')}
                  type="text"
                  id="tokenCode"
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  placeholder="例: MYPROJECT"
                  style={{ textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  onClick={handleGenerateTokenCode}
                  // disabled={isGeneratingTokenCode}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2 whitespace-nowrap"
                >
                  <span>⚡</span>
                  <span>自動生成</span>
                </button>
              </div>
              {errors.tokenCode && (
                <p className="mt-2 text-sm text-red-400">{errors.tokenCode.message}</p>
              )}
              <p className="mt-2 text-sm text-gray-400">
                プロジェクト固有のトークン識別子（大文字英数字、最大10文字）
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
            disabled={!isValid || !selectedRepository || isSubmitting}
            className="px-8 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>登録中...</span>
              </>
            ) : (
              <span>プロジェクトを登録</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
