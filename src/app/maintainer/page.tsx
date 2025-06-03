'use client'

import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { GitHubAppSetup } from '@/components/GitHubAppSetup'
import { ToastManager } from '@/components/ToastManager'

export default function MaintainerDashboard() {
  const { user, currentMode, loading } = useAuth()
  const { primaryWallet, isLoading: walletLoading } = useWallet()
  const router = useRouter()

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
    <>
      <ToastManager />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">管理プロジェクト</p>
                  <p className="text-2xl font-bold text-white">0</p>
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
                  <p className="text-2xl font-bold text-white">0 XRP</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-blue-400 text-xl">💰</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">発行トークン</p>
                  <p className="text-2xl font-bold text-white">0</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-purple-400 text-xl">🪙</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">支援者数</p>
                  <p className="text-2xl font-bold text-white">0</p>
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
                  <p className="text-gray-400">まだ収益データがありません</p>
                  <p className="text-gray-500 text-sm mt-2">
                    プロジェクトを登録して寄付を受け取ると、ここに分析データが表示されます
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* トークン管理 */}
          <div className="mt-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">🪙 トークン管理</h2>
                <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                  新規トークン発行
                </button>
              </div>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">🪙</span>
                </div>
                <p className="text-gray-400">まだトークンを発行していません</p>
                <p className="text-gray-500 text-sm mt-2">
                  プロジェクトを登録すると、専用トークンを発行できます
                </p>
              </div>
            </div>
          </div>

          {/* 最近の寄付 */}
          <div className="mt-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">💝 最近の寄付</h2>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">💝</span>
                </div>
                <p className="text-gray-400">まだ寄付を受け取っていません</p>
                <p className="text-gray-500 text-sm mt-2">
                  プロジェクトを登録して公開すると、寄付を受け取ることができます
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
