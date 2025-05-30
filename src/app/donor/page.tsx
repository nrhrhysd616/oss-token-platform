'use client'

import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DonorDashboard() {
  const { user, currentMode, loading } = useAuth()
  const { primaryWallet, isLoading: walletLoading } = useWallet()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !walletLoading) {
      if (!user) {
        console.error('User not authenticated')
        router.push('/')
        return
      }

      if (!primaryWallet) {
        console.error('Primary wallet not found', primaryWallet)
        router.push('/')
        return
      }

      if (currentMode !== 'donor') {
        router.push('/maintainer')
        return
      }
    }
  }, [user, currentMode, primaryWallet, loading, walletLoading, router])

  if (loading || walletLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user || !primaryWallet || currentMode !== 'donor') {
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
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">ウォレット</p>
                <p className="text-white font-mono text-sm">
                  {primaryWallet.address.slice(0, 8)}...{primaryWallet.address.slice(-6)}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">🎁</span>
              </div>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">総寄付額</p>
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
                <p className="text-gray-400 text-sm">保有トークン種類</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-400 text-xl">🪙</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">支援プロジェクト数</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-purple-400 text-xl">📦</span>
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
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    探索する
                  </button>
                </div>
              </div>
              <div className="border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">人気プロジェクト</h3>
                    <p className="text-gray-400 text-sm">寄付額の多いプロジェクトをチェック</p>
                  </div>
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
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
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">📊</span>
                </div>
                <p className="text-gray-400">まだ寄付履歴がありません</p>
                <p className="text-gray-500 text-sm mt-2">
                  プロジェクトに寄付すると、ここに履歴が表示されます
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 保有トークン */}
        <div className="mt-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">🪙 保有トークン</h2>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">🪙</span>
              </div>
              <p className="text-gray-400">まだトークンを保有していません</p>
              <p className="text-gray-500 text-sm mt-2">
                プロジェクトに寄付すると、トークンを受け取ることができます
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
