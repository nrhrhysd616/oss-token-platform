'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import AuthGuard from '@/components/AuthGuard'
import { useAuth } from '@/lib/firebase/auth-context'
import { useTheme } from '@/lib/theme-context'
import { getAccentClasses } from '@/lib/theme-utils'
import type { UserRole } from '@/types/user'

export default function ModeSelectPage() {
  const { user, userRoles, currentMode, switchMode, updateUserRoles, loading } = useAuth()
  const { colorTheme } = useTheme()
  const router = useRouter()
  const [selectedMode, setSelectedMode] = useState<UserRole>(currentMode || 'donor')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // カラーテーマに基づくスタイル
  const {
    text: accentText,
    bgOpacity: accentBg,
    borderOpacity: accentBorder,
  } = getAccentClasses(colorTheme)

  const handleModeSelect = async (mode: UserRole) => {
    if (!user) return

    setSelectedMode(mode)
    setError(null)
    setIsUpdating(true)

    try {
      if (userRoles.includes(mode)) {
        // 既存のロールの場合はモード切り替え
        const result = await switchMode(mode)
        if (result.success) {
          router.push(`/${mode}`)
        } else if (result.requiresWallet) {
          router.push('/wallet-required')
        } else {
          setError('モードの切り替えに失敗しました')
        }
      } else {
        // 新しいロールの場合は追加
        if (mode === 'maintainer') {
          // maintainerモードの場合、ウォレット連携ページに誘導
          router.push('/wallet-required')
        } else {
          const newRoles = [...userRoles, mode]
          await updateUserRoles(newRoles, mode)
          router.push(`/${mode}`)
        }
      }
    } catch (error) {
      console.error('モード選択エラー:', error)
      setError('モードの選択に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleContinueWithCurrent = () => {
    if (currentMode) {
      router.push(`/${currentMode}`)
    }
  }

  // ローディング中
  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-lg">読み込み中...</p>
            </div>
          </div>
        </main>
      </>
    )
  }

  // 未ログイン
  if (!user) {
    router.push('/')
    return null
  }

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">利用モードを選択</h1>
            <p className="text-gray-300">
              どちらのモードでプラットフォームをご利用になりますか？
              <br />
              後からいつでも変更することができます
            </p>
          </div>

          {error && (
            <div className="max-w-2xl mx-auto mb-6">
              <div className="bg-red-900 border border-red-700 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-red-400 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-red-300">{error}</span>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* 寄付者モード */}
              <div
                className={`border rounded-lg p-6 cursor-pointer transition-colors ${
                  selectedMode === 'donor'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedMode('donor')}
              >
                <div className="flex items-start mb-4">
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${
                        selectedMode === 'donor' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                      }`}
                    >
                      {selectedMode === 'donor' && (
                        <div className="w-3 h-3 bg-white rounded-full mx-auto mt-0.5"></div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      🎁 寄付者モード
                      {userRoles.includes('donor') && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                          設定済み
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-300 mb-4">
                      OSSプロジェクトへの寄付を行い、トークンを受け取ることができます
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">プロジェクト閲覧</h4>
                      <p className="text-gray-400 text-sm">
                        登録されたOSSプロジェクトの一覧と詳細を確認
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">寄付とトークン受け取り</h4>
                      <p className="text-gray-400 text-sm">
                        寄付額に応じてプロジェクト独自のトークンを獲得
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">履歴管理</h4>
                      <p className="text-gray-400 text-sm">寄付履歴と保有トークンの確認・管理</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">将来的に…</h4>
                      <p className="text-gray-400 text-sm">OSSのライセンスキー購入・管理</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                  <p className="text-blue-400 text-sm">
                    <strong>ウォレット連携:</strong>不要 (寄付時にXamanにて選択)
                  </p>
                </div>
              </div>

              {/* OSS管理者モード */}
              <div
                className={`border rounded-lg p-6 cursor-pointer transition-colors ${
                  selectedMode === 'maintainer'
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedMode('maintainer')}
              >
                <div className="flex items-start mb-4">
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${
                        selectedMode === 'maintainer'
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-400'
                      }`}
                    >
                      {selectedMode === 'maintainer' && (
                        <div className="w-3 h-3 bg-white rounded-full mx-auto mt-0.5"></div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      🛠 OSS管理者モード
                      {userRoles.includes('maintainer') && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                          設定済み
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-300 mb-4">
                      OSSプロジェクトを登録し、寄付の受け取りや収益分析を行えます
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start">
                    <span className="text-green-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">プロジェクト管理</h4>
                      <p className="text-gray-400 text-sm">GitHubリポジトリの登録・設定・更新</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">トークン発行</h4>
                      <p className="text-gray-400 text-sm">
                        プロジェクト専用のXRPLトークンを自動発行
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">収益分析</h4>
                      <p className="text-gray-400 text-sm">寄付の受け取り履歴と収益データの確認</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-400 mr-3 mt-1">✓</span>
                    <div>
                      <h4 className="text-white font-medium">将来的に…</h4>
                      <p className="text-gray-400 text-sm">ライセンスキーの自動発行</p>
                    </div>
                  </div>
                </div>

                <div className={`${accentBg} border ${accentBorder} rounded-md p-3`}>
                  <div className="flex items-start">
                    <span className={`${accentText} mr-2 mt-0.5`}>⚠</span>
                    <p className={`${accentText} text-sm`}>
                      <strong>ウォレット連携が必要:</strong>{' '}
                      寄付受け取り用のXRPLウォレット連携が必須です
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => handleModeSelect(selectedMode)}
                  disabled={isUpdating}
                  className={`w-full py-4 px-6 rounded-lg font-medium transition-colors text-lg ${
                    selectedMode === 'donor'
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  {isUpdating ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      設定中...
                    </div>
                  ) : (
                    `${selectedMode === 'donor' ? '寄付者' : 'OSS管理者'}モードで開始`
                  )}
                </button>

                {currentMode && (
                  <button
                    onClick={handleContinueWithCurrent}
                    className="w-full py-3 px-4 text-gray-300 hover:text-white transition-colors border border-gray-600 rounded-lg"
                  >
                    現在のモード（{currentMode === 'donor' ? '寄付者' : 'OSS管理者'}）で続行
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
