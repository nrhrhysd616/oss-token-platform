'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/firebase/auth-context'
import { MaintainerProject, ProjectStatus } from '@/types/project'
import { formatDateJP } from '@/lib/firebase/utils'

type ProjectsResponse = {
  projects: MaintainerProject[]
  total: number
  limit: number
  offset: number
}

export default function MaintainerProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<MaintainerProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  const fetchProjects = async () => {
    if (!user) return

    try {
      setLoading(true)
      const token = await user.getIdToken()

      const params = new URLSearchParams({
        limit: '20',
        offset: '0',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/management/projects?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('プロジェクトの取得に失敗しました')
      }

      const data: ProjectsResponse = await response.json()
      setProjects(data.projects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [user, statusFilter])

  const getStatusBadge = (status: ProjectStatus) => {
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
      <span className={`px-2 py-1 text-xs rounded-md border ${styles[status]}`}>
        {labels[status]}
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">プロジェクト管理</h1>
            <p className="text-gray-400">あなたが管理するプロジェクトの一覧です</p>
          </div>
          <Link
            href="/maintainer/projects/new"
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-md font-medium transition-colors"
          >
            新しいプロジェクトを作成
          </Link>
        </div>

        {/* フィルター */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`px-4 py-2 rounded-md transition-colors ${
                statusFilter === 'draft'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              下書き
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              公開中
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-4 py-2 rounded-md transition-colors ${
                statusFilter === 'suspended'
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              停止中
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* プロジェクト一覧 */}
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium mb-2">プロジェクトがありません</h3>
            <p className="text-gray-400 mb-6">最初のプロジェクトを作成してみましょう</p>
            <Link
              href="/maintainer/projects/new"
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-md font-medium transition-colors inline-block"
            >
              プロジェクトを作成
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/maintainer/projects/${project.id}`}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold truncate">{project.name}</h3>
                  {getStatusBadge(project.status)}
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{project.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-400">
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
                  </div>

                  {project.tokenCode && (
                    <div className="flex items-center text-yellow-400">
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
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                      トークン: {project.tokenCode}
                    </div>
                  )}

                  <div className="text-gray-500 text-xs">
                    作成日: {formatDateJP(project.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
