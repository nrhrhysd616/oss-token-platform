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
  XAMAN_USER_TOKENS: 'xamanUserTokens',
  SETTINGS: 'settings',

  // サブコレクション
  WALLETS: 'wallets',
  PRICE_HISTORY: 'priceHistory',
} as const

/**
 * Firestoreコレクション名の型定義
 */
export type FirestoreCollection = (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS]

/**
 * コレクションパス生成関数
 * BaseServiceのByPath系メソッドで使用するためのパス生成ユーティリティ
 */
export const collectionPath = {
  // メインコレクション
  /**
   * ユーザーコレクションパス
   * @returns `users`
   */
  users: () => 'users',
  /**
   * プロジェクトコレクションパス
   * @returns `projects`
   */
  projects: () => 'projects',
  /**
   * 寄付リクエストコレクションパス
   * @returns `donationRequests`
   */
  donationRequests: () => 'donationRequests',
  /**
   * 寄付履歴コレクションパス
   * @returns `donationRecords`
   */
  donationRecords: () => 'donationRecords',
  /**
   * ウォレットリンクリクエストコレクションパス
   * @returns `walletLinkRequests`
   */
  walletLinkRequests: () => 'walletLinkRequests',
  /**
   * GitHub Appインストール情報コレクションパス
   * @returns `installations`
   */
  installations: () => 'installations',
  /**
   * Xamanユーザートークンコレクションパス
   * @returns `xamanUserTokens`
   */
  xamanUserTokens: () => 'xamanUserTokens',
  /**
   * 設定コレクションパス
   * @returns `settings`
   */
  settings: () => 'settings',

  // サブコレクション
  /**
   * ユーザーのウォレットコレクションパス
   * @param userId ユーザーID
   * @returns `users/${userId}/wallets`
   */
  userWallets: (userId: string) => `users/${userId}/wallets`,
  /**
   * プロジェクトの価格履歴コレクションパス
   * @param projectId プロジェクトID
   * @returns `projects/${projectId}/wallets`
   */
  projectPriceHistory: (projectId: string) => `projects/${projectId}/priceHistory`,
  /**
   * 設定の価格コレクションパス
   * @returns `settings/quality/parameters`
   */
  settingsQualityParameters: () => 'settings/quality/parameters',
} as const

/**
 * ドキュメントパス生成関数
 * 特定のドキュメントへのパスを生成するためのユーティリティ
 */
export const docPath = {
  // メインドキュメント
  /**
   * ユーザードキュメントパス
   * @param projectId プロジェクトID
   * @returns `projects/${projectId}`
   */
  project: (projectId: string) => `projects/${projectId}`,
  /**
   * ユーザードキュメントパス
   * @param userId ユーザーID
   * @returns `users/${userId}`
   */
  user: (userId: string) => `users/${userId}`,
  /**
   * 寄付リクエストドキュメントパス
   * @param requestId リクエストID
   * @returns `donationRequests/${requestId}`
   */
  donationRequest: (requestId: string) => `donationRequests/${requestId}`,
  /**
   * 寄付履歴ドキュメントパス
   * @param recordId レコードID
   * @returns `donationRecords/${recordId}`
   */
  donationRecord: (recordId: string) => `donationRecords/${recordId}`,
  /**
   * ウォレットリンクリクエストドキュメントパス
   * @param requestId リクエストID
   * @returns `walletLinkRequests/${requestId}`
   */
  walletLinkRequest: (requestId: string) => `walletLinkRequests/${requestId}`,
  /**
   * GitHub Appインストール情報ドキュメントパス
   * @param installationId インストールID
   * @returns `installations/${installationId}`
   */
  installation: (installationId: string) => `installations/${installationId}`,
  /**
   * Xamanユーザートークンドキュメントパス
   * @param tokenId トークンID
   * @returns `xamanUserTokens/${tokenId}`
   */
  xamanUserToken: (tokenId: string) => `xamanUserTokens/${tokenId}`,

  // サブドキュメント
  /**
   * ユーザーのウォレットドキュメントパス
   * @param userId ユーザーID
   * @param walletId ウォレットID
   * @returns `users/${userId}/wallets/${walletId}`
   */
  userWallet: (userId: string, walletId: string) => `users/${userId}/wallets/${walletId}`,
  /**
   * プロジェクトの価格履歴ドキュメントパス
   * @param projectId プロジェクトID
   * @param historyId 履歴ID
   * @returns `projects/${projectId}/priceHistory/${historyId}`
   */
  projectPriceHistory: (projectId: string, historyId: string) =>
    `projects/${projectId}/priceHistory/${historyId}`,
  /**
   * 価格のグローバル設定ドキュメントパス
   * @returns `settings/quality/parameters/global`
   */
  settingsPricingParameters: () => 'settings/pricing/parameters/global',
} as const
