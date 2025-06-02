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
  tokenCode?: string
  createdAt: Date
  updatedAt: Date
  status: ProjectStatus
}
