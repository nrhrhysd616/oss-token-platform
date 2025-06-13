/**
 * サービス共通基底クラス
 */

import crypto from 'crypto'
import { getAdminDb } from '@/lib/firebase/admin'
import { convertTimestamps } from '@/lib/firebase/utils'
import { getXummInstance } from '@/lib/xaman'
import { ServiceError } from './ServiceError'
import type { XummTypes } from 'xumm-sdk'
import type { Query, DocumentData, OrderByDirection } from 'firebase-admin/firestore'

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
  sortOrder: OrderByDirection
}

/**
 * サービス基底クラス
 */
export abstract class BaseService {
  protected static db = getAdminDb()
  protected static xumm = getXummInstance()

  // === BYPATH DOCUMENT OPERATIONS ===

  /**
   * パス文字列からドキュメントを取得
   * @param path - "collection/docId/subcollection/subdocId" 形式のパス
   */
  protected static async getDocumentByPath<T>(path: string): Promise<T | null> {
    const segments = path.split('/').filter(segment => segment.length > 0)

    if (segments.length === 0 || segments.length % 2 !== 0) {
      console.error(`パス指定ドキュメント取得エラー: ${path}`)
      throw new ServiceError(
        'パスは "collection/docId" のペア形式である必要があります',
        'VALIDATION_ERROR',
        400
      )
    }

    let ref: any = this.db

    // パスを順次辿ってドキュメント参照を構築
    for (let i = 0; i < segments.length; i += 2) {
      const collection = segments[i]
      const docId = segments[i + 1]
      ref = ref.collection(collection).doc(docId)
    }

    const docSnap = await ref.get()

    if (!docSnap.exists) {
      return null
    }

    return convertTimestamps({
      id: docSnap.id,
      ...docSnap.data(),
    }) as T
  }

  protected static getDocumentRefByPath(
    path: string
  ): FirebaseFirestore.DocumentReference<DocumentData> {
    const segments = path.split('/').filter(segment => segment.length > 0)

    if (segments.length === 0 || segments.length % 2 !== 0) {
      throw new ServiceError(
        'パスは "collection/docId" のペア形式である必要があります',
        'VALIDATION_ERROR',
        400
      )
    }

    let ref: any = this.db

    // パスを順次辿ってドキュメント参照を構築
    for (let i = 0; i < segments.length; i += 2) {
      const collection = segments[i]
      const docId = segments[i + 1]
      ref = ref.collection(collection).doc(docId)
    }

    return ref
  }

  protected static async getCollecionByPath<T>(path: string): Promise<T[]> {
    const segments = path.split('/').filter(segment => segment.length > 0)

    // パスは奇数長である必要がある（最後がコレクション名）
    if (segments.length === 0 || segments.length % 2 === 0) {
      console.error(`パス指定コレクション取得エラー: ${path}`)
      throw new ServiceError(
        'getCollecionByPathのパスは奇数長である必要があります（最後はコレクション名）。例: "collection" または "collection/docId/subcollection"',
        'VALIDATION_ERROR',
        400
      )
    }

    let ref: any = this.db

    // 最後のセグメント（コレクション名）を除いて、collection/docIdのペアを順次辿る
    for (let i = 0; i < segments.length - 1; i += 2) {
      const collection = segments[i]
      const docIdSegment = segments[i + 1]
      if (!docIdSegment) {
        throw new ServiceError(
          'パスの形式が正しくありません。"collection/docId/..." の形式である必要があります',
          'VALIDATION_ERROR',
          400
        )
      }
      ref = ref.collection(collection).doc(docIdSegment)
    }

    // 最後のコレクションを返す
    const finalCollection = segments[segments.length - 1]

    const snapshot = (await ref
      .collection(finalCollection)
      .get()) as FirebaseFirestore.QuerySnapshot<DocumentData>

    return snapshot.docs.map(doc => {
      return convertTimestamps({
        id: doc.id,
        ...doc.data(),
      }) as T
    })
  }

