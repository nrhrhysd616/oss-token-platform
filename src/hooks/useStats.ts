/**
 * 統計情報取得用カスタムフック
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { DonorStats, MaintainerStats } from '@/types/stats'

/**
 * 寄付者統計情報を取得するフック
 */
export function useDonorStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DonorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setStats(null)
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = await user.getIdToken()
        const response = await fetch('/api/donor/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('統計情報の取得に失敗しました')
        }

        const data = (await response.json()) as DonorStats
        setStats(data)
      } catch (err) {
        console.error('Donor stats fetch error:', err)
        setError(err instanceof Error ? err.message : '統計情報の取得に失敗しました')
        setStats(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user])

  const refetch = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch('/api/donor/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('統計情報の取得に失敗しました')
      }

      const data = (await response.json()) as DonorStats
      setStats(data)
    } catch (err) {
      console.error('Donor stats refetch error:', err)
      setError(err instanceof Error ? err.message : '統計情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return {
    stats,
    loading,
    error,
    refetch,
  }
}

/**
 * メンテナー統計情報を取得するフック
 */
export function useMaintainerStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<MaintainerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setStats(null)
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = await user.getIdToken()
        const response = await fetch('/api/maintainer/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('統計情報の取得に失敗しました')
        }

        const data = (await response.json()) as MaintainerStats
        setStats(data)
      } catch (err) {
        console.error('Maintainer stats fetch error:', err)
        setError(err instanceof Error ? err.message : '統計情報の取得に失敗しました')
        setStats(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user])

  const refetch = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const token = await user.getIdToken()
      const response = await fetch('/api/maintainer/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('統計情報の取得に失敗しました')
      }

      const data = (await response.json()) as MaintainerStats
      setStats(data)
    } catch (err) {
      console.error('Maintainer stats refetch error:', err)
      setError(err instanceof Error ? err.message : '統計情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return {
    stats,
    loading,
    error,
    refetch,
  }
}
