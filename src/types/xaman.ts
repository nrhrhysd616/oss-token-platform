/**
 * Xaman API関連の型定義
 * xumm-sdkライブラリの型を活用
 */

import type { XummTypes } from 'xumm-sdk'

/**
 * Xaman WebSocketイベントの型定義
 * 実際のWebSocketメッセージ構造に基づく
 * 単純なイベントの型が未定義だったのでここで定義している
 */
export type XamanWebSocketEvent =
  | { message: string }
  | { expires_in_seconds: number }
  | { opened: boolean }
  | { devapp_fetched: boolean }
  | { pre_signed: boolean }
  | { dispatched: boolean }
  | { expired: boolean }
  | { signed: boolean }
  | XummTypes.XummWebsocketBody

/**
 * ウォレット連携リクエストの型定義
 */
export type WalletLinkRequest = {
  id: string
  userId: string
  xamanPayloadUuid: string
  qrPng: string // QRコード画像URL
  websocketUrl: string // WebSocketのURL
  status: 'created' | 'pending' | 'signed' | 'expired' | 'cancelled'
  createdAt: Date
  expiresAt: Date
  completedAt?: Date
  walletAddress?: string
}
