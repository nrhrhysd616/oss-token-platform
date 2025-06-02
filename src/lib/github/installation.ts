// GitHub App インストール関連のユーティリティ

// GitHub App インストールURLを生成
export function generateInstallationUrl(options: {
  uid?: string // Firebase UID
  redirectPath?: string // インストール後のリダイレクト先
  repositoryIds?: number[] // 特定のリポジトリのみインストールする場合
}): string {
  const baseUrl = 'https://github.com/apps'
  const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || process.env.GITHUB_APP_NAME

  if (!appName) {
    throw new Error('GITHUB_APP_NAME環境変数が設定されていません')
  }

  const installUrl = new URL(`${baseUrl}/${appName}/installations/new`)

  // stateパラメータでユーザー情報を渡す
  if (options.uid) {
    const stateData = {
      uid: options.uid,
      redirectPath: options.redirectPath || '/maintainer',
      timestamp: Date.now(),
    }
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64')
    installUrl.searchParams.set('state', encodedState)
  }

  // 特定のリポジトリのみインストールする場合
  if (options.repositoryIds && options.repositoryIds.length > 0) {
    installUrl.searchParams.set('repository_ids[]', options.repositoryIds.join(','))
  }

  return installUrl.toString()
}

// GitHub App設定URLを生成（既存のインストールを編集）
export function generateInstallationSettingsUrl(installationId: number): string {
  return `https://github.com/settings/installations/${installationId}`
}

// Installation状態を確認
export type InstallationStatus = 'not_installed' | 'installed' | 'suspended' | 'deleted'

export function getInstallationStatus(installation: any): InstallationStatus {
  if (!installation) {
    return 'not_installed'
  }

  return installation.status || 'installed'
}

// Installation権限を確認
export function hasRequiredPermissions(installation: any, requiredPermissions: string[]): boolean {
  if (!installation?.permissions) {
    return false
  }

  return requiredPermissions.every(permission => {
    const permissionValue = installation.permissions[permission]
    return permissionValue === 'read' || permissionValue === 'write'
  })
}

// プロジェクト登録に必要な最小権限
export const REQUIRED_PERMISSIONS = [
  'contents', // リポジトリコンテンツの読み取り
  'metadata', // リポジトリメタデータの読み取り
  'issues', // Issue管理（オプション）
  'pull_requests', // PR管理（オプション）
]

// Installation情報の型定義
export type InstallationInfo = {
  id: number
  account: {
    login: string
    type: string
    avatarUrl: string
  } | null
  permissions: Record<string, string>
  repositorySelection: string
  status: InstallationStatus
  createdAt: Date
  updatedAt: Date
  suspendedAt?: Date | null
  suspendedBy?: any
}
