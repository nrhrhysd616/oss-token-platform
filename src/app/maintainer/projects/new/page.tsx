/**
 * プロジェクト登録ページ
 */

'use client'

import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import ProjectRegistrationForm from '@/components/forms/ProjectRegistrationForm'

export default function NewProjectPage() {
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
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#374151',
            color: '#fff',
            border: '1px solid #4B5563',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <div className="min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* ヘッダー */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={() => router.push('/maintainer')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← 戻る
              </button>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">📦 新規プロジェクト登録</h1>
              <p className="text-gray-300">
                GitHubリポジトリをトークン化して、支援を受け取れるようにしましょう
              </p>
            </div>
          </div>

          {/* フォーム */}
          <ProjectRegistrationForm />
        </div>
      </div>
    </>
  )
}
