/**
 * トラストライン設定専用モーダルコンポーネント
 */

import { useState, useEffect } from 'react'
import { useXamanWebSocket } from '@/hooks/useXamanWebSocket'
import { useAuth } from '@/lib/firebase/auth-context'
import type { TrustlineSetupRequest } from '@/types/xaman'

type TrustlineSetupModalProps = {
  isOpen: boolean
  onClose: () => void
  projectId: string
  donorAddress: string
  tokenCode?: string
}

export function TrustlineSetupModal({
  isOpen,
  onClose,
  projectId,
  donorAddress,
  tokenCode,
}: TrustlineSetupModalProps) {
  const [trustlineRequest, setTrustlineRequest] = useState<TrustlineSetupRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [status, setStatus] = useState<'pending' | 'signed' | 'rejected' | 'expired'>('pending')

  // 認証状態を取得
  const { user } = useAuth()

  // WebSocket接続を使用してペイロード状況を監視
  const { isConnected, error: wsError } = useXamanWebSocket({
    payloadUuid: trustlineRequest?.xamanPayloadUuid || '',
    websocketUrl: trustlineRequest?.websocketUrl || '',
    onSigned: event => {
      console.log('Trustline setup signed:', event)
      setStatus('signed')
      // 少し待ってからモーダルを閉じる
      setTimeout(() => {
        onClose()
      }, 2000)
    },
    onRejected: event => {
      console.log('Trustline setup rejected:', event)
      setStatus('rejected')
      setTimeout(() => {
        onClose()
      }, 2000)
    },
    onExpired: event => {
      console.log('Trustline setup expired:', event)
      setStatus('expired')
      setTimeout(() => {
        onClose()
      }, 2000)
    },
    onOpened: event => {
      console.log('Trustline setup opened in Xaman:', event)
      setStatus('pending')
    },
    enabled: isOpen && !!trustlineRequest?.xamanPayloadUuid && !!trustlineRequest?.websocketUrl,
  })

  // トラストライン設定リクエストを作成
  const createTrustlineRequest = async () => {
    setLoading(true)
    setError(null)

    try {
      // ヘッダーを準備
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // ログインしている場合はBearerトークンを追加
      if (user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`
      }

      const response = await fetch('/api/xaman/trustline', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          donorAddress,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'トラストライン設定リクエストの作成に失敗しました')
      }

      const data = await response.json()

      // TrustlineSetupRequest形式に変換
      const req: TrustlineSetupRequest = {
        id: data.request.id,
        projectId: data.request.projectId,
        projectName: data.request.projectName,
        tokenCode: data.request.tokenCode,
        xamanPayloadUuid: data.xamanPayload.uuid,
        qrPng: data.xamanPayload.qrPng,
        websocketUrl: data.xamanPayload.websocketUrl,
        status: 'created',
        expiresAt: new Date(data.request.expiresAt),
        createdAt: new Date(),
      }

      setTrustlineRequest(req)
    } catch (error) {
      console.error('Trustline request creation error:', error)
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // モーダルが開かれたときにリクエストを作成
  useEffect(() => {
    if (isOpen && !trustlineRequest && !loading) {
      createTrustlineRequest()
    }
  }, [isOpen])

  // カウントダウンタイマー
  useEffect(() => {
    if (!trustlineRequest || !isOpen) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiresAt = trustlineRequest.expiresAt.getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setTimeLeft(remaining)

      if (remaining === 0) {
        setStatus('expired')
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [trustlineRequest, isOpen, onClose])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 接続状態に応じたステータスメッセージ
  const getStatusMessage = () => {
    if (error) {
      return `エラー: ${error}`
    }
    if (wsError) {
      return `接続エラー: ${wsError}`
    }
    if (loading) {
      return 'リクエストを作成中...'
    }
    if (!isConnected && trustlineRequest) {
      return 'WebSocketに接続中...'
    }
    if (status === 'signed') {
      return 'トラストライン設定が完了しました！'
    }
    if (status === 'rejected') {
      return 'トラストライン設定がキャンセルされました'
    }
    if (status === 'expired') {
      return 'リクエストが期限切れです'
    }
    return 'トラストライン設定の署名を待機中...'
  }

  // ステータスに応じたスタイル
  const getStatusStyle = () => {
    if (error || wsError || status === 'rejected') {
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
  const showSpinner =
    loading || (!isConnected && trustlineRequest) || (isConnected && status === 'pending')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 text-gray-900">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">トラストライン設定</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 説明 */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            {tokenCode}トークンを受け取るためのトラストライン設定を行います。
          </p>
          <p className="text-xs text-gray-500">
            この操作により、あなたのウォレットで{tokenCode}トークンを保持できるようになります。
          </p>
        </div>

        {/* QRコード */}
        {trustlineRequest && (
          <div className="text-center mb-6">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
              <img src={trustlineRequest.qrPng} alt="Xaman QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-sm text-gray-600 mb-2">
              XamanアプリでQRコードをスキャンしてください
            </p>
            <p className="text-xs text-gray-500">
              残り時間: <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
            </p>
          </div>
        )}

        {/* ローディング状態 */}
        {loading && (
          <div className="text-center mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">リクエストを作成中...</p>
          </div>
        )}

        {/* エラー状態 */}
        {error && !loading && (
          <div className="text-center mb-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={createTrustlineRequest}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              再試行
            </button>
          </div>
        )}

        {/* 手順 */}
        {trustlineRequest && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">設定手順:</h3>
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
                トラストライン設定を承認
              </li>
            </ol>
          </div>
        )}

        {/* 状態表示 */}
        <div className={`border rounded-lg p-3 mb-4 ${getStatusStyle()}`}>
          <div className="flex items-center">
            {showSpinner && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            )}
            <span className="text-sm">{getStatusMessage()}</span>
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
