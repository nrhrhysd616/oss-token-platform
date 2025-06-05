/**
 * Xaman WebSocket接続用のシンプルなフック
 */

import { useEffect, useRef, useState } from 'react'
import type { XamanWebSocketEvent } from '@/types/xaman'

type UseXamanWebSocketOptions = {
  payloadUuid: string
  websocketUrl: string
  onSigned?: (event: XamanWebSocketEvent) => void
  onRejected?: (event: XamanWebSocketEvent) => void
  onExpired?: (event: XamanWebSocketEvent) => void
  onOpened?: (event: XamanWebSocketEvent) => void
  enabled?: boolean
}

type UseXamanWebSocketReturn = {
  isConnected: boolean
  error: string | null
}

export function useXamanWebSocket({
  payloadUuid,
  websocketUrl,
  onSigned,
  onRejected,
  onExpired,
  onOpened,
  enabled = true,
}: UseXamanWebSocketOptions): UseXamanWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // 新規接続しない条件を確認
    if (!enabled || !websocketUrl || !payloadUuid || wsRef.current) {
      return
    }

    console.log(`Connecting to WebSocket: ${websocketUrl} for payload: ${payloadUuid}`)
    // WebSocket接続を作成
    const ws = new WebSocket(websocketUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Xaman WebSocket connected')
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = event => {
      try {
        const data: XamanWebSocketEvent = JSON.parse(event.data)

        console.log('Received WebSocket event:', data)

        // 対象のペイロードUUIDのイベントのみ処理
        if ('payload_uuidv4' in data && data.payload_uuidv4 !== payloadUuid) {
          console.warn(`Ignoring message for different payload UUID: ${data.payload_uuidv4}`)
          return
        }

        // イベントタイプに応じてコールバックを実行
        if ('signed' in data && data.signed === true) {
          onSigned?.(data)
        } else if ('signed' in data && data.signed === false) {
          onRejected?.(data)
        } else if ('expired' in data && data.expired === true) {
          onExpired?.(data)
        } else if ('opened' in data && data.opened === true) {
          onOpened?.(data)
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
        setError('メッセージの解析に失敗しました')
      }
    }

    ws.onclose = event => {
      console.log('Xaman WebSocket closed:', event.code, event.reason)
      setIsConnected(false)
    }

    ws.onerror = err => {
      console.error('Xaman WebSocket error:', err)
      setError('WebSocket接続エラーが発生しました')
      setIsConnected(false)
    }

    // クリーンアップ関数
    return () => {
      // enabledがfalseになった場合のみ切断
      if (!enabled) {
        ws.close()
      }
    }
  }, [enabled])

  return {
    isConnected,
    error,
  }
}
