'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import WalletLinkStepper from '@/components/WalletLinkStepper'
import Header from '@/components/Header'
import { useAuth } from '@/lib/firebase/auth-context'

export default function Home() {
  const { user, loading, currentMode } = useAuth()

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

  // 未ログインユーザー向けのランディングページ
  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">OSSトークンプラットフォーム</h1>
            <p className="text-gray-300 text-lg">
              GitHubとXRPLを連携したOSSトークン化プラットフォームへようこそ
            </p>
          </div>
          <WalletLinkStepper />
        </div>
      </main>
    </>
  )
}
