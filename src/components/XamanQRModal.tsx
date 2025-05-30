'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { WalletLinkRequest } from '@/types/user'

type XamanQRModalProps = {
  isOpen: boolean
  onClose: () => void
  linkRequest: WalletLinkRequest | null
  onStatusCheck: (payloadUuid: string) => void
}

export default function XamanQRModal({
  isOpen,
  onClose,
  linkRequest,
  onStatusCheck,
}: XamanQRModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const isCheckingRef = useRef(false)

  // カウントダウンタイマー
  useEffect(() => {
    if (!linkRequest || !isOpen) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiresAt = linkRequest.expiresAt.getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setTimeLeft(remaining)

      if (remaining === 0) {
        onClose()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [linkRequest, isOpen, onClose])

  // 重複実行を防ぐステータスチェック関数
  const checkStatus = useCallback(async () => {
    if (!linkRequest || isCheckingRef.current) return

    isCheckingRef.current = true
    try {
      onStatusCheck(linkRequest.xamanPayloadUuid)
    } finally {
      // APIのレスポンス待機時間は実行しないように、少し遅延を入れて次のチェックを許可
      setTimeout(() => {
        isCheckingRef.current = false
      }, 500)
    }
  }, [linkRequest, onStatusCheck])

  // 定期的にステータスをチェック
  useEffect(() => {
    if (!linkRequest || !isOpen) {
      isCheckingRef.current = false
      return
    }

    // 初回チェック
    checkStatus()

    // 3秒ごとにチェック
    const interval = setInterval(checkStatus, 3000)

    return () => {
      clearInterval(interval)
      isCheckingRef.current = false
    }
  }, [linkRequest, isOpen, checkStatus])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (!isOpen || !linkRequest) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 text-gray-900">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">ウォレット連携</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* QRコード */}
        <div className="text-center mb-6">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
            <img
              src={linkRequest.qrData.qr_png}
              alt="Xaman QR Code"
              className="w-48 h-48 mx-auto"
            />
          </div>
          <p className="text-sm text-gray-600 mb-2">XamanアプリでQRコードをスキャンしてください</p>
          <p className="text-xs text-gray-500">
            残り時間: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
          </p>
        </div>

        {/* 手順 */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">連携手順:</h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-2 mt-0.5">
                1
              </span>
              Xamanアプリを開く
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-2 mt-0.5">
                2
              </span>
              QRコードをスキャン
            </li>
            <li className="flex items-start">
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-2 mt-0.5">
                3
              </span>
              署名を承認
            </li>
          </ol>
        </div>

        {/* 状態表示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            <span className="text-sm text-blue-700">署名を待機中...</span>
          </div>
        </div>

        {/* Xamanアプリのリンク */}
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">Xamanアプリをお持ちでない場合:</p>
          <div className="flex justify-center space-x-4">
            <a
              href="https://apps.apple.com/app/xaman/id1492302343"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 text-xs underline"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.xrpllabs.xumm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 text-xs underline"
            >
              Google Play
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
