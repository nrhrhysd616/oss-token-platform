/**
 * 寄付状態表示コンポーネント
 * トラストライン未設定やウォレット未連携時の注意事項を表示
 */

import { useState } from 'react'
import { TrustlineSetupModal } from './TrustlineSetupModal'
import { Wallet } from '@/types/user'

type DonationStatusAlertProps = {
  status: 'wallet-not-linked' | 'trustline-required' | 'ready' | 'loading'
  projectId: string
  wallet?: Wallet
  tokenCode?: string
  xrpBalance?: number
  tokenBalance?: number
  onTrustlineComplete?: () => void
}

export function DonationStatusAlert({
  status,
  projectId,
  wallet,
  tokenCode,
  xrpBalance,
  tokenBalance,
  onTrustlineComplete,
}: DonationStatusAlertProps) {
  const [showTrustlineModal, setShowTrustlineModal] = useState(false)

  const handleSetupTrustline = () => {
    setShowTrustlineModal(true)
  }

  const handleTrustlineModalClose = () => {
    setShowTrustlineModal(false)
    onTrustlineComplete?.()
  }

  if (status === 'loading') {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-md p-4 mb-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500 mr-3"></div>
          <span className="text-gray-300">寄付可能状態を確認中...</span>
        </div>
      </div>
    )
  }

  if (status === 'wallet-not-linked') {
    return (
      <div className="bg-orange-500/20 border border-orange-500/30 rounded-md p-4 mb-4">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div>
            <h3 className="text-orange-400 font-medium mb-1">ウォレット連携が必要です</h3>
            <p className="text-gray-300 text-sm mb-3">
              寄付するにはXamanウォレットとの連携が必要です。
            </p>
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              ウォレットを連携する
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'trustline-required') {
    return (
      <>
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-md p-4 mb-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <h3 className="text-yellow-400 font-medium mb-1">トラストライン設定が必要です</h3>
              <p className="text-gray-300 text-sm mb-3">
                寄付後に{tokenCode}
                トークンを受け取るためにはトラストラインを設定する必要があります。
              </p>
              <button
                onClick={handleSetupTrustline}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                トラストラインを設定する
              </button>
            </div>
          </div>
        </div>

        {showTrustlineModal && wallet && (
          <TrustlineSetupModal
            isOpen={showTrustlineModal}
            onClose={handleTrustlineModalClose}
            projectId={projectId}
            donorAddress={wallet.address}
            tokenCode={tokenCode}
          />
        )}
      </>
    )
  }

  if (status === 'ready') {
    return (
      <div className="bg-green-500/20 border border-green-500/30 rounded-md p-4 mb-4">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-green-400 font-medium mb-1">寄付準備完了</h3>
            <p className="text-gray-300 text-sm mb-2">
              連携されたウォレットアドレスにて、寄付後に{tokenCode}
              トークンが送付されます！
            </p>
            <div className="text-sm text-gray-400">
              <div>
                ウォレット: {wallet?.address.slice(0, 8)}...{wallet?.address.slice(-8)}
              </div>
              <div>XRP残高: {xrpBalance?.toFixed(2)} XRP</div>
              <div>
                {tokenCode}残高: {tokenBalance?.toFixed(2)} {tokenCode}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
