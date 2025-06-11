/**
 * Firestoreコレクション名の定数定義
 *
 * すべてのコレクション名をここで一元管理し、
 * 大文字小文字の混在によるバグを防ぐ
 */
export const FIRESTORE_COLLECTIONS = {
  // メインコレクション
  USERS: 'users',
  PROJECTS: 'projects',
  DONATION_REQUESTS: 'donationRequests',
  DONATION_RECORDS: 'donationRecords',
  WALLET_LINK_REQUESTS: 'walletLinkRequests',
  // TODO: このコレクションは現状保存のみに利用されている。ユーザー情報にインストール情報を含んでいるため、削除できるようであれば削除予定
  INSTALLATIONS: 'installations',
  INSTALLATION_REPOSITORIES: 'installationRepositories', // キャメルケースに統一
  XAMAN_USER_TOKENS: 'xamanUserTokens',
  PROJECT_STATS: 'projectStats',
  SETTINGS: 'settings',

  // サブコレクション
  WALLETS: 'wallets',
  PRICE_HISTORY: 'priceHistory',
} as const

/**
 * Firestoreコレクション名の型定義
 */
export type FirestoreCollection = (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS]
