/**
 * サービス共通基底クラス
 */

import crypto from 'crypto'
import { getAdminDb } from '@/lib/firebase/admin'
import { convertTimestamps } from '@/lib/firebase/utils'
import { getXummInstance } from '@/lib/xaman'
import { ServiceError } from './ServiceError'
import type { XummTypes } from 'xumm-sdk'
import type { Query, DocumentData } from 'firebase-admin/firestore'

/**
 * ページネーション結果の型
 */
export type PaginatedResult<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

/**
 * ページネーションオプション
 */
export type PaginationOptions = {
  limit: number
  offset: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

/**
 * サービス基底クラス
 */
export abstract class BaseService {
  protected static db = getAdminDb()
  protected static xumm = getXummInstance()

  // === COMMON FIRESTORE OPERATIONS ===

  /**
   * ドキュメントを取得
   */
  protected static async getDocument<T>(collection: string, docId: string): Promise<T | null> {
    try {
      const docSnap = await this.db.collection(collection).doc(docId).get()

      if (!docSnap.exists) {
        return null
      }

      return convertTimestamps({
        id: docSnap.id,
        ...docSnap.data(),
      }) as T
    } catch (error) {
      console.error(`ドキュメント取得エラー (${collection}/${docId}):`, error)
      throw new ServiceError(`ドキュメントの取得に失敗しました: ${docId}`, 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * ドキュメントを作成
   */
  protected static async createDocument<T>(
    collection: string,
    data: Omit<T, 'id'>,
    docId?: string
  ): Promise<T> {
    try {
      const docRef = docId
        ? this.db.collection(collection).doc(docId)
        : this.db.collection(collection).doc()

      await docRef.set(data)

      return {
        id: docRef.id,
        ...data,
      } as T
    } catch (error) {
      console.error(`ドキュメント作成エラー (${collection}):`, error)
      throw new ServiceError('ドキュメントの作成に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * ドキュメントを更新
   */
  protected static async updateDocument<T>(
    collection: string,
    docId: string,
    updates: Partial<T>
  ): Promise<void> {
    try {
      await this.db
        .collection(collection)
        .doc(docId)
        .update({
          ...updates,
          updatedAt: new Date(),
        })
    } catch (error) {
      console.error(`ドキュメント更新エラー (${collection}/${docId}):`, error)
      throw new ServiceError(`ドキュメントの更新に失敗しました: ${docId}`, 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * ドキュメントを削除
   */
  protected static async deleteDocument(collection: string, docId: string): Promise<void> {
    try {
      await this.db.collection(collection).doc(docId).delete()
    } catch (error) {
      console.error(`ドキュメント削除エラー (${collection}/${docId}):`, error)
      throw new ServiceError(`ドキュメントの削除に失敗しました: ${docId}`, 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * ページネーション付きクエリ実行
   */
  protected static async executePaginatedQuery<T>(
    baseQuery: Query<DocumentData>,
    options: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    try {
      // データ取得クエリ
      let query = baseQuery
        .orderBy(options.sortBy, options.sortOrder)
        .limit(options.limit)
        .offset(options.offset)

      const snapshot = await query.get()
      const items: T[] = snapshot.docs.map(doc =>
        convertTimestamps({
          id: doc.id,
          ...doc.data(),
        })
      ) as T[]

      // 総数取得
      const countSnapshot = await baseQuery.get()

      return {
        items,
        total: countSnapshot.size,
        limit: options.limit,
        offset: options.offset,
      }
    } catch (error) {
      console.error('ページネーションクエリ実行エラー:', error)
      throw new ServiceError('データの取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === COMMON XAMAN OPERATIONS ===

  /**
   * Xamanペイロードの状態をチェック
   */
  protected static async checkPayloadStatus(
    payloadUuid: string
  ): Promise<XummTypes.XummGetPayloadResponse> {
    try {
      const status = await this.xumm.payload?.get(payloadUuid)

      if (!status) {
        throw new ServiceError('ペイロードステータスの取得に失敗しました', 'INTERNAL_ERROR', 500)
      }

      return status
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error
      }
      console.error('ペイロードステータス確認エラー:', error)
      throw new ServiceError('ペイロードステータスの確認に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * Xamanペイロードをキャンセル
   */
  protected static async cancelPayload(payloadUuid: string): Promise<void> {
    try {
      await this.xumm.payload?.cancel(payloadUuid)
    } catch (error) {
      console.error('ペイロードキャンセルエラー:', error)
      throw new ServiceError('ペイロードのキャンセルに失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * Xamanペイロード作成
   */
  protected static async createXamanPayload(
    payload: XummTypes.XummPostPayloadBodyJson
  ): Promise<XummTypes.XummPostPayloadResponse> {
    try {
      const response = await this.xumm.payload?.create(payload)
      if (!response) {
        throw new ServiceError('Xamanペイロードの作成に失敗しました', 'INTERNAL_ERROR', 500)
      }
      return response
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error
      }
      console.error('Xamanペイロード作成エラー:', error)
      throw new ServiceError('Xamanペイロードの作成に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === COMMON UTILITIES ===

  /**
   * 一意識別子を生成
   */
  protected static generateIdentifier(prefix: string, input: string): string {
    const timestamp = Date.now().toString()
    const combined = `${input}-${timestamp}`
    // SHA-256ハッシュの最初の32文字を使用
    const hash = crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32)
    return `${prefix}${hash}`
  }

  /**
   * 期限切れチェック
   */
  protected static isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt
  }

  /**
   * ドキュメントの存在確認
   */
  protected static async documentExists(collection: string, docId: string): Promise<boolean> {
    try {
      const docSnap = await this.db.collection(collection).doc(docId).get()
      return docSnap.exists
    } catch (error) {
      console.error(`ドキュメント存在確認エラー (${collection}/${docId}):`, error)
      return false
    }
  }

  /**
   * 重複チェック
   */
  protected static async checkDuplicate(
    collection: string,
    field: string,
    value: any,
    excludeDocId?: string
  ): Promise<boolean> {
    try {
      const query = this.db.collection(collection).where(field, '==', value)
      const snapshot = await query.get()

      if (excludeDocId) {
        return snapshot.docs.some(doc => doc.id !== excludeDocId)
      }

      return !snapshot.empty
    } catch (error) {
      console.error(`重複チェックエラー (${collection}.${field}):`, error)
      return false
    }
  }

  /**
   * トランザクション実行
   */
  protected static async runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.runTransaction(updateFunction)
    } catch (error) {
      console.error('トランザクション実行エラー:', error)
      throw new ServiceError('トランザクションの実行に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }
}
