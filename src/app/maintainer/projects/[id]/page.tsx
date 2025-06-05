'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/firebase/auth-context'
import { MaintainerProject } from '@/types/project'
import { formatDateJP, formatDateTimeJP } from '@/lib/firebase/utils'

type MaintainerProjectResponse = {
  project: MaintainerProject
}

export default function MaintainerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { user } = useAuth()
  const [project, setProject] = useState<MaintainerProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = async () => {
    if (!user) return

    try {
      setLoading(true)
      const token = await user.getIdToken()

      const response = await fetch(`/api/management/projects/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('プロジェクトが見つかりません')
        } else if (response.status === 403) {
          throw new Error('このプロジェクトにアクセスする権限がありません')
        }
        throw new Error('プロジェクトの取得に失敗しました')
      }

      const data: MaintainerProjectResponse = await response.json()
      setProject(data.project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [user, id])

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    }

    const labels = {
      draft: '下書き',
      active: '公開中',
      suspended: '停止中',
    }

    return (
      <span
        className={`px-3 py-1 text-sm rounded-md border ${styles[status as keyof typeof styles]}`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-4"></div>
              <p className="text-gray-400">プロジェクトを読み込み中...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-6 rounded-md">
              <h2 className="text-xl font-semibold mb-2">エラー</h2>
              <p>{error}</p>
              <Link
                href="/maintainer/projects"
                className="mt-4 inline-block bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-md font-medium transition-colors"
              >
                プロジェクト一覧に戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link
              href="/maintainer/projects"
              className="text-gray-400 hover:text-white mb-4 inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              プロジェクト一覧に戻る
            </Link>
            <div className="flex items-center space-x-4 mb-2">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-gray-400">{project.description}</p>
          </div>
          <div className="flex space-x-3">
            <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors">
              編集
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* メイン情報 */}
          <div className="lg:col-span-2 space-y-6">
            {/* プロジェクト基本情報 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">プロジェクト情報</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    GitHubリポジトリ
                  </label>
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:text-yellow-300 flex items-center"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                    {project.githubOwner}/{project.githubRepo}
                    <svg
                      className="w-4 h-4 ml-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>

                {project.tokenCode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      トークンコード
                    </label>
                    <div className="text-yellow-400 font-mono text-lg">{project.tokenCode}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">作成日</label>
                    <div className="text-white">{formatDateJP(project.createdAt)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">最終更新</label>
                    <div className="text-white">{formatDateJP(project.updatedAt)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 寄付履歴 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">最近の寄付</h2>
              {project.stats.recentDonations.length > 0 ? (
                <div className="space-y-3">
                  {project.stats.recentDonations.map((donation, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-800 rounded-md"
                    >
                      <div>
                        <div className="font-mono text-sm text-gray-400">
                          {donation.donorAddress.slice(0, 8)}...{donation.donorAddress.slice(-8)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateTimeJP(donation.timestamp)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-semibold">{donation.amount} XRP</div>
                        <a
                          href={`https://testnet.xrpl.org/transactions/${donation.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-gray-300"
                        >
                          TX: {donation.txHash.slice(0, 8)}...
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">まだ寄付がありません</p>
              )}
            </div>
          </div>

          {/* サイドバー統計 */}
          <div className="space-y-6">
            {/* 統計カード */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">統計情報</h2>
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-800 rounded-md">
                  <div className="text-2xl font-bold text-yellow-400">
                    {project.stats.totalDonations} XRP
                  </div>
                  <div className="text-sm text-gray-400">総寄付額</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-gray-800 rounded-md">
                    <div className="text-lg font-semibold text-white">
                      {project.stats.donorCount}
                    </div>
                    <div className="text-xs text-gray-400">寄付者数</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800 rounded-md">
                    <div className="text-lg font-semibold text-white">
                      {project.stats.currentPrice}
                    </div>
                    <div className="text-xs text-gray-400">現在価格</div>
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-800 rounded-md">
                  <div className="text-xl font-bold text-green-400">
                    {project.stats.tokenSupply.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400">発行済みトークン</div>
                </div>
              </div>
            </div>

            {/* アクション */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">アクション</h2>
              <div className="space-y-3">
                <button className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors">
                  プロジェクト設定
                </button>
                <button className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors">
                  寄付履歴をエクスポート
                </button>
                {project.status === 'active' && (
                  <Link
                    href={`/donor/projects/${project.id}`}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors block text-center"
                  >
                    公開ページを表示
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
