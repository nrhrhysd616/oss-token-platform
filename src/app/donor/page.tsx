'use client'

import { useAuth } from '@/lib/firebase/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { useDonorStats } from '@/hooks/useStats'

export default function DonorDashboard() {
  const { user, currentMode, loading } = useAuth()
  const { stats, loading: statsLoading, error: statsError } = useDonorStats()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        console.error('User not authenticated')
        router.push('/')
        return
      }

      if (currentMode !== 'donor') {
        router.push('/maintainer')
        return
      }
    }
  }, [user, currentMode, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user || currentMode !== 'donor') {
    return null
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">🎁 寄付者ダッシュボード</h1>
              <p className="text-gray-300">OSSプロジェクトへの寄付とトークン管理</p>
            </div>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">🎁</span>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">総寄付額</p>
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-600 h-8 w-20 rounded"></div>
                ) : statsError ? (
                  <p className="text-2xl font-bold text-red-400">エラー</p>
                ) : (
                  <p className="text-2xl font-bold text-white">
                    {stats?.totalDonationXrpAmount?.toFixed(2) || '0'} XRP
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-blue-400 text-xl">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">受け取ったトークンの種類</p>
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-600 h-8 w-12 rounded"></div>
                ) : statsError ? (
                  <p className="text-2xl font-bold text-red-400">エラー</p>
                ) : (
                  <p className="text-2xl font-bold text-white">{stats?.tokenTypesCount || 0}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-400 text-xl">🪙</span>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* プロジェクト探索 */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">🔍 プロジェクトを探索</h2>
            <p className="text-gray-300 mb-6">
              支援したいOSSプロジェクトを見つけて寄付を行いましょう
            </p>
            <div className="space-y-4">
              <div className="border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">プロジェクト一覧</h3>
                    <p className="text-gray-400 text-sm">登録されているOSSプロジェクトを閲覧</p>
                  </div>
                  <Link
                    href="/donor/projects"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    探索する
                  </Link>
                </div>
              </div>
              <div className="border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">人気プロジェクト</h3>
                    <p className="text-gray-400 text-sm">寄付額の多いプロジェクトをチェック</p>
                  </div>
                  {/* TODO: 人気プロジェクトページを作成次第リンク付け */}
                  <button
                    // href="/donor/projects"
                    disabled
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-not-allowed"
                  >
                    見る
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 最近の活動 */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📈 最近の活動</h2>
            <div className="space-y-4">
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-600 h-4 w-3/4 rounded mb-2"></div>
                      <div className="bg-gray-600 h-3 w-1/2 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : statsError ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-400 text-2xl">⚠️</span>
                  </div>
                  <p className="text-red-400">データの取得に失敗しました</p>
                </div>
              ) : stats?.recentDonations && stats.recentDonations.length > 0 ? (
                stats.recentDonations.map((donation, index) => (
                  <div key={index} className="border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{donation.projectName}</h3>
                        <p className="text-gray-400 text-sm">
                          {donation.xrpAmount.toFixed(2)} XRP を寄付
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(donation.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <div className="text-right">
                        <a
                          href={`${process.env.NEXT_PUBLIC_XRPL_EXPLORER_BASE_URL}transactions/${donation.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          取引を確認
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-gray-400 text-2xl">📊</span>
                  </div>
                  <p className="text-gray-400">まだ寄付履歴がありません</p>
                  <p className="text-gray-500 text-sm mt-2">
                    プロジェクトに寄付すると、ここに履歴が表示されます
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 受け取ったトークン */}
        <div className="mt-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">🪙 受け取ったトークン</h2>
            {statsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="bg-gray-600 h-5 w-32 rounded mb-2"></div>
                        <div className="bg-gray-600 h-4 w-24 rounded mb-1"></div>
                        <div className="bg-gray-600 h-3 w-20 rounded"></div>
                      </div>
                      <div className="bg-gray-600 h-8 w-20 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : statsError ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-400 text-2xl">⚠️</span>
                </div>
                <p className="text-red-400">トークン情報の取得に失敗しました</p>
              </div>
            ) : stats?.receivedTokens && stats.receivedTokens.length > 0 ? (
              <div className="space-y-4">
                {stats.receivedTokens.map((token, index) => (
                  <Link
                    key={index}
                    href={`/donor/projects/${token.projectId}`}
                    className="block border border-gray-600 rounded-lg p-4 hover:border-gray-500 hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {token.tokenCode.substring(0, 2)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{token.tokenCode}</h3>
                            <p className="text-gray-400 text-sm">{token.projectName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>受信量: {token.totalAmount.toFixed(6)}</span>
                          <span>取引回数: {token.transactionCount}回</span>
                          <span>
                            最終受取: {new Date(token.lastReceivedAt).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white mb-1">
                          {token.totalAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">{token.tokenCode}</div>
                      </div>
                    </div>
                  </Link>
                ))}

                {/* 統計サマリー */}
                <div className="mt-6 pt-4 border-t border-gray-600">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-400">
                        {stats.tokenTypesCount}
                      </div>
                      <div className="text-sm text-gray-400">トークン種類</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">
                        {stats.receivedTokens.reduce(
                          (sum, token) => sum + token.transactionCount,
                          0
                        )}
                      </div>
                      <div className="text-sm text-gray-400">総取引回数</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">🪙</span>
                </div>
                <p className="text-gray-400">まだトークンを受け取っていません</p>
                <p className="text-gray-500 text-sm mt-2">
                  プロジェクトに寄付すると、トークンを受け取ることができます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
