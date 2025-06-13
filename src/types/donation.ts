/**
 * 寄付関連の型定義
 * Firestore保存形式に準拠し、キャメルケースで統一
 */

/**
 * 寄付ステータス
 */
export type DonationStatus = 'pending' | 'payload_created' | 'completed' | 'failed'

/**
 * トークン発行ステータス
 */
export type TokenIssueStatus = 'pending' | 'completed' | 'failed'

/**
 * Xamanペイロード（寄付用）
 */
export type DonationPayload = {
  uuid: string
  qrPng: string
  websocketUrl: string
  destinationTag: number
  verificationHash: string
}

/**
 * 寄付リクエスト（Firestoreドキュメント形式）
 */
export type DonationRequest = {
  id: string
  projectId: string
  donorUid?: string
  xrpAmount: number
  destinationTag: number
  verificationHash: string
  status: DonationStatus
  xamanPayloadUuid?: string
  txHash?: string
  createdAt: Date
  expiresAt: Date
  completedAt?: Date
}

/**
 * 寄付記録（Firestoreドキュメント形式）
 */
export type DonationRecord = {
  id: string
  requestId: string
  projectId: string
  donorAddress: string
  donorUid?: string
  xrpAmount: number
  txHash: string
  destinationTag: number
  verificationHash: string
  tokenIssued: boolean
  tokenAmount?: number
  tokenTxHash?: string
  tokenIssuedAt?: Date
  tokenIssueStatus?: TokenIssueStatus
  tokenIssueError?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * プロジェクト寄付統計
 * 寄付履歴から集計した統計情報
 */
export type ProjectDonationStats = {
  totalDonations: number
  totalXrpAmount: number
  donorCount: number
  totalTokensIssued: number
  lastDonationAt?: Date
}

// === API Request/Response 型定義 ===

/**
 * 寄付セッション作成リクエスト
 */
export type DonationCreateRequest = {
  projectId: string
  xrpAmount: number
}
