/**
 * トラストライン状態確認用カスタムフック
 */

import { Wallet } from '@/types/user'
import { useState, useEffect } from 'react'

type TrustlineCheckResult = {
  canDonate: boolean
  hasTrustLine: boolean
  tokenCode: string
  issuerAddress: string
  xrpBalance: number
  tokenBalance: number
}

type TrustlineCheckState = {
  data: TrustlineCheckResult | null
  loading: boolean
  error: string | null
}

export function useTrustlineCheck(donorWallet: Wallet | null, projectId: string) {
  const [state, setState] = useState<TrustlineCheckState>({
    data: null,
    loading: false,
    error: null,
  })

  const checkTrustline = async () => {
    if (!donorWallet || !projectId) {
      setState({
        data: null,
        loading: false,
        error: null,
      })
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params = new URLSearchParams({
        donorAddress: donorWallet.address,
        projectId,
      })

      const response = await fetch(`/api/xrpl/trustline?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'トラストライン状態の確認に失敗しました')
      }

      const result = await response.json()

      setState({
        data: result.data,
        loading: false,
        error: null,
      })
    } catch (error) {
      console.error('Trustline check error:', error)
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'エラーが発生しました',
      })
    }
  }

  useEffect(() => {
    checkTrustline()
  }, [donorWallet, projectId])

  return {
    ...state,
    refetch: checkTrustline,
  }
}
