/**
 * ユーザー関連の型定義
 */

export type UserRole = 'donor' | 'maintainer'

export type User = {
  uid: string
  email: string
  githubId: string
  displayName: string
  photoURL: string
  lastLogin: Date
  roles: UserRole[]
  defaultMode: UserRole
  projects?: string[]
  donations?: DonationSummary
  walletSummary?: WalletSummary
}

export type WalletSummary = {
  primaryWalletId?: string
  totalWallets: number
  lastLinkedAt?: Date
}

export type Wallet = {
  id: string
  address: string
  linkedAt: Date
  xamanPayloadUuid?: string
  verificationTxHash?: string
  status: 'pending' | 'linked' | 'failed'
  isPrimary: boolean
  nickname?: string
  createdAt: Date
  updatedAt: Date
}

export type DonationSummary = {
  totalCount: number
  lastDonationAt?: Date
  byToken: {
    [tokenCode: string]: {
      amount: number
      count: number
      lastDonationAt?: Date
    }
  }
}
