'use client'

import { useEffect, useRef, useState } from 'react'
import type { XamanWebSocketEvent } from '@/types/xaman'

type UseXamanWebSocketProps = {
  payloadUuid: string
  websocketUrl: string
  onMessage?: (event: XamanWebSocketEvent) => void
  enabled?: boolean
  payloadFilter?: boolean
}

type UseXamanWebSocketReturn = {
  isConnected: boolean
  error: string | null
  lastEvent: XamanWebSocketEvent | null
}

export function useXamanWebSocket({
  payloadUuid,
  websocketUrl,
  onMessage,
  enabled = true,
  payloadFilter = false,
}: UseXamanWebSocketProps): UseXamanWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<XamanWebSocketEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const connect = () => {
    if (!enabled || !payloadUuid || !websocketUrl) {
      return
    }

    try {
      console.log(`🔌 Connecting to WebSocket: ${websocketUrl}`)
      const ws = new WebSocket(websocketUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        setIsConnected(true)
        setError(null)
      }

      ws.onmessage = event => {
        try {
          const data: XamanWebSocketEvent = JSON.parse(event.data)
          console.log('📨 WebSocket message received:', data)

          // payloadFilterが有効な場合、対象のペイロードUUIDのイベントのみ処理
          if (payloadFilter && 'payload_uuidv4' in data && data.payload_uuidv4 !== payloadUuid) {
            console.warn(`Ignoring message for different payload UUID: ${data.payload_uuidv4}`)
            return
          }

          setLastEvent(data)

          // 汎用的なメッセージコールバック
          onMessage?.(data)
        } catch (error) {
          console.error('WebSocket message parse error:', error)
        }
      }

      ws.onerror = error => {
        console.error('❌ WebSocket error:', error)
        setError('WebSocket接続エラーが発生しました')
      }

      ws.onclose = event => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      setError('WebSocket接続の初期化に失敗しました')
    }
  }

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounted')
      wsRef.current = null
    }

    setIsConnected(false)
    setError(null)
    setLastEvent(null)
  }

  useEffect(() => {
    if (enabled && payloadUuid && websocketUrl) {
      connect()
    } else {
      disconnect()
    }

    return disconnect
  }, [enabled, payloadUuid, websocketUrl])

  return {
    isConnected,
    error,
    lastEvent,
  }
}
