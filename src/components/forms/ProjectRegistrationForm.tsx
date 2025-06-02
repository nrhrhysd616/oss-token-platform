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
import { projectRegistrationSchema, ProjectRegistrationFormData } from '@/validations/project'
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

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
  } = useForm<ProjectRegistrationFormData>({
    resolver: zodResolver(projectRegistrationSchema),
    mode: 'onChange',
  })

  // 登録済みプロジェクトを取得する関数
  const fetchRegisteredProjects = async () => {
    if (!user) return

    setRegisteredProjectsLoading(true)
    try {
      const response = await fetch(`/api/projects?ownerUid=${user.uid}`, {
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
    console.debug('Checking if repository is registered:', repository)
    console.debug('Registered projects:', registeredProjects)
    return registeredProjects.some(
      project =>
        project.repositoryUrl === repository.htmlUrl ||
        (project.githubOwner === repository.owner.login && project.githubRepo === repository.name)
    )
  }

  // 利用可能なリポジトリと登録済みリポジトリを分離
  const availableRepositories = allRepositories.filter(repo => !isRepositoryRegistered(repo))
  const registeredRepositories = allRepositories.filter(repo => isRepositoryRegistered(repo))

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
  }

  const onSubmit = async (data: ProjectRegistrationFormData) => {
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
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          ...data,
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
