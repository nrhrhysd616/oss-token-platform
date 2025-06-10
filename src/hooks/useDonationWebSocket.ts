'use client'

import { useEffect, useRef, useState } from 'react'
import type { XamanWebSocketEvent } from '@/types/xaman'

type UseDonationWebSocketProps = {
  payloadUuid: string
  websocketUrl: string
  onMessage?: (event: XamanWebSocketEvent) => void
  enabled?: boolean
}

type UseDonationWebSocketReturn = {
  isConnected: boolean
  error: string | null
  lastEvent: XamanWebSocketEvent | null
}

export function useDonationWebSocket({
  payloadUuid,
  websocketUrl,
  onMessage,
  enabled = true,
}: UseDonationWebSocketProps): UseDonationWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<XamanWebSocketEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

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
        reconnectAttempts.current = 0
      }

      ws.onmessage = event => {
        try {
          const data: XamanWebSocketEvent = JSON.parse(event.data)
          console.log('📨 WebSocket message received:', data)
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

        // 正常終了でない場合は再接続を試行
        if (event.code !== 1000 && enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        }
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      setError('WebSocket接続の初期化に失敗しました')
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounted')
      wsRef.current = null
    }

    setIsConnected(false)
    setError(null)
    setLastEvent(null)
    reconnectAttempts.current = 0
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
