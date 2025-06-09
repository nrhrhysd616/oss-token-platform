'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { PublicProject } from '@/types/project'
import { formatDateJP } from '@/lib/firebase/utils'

type PublicProjectResponse = {
  project: PublicProject
}

export default function DonorProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<PublicProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [donationAmount, setDonationAmount] = useState('')

  const fetchProject = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/projects/${id}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('プロジェクトが見つかりません')
        } else if (response.status === 403) {
          throw new Error('このプロジェクトは公開されていません')
        }
        throw new Error('プロジェクトの取得に失敗しました')
      }

      const data: PublicProjectResponse = await response.json()
      setProject(data.project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [id])

  const handleDonation = () => {
    // TODO: 寄付機能を実装する必要があります
    // 優先度: 高 - プラットフォームの核となる機能
    // - ユーザーのウォレット連携確認
    // - XRPLトランザクションの作成
    // - 寄付トランザクションの送信
    // - トークンの発行と送付
    // - 寄付履歴の記録
    alert(`${donationAmount} XRPの寄付機能は後で実装されます`)
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
                href="/donor/projects"
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
            href="/donor/projects"
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
          <div className="mb-4">
            <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
            <p className="text-gray-400 text-lg">{project.description}</p>
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
                      プロジェクトトークン
                    </label>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-yellow-400 font-mono text-lg">
                            {project.tokenCode}
                          </div>
                          <div className="text-sm text-gray-400">
                            寄付するとこのトークンを受け取れます
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-yellow-400 font-semibold text-lg">
                            {project.stats.currentPrice} XRP
                          </div>
                          <div className="text-sm text-gray-400">現在価格</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">作成日</label>
                  <div className="text-white">{formatDateJP(project.createdAt)}</div>
                </div>
              </div>
            </div>

            {/* 価格チャート（プレースホルダー） */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">価格推移</h2>
              <div className="h-64 bg-gray-800 rounded-md flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-12 h-12 mx-auto mb-2 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  {/* TODO: 価格チャート表示機能を実装する必要があります */}
                  {/* 優先度: 中 - 寄付者向けの重要な情報表示機能 */}
                  {/* - Chart.jsやRechartsなどのライブラリを使用 */}
                  {/* - 価格履歴データの可視化 */}
                  {/* - リアルタイム価格更新 */}
                  <p className="text-gray-400">価格チャートは後で実装されます</p>
                </div>
              </div>
            </div>

            {/* プロジェクトの説明 */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">このプロジェクトについて</h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 leading-relaxed">{project.description}</p>
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
                  <h3 className="text-blue-400 font-semibold mb-2">寄付の使い道</h3>
                  {project.donationUsages && project.donationUsages.length > 0 ? (
                    <ul className="text-gray-300 text-sm space-y-1">
                      {project.donationUsages.map((usage, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-400 mr-2">•</span>
                          <span>{usage}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm">指定されていません</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* 寄付パネル */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">🎁 寄付する</h2>
              <div className="space-y-4">
                {/* 寄付の説明 */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-4">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <h3 className="text-blue-400 font-medium mb-1">寄付の流れ</h3>
                      <p className="text-gray-300 text-sm">
                        寄付ボタンを押すとXamanウォレットでの署名画面が表示されます。
                        任意のXRPLウォレットで寄付を実行できます。
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    寄付額 (XRP)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="10"
                    value={donationAmount}
                    onChange={e => setDonationAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  />
                </div>

                {donationAmount && parseFloat(donationAmount) > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                    <div className="text-sm text-gray-300">想定受け取りトークン数:</div>
                    <div className="text-yellow-400 font-semibold">
                      {(parseFloat(donationAmount) / project.stats.currentPrice).toFixed(2)}{' '}
                      {project.tokenCode}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDonation}
                  disabled={!donationAmount || parseFloat(donationAmount) <= 0}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black disabled:text-gray-400 px-4 py-3 rounded-md font-medium transition-colors"
                >
                  寄付する
                </button>

                <div className="text-xs text-gray-400 text-center">
                  XamanウォレットまたはXRPLウォレットが必要です
                </div>
              </div>
            </div>

            {/* 統計情報 */}
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
              </div>
            </div>

            {/* シェア */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">シェア</h2>
              <div className="space-y-3">
                {/* TODO: Twitterシェア機能を実装する必要があります */}
                {/* 優先度: 低 - ソーシャル機能の拡張 */}
                {/* - Twitter Web Intent APIの使用 */}
                {/* - プロジェクト情報を含むツイート文の生成 */}
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                  Twitterでシェア
                </button>
                {/* TODO: リンクコピー機能を実装する必要があります */}
                {/* 優先度: 低 - ユーザビリティ向上機能 */}
                {/* - Clipboard APIの使用 */}
                {/* - コピー完了の通知表示 */}
                <button className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors">
                  リンクをコピー
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
