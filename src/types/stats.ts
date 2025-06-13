/**
 * 統計情報関連の型定義
 */

// 共通の寄付履歴項目型
type BaseDonationItem = {
  projectId: string
  projectName: string
  xrpAmount: number
  txHash: string
  createdAt: string
}

// 寄付者用の寄付履歴項目型
export type DonorDonationItem = BaseDonationItem

// メンテナー用の寄付履歴項目型（寄付者アドレスを含む）
export type MaintainerDonationItem = BaseDonationItem & {
  donorAddress: string
}

// 受け取ったトークン情報の型定義
export type ReceivedToken = {
  projectId: string
  projectName: string
  tokenCode: string
  totalAmount: number
  lastReceivedAt: string
  transactionCount: number
}

// 寄付者統計情報の型定義
export type DonorStats = {
  totalDonationXrpAmount: number
  tokenTypesCount: number
  recentDonations: DonorDonationItem[]
  receivedTokens: ReceivedToken[]
}

// メンテナー統計情報の型定義
export type MaintainerStats = {
  projectCount: number
  totalReceivedXrpAmount: number
  totalSupportersCount: number
  recentDonations: MaintainerDonationItem[]
}
