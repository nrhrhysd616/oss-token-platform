'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import type { DonationPayload, DonationRecord, DonationRequest } from '@/types/donation'

type DonationState = {
  isLoading: boolean
  error: string | null
  donationRequest: DonationRequest | null
  payload: DonationPayload | null
  donationRecord: DonationRecord | null
  isCompleted: boolean
}

type UseDonationReturn = {
  state: DonationState
  createDonation: (projectId: string, xrpAmount: number) => Promise<void>
  checkDonationStatus: (requestId: string) => Promise<void>
  reset: () => void
}

export function useDonation(): UseDonationReturn {
  const { user } = useAuth()
  const [state, setState] = useState<DonationState>({
    isLoading: false,
    error: null,
    donationRequest: null,
    payload: null,
    donationRecord: null,
    isCompleted: false,
  })

  const createDonation = useCallback(
    async (projectId: string, xrpAmount: number) => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        donationRequest: null,
        donationRecord: null,
        isCompleted: false,
      }))

      try {
        // 認証チェック
        if (!user) {
          throw new Error('ログインが必要です')
        }

        // IDトークンを取得
        const idToken = await user.getIdToken()

        const response = await fetch('/api/xaman/donations/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            projectId,
            xrpAmount,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '寄付リクエストの作成に失敗しました')
        }

        const data = (await response.json()) as {
          request: DonationRequest
          payload: DonationPayload
        }

        setState(prev => ({
          ...prev,
          isLoading: false,
          donationRequest: data.request,
          payload: data.payload,
        }))
      } catch (error) {
        console.error('寄付リクエスト作成エラー:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '寄付リクエストの作成に失敗しました',
        }))
      }
    },
    [user]
  )

  const checkDonationStatus = useCallback(async (requestId: string) => {
    try {
      const response = await fetch(`/api/xaman/donations/${requestId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '寄付状態の確認に失敗しました')
      }

      const data = (await response.json()) as {
        completed: boolean
        request: DonationRequest
        record: DonationRecord | null
      }

      // 寄付が完了している場合は、寄付記録を取得
      if (data.completed && data.record) {
        setState(prev => ({
          ...prev,
          isCompleted: true,
          donationRecord: data.record,
        }))
      }
    } catch (error) {
      console.error('寄付状態確認エラー:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '寄付状態の確認に失敗しました',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      donationRequest: null,
      payload: null,
      donationRecord: null,
      isCompleted: false,
    })
  }, [])

  return {
    state,
    createDonation,
    checkDonationStatus,
    reset,
  }
}
