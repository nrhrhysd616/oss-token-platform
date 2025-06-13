'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import WalletLinkQRModal from '@/components/WalletLinkQRModal'
import WalletStatus from '@/components/WalletStatus'
import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import { useTheme } from '@/lib/theme-context'
import { UserRole } from '@/types/user'

export default function WalletRequiredPage() {
  const { user, userRoles, updateUserRoles, loading } = useAuth()
  const {
    primaryWallet,
    linkStatus,
    linkRequest,
    error,
    isLoading: walletLoading,
    createWalletLink,
    checkLinkStatus,
    clearError,
  } = useWallet()
  const { colorTheme } = useTheme()
  const router = useRouter()
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // カラーテーマに基づくスタイル
  const accentBg = colorTheme === 'red' ? 'bg-red-500/20' : 'bg-yellow-500/20'
  const accentBorder = colorTheme === 'red' ? 'border-red-500/20' : 'border-yellow-500/20'
  const accentText = colorTheme === 'red' ? 'text-red-400' : 'text-yellow-400'

  // ウォレット連携完了後の処理
  useEffect(() => {
    const handleWalletLinked = async () => {
      if (primaryWallet && user && !userRoles.includes('maintainer')) {
        setIsUpdatingRole(true)
        try {
          const newRoles: UserRole[] = ['donor', 'maintainer']
          await updateUserRoles(newRoles, 'maintainer')
          router.push('/maintainer')
        } catch (error) {
          console.error('ロール更新エラー:', error)
        } finally {
          setIsUpdatingRole(false)
        }
      } else if (primaryWallet && userRoles.includes('maintainer')) {
        router.push('/maintainer')
      }
    }

    if (!walletLoading && primaryWallet) {
      handleWalletLinked()
    }
  }, [primaryWallet, walletLoading, user, userRoles, updateUserRoles, router])

  const handleStartWalletLink = async () => {
    clearError()
    await createWalletLink()
    setIsModalOpen(true)
  }

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleStatusCheck = useCallback(
    (payloadUuid: string) => {
      checkLinkStatus(payloadUuid)
    },
    [checkLinkStatus]
  )

  // ローディング中
  if (loading || walletLoading) {
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

  // ウォレット連携済みの場合はリダイレクト
  if (primaryWallet && !isUpdatingRole) {
    return null
  }

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">
              🛠 OSS管理者モードにはウォレット連携が必要です
            </h1>
            <p className="text-gray-300 text-lg">
              受け付けた寄付を運営からXRPLを通して受け取るため、XRPLウォレットの連携が必須となります
            </p>
          </div>

          {/* 要件説明 */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className={`${accentBg} border ${accentBorder} rounded-lg p-6`}>
              <div className="flex items-start mb-4">
                <span className={`${accentText} text-2xl mr-3`}>⚠</span>
                <div>
                  <h2 className={`${accentText} text-xl font-bold mb-2`}>
                    なぜウォレット連携が必要なのか？
                  </h2>
                  <p className="text-gray-300">
                    受け付けた寄付を運営からXRPLを通して受け取るため、
                    XRPLネットワーク上でのウォレットアドレスが必要です。
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-green-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">寄付の受け取り</h3>
                    <p className="text-gray-400 text-sm">
                      運営から寄付金をXRPLを通してあなたのウォレットで受け取ります
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-green-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">透明性の確保</h3>
                    <p className="text-gray-400 text-sm">
                      すべての取引がXRPLブロックチェーン上で公開され、透明性が保たれます
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ウォレット連携セクション */}
          <div className="max-w-2xl mx-auto">
            {isUpdatingRole ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
                  <h3 className="text-white font-semibold mb-2">OSS管理者モードを設定中...</h3>
                  <p className="text-gray-300">
                    ウォレット連携が完了しました。OSS管理者ダッシュボードに移動します。
                  </p>
                </div>
              </div>
            ) : primaryWallet ? (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white mb-2">ウォレット連携完了</h2>
                  <p className="text-gray-300">
                    ウォレット連携が完了しました。OSS管理者ダッシュボードに移動します。
                  </p>
                </div>
                <WalletStatus wallet={primaryWallet} isLoading={walletLoading} />
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-2">XRPLウォレット連携</h2>
                    <p className="text-gray-300">
                      XamanアプリでQRコードをスキャンしてウォレットを連携してください
                    </p>
                  </div>

                  {/* エラー表示 */}
                  {error && (
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
                  )}

                  {/* ウォレット連携ボタン */}
                  <div className="text-center">
                    <button
                      onClick={handleStartWalletLink}
                      disabled={linkStatus === 'creating' || linkStatus === 'pending'}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      {linkStatus === 'creating' && 'QRコード生成中...'}
                      {linkStatus === 'pending' && 'ウォレット連携待機中...'}
                      {linkStatus === 'checking' && '連携状態確認中...'}
                      {(linkStatus === 'idle' || linkStatus === 'error') && 'ウォレットを連携する'}
                    </button>
                  </div>

                  {/* 説明 */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">ウォレット連携について</h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• XamanアプリでQRコードをスキャンして連携します</li>
                      <li>• 連携後、OSSプロジェクトへの寄付が連携されたウォレットに送金できます</li>
                      <li>• 秘密鍵は当サービスで保存されません</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 戻るリンク */}
          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/mode-select')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← モード選択に戻る
            </button>
          </div>

          {/* 補足情報 */}
          <div className="max-w-3xl mx-auto mt-12">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-white font-semibold mb-4">🔒 セキュリティについて</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start">
                  <span className="text-blue-400 mr-2 mt-0.5">•</span>
                  <p>
                    <strong>秘密鍵は保存されません:</strong>{' '}
                    当プラットフォームではウォレットの秘密鍵を保存することはありません
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="text-blue-400 mr-2 mt-0.5">•</span>
                  <p>
                    <strong>Xamanアプリを使用:</strong>{' '}
                    安全で信頼性の高いXamanアプリを通じてウォレット連携を行います
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* QRモーダル */}
      <WalletLinkQRModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        linkRequest={linkRequest}
        onStatusCheck={handleStatusCheck}
      />
    </>
  )
}
