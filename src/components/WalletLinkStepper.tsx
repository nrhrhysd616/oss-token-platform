'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { useWallet } from '@/hooks/useWallet'
import XamanQRModal from './XamanQRModal'
import WalletStatus from './WalletStatus'
import ModeSelector from './ModeSelector'

export default function WalletLinkStepper() {
  const { user, loading: authLoading, signInWithGithub, currentMode } = useAuth()
  const {
    primaryWallet,
    linkStatus,
    linkRequest,
    error,
    isLoading,
    createWalletLink,
    checkLinkStatus,
    clearError,
  } = useWallet()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showModeSelector, setShowModeSelector] = useState(false)

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

  const handleModeSelected = useCallback(() => {
    setShowModeSelector(false)
  }, [])

  // ローディング状態
  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-gray-300">認証状態を確認中...</span>
          </div>
        </div>
      </div>
    )
  }

  // 未ログイン状態
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-4">ウォレット連携</h2>
            <p className="text-gray-300 mb-6">
              XRPLウォレットを連携して
              <br />
              寄付者の方はOSSへの寄付・OSSトークンの受け取り
              <br />
              OSSメンテナーの方は寄付の受け取りや収入分析を開始しましょう
            </p>

            {/* ステップ表示 */}
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <span className="ml-2 text-sm text-gray-300">GitHubログイン</span>
                </div>
                <div className="w-8 h-0.5 bg-gray-600"></div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-600 text-gray-400 rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <span className="ml-2 text-sm text-gray-400">ウォレット連携</span>
                </div>
              </div>
            </div>

            <button
              onClick={signInWithGithub}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              GitHubでログイン
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ログイン済み・ウォレット連携済み
  if (primaryWallet) {
    // モード選択が必要な場合（初回連携時またはモード未設定時）
    if (showModeSelector || !currentMode) {
      return <ModeSelector onModeSelected={handleModeSelected} />
    }

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">セットアップ完了</h2>
            <p className="text-gray-300">
              ウォレット連携とモード設定が完了しました
              <br />
              現在のモード: {currentMode === 'donor' ? '🎁 寄付者' : '🛠 OSS管理者'}
            </p>
          </div>

          {/* ステップ表示 */}
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm text-green-400">GitHubログイン</span>
            </div>
            <div className="w-8 h-0.5 bg-green-500"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm text-green-400">ウォレット連携</span>
            </div>
            <div className="w-8 h-0.5 bg-green-500"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm text-green-400">モード設定</span>
            </div>
          </div>

          <WalletStatus wallet={primaryWallet} isLoading={isLoading} />

          {/* ダッシュボードへのリンク */}
          <div className="text-center">
            <button
              onClick={() => setShowModeSelector(true)}
              className="mr-4 text-gray-300 hover:text-white transition-colors text-sm"
            >
              モードを変更
            </button>
            <a
              href={`/${currentMode}`}
              className={`inline-block px-6 py-3 rounded-lg font-medium transition-colors ${
                currentMode === 'donor'
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {currentMode === 'donor' ? '寄付者ダッシュボードへ' : 'OSS管理者ダッシュボードへ'}
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ログイン済み・ウォレット未連携
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">ウォレット連携</h2>
            <p className="text-gray-300">XRPLウォレットを連携して寄付を受け取りましょう</p>
          </div>

          {/* ステップ表示 */}
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
                ✓
              </div>
              <span className="ml-2 text-sm text-green-400">GitHubログイン</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-600"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <span className="ml-2 text-sm text-blue-400">ウォレット連携</span>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
              {/* <li>• 複数のウォレットを連携することも可能です</li> */}
              <li>• 秘密鍵は当サービスで保存されません</li>
            </ul>
          </div>
        </div>
      </div>

      {/* QRモーダル */}
      <XamanQRModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        linkRequest={linkRequest}
        onStatusCheck={handleStatusCheck}
      />
    </div>
  )
}
