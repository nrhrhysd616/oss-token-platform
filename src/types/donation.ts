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
export type TokenIssueStatus = 'pending' | 'pendingTrustline' | 'completed' | 'failed'

/**
 * トラストライン設定リクエストステータス
 */
export type TrustLineStatus = 'created' | 'pending' | 'signed' | 'expired' | 'cancelled'

/**
 * Xamanペイロード（トラストライン用）
 */
export type TrustLinePayload = {
  uuid: string
  qrPng: string
  websocketUrl: string
}

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
  donorAddress: string
  donorUid?: string
  amount: number
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
  amount: number
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
 * トラストライン設定リクエスト（Firestoreドキュメント形式）
 */
export type TrustLineRequest = {
  id: string
  projectId: string
  projectName: string
  tokenCode: string
  issuerAddress: string
  donorAddress: string
  donorUid?: string
  xamanPayloadUuid: string
  status: TrustLineStatus
  txHash?: string
  completedAt?: Date
  error?: string
  createdAt: Date
  expiresAt: Date
}

/**
 * プロジェクト統計（Firestoreドキュメント形式）
 */
export type ProjectStats = {
  projectId: string
  totalDonations: number
  donorCount: number
  totalTokensIssued: number
  lastDonationAt?: Date
  createdAt: Date
  updatedAt: Date
}

// === API Request/Response 型定義 ===

/**
 * 寄付セッション作成リクエスト
 */
export type DonationCreateRequest = {
  projectId: string
  donorAddress: string
  amount: number
}

/**
 * 寄付セッション作成レスポンス
 */
export type DonationCreateResponse = {
  request: {
    id: string
    projectId: string
    amount: number
    destinationTag: number
    expiresAt: string
  }
  xamanPayload: {
    uuid: string
    qrPng: string
    websocketUrl: string
  }
}

/**
 * トラストライン作成リクエスト
 */
export type TrustLineCreateRequest = {
  projectId: string
  donorAddress: string
}

/**
 * トラストライン作成レスポンス
 */
export type TrustLineCreateResponse = {
  request: {
    id: string
    projectId: string
    projectName: string
    tokenCode: string
    expiresAt: string
  }
  xamanPayload: {
    uuid: string
    qrPng: string
    websocketUrl: string
  }
}

/**
 * トラストライン状態確認レスポンス
 */
export type TrustLineStatusResponse = {
  donorAddress: string
  projectId: string
  tokenCode: string
  hasTrustLine: boolean
  issuerAddress: string
}
