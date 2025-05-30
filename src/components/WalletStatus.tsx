'use client'

import type { Wallet } from '@/types/user'

type WalletStatusProps = {
  wallet: Wallet | null
  isLoading: boolean
}

export default function WalletStatus({ wallet, isLoading }: WalletStatusProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-gray-300">ウォレット情報を読み込み中...</span>
        </div>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
          <span className="text-gray-300">ウォレット未連携</span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          XRPLウォレットを連携してトークンの受け取りを開始しましょう
        </p>
      </div>
    )
  }

  const formatDate = (date: any): string => {
    try {
      let dateObj: Date

      if (date && typeof date === 'object' && '_seconds' in date) {
        // Firestoreのタイムスタンプ形式の場合
        dateObj = new Date(date._seconds * 1000)
        console.log('Converted from Firestore timestamp:', dateObj)
      } else if (date instanceof Date) {
        dateObj = date
      } else if (typeof date === 'string') {
        dateObj = new Date(date)
      } else {
        console.warn('Unknown date format:', date)
        return '日時不明'
      }

      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date object:', dateObj)
        return '無効な日時'
      }

      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateObj)
    } catch (error) {
      console.error('Error in formatDate:', error)
      return 'フォーマットエラー'
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      {/* ステータス */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <span className="text-green-400 font-medium">ウォレット連携済み</span>
          {wallet.isPrimary && (
            <span className="ml-2 bg-blue-600 text-blue-100 text-xs px-2 py-1 rounded-full">
              プライマリ
            </span>
          )}
        </div>
      </div>

      {/* ウォレット情報 */}
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">
            ウォレットアドレス
          </label>
          <div className="flex items-center mt-1">
            <span className="font-mono text-sm text-gray-200">{wallet.address}</span>
            <button
              onClick={() => navigator.clipboard.writeText(wallet.address)}
              className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
              title="アドレスをコピー"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">連携日時</label>
          <p className="text-sm text-gray-200 mt-1">{formatDate(wallet.linkedAt)}</p>
        </div>

        {wallet.nickname && (
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide">ニックネーム</label>
            <p className="text-sm text-gray-200 mt-1">{wallet.nickname}</p>
          </div>
        )}
      </div>

      {/* アクション */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex space-x-2">
          <a
            href={`https://livenet.xrpl.org/accounts/${wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            XRPLエクスプローラーで確認
          </a>
        </div>
      </div>
    </div>
  )
}
