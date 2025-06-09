'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/lib/firebase/auth-context'
import { useTheme } from '@/lib/theme-context'

export default function Home() {
  const { user, loading, currentMode, signInWithGithub } = useAuth()
  const { colorTheme } = useTheme()
  const router = useRouter()

  // カラーテーマに基づくスタイル
  const accentColor = colorTheme === 'red' ? 'text-red-500' : 'text-yellow-500'
  const buttonBg =
    colorTheme === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'
  const accentBg = colorTheme === 'red' ? 'bg-red-500/20' : 'bg-yellow-500/20'

  // ログイン済みユーザーで現在のモードがある場合はダッシュボードにリダイレクト
  // currentModeがnullの場合はリダイレクトしない（モード選択を促すため）
  useEffect(() => {
    if (!loading && user && currentMode) {
      router.push(`/${currentMode}`)
    }
  }, [user, currentMode, loading, router])

  // ローディング中の表示
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

  // ログイン済みユーザーで現在のモードがある場合はリダイレクト中
  if (user && currentMode) {
    return null
  }

  // ログイン済みだがモードが未設定の場合はモード選択に誘導
  if (user && !currentMode) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">ようこそ！</h1>
              <p className="text-gray-300 text-lg">
                GitHubログインが完了しました。
                <br />
                利用モードを選択してプラットフォームを開始しましょう。
              </p>
            </div>
            <div className="text-center">
              <a
                href="/mode-select"
                className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg"
              >
                モードを選択して開始
              </a>
            </div>
          </div>
        </main>
      </>
    )
  }

  // 未ログインユーザー向けのランディングページ
  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* ヒーローセクション */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">
              <span className="text-white">OSS</span>
              <span className={accentColor}>トークン</span>
              <span className="text-white">プラットフォーム</span>
            </h1>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto mb-8">
              オープンソースプロジェクトを支援し、独自トークンで価値を共有する
              <br />
              新しいエコシステムへようこそ
            </p>
            {!user && (
              <button
                onClick={signInWithGithub}
                className={`${buttonBg} text-black px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg`}
              >
                GitHubでログインして始める
              </button>
            )}
          </div>

          {/* 役割選択セクション */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* 寄付者向け */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 hover:border-blue-500/50 transition-colors">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-400 text-3xl">🎁</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">寄付者として参加</h2>
                <p className="text-gray-400">
                  OSSプロジェクトを支援して、独自トークンを受け取りましょう
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <span className="text-blue-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">簡単な寄付</h3>
                    <p className="text-gray-400 text-sm">ウォレット連携不要で気軽に寄付できます</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-blue-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">トークン受け取り</h3>
                    <p className="text-gray-400 text-sm">
                      寄付額に応じてプロジェクト独自のトークンを獲得
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-blue-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">価値の成長</h3>
                    <p className="text-gray-400 text-sm">
                      プロジェクトの成長とともにトークン価値も上昇
                    </p>
                  </div>
                </div>
              </div>

              {user ? (
                <Link
                  href="/donor"
                  className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors text-center"
                >
                  寄付者ダッシュボードへ
                </Link>
              ) : (
                <button
                  onClick={signInWithGithub}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  GitHubでログインして寄付を始める
                </button>
              )}
            </div>

            {/* OSSメンテナー向け */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 hover:border-green-500/50 transition-colors">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-400 text-3xl">🛠</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">OSSメンテナーとして参加</h2>
                <p className="text-gray-400">
                  あなたのプロジェクトをトークン化して寄付を募りましょう
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <span className="text-green-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">プロジェクト登録</h3>
                    <p className="text-gray-400 text-sm">GitHubリポジトリを簡単に登録・管理</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">独自トークン発行</h3>
                    <p className="text-gray-400 text-sm">
                      プロジェクト専用のXRPLトークンを自動発行
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">寄付管理</h3>
                    <p className="text-gray-400 text-sm">寄付の受け取りと履歴を一元管理</p>
                  </div>
                </div>
              </div>

              <div
                className={`${accentBg} border ${colorTheme === 'red' ? 'border-red-500/20' : 'border-yellow-500/20'} rounded-md p-3 mb-4`}
              >
                <div className="flex items-start">
                  <span
                    className={`${colorTheme === 'red' ? 'text-red-400' : 'text-yellow-400'} mr-2 mt-0.5`}
                  >
                    ⚠
                  </span>
                  <p
                    className={`${colorTheme === 'red' ? 'text-red-400' : 'text-yellow-400'} text-sm`}
                  >
                    <strong>ウォレット連携が必要:</strong>{' '}
                    寄付受け取り用のXRPLウォレット連携が必要です
                  </p>
                </div>
              </div>

              {user ? (
                <Link
                  href="/maintainer"
                  className="block w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors text-center"
                >
                  メンテナーダッシュボードへ
                </Link>
              ) : (
                <button
                  onClick={signInWithGithub}
                  className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  GitHubでログインしてプロジェクト登録
                </button>
              )}
            </div>
          </div>

          {/* 特徴セクション */}
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-8">プラットフォームの特徴</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div
                  className={`w-12 h-12 ${accentBg} rounded-lg flex items-center justify-center mx-auto mb-4`}
                >
                  <span
                    className={`${colorTheme === 'red' ? 'text-red-400' : 'text-yellow-400'} text-2xl`}
                  >
                    ⚡
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">高速・低コスト</h3>
                <p className="text-gray-400">XRPLネットワークを使用した高速かつ低コストな取引</p>
              </div>
              <div className="text-center">
                <div
                  className={`w-12 h-12 ${accentBg} rounded-lg flex items-center justify-center mx-auto mb-4`}
                >
                  <span
                    className={`${colorTheme === 'red' ? 'text-red-400' : 'text-yellow-400'} text-2xl`}
                  >
                    🔗
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">GitHub連携</h3>
                <p className="text-gray-400">GitHubリポジトリと直接連携した透明性の高いシステム</p>
              </div>
              <div className="text-center">
                <div
                  className={`w-12 h-12 ${accentBg} rounded-lg flex items-center justify-center mx-auto mb-4`}
                >
                  <span
                    className={`${colorTheme === 'red' ? 'text-red-400' : 'text-yellow-400'} text-2xl`}
                  >
                    🌱
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">持続可能な支援</h3>
                <p className="text-gray-400">トークンエコノミーによる長期的なOSS支援モデル</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
