/**
 * 寄付関連の型定義
 */

export type DonationStatus = 'pending' | 'completed' | 'failed'

export type TokenIssueStatus = 'pending' | 'pending_trustline' | 'completed' | 'failed'

export type TrustLinePayload = {
  uuid: string
  qr_png: string
  qr_uri: string
  websocket_status: string
}

export type DonationPayload = {
  uuid: string
  qr_png: string
  qr_uri: string
  websocket_status: string
  destinationTag: number
  verificationHash: string
}

export type DonationSession = {
  id: string
  projectId: string
  donorAddress: string
  donorUid?: string
  amount: number
  destinationTag: number
  verificationHash: string
  status: DonationStatus
  xamanPayloadId?: string
  txHash?: string
  createdAt: Date
  expiresAt: Date
}

export type DonationRecord = {
  id: string
  sessionId: string
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
}

export type TrustLineRequest = {
  id: string
  projectId: string
  projectName: string
  tokenCode: string
  issuerAddress: string
  donorAddress: string
  donorUid?: string
  xamanPayloadId: string
  status: 'pending' | 'completed' | 'failed'
  txHash?: string
  completedAt?: Date
  error?: string
  createdAt: Date
  expiresAt: Date
}

export type ProjectStats = {
  projectId: string
  totalDonations: number
  donorCount: number
  totalTokensIssued: number
  lastDonationAt: Date
  createdAt: Date
  updatedAt: Date
}

export type DonationCreateRequest = {
  projectId: string
  donorAddress: string
  amount: number
}

export type DonationCreateResponse = {
  session: {
    id: string
    projectId: string
    amount: number
    destinationTag: number
    expiresAt: string
  }
  xamanPayload: {
    uuid: string
    qr_png: string
    qr_uri: string
    websocket_status: string
  }
}

export type TrustLineCreateRequest = {
  projectId: string
  donorAddress: string
}

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
    qr_png: string
    qr_uri: string
    websocket_status: string
  }
}

export type TrustLineStatusResponse = {
  donorAddress: string
  projectId: string
  tokenCode: string
  hasTrustLine: boolean
  issuerAddress: string
}
