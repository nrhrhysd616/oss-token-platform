/**
 * プロジェクト関連の型定義
 */

import type { QualityScore, TokenPrice } from './pricing'

export type ProjectStatus = 'draft' | 'active' | 'suspended'

export type Project = {
  id: string
  name: string
  description: string
  repositoryUrl: string
  ownerUid: string
  githubOwner: string
  githubRepo: string
  githubInstallationId: number
  tokenCode: string
  issuerAddress: string
  donationUsages: string[]
  createdAt: Date
  updatedAt: Date
  status: ProjectStatus
  qualityScore?: QualityScore
  currentPrice?: TokenPrice
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
}

/**
 * 公開プロジェクト統計情報
 */
export type PublicProjectStats = {
  totalXrpDonations: number
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
    xrpAmount: number
    donorAddress: string
    timestamp: string
    txHash: string
  }>
}
