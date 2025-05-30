/**
 * Firebase Firestore関連のユーティリティ関数
 */

import { Timestamp } from 'firebase-admin/firestore'

/**
 * FirestoreのTimestampをDate型に変換
 * @param timestamp Firestoreのタイムスタンプまたは既存のDate型
 * @returns Date型のオブジェクト
 */
export const convertTimestampToDate = (
  timestamp:
    | Timestamp
    | Date
    | { _seconds: number; _nanoseconds: number }
    | string
    | null
    | undefined
): Date => {
  // nullまたはundefinedの場合は現在時刻を返す
  if (!timestamp) {
    return new Date()
  }
  // Firestoreのタイムスタンプ形式の場合（内部形式）
  if (timestamp && typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date(timestamp._seconds * 1000)
  }
  // Firebase Admin SDKのTimestamp型の場合
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  // 既にDate型の場合
  if (timestamp instanceof Date) {
    return timestamp
  }
  // 文字列の場合
  if (typeof timestamp === 'string') {
    return new Date(timestamp)
  }
  // その他の場合は現在時刻を返す
  return new Date()
}

/**
 * Walletオブジェクトのタイムスタンプフィールドを変換
 * @param walletData Firestoreから取得したウォレットデータ
 * @returns タイムスタンプが変換されたウォレットデータ
 */
export const convertWalletTimestamps = (walletData: any): any => {
  return {
    ...walletData,
    linkedAt: convertTimestampToDate(walletData.linkedAt),
    createdAt: convertTimestampToDate(walletData.createdAt),
    updatedAt: convertTimestampToDate(walletData.updatedAt),
  }
}

/**
 * WalletSummaryオブジェクトのタイムスタンプフィールドを変換
 * @param summaryData Firestoreから取得したWalletSummaryデータ
 * @returns タイムスタンプが変換されたWalletSummaryデータ
 */
export const convertWalletSummaryTimestamps = (summaryData: any): any => {
  if (!summaryData) return summaryData

  return {
    ...summaryData,
    lastLinkedAt: summaryData.lastLinkedAt
      ? convertTimestampToDate(summaryData.lastLinkedAt)
      : undefined,
  }
}
