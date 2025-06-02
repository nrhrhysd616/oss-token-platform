import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { GitHubRepository, GitHubInstallation, GitHubAppInfo } from '@/types/github'

// Installation IDを含むリポジトリ型
type RepositoryWithInstallation = GitHubRepository & { installationId: number }

export function useGitHubApp() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [appInfo, setAppInfo] = useState<GitHubAppInfo | null>(null)
  const [installations, setInstallations] = useState<GitHubInstallation[]>([])
  // const [repositories, setRepositories] = useState<GitHubRepositoryListItem[]>([])
  const [allRepositories, setAllRepositories] = useState<RepositoryWithInstallation[]>([])
  // const [repositoriesLoading, setRepositoriesLoading] = useState(false)
  const [allRepositoriesLoading, setAllRepositoriesLoading] = useState(false)

  // GitHub App情報を取得
  const fetchAppInfo = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/github/app')
      const data = await response.json()
      if (response.ok) {
        setAppInfo(data)
      } else {
        console.error('GitHub App情報取得エラー:', data.error)
      }
    } catch (error) {
      console.error('GitHub App情報取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // ユーザーのInstallation情報を取得
  const fetchInstallations = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const token = await user.getIdToken()

      const response = await fetch('/api/github/installations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setInstallations(data.data.installations)
      } else {
        console.error('Installation情報取得エラー:', data.error)
      }
    } catch (error) {
      console.error('Installation情報取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // すべてのInstallationからリポジトリを取得
  const fetchAllRepositories = useCallback(async () => {
    if (!user) return

    try {
      setAllRepositoriesLoading(true)
      const token = await user.getIdToken()

      const response = await fetch('/api/github/repositories', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setAllRepositories(data.data.repositories)
      } else {
        console.error('全リポジトリ取得エラー:', data.error)
        setAllRepositories([])
      }
    } catch (error) {
      console.error('全リポジトリ取得エラー:', error)
      setAllRepositories([])
    } finally {
      setAllRepositoriesLoading(false)
    }
  }, [user])

  return {
    loading,
    appInfo,
    installations,
    allRepositories,
    allRepositoriesLoading,
    fetchAppInfo,
    fetchInstallations,
    fetchAllRepositories,
  }
}
