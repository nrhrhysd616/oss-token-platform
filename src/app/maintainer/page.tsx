'use client'

import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { GitHubAppSetup } from '@/components/GitHubAppSetup'
import { useMaintainerStats } from '@/hooks/useStats'

export default function MaintainerDashboard() {
  const { user, currentMode, loading } = useAuth()
  const { primaryWallet, isLoading: walletLoading } = useWallet()
  const { stats, loading: statsLoading, error: statsError } = useMaintainerStats()
  const router = useRouter()

  // 取引確認リンクを開く関数
  const handleTransactionClick = (txHash: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    window.open(
      `${process.env.NEXT_PUBLIC_XRPL_EXPLORER_BASE_URL}transactions/${txHash}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  useEffect(() => {
    if (!loading && !walletLoading) {
      if (!user) {
        router.push('/')
        return
      }

      if (!primaryWallet) {
        router.push('/')
        return
      }

      if (currentMode !== 'maintainer') {
        router.push('/donor')
        return
      }
    }
  }, [user, currentMode, primaryWallet, loading, walletLoading, router])

  if (loading || walletLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!user || !primaryWallet || currentMode !== 'maintainer') {
    return null
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">🛠 OSS管理者ダッシュボード</h1>
              <p className="text-gray-300">プロジェクト管理と収益分析</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">ウォレット</p>
                <p className="text-white font-mono text-sm">{primaryWallet.address}</p>
              </div>
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">🛠</span>
              </div>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">管理プロジェクト</p>
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-600 h-8 w-12 rounded"></div>
                ) : statsError ? (
                  <p className="text-2xl font-bold text-red-400">エラー</p>
                ) : (
                  <p className="text-2xl font-bold text-white">{stats?.projectCount || 0}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-400 text-xl">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">総受取額</p>
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-600 h-8 w-20 rounded"></div>
                ) : statsError ? (
                  <p className="text-2xl font-bold text-red-400">エラー</p>
                ) : (
                  <p className="text-2xl font-bold text-white">
                    {stats?.totalReceivedXrpAmount?.toFixed(2) || '0'} XRP
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
                <p className="text-gray-400 text-sm">支援者数</p>
                {statsLoading ? (
                  <div className="animate-pulse bg-gray-600 h-8 w-12 rounded"></div>
                ) : statsError ? (
                  <p className="text-2xl font-bold text-red-400">エラー</p>
                ) : (
                  <p className="text-2xl font-bold text-white">
                    {stats?.totalSupportersCount || 0}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-orange-400 text-xl">👥</span>
              </div>
            </div>
          </div>
        </div>

        {/* GitHub App設定 */}
        <div className="mb-8">
          <GitHubAppSetup />
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* プロジェクト管理 */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📦 プロジェクト管理</h2>
            <p className="text-gray-300 mb-6">OSSプロジェクトを登録してトークン化しましょう</p>
            <div className="space-y-4">
              <div className="border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">新規プロジェクト登録</h3>
                    <p className="text-gray-400 text-sm">GitHubリポジトリをトークン化</p>
                  </div>
                  <Link
                    href="/maintainer/projects/new"
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors inline-block"
                  >
                    登録する
                  </Link>
                </div>
              </div>
              <div className="border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">プロジェクト一覧</h3>
                    <p className="text-gray-400 text-sm">登録済みプロジェクトの管理</p>
                  </div>
                  <Link
                    href="/maintainer/projects"
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors inline-block"
                  >
                    管理する
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 収益分析 */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📊 収益分析</h2>
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">📈</span>
                </div>
                <p className="text-gray-400">収益分析機能は有効化されていません</p>
                <p className="text-gray-500 text-sm mt-2">
                  Coming soon: プロジェクトごとの収益分析を提供予定です
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 最近の寄付 */}
        <div className="mt-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">💝 最近の寄付</h2>
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
                  <Link
                    key={index}
                    href={`/maintainer/projects/${donation.projectId}`}
                    className="block border border-gray-600 rounded-lg p-4 hover:border-gray-500 hover:bg-gray-750 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{donation.projectName}</h3>
                        <p className="text-gray-400 text-sm">
                          {donation.xrpAmount.toFixed(2)} XRP の寄付を受け取りました
                        </p>
                        <p className="text-gray-500 text-xs">
                          寄付者: {donation.donorAddress.slice(0, 8)}...
                          {donation.donorAddress.slice(-8)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(donation.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <div className="text-right flex flex-col space-y-2">
                        <button
                          onClick={handleTransactionClick(donation.txHash)}
                          className="text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                          取引を確認
                        </button>
                        <span className="text-gray-500 text-xs">クリックで詳細表示</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-gray-400 text-2xl">💝</span>
                  </div>
                  <p className="text-gray-400">まだ寄付を受け取ってnません</p>
                  <p className="text-gray-500 text-sm mt-2">
                    プロジェクトを登録して公開すると、寄付を受け取ることができます
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
