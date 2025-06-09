'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import WalletLinkStepper from '@/components/WalletLinkStepper'
import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import { useTheme } from '@/lib/theme-context'
import { UserRole } from '@/types/user'

export default function WalletRequiredPage() {
  const { user, userRoles, updateUserRoles, loading } = useAuth()
  const { primaryWallet, isLoading: walletLoading } = useWallet()
  const { colorTheme } = useTheme()
  const router = useRouter()
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

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
                {/* <div className="flex items-start">
                  <span className="text-green-400 mr-3 mt-1">✓</span>
                  <div>
                    <h3 className="text-white font-medium">トークン発行・管理</h3>
                    <p className="text-gray-400 text-sm">
                      プロジェクト専用トークンの発行と寄付者への配布を行います
                    </p>
                  </div>
                </div> */}
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

          {/* ウォレット連携ステッパー */}
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
            ) : (
              <WalletLinkStepper />
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
                {/* <div className="flex items-start">
                  <span className="text-blue-400 mr-2 mt-0.5">•</span>
                  <p>
                    <strong>いつでも連携解除可能:</strong>{' '}
                    必要に応じてウォレット連携を解除することができます
                  </p>
                </div> */}
                {/* <div className="flex items-start">
                  <span className="text-blue-400 mr-2 mt-0.5">•</span>
                  <p>
                    <strong>複数ウォレット対応:</strong>{' '}
                    複数のウォレットを連携して用途に応じて使い分けることも可能です
                  </p>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
