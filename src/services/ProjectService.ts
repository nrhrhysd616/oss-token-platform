/**
 * プロジェクト関連の共通サービス
 */

import { getAdminDb } from '../lib/firebase/admin'
import { assignIssuerWallet } from '../lib/xrpl/config'
import { convertTimestamps } from '../lib/firebase/utils'
import { FIRESTORE_COLLECTIONS } from '../lib/firebase/collections'
import { QualityScoreService } from './QualityScoreService'
import { PricingService } from './PricingService'
import { DonationService } from './DonationService'
import {
  projectUpdateApiSchema,
  type ProjectCreateApiData,
  type ProjectUpdateApiData,
  type ProjectQueryParams,
  type ProjectPublicQueryParams,
} from '../validations/project'
import type {
  Project,
  PublicProject,
  PublicProjectStats,
  MaintainerProject,
  MaintainerProjectStats,
} from '../types/project'
import type { Query, DocumentData } from 'firebase-admin/firestore'

/**
 * プロジェクトサービスエラークラス
 */
export class ProjectServiceError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'DUPLICATE' | 'INTERNAL_ERROR',
    public statusCode: number
  ) {
    super(message)
    this.name = 'ProjectServiceError'
  }
}

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
 * プロジェクトサービスクラス
 */
export class ProjectService {
  // === CREATE ===