  /**
   * パス文字列でドキュメントを作成
   * @param path - "collection/docId/subcollection" 形式のパス（最後は必ずコレクション名）
   * @param data - 作成するドキュメントのデータ
   * @param docId - 指定するドキュメントID（省略時は自動生成）
   */
  protected static async createDocumentByPath<T>(
    path: string,
    data: Omit<T, 'id'>,
    docId?: string
  ): Promise<T> {
    try {
      const segments = path.split('/').filter(segment => segment.length > 0)

      // パスは奇数長である必要がある（最後がコレクション名）
      if (segments.length === 0 || segments.length % 2 === 0) {
        throw new ServiceError(
          'createDocumentByPathのパスは奇数長である必要があります（最後はコレクション名）。例: "collection" または "collection/docId/subcollection"',
          'VALIDATION_ERROR',
          400
        )
      }

      let ref: any = this.db

      // 最後のセグメント（コレクション名）を除いて、collection/docIdのペアを順次辿る
      for (let i = 0; i < segments.length - 1; i += 2) {
        const collection = segments[i]
        const docIdSegment = segments[i + 1]
        if (!docIdSegment) {
          throw new ServiceError(
            'パスの形式が正しくありません。"collection/docId/..." の形式である必要があります',
            'VALIDATION_ERROR',
            400
          )
        }
        ref = ref.collection(collection).doc(docIdSegment)
      }

      // 最後のコレクションでドキュメントを作成
      const finalCollection = segments[segments.length - 1]
      const collectionRef = ref.collection(finalCollection)
      const docRef = docId ? collectionRef.doc(docId) : collectionRef.doc()

      await docRef.set(data)

      return {
        id: docRef.id,
        ...data,
      } as T
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error
      }
      console.error(`パス指定ドキュメント作成エラー (${path}):`, error)
      throw new ServiceError(`ドキュメントの作成に失敗しました: ${path}`, 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * パス文字列でドキュメントを更新
   * @param path - "collection/docId/subcollection/subdocId" 形式のパス
   * @param updates - 更新するデータ
   */
  protected static async updateDocumentByPath<T>(path: string, updates: Partial<T>): Promise<void> {
    try {
      const segments = path.split('/').filter(segment => segment.length > 0)

      if (segments.length === 0 || segments.length % 2 !== 0) {
        throw new ServiceError(
          'パスは "collection/docId" のペア形式である必要があります',
          'VALIDATION_ERROR',
          400
        )
      }

      let ref: any = this.db

      // パスを順次辿ってドキュメント参照を構築
      for (let i = 0; i < segments.length; i += 2) {
        const collection = segments[i]
        const docId = segments[i + 1]
        ref = ref.collection(collection).doc(docId)
      }

      await ref.update({
        ...updates,
        updatedAt: new Date(),
      })
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error
      }
      console.error(`パス指定ドキュメント更新エラー (${path}):`, error)
      throw new ServiceError(`ドキュメントの更新に失敗しました: ${path}`, 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * パス文字列でドキュメントを削除
   * @param path - "collection/docId/subcollection/subdocId" 形式のパス
   */
  protected static async deleteDocumentByPath(path: string): Promise<void> {
    try {
      const segments = path.split('/').filter(segment => segment.length > 0)

      if (segments.length === 0 || segments.length % 2 !== 0) {
        throw new ServiceError(
          'パスは "collection/docId" のペア形式である必要があります',
          'VALIDATION_ERROR',
          400
        )
      }

      let ref: any = this.db

      // パスを順次辿ってドキュメント参照を構築
      for (let i = 0; i < segments.length; i += 2) {
        const collection = segments[i]
        const docId = segments[i + 1]
        ref = ref.collection(collection).doc(docId)
      }

      await ref.delete()
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error
      }
      console.error(`パス指定ドキュメント削除エラー (${path}):`, error)
      throw new ServiceError(`ドキュメントの削除に失敗しました: ${path}`, 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * パス文字列でドキュメントの存在確認
   * @param path - "collection/docId/subcollection/subdocId" 形式のパス
   */
  protected static async documentExistsByPath(path: string): Promise<boolean> {
    try {
      const segments = path.split('/').filter(segment => segment.length > 0)

      if (segments.length === 0 || segments.length % 2 !== 0) {
        return false
      }

      let ref: any = this.db

      // パスを順次辿ってドキュメント参照を構築
      for (let i = 0; i < segments.length; i += 2) {
        const collection = segments[i]
        const docId = segments[i + 1]
        ref = ref.collection(collection).doc(docId)
      }

      const docSnap = await ref.get()
      return docSnap.exists
    } catch (error) {
      console.error(`パス指定ドキュメント存在確認エラー (${path}):`, error)
      return false
    }
  }

  /**
   * パス文字列からクエリを作成
   * @param path - "collection/docId/subcollection" 形式のパス（最後は必ずコレクション名）
   */
  protected static createQueryByPath(path: string): Query<DocumentData> {
    const segments = path.split('/').filter(segment => segment.length > 0)

    // パスは奇数長である必要がある（最後がコレクション名）
    if (segments.length === 0 || segments.length % 2 === 0) {
      throw new ServiceError(
        'createQueryByPathのパスは奇数長である必要があります（最後はコレクション名）。例: "collection" または "collection/docId/subcollection"',
        'VALIDATION_ERROR',
        400
      )
    }

    let ref: any = this.db

    // 最後のセグメント（コレクション名）を除いて、collection/docIdのペアを順次辿る
    for (let i = 0; i < segments.length - 1; i += 2) {
      const collection = segments[i]
      const docIdSegment = segments[i + 1]
      if (!docIdSegment) {
        throw new ServiceError(
          'パスの形式が正しくありません。"collection/docId/..." の形式である必要があります',
          'VALIDATION_ERROR',
          400
        )
      }
      ref = ref.collection(collection).doc(docIdSegment)
    }

    // 最後のコレクションを返す
    const finalCollection = segments[segments.length - 1]
    return ref.collection(finalCollection)
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

  /**
   * Xamanペイロードの状態をチェック
   */
  protected static async checkXamanPayloadStatus(
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
  protected static async cancelXamanPayload(payloadUuid: string): Promise<void> {
    try {
      await this.xumm.payload?.cancel(payloadUuid)
    } catch (error) {
      console.error('ペイロードキャンセルエラー:', error)
      throw new ServiceError('ペイロードのキャンセルに失敗しました', 'INTERNAL_ERROR', 500)
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
