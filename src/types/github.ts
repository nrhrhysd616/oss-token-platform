// GitHub関連の型定義

// GitHub App情報
export type GitHubAppInfo = {
  name: string
  description: string | null
  url: string
  permissions: Record<string, string | undefined>
}

// GitHubリポジトリの型定義
export type GitHubRepository = {
  id: number
  name: string
  fullName: string
  description: string | null
  private: boolean
  htmlUrl: string
  language: string | null
  stargazersCount: number
  forksCount: number
  updatedAt: string
  owner: {
    login: string
    type: string
    avatarUrl: string
  }
}

export type GitHubInstallation = {
  id: number
  account: {
    login: string
    type: string
  } | null
  permissions: Record<string, string>
  repositorySelection: string
  updatedAt: Date
}
