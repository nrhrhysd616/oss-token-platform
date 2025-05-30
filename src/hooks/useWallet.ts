'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'

import type { Wallet, WalletLinkRequest } from '@/types/user'
import type { XamanPayloadStatus } from '@/types/xaman'

export type WalletLinkStatus = 'idle' | 'creating' | 'pending' | 'checking' | 'success' | 'error'

export type UseWalletReturn = {
  wallets: Wallet[]
  primaryWallet: Wallet | null
  linkStatus: WalletLinkStatus
  linkRequest: WalletLinkRequest | null
  error: string | null
  isLoading: boolean
  createWalletLink: () => Promise<void>
  checkLinkStatus: (payloadUuid: string) => Promise<void>
  refreshWallets: () => Promise<void>
  clearError: () => void
}

/**
 * ウォレット操作用カスタムフック
 */
export function useWallet(): UseWalletReturn {
  const { user } = useAuth()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [primaryWallet, setPrimaryWallet] = useState<Wallet | null>(null)
  const [linkStatus, setLinkStatus] = useState<WalletLinkStatus>('idle')
  const [linkRequest, setLinkRequest] = useState<WalletLinkRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * ウォレット一覧を更新
   */
  const refreshWallets = useCallback(async () => {
    if (!user) return
    try {
      setIsLoading(true)
      // Firebase認証トークンを取得
      const token = await user.getIdToken()
      // ウォレット一覧を取得
      const walletsResponse = await fetch('/api/xaman/wallets', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!walletsResponse.ok) {
        const errorData = await walletsResponse.json()
        throw new Error(errorData.error || 'ウォレット一覧の取得に失敗しました')
      }

      const { data: userWallets } = await walletsResponse.json()
      // isPrimaryプロパティでプライマリウォレットを特定
      const primary = userWallets.find((wallet: Wallet) => wallet.isPrimary) || null

      setWallets(userWallets)
      setPrimaryWallet(primary)
    } catch (err) {
      console.error('Failed to refresh wallets:', err)
      setError(err instanceof Error ? err.message : 'ウォレット情報の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * ウォレット連携リクエストを作成
   */
  const createWalletLink = useCallback(async () => {
    if (!user) {
      setError('ログインが必要です')
      return
    }
    try {
      setLinkStatus('creating')
      setError(null)
      // Firebase認証トークンを取得
      const token = await user.getIdToken()
      // APIエンドポイントを呼び出し
      const response = await fetch('/api/xaman/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'ウォレット連携リクエストの作成に失敗しました')
      }
      const { data } = await response.json()
      const request: WalletLinkRequest = {
        id: data.payloadUuid,
        userId: user.uid,
        xamanPayloadUuid: data.payloadUuid,
        qrData: data.qrData,
        status: 'created',
        createdAt: new Date(),
        expiresAt: new Date(data.expiresAt),
      }
      setLinkRequest(request)
      setLinkStatus('pending')
    } catch (err) {
      console.error('Failed to create wallet link:', err)
      setError(err instanceof Error ? err.message : 'ウォレット連携リクエストの作成に失敗しました')
      setLinkStatus('error')
    }
  }, [user])

  /**
   * ウォレット連携状態をチェック
   */
  const checkLinkStatus = useCallback(
    async (payloadUuid: string) => {
      if (!user) return
      try {
        setLinkStatus('checking')
        setError(null)
        // Firebase認証トークンを取得
        const token = await user.getIdToken()
        // APIエンドポイントを呼び出し
        const response = await fetch(`/api/xaman/wallets/link-status?payloadUuid=${payloadUuid}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'ウォレット連携状態の確認に失敗しました')
        }
        const { data } = await response.json()
        if (data.status === 'completed') {
          // 署名完了 - ウォレット連携完了
          setLinkStatus('success')
          setLinkRequest(null)
          // ウォレット一覧を更新（内部実装で依存関係を回避）
          try {
            const walletsResponse = await fetch('/api/xaman/wallets', {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            })
            if (walletsResponse.ok) {
              const { data: userWallets } = await walletsResponse.json()
              const primary = userWallets.find((wallet: Wallet) => wallet.isPrimary) || null
              setWallets(userWallets)
              setPrimaryWallet(primary)
            }
          } catch (refreshError) {
            console.error('Failed to refresh wallets after link completion:', refreshError)
          }
        } else if (data.status === 'cancelled') {
          setError('ウォレット連携がキャンセルされました')
          setLinkStatus('error')
          setLinkRequest(null)
        } else if (data.status === 'expired') {
          setError('ウォレット連携リクエストが期限切れです')
          setLinkStatus('error')
          setLinkRequest(null)
        } else {
          // まだ署名されていない - 待機状態を継続
          setLinkStatus('pending')
        }
      } catch (err) {
        console.error('Failed to check link status:', err)
        setError(err instanceof Error ? err.message : 'ウォレット連携状態の確認に失敗しました')
        setLinkStatus('error')
      }
    },
    [user]
  )

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 初回ロード時にウォレット一覧を取得
  useEffect(() => {
    if (user) {
      refreshWallets()
    } else {
      setWallets([])
      setPrimaryWallet(null)
      setLinkStatus('idle')
      setLinkRequest(null)
      setError(null)
      setIsLoading(false)
    }
  }, [user, refreshWallets])

  return {
    wallets,
    primaryWallet,
    linkStatus,
    linkRequest,
    error,
    isLoading,
    createWalletLink,
    checkLinkStatus,
    refreshWallets,
    clearError,
  }
}
