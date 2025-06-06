'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/firebase/auth-context'
import { Project } from '@/types/project'
import ProjectEditForm from '@/components/forms/ProjectEditForm'

type ProjectResponse = {
  project: Project
}

export default function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
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
          throw new Error('このプロジェクトを編集する権限がありません')
        }
        throw new Error('プロジェクトの取得に失敗しました')
      }

      const data: ProjectResponse = await response.json()
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
        <div className="mb-8">
          <Link
            href={`/maintainer/projects/${id}`}
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
            プロジェクト詳細に戻る
          </Link>
          <div className="flex items-center space-x-4 mb-2">
            <h1 className="text-3xl font-bold">プロジェクト編集</h1>
          </div>
          <p className="text-gray-400">{project.name} の設定を編集できます</p>
        </div>

        {/* 編集フォーム */}
        <ProjectEditForm project={project} />
      </div>
    </div>
  )
}
