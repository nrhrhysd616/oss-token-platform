/**
 * Firebase Firestore関連のユーティリティ関数
 */

/**
 * FirestoreのTimestampをDate型に変換
 * Firestoreの標準toDate()メソッドを活用
 * @param timestamp Firestoreのタイムスタンプまたは既存のDate型
 * @returns Date型のオブジェクト
 */
export const convertTimestampToDate = (timestamp: any): Date => {
  // nullまたはundefinedの場合は現在時刻を返す
  if (!timestamp) {
    return new Date()
  }

  // FirestoreのTimestamp型の場合（toDate()メソッドを使用）
  if (typeof timestamp?.toDate === 'function') {
    return timestamp.toDate()
  }

  // 既にDate型の場合
  if (timestamp instanceof Date) {
    return timestamp
  }

  // 文字列の場合
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp)
    // Invalid Dateの場合は現在時刻を返す
    if (isNaN(date.getTime())) {
      return new Date()
    }
    return date
  }

  // その他の場合は現在時刻を返す
  return new Date()
}

/**
 * 日付をyyyy/MM/dd形式でフォーマット
 * @param timestamp Firestoreのタイムスタンプまたは日付
 * @returns フォーマットされた日付文字列
 */
export const formatDateJP = (
  timestamp:
    | Date
    | { _seconds: number; _nanoseconds: number }
    | { seconds: number; nanoseconds: number }
    | string
    | null
    | undefined
): string => {
  const date = convertTimestampToDate(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

/**
 * 日付と時刻をyyyy/MM/dd HH:mm:ss形式でフォーマット
 * @param timestamp Firestoreのタイムスタンプまたは日付
 * @returns フォーマットされた日付時刻文字列
 */
export const formatDateTimeJP = (
  timestamp:
    | Date
    | { _seconds: number; _nanoseconds: number }
    | { seconds: number; nanoseconds: number }
    | string
    | null
    | undefined
): string => {
  const date = convertTimestampToDate(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

// 全てのtimestampフィールドを定義
const TIMESTAMP_FIELDS = [
  'createdAt',
  'updatedAt',
  'expiresAt',
  'completedAt',
  'linkedAt',
  'lastLinkedAt',
  'lastDonationAt',
  'lastUpdated',
  'suspendedAt',
  'issuedAt',
] as const

/**
 * 汎用的なタイムスタンプ変換関数
 * @param data Firestoreから取得したデータ
 * @param fields 変換対象のフィールド名配列（省略時は全てのtimestampフィールドを対象）
 * @returns タイムスタンプが変換されたデータ
 */
export const convertTimestamps = (data: any, fields?: string[]): any => {
  if (!data) return data

  const fieldsToConvert = fields || TIMESTAMP_FIELDS
  const result = { ...data }

  fieldsToConvert.forEach(field => {
    if (result[field]) {
      result[field] = convertTimestampToDate(result[field])
    }
  })

  return result
}
