'use client'

import { useEffect, useState } from 'react'
import { useXamanWebSocket } from '@/hooks/useXamanWebSocket'
import type { DonationPayload, DonationRequest } from '@/types/donation'

type DonationQRModalProps = {
  isOpen: boolean
  onClose: () => void
  donationRequest: DonationRequest | null
  payload: DonationPayload | null
  onDonationCompleted: (txHash: string) => void
}

export default function DonationQRModal({
  isOpen,
  onClose,
  donationRequest,
  payload,
  onDonationCompleted,
}: DonationQRModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [status, setStatus] = useState<'pending' | 'signed' | 'rejected' | 'expired'>('pending')
  const [transactionHash, setTransactionHash] = useState<string | null>(null)

  // WebSocket接続を使用してペイロード状況を監視
  const { isConnected, error } = useXamanWebSocket({
    payloadUuid: donationRequest?.xamanPayloadUuid || '',
    websocketUrl: payload?.websocketUrl || '',
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
        console.log('⏰ Donation expired')
        setStatus('expired')
        setTimeout(() => onClose(), 2000) // 2秒後に自動で閉じる
      } else if ('signed' in event) {
        // XummWebsocketBody型の場合
        if (event.signed && 'txid' in event) {
          console.log('✅ Donation signed:', event)
          setStatus('signed')
          setTransactionHash(event.txid)
          // 寄付完了を親コンポーネントに通知
          onDonationCompleted(event.txid)
          onClose()
        } else if (!event.signed) {
          console.log('❌ Donation rejected')
          setStatus('rejected')
          setTimeout(() => onClose(), 2000) // 2秒後に自動で閉じる
        }
      }
    },
    enabled:
      status !== 'signed' &&
      isOpen &&
      !!donationRequest?.xamanPayloadUuid &&
      !!payload?.websocketUrl,
  })

  // フォールバック用のカウントダウンタイマー（WebSocketからexpires_in_secondsが来ない場合）
  useEffect(() => {
    if (!donationRequest || !isOpen) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiresAt = new Date(donationRequest.expiresAt).getTime()
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
        setStatus('expired')
        setTimeout(() => onClose(), 2000)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [donationRequest, isOpen, onClose])

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
    // signedのときはすぐモーダルを閉じるのでコメントアウト
    // if (status === 'signed') {
    //   return '寄付が完了しました！トークンの小切手が送付されます。トークンを受け取るためのCheckCashトランザクションをXamanから実行してください。'
    // }
    if (status === 'rejected') {
      return '寄付がキャンセルされました'
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
    // signedのときはすぐモーダルを閉じるのでコメントアウト
    // if (status === 'signed') {
    //   return 'bg-green-50 border-green-200 text-green-700'
    // }
    if (status === 'expired') {
      return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    }
    return 'bg-blue-50 border-blue-200 text-blue-700'
  }

  // スピナーの表示条件
  const showSpinner = !isConnected || (isConnected && status === 'pending')

  if (!isOpen || !donationRequest) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 text-gray-900">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">寄付の実行</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 寄付情報 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">寄付金額</div>
          <div className="text-2xl font-bold text-gray-900">{donationRequest.xrpAmount} XRP</div>
          {/* <div className="text-sm text-gray-600 mt-2"> */}
          {/* 受け取り予定トークン: {donationRequest.request.xrpAmount} トークン */}
          {/* TODO: 価格算出アルゴリズム実装後に動的計算に変更 */}
          {/* 現在は1:1の固定レートで表示 */}
          {/* </div> */}
        </div>

        {/* QRコード */}
        <div className="text-center mb-6">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
            <img src={payload?.qrPng} alt="Xaman QR Code" className="w-48 h-48 mx-auto" />
          </div>
          <p className="text-sm text-gray-600 mb-2">XamanアプリでQRコードをスキャンしてください</p>
          <p className="text-xs text-gray-500">
            残り時間: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
          </p>
        </div>

        {/* 手順 */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">寄付手順:</h3>
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
              寄付トランザクションを承認
            </li>
            <li className="flex items-start">
              <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-2 mt-0.5">
                4
              </span>
              トークンが自動発行されます
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
          {/* 成功時の詳細情報 */}
          {status === 'signed' && transactionHash && (
            <div className="mt-2 text-xs space-y-1">
              <div>トランザクション: {transactionHash.substring(0, 16)}...</div>
            </div>
          )}
          {/* WebSocket接続状態の詳細表示（デバッグ用） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs opacity-70">
              <div>WebSocket: {isConnected ? '接続済み' : '切断中'}</div>
              <div>ペイロード状態: {status}</div>
              <div>PayloadUUID: {donationRequest?.xamanPayloadUuid ? 'あり' : 'なし'}</div>
              <div>WebSocketURL: {payload?.websocketUrl ? 'あり' : 'なし'}</div>
            </div>
          )}
        </div>

        {/* 注意事項 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0"
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
              <h4 className="text-yellow-800 font-medium text-sm">重要</h4>
              <p className="text-yellow-700 text-xs mt-1">
                任意のXRPLウォレットで寄付できます。ウォレット連携は不要です。
                寄付完了後、トークンは自動的に発行され、CheckトランザクションとしてXRPLに記録されます。
              </p>
            </div>
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