  /**
   * プロジェクトを作成
   */
  static async createProject(
    projectData: ProjectCreateApiData,
    ownerUid: string
  ): Promise<Project> {
    try {
      const now = new Date()
      const projectDoc = {
        name: projectData.name,
        description: projectData.description,
        repositoryUrl: projectData.repositoryUrl,
        ownerUid,
        githubOwner: projectData.githubOwner,
        githubRepo: projectData.githubRepo,
        githubInstallationId: projectData.githubInstallationId,
        tokenCode: projectData.tokenCode,
        donationUsages: projectData.donationUsages,
        status: projectData.status,
        createdAt: now,
        updatedAt: now,
      }

      // Firestoreに保存
      const docRef = await getAdminDb().collection(FIRESTORE_COLLECTIONS.PROJECTS).add(projectDoc)

      // Issuerウォレットを割り当て
      let issuerAddress: string
      try {
        const assignedWallet = assignIssuerWallet(docRef.id)
        issuerAddress = assignedWallet.address
      } catch (error) {
        // プロジェクト作成は成功したが、Issuerウォレット割り当てに失敗した場合はプロジェクトを削除
        await docRef.delete()
        throw new ProjectServiceError(
          'Issuerウォレットの割り当てに失敗しました',
          'INTERNAL_ERROR',
          500
        )
      }

      // issuerAddressを追加してプロジェクトを更新
      await docRef.update({
        issuerAddress,
        updatedAt: new Date(),
      })

      const project = {
        id: docRef.id,
        ...projectDoc,
        issuerAddress,
      }

      // 品質スコアを更新（非同期、失敗してもプロジェクト作成は成功）
      QualityScoreService.updateQualityScore(docRef.id).catch(qualityScoreError => {
        console.error(
          `品質スコアの更新に失敗しました (プロジェクトID: ${docRef.id}):`,
          qualityScoreError
        )
      })

      return project
    } catch (error) {
      if (error instanceof ProjectServiceError) {
        throw error
      }
      console.error('プロジェクト作成エラー:', error)
      throw new ProjectServiceError('プロジェクトの作成に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === READ ===

  /**
   * プロジェクトIDからプロジェクト情報を取得
   */
  static async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const projectDoc = await getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .doc(projectId)
        .get()

      if (!projectDoc.exists) {
        return null
      }

      const projectData = projectDoc.data()
      if (!projectData) {
        return null
      }

      return convertTimestamps({
        id: projectDoc.id,
        ...projectData,
      }) as Project
    } catch (error) {
      console.error('プロジェクト取得エラー:', error)
      throw new ProjectServiceError(
        `プロジェクトの取得に失敗しました: ${projectId}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 公開プロジェクトIDから公開プロジェクト情報を取得（統計情報付き）
   */
  static async getPublicProjectById(projectId: string): Promise<PublicProject | null> {
    try {
      // 基本プロジェクト情報を取得
      const project = await this.getProjectById(projectId)

      if (!project || project.status !== 'active') {
        return null
      }

      // 統計情報を取得
      const stats = await this.getPublicProjectStats(projectId)

      // 公開情報のみを返却
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        repositoryUrl: project.repositoryUrl,
        githubOwner: project.githubOwner,
        githubRepo: project.githubRepo,
        tokenCode: project.tokenCode,
        donationUsages: project.donationUsages,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        status: project.status,
        stats,
      }
    } catch (error) {
      console.error('公開プロジェクト取得エラー:', error)
      throw new ProjectServiceError(
        `公開プロジェクトの取得に失敗しました: ${projectId}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 公開プロジェクト一覧を取得
   *
   * 使用インデックス:
   * - status + createdAt (DESC): status='active' + createdAt降順ソート時
   * - 注意: name, updatedAtソートは現在インデックス未対応
   */
  static async getPublicProjects(
    options: ProjectPublicQueryParams
  ): Promise<PaginatedResult<PublicProject>> {
    try {
      let query: Query<DocumentData> = getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('status', '==', 'active')

      // ソート
      query = query.orderBy(options.sortBy, options.sortOrder)

      // ページネーション
      query = query.limit(options.limit).offset(options.offset)

      const snapshot = await query.get()

      // 公開情報のみを含むプロジェクトリストを作成
      const publicProjects: PublicProject[] = await Promise.all(
        snapshot.docs.map(async doc => {
          const projectData = convertTimestamps({
            id: doc.id,
            ...doc.data(),
          }) as Project

          const stats: PublicProjectStats = await this.getPublicProjectStats(projectData.id)

          // 公開情報のみを返却
          return {
            id: projectData.id,
            name: projectData.name,
            description: projectData.description,
            repositoryUrl: projectData.repositoryUrl,
            githubOwner: projectData.githubOwner,
            githubRepo: projectData.githubRepo,
            tokenCode: projectData.tokenCode,
            donationUsages: projectData.donationUsages,
            createdAt: projectData.createdAt,
            updatedAt: projectData.updatedAt,
            status: projectData.status,
            stats,
          }
        })
      )

      // 総数を取得
      const countQuery = getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('status', '==', 'active')
      const countSnapshot = await countQuery.get()

      return {
        items: publicProjects,
        total: countSnapshot.size,
        limit: options.limit,
        offset: options.offset,
      }
    } catch (error) {
      console.error('公開プロジェクト一覧取得エラー:', error)
      throw new ProjectServiceError('プロジェクト一覧の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * メンテナーのプロジェクト一覧を取得
   *
   * 使用インデックス:
   * - ownerUid + createdAt (DESC): statusフィルタなし + createdAt降順ソート時
   * - ownerUid + status + createdAt (DESC): statusフィルタあり + createdAt降順ソート時
   * - 注意: name, updatedAtソートは現在インデックス未対応
   */
  static async getMaintainerProjects(
    ownerUid: string,
    options: ProjectQueryParams
  ): Promise<PaginatedResult<Project>> {
    try {
      let query: Query<DocumentData> = getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('ownerUid', '==', ownerUid)

      // ステータスフィルタリング
      if (options.status) {
        query = query.where('status', '==', options.status)
      }

      // ソート
      query = query.orderBy(options.sortBy, options.sortOrder)

      // ページネーション
      query = query.limit(options.limit).offset(options.offset)

      const snapshot = await query.get()
      const projects: Project[] = snapshot.docs.map(doc =>
        convertTimestamps({
          id: doc.id,
          ...doc.data(),
        })
      ) as Project[]

      // 総数を取得
      let countQuery: Query<DocumentData> = getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('ownerUid', '==', ownerUid)

      if (options.status) {
        countQuery = countQuery.where('status', '==', options.status)
      }

      const countSnapshot = await countQuery.get()

      return {
        items: projects,
        total: countSnapshot.size,
        limit: options.limit,
        offset: options.offset,
      }
    } catch (error) {
      console.error('メンテナープロジェクト一覧取得エラー:', error)
      throw new ProjectServiceError('プロジェクト一覧の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  /**
   * メンテナーのプロジェクト一覧を取得（統計情報付き）
   */
  static async getMaintainerProjectsWithDetails(
    ownerUid: string,
    options: ProjectQueryParams
  ): Promise<PaginatedResult<MaintainerProject>> {
    try {
      // 基本のプロジェクト一覧を取得
      const result = await this.getMaintainerProjects(ownerUid, options)

      // 各プロジェクトに統計情報を追加
      const maintainerProjects = await Promise.all(
        result.items.map(async project => {
          // 統計情報を取得
          const stats = await this.getMaintainerProjectStats(project.id)

          return {
            ...project,
            stats,
          }
        })
      )

      return {
        items: maintainerProjects,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }
    } catch (error) {
      console.error('メンテナープロジェクト詳細一覧取得エラー:', error)
      throw new ProjectServiceError('プロジェクト一覧の取得に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === UPDATE ===

  /**
   * プロジェクトを更新
   */
  static async updateProject(
    projectId: string,
    updates: ProjectUpdateApiData,
    ownerUid: string
  ): Promise<Project> {
    try {
      // 所有者チェック
      await this.checkProjectOwnership(projectId, ownerUid)

      // 更新データを準備
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      }

      // Firestoreを更新
      await getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .doc(projectId)
        .update(updateData)

      // 更新されたプロジェクトを取得
      const updatedProject = await this.getProjectById(projectId)
      if (!updatedProject) {
        throw new ProjectServiceError('更新後のプロジェクトが見つかりません', 'NOT_FOUND', 404)
      }

      return updatedProject
    } catch (error) {
      if (error instanceof ProjectServiceError) {
        throw error
      }
      console.error('プロジェクト更新エラー:', error)
      throw new ProjectServiceError('プロジェクトの更新に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === DELETE ===

  /**
   * プロジェクトを削除
   */
  static async deleteProject(projectId: string, ownerUid: string): Promise<void> {
    try {
      // 所有者チェック
      const project = await this.checkProjectOwnership(projectId, ownerUid)

      // アクティブなプロジェクトは削除不可
      if (project.status === 'active') {
        throw new ProjectServiceError(
          'アクティブなプロジェクトは削除できません。まずステータスを変更してください。',
          'VALIDATION_ERROR',
          400
        )
      }

      // 関連データの削除処理
      const db = getAdminDb()
      const batch = db.batch()

      try {
        // 1. 価格履歴を削除
        const priceHistorySnapshot = await db
          .collection(FIRESTORE_COLLECTIONS.PROJECTS)
          .doc(projectId)
          .collection(FIRESTORE_COLLECTIONS.PRICE_HISTORY)
          .get()

        priceHistorySnapshot.docs.forEach(doc => {
          batch.delete(doc.ref)
        })

        // 2. 品質スコア履歴を削除
        const qualityScoreSnapshot = await db
          .collection(FIRESTORE_COLLECTIONS.PROJECTS)
          .doc(projectId)
          .collection('qualityScores')
          .get()

        qualityScoreSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref)
        })

        // 3. プロジェクト本体を削除
        const projectRef = db.collection(FIRESTORE_COLLECTIONS.PROJECTS).doc(projectId)
        batch.delete(projectRef)

        // バッチ実行
        await batch.commit()

        console.log(`プロジェクト削除完了: ${projectId}`)
      } catch (batchError) {
        console.error('バッチ削除エラー:', batchError)
        // バッチ削除に失敗した場合は個別削除を試行
        await db.collection(FIRESTORE_COLLECTIONS.PROJECTS).doc(projectId).delete()
      }

      // 注意: 寄付記録とトークン発行記録は履歴として保持
      // これらのデータは監査やレポート目的で重要なため、論理削除または保持する
      console.log(`プロジェクト削除完了 (寄付記録は保持): ${projectId}`)
    } catch (error) {
      if (error instanceof ProjectServiceError) {
        throw error
      }
      console.error('プロジェクト削除エラー:', error)
      throw new ProjectServiceError('プロジェクトの削除に失敗しました', 'INTERNAL_ERROR', 500)
    }
  }

  // === VALIDATION & UTILITIES ===

  /**
   * プロジェクトの存在確認
   */
  static async projectExists(projectId: string): Promise<boolean> {
    try {
      const projectDoc = await getAdminDb()
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .doc(projectId)
        .get()
      return projectDoc.exists
    } catch (error) {
      console.error('プロジェクト存在確認エラー:', error)
      return false
    }
  }

  /**
   * プロジェクトの基本検証
   */
  static validateProject(project: Project): void {
    if (!project.tokenCode) {
      throw new Error(`プロジェクトのトークンコードが設定されていません: ${project.id}`)
    }

    if (!project.issuerAddress) {
      throw new Error(`プロジェクトのIssuerアドレスが設定されていません: ${project.id}`)
    }

    if (project.status !== 'active') {
      throw new Error(
        `プロジェクトがアクティブではありません: ${project.id} (status: ${project.status})`
      )
    }
  }

  /**
   * プロジェクトの所有者チェック
   */
  static async checkProjectOwnership(projectId: string, ownerUid: string): Promise<Project> {
    const project = await this.getProjectById(projectId)
    if (!project) {
      throw new ProjectServiceError('プロジェクトが見つかりません', 'NOT_FOUND', 404)
    }

    if (project.ownerUid !== ownerUid) {
      throw new ProjectServiceError(
        'このプロジェクトにアクセスする権限がありません',
        'UNAUTHORIZED',
        403
      )
    }

    return project
  }

  /**
   * 重複制約の検証
   *
   * 使用インデックス:
   * - name + ownerUid: プロジェクト名の重複チェック（同一オーナー内）
   * - repositoryUrl (単一フィールド): リポジトリURLの重複チェック（全体）
   * - tokenCode: 自動インデックス（単一フィールド等価クエリ）
   */
  static async validateUniqueConstraints(
    data: {
      name?: string
      tokenCode?: string
      repositoryUrl?: string
    },
    ownerUid: string,
    excludeProjectId?: string
  ): Promise<void> {
    const db = getAdminDb()

    // プロジェクト名の重複チェック（同一オーナー内）
    // 使用インデックス: name + ownerUid
    if (data.name) {
      let nameQuery = db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('name', '==', data.name)
        .where('ownerUid', '==', ownerUid)

      const nameSnapshot = await nameQuery.get()
      const duplicateName = nameSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateName) {
        throw new ProjectServiceError('プロジェクト名が既に存在します', 'DUPLICATE', 409)
      }
    }

    // トークンコードの重複チェック（全体）
    // 使用インデックス: tokenCode（自動インデックス）
    if (data.tokenCode) {
      const tokenQuery = db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('tokenCode', '==', data.tokenCode)
      const tokenSnapshot = await tokenQuery.get()
      const duplicateToken = tokenSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateToken) {
        throw new ProjectServiceError('トークンコードが既に存在します', 'DUPLICATE', 409)
      }
    }

    // リポジトリURLの重複チェック（全体）
    // 使用インデックス: repositoryUrl（単一フィールドインデックス）
    if (data.repositoryUrl) {
      const repoQuery = db
        .collection(FIRESTORE_COLLECTIONS.PROJECTS)
        .where('repositoryUrl', '==', data.repositoryUrl)
      const repoSnapshot = await repoQuery.get()
      const duplicateRepo = repoSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateRepo) {
        throw new ProjectServiceError('リポジトリが既に登録されています', 'DUPLICATE', 409)
      }
    }
  }

  /**
   * 公開プロジェクトの統計情報を取得
   */
  private static async getPublicProjectStats(projectId: string): Promise<PublicProjectStats> {
    try {
      // 寄付統計を取得
      const donationStats = await DonationService.getProjectDonationStats(projectId)

      // 現在価格を取得
      let currentPrice = 1.0
      try {
        const tokenPrice = await PricingService.calculateTokenPrice(projectId)
        currentPrice = tokenPrice.xrp
      } catch (error) {
        console.warn(`価格取得に失敗しました (プロジェクトID: ${projectId}):`, error)
        // 価格取得に失敗した場合はデフォルト値を使用
      }

      // 価格履歴を取得
      let priceHistory: Array<{ date: string; price: number }> = []
      try {
        const priceHistoryData = await PricingService.getPriceHistory(projectId, 30)
        priceHistory = priceHistoryData.map(record => ({
          date: record.date.toISOString(),
          price: record.priceXRP,
        }))
      } catch (error) {
        console.warn(`価格履歴取得に失敗しました (プロジェクトID: ${projectId}):`, error)
        // 価格履歴取得に失敗した場合は空配列を使用
      }

      return {
        totalDonations: donationStats.totalAmount,
        donorCount: donationStats.donorCount,
        currentPrice,
        priceHistory,
      }
    } catch (error) {
      console.error(`統計情報取得エラー (プロジェクトID: ${projectId}):`, error)
      // エラーが発生した場合はデフォルト値を返す
      return {
        totalDonations: 0,
        donorCount: 0,
        currentPrice: 1.0,
        priceHistory: [],
      }
    }
  }

  /**
   * メンテナー向けプロジェクトの統計情報を取得
   */
  private static async getMaintainerProjectStats(
    projectId: string
  ): Promise<MaintainerProjectStats> {
    try {
      // 公開統計を取得
      const publicStats = await this.getPublicProjectStats(projectId)

      // トークン総発行量を取得
      let tokenSupply = 0
      try {
        tokenSupply = await DonationService.getTotalTokenSupply(projectId)
      } catch (error) {
        console.warn(`トークン総発行量取得に失敗しました (プロジェクトID: ${projectId}):`, error)
        // トークン総発行量取得に失敗した場合はデフォルト値を使用
      }

      // 最近の寄付履歴を取得
      let recentDonations: Array<{
        amount: number
        donorAddress: string
        timestamp: string
        txHash: string
      }> = []
      try {
        const recentDonationsData = await DonationService.getRecentDonations(10)
        recentDonations = recentDonationsData
          .filter(donation => donation.projectId === projectId)
          .map(donation => ({
            amount: donation.amount,
            donorAddress: donation.donorAddress,
            timestamp: donation.createdAt.toISOString(),
            txHash: donation.txHash,
          }))
      } catch (error) {
        console.warn(`最近の寄付履歴取得に失敗しました (プロジェクトID: ${projectId}):`, error)
        // 最近の寄付履歴取得に失敗した場合は空配列を使用
      }

      return {
        ...publicStats,
        tokenSupply,
        recentDonations,
      }
    } catch (error) {
      console.error(`メンテナー統計情報取得エラー (プロジェクトID: ${projectId}):`, error)
      // エラーが発生した場合はデフォルト値を返す
      return {
        totalDonations: 0,
        donorCount: 0,
        currentPrice: 1.0,
        priceHistory: [],
        tokenSupply: 0,
        recentDonations: [],
      }
    }
  }
}
