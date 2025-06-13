'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PublicProject } from '@/types/project'
import { PaginatedResult } from '@/services/shared/BaseService'

export default function DonorProjectsPage() {
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchProjects = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      // TODO: インデックスなど適切に設定次第、クエリパラメータを設定
      const response = await fetch(`/api/projects?${params}`)

      if (!response.ok) {
        throw new Error('プロジェクトの取得に失敗しました')
      }

      const data: PaginatedResult<PublicProject> = await response.json()
      setProjects(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // 検索フィルタリング
  // TODO: プロジェクト数が増えてくると、取ってきた50件のなかで検索しても仕方ないので、API側での検索機能を実装する
  const filteredProjects = projects.filter(
    project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.githubOwner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.githubRepo.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-white">OSS プロジェクトに</span>
            <span className="text-yellow-500">寄付しよう</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            オープンソースプロジェクトを支援して、独自トークンを受け取りましょう。
            あなたの寄付がプロジェクトの成長を支えます。
          </p>
        </div>

        {/* 検索バー */}
        <div className="mb-8">
          <div className="max-w-md mx-auto">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="プロジェクトを検索..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* プロジェクト一覧 */}
        {filteredProjects.length === 0 ? (
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium mb-2">
              {searchTerm ? '検索結果が見つかりません' : 'プロジェクトがありません'}
            </h3>
            <p className="text-gray-400">
              {searchTerm
                ? '別のキーワードで検索してみてください'
                : '公開されているプロジェクトがまだありません'}
            </p>
          </div>
        ) : (
          <>
            {/* 検索結果数 */}
            {searchTerm && (
              <div className="mb-6">
                <p className="text-gray-400">
                  「{searchTerm}」の検索結果: {filteredProjects.length}件
                </p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map(project => (
                <Link
                  key={project.id}
                  href={`/donor/projects/${project.id}`}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10 transition-all duration-200"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold mb-2 truncate">{project.name}</h3>
                    <p className="text-gray-400 text-sm line-clamp-3 mb-4">{project.description}</p>
                  </div>

                  <div className="space-y-3">
                    {/* GitHub情報 */}
                    <div className="flex items-center text-gray-400 text-sm">
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

                    {/* 統計情報 */}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800">
                      <div className="text-center">
                        <div className="text-yellow-400 font-semibold">
                          {project.stats.totalXrpDonations} XRP
                        </div>
                        <div className="text-xs text-gray-500">総寄付額</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-semibold">{project.stats.donorCount}</div>
                        <div className="text-xs text-gray-500">寄付者数</div>
                      </div>
                    </div>

                    {/* トークン情報 */}
                    {project.tokenCode && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-yellow-400 font-mono text-sm">
                              {project.tokenCode}
                            </div>
                            <div className="text-xs text-gray-400">トークン</div>
                          </div>
                          <div className="text-right">
                            <div className="text-yellow-400 font-semibold">
                              {project.stats.currentPrice} XRP
                            </div>
                            <div className="text-xs text-gray-400">現在価格</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 寄付ボタン */}
                    <div className="pt-2">
                      <div className="w-full bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-md font-medium transition-colors text-center">
                        🎁 寄付する
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* フッター情報 */}
        <div className="mt-16 text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">寄付の仕組み</h2>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-yellow-500 text-2xl mb-2">💰</div>
                <h3 className="font-semibold mb-2">XRPで寄付</h3>
                <p className="text-gray-400">
                  XRPLネットワークを使用して、簡単かつ低コストで寄付できます
                </p>
              </div>
              <div>
                <div className="text-yellow-500 text-2xl mb-2">🪙</div>
                <h3 className="font-semibold mb-2">トークンを受け取り</h3>
                <p className="text-gray-400">
                  寄付額に応じてプロジェクト独自のトークンを受け取れます
                </p>
              </div>
              <div>
                <div className="text-yellow-500 text-2xl mb-2">📈</div>
                <h3 className="font-semibold mb-2">価値の成長</h3>
                <p className="text-gray-400">
                  プロジェクトの成長とともにトークンの価値も上昇する可能性があります
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
