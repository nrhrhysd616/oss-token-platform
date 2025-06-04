/**
 * プロジェクト関連の型定義
 */

export type ProjectStatus = 'draft' | 'active' | 'suspended'

export type Project = {
  id: string
  name: string
  description: string
  repositoryUrl: string
  ownerUid: string
  githubOwner: string
  githubRepo: string
  githubInstallationId: string
  tokenCode: string
  issuerAddress: string
  donationUsages: string[]
  createdAt: Date
  updatedAt: Date
  status: ProjectStatus
}

/**
 * 公開プロジェクト情報（寄付者・一般ユーザー向け）
 */
export type PublicProject = Omit<Project, 'ownerUid' | 'githubInstallationId' | 'issuerAddress'> & {
  stats: PublicProjectStats
}

/**
 * 管理者プロジェクト情報（メンテナー向け）
 */
export type MaintainerProject = Project & {
  stats: MaintainerProjectStats
  permissions: ProjectPermissions
}

/**
 * 公開プロジェクト統計情報
 */
export type PublicProjectStats = {
  totalDonations: number
  donorCount: number
  currentPrice: number
  priceHistory: Array<{
    date: string
    price: number
  }>
}

/**
 * 管理者プロジェクト統計情報
 */
export type MaintainerProjectStats = PublicProjectStats & {
  tokenSupply: number
  recentDonations: Array<{
    amount: number
    donorAddress: string
    timestamp: string
    txHash: string
  }>
}

/**
 * プロジェクト権限情報
 */
export type ProjectPermissions = {
  canEdit: boolean
  canIssueToken: boolean
  tokenIssued: boolean
}
