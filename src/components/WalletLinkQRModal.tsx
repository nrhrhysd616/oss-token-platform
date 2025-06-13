'use client'

import { useEffect, useState } from 'react'
import { useXamanWebSocket } from '@/hooks/useXamanWebSocket'
import type { WalletLinkRequest } from '@/types/xaman'

type WalletLinkQRModalProps = {
  isOpen: boolean
  onClose: () => void
  linkRequest: WalletLinkRequest | null
  onStatusCheck: (payloadUuid: string) => void
}

export default function WalletLinkQRModal({
  isOpen,
  onClose,
  linkRequest,
  onStatusCheck,
}: WalletLinkQRModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [status, setStatus] = useState<'pending' | 'signed' | 'rejected' | 'expired'>('pending')
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  // WebSocket接続を使用してペイロード状況を監視
  const { isConnected, error } = useXamanWebSocket({
    payloadUuid: linkRequest?.xamanPayloadUuid || '',
    websocketUrl: linkRequest?.websocketUrl || '',
    onMessage: event => {
      console.log('WebSocket message received:', event)

      // expires_in_secondsイベントの処理
      if ('expires_in_seconds' in event) {
        console.log('⏰ Expires in seconds received:', event.expires_in_seconds)
        setTimeLeft(event.expires_in_seconds)
      }

      // 各種イベントの処理
      if ('opened' in event && event.opened) {
        console.log('📱 Payload opened in Xaman')
        setStatus('pending')
      } else if ('expired' in event && event.expired) {
        console.log('⏰ Wallet link expired')
        setStatus('expired')
        onClose()
      } else if ('signed' in event) {
        // XummWebsocketBody型の場合
        if (event.signed && 'txid' in event) {
          console.log('✅ Wallet link signed:', event)
          setStatus('signed')
          setTransactionHash(event.txid)
          // 署名完了時にステータスチェックを実行
          if (linkRequest?.xamanPayloadUuid) {
            onStatusCheck(linkRequest.xamanPayloadUuid)
          }
        } else if (!event.signed) {
          console.log('❌ Wallet link rejected')
          setStatus('rejected')
          onClose()
        }
      }
    },
    enabled:
      status !== 'signed' &&
      isOpen &&
      !!linkRequest?.xamanPayloadUuid &&
      !!linkRequest?.websocketUrl,
  })

  // フォールバック用のカウントダウンタイマー（WebSocketからexpires_in_secondsが来ない場合）
  useEffect(() => {
    if (!linkRequest || !isOpen) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiresAt = linkRequest.expiresAt.getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))

      // WebSocketからの値がない場合のみフォールバック計算を使用
      setTimeLeft(prevTimeLeft => {
        // WebSocketから値が来ている場合（prevTimeLeftが最近更新されている）は、そちらを優先
        if (prevTimeLeft !== null && prevTimeLeft > 0) {
          return Math.max(0, prevTimeLeft - 1)
        }
        return remaining
      })

      if (remaining === 0) {
        onClose()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [linkRequest, isOpen, onClose])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 接続状態に応じたステータスメッセージ
  const getStatusMessage = () => {
    if (error) {
      return `接続エラー: ${error}`
    }
    if (!isConnected) {
      return 'WebSocketに接続中...'
    }
    if (status === 'signed') {
      return '署名が完了しました！'
    }
    if (status === 'rejected') {
      return '署名がキャンセルされました'
    }
    if (status === 'expired') {
      return 'リクエストが期限切れです'
    }
    return '署名を待機中...'
  }

  // ステータスに応じたスタイル
  const getStatusStyle = () => {
    if (error || status === 'rejected') {
      return 'bg-red-50 border-red-200 text-red-700'
    }
    if (status === 'signed') {
      return 'bg-green-50 border-green-200 text-green-700'
    }
    if (status === 'expired') {
      return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    }
    return 'bg-blue-50 border-blue-200 text-blue-700'
  }

  // スピナーの表示条件
  const showSpinner = !isConnected || (isConnected && status === 'pending')

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
            <img src={linkRequest.qrPng} alt="Xaman QR Code" className="w-48 h-48 mx-auto" />
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
        <div className={`border rounded-lg p-3 mb-4 ${getStatusStyle()}`}>
          <div className="flex items-center">
            {showSpinner && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            )}
            <span className="text-sm">{getStatusMessage()}</span>
          </div>
          {/* WebSocket接続状態の詳細表示（デバッグ用） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs opacity-70">
              <div>WebSocket: {isConnected ? '接続済み' : '切断中'}</div>
              <div>ペイロード状態: {status}</div>
              <div>
                Enabled:{' '}
                {isOpen && !!linkRequest?.xamanPayloadUuid && !!linkRequest?.websocketUrl
                  ? 'true'
                  : 'false'}
              </div>
              <div>PayloadUUID: {linkRequest?.xamanPayloadUuid ? 'あり' : 'なし'}</div>
              <div>WebSocketURL: {linkRequest?.websocketUrl ? 'あり' : 'なし'}</div>
              {transactionHash && <div>TX Hash: {transactionHash}...</div>}
            </div>
          )}
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
