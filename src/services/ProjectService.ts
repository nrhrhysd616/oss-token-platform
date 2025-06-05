/**
 * プロジェクト関連の共通サービス
 */

import { getAdminDb } from '../lib/firebase/admin'
import { assignIssuerWallet } from '../lib/xrpl/config'
import { convertTimestamps } from '../lib/firebase/utils'
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
      const docRef = await getAdminDb().collection('projects').add(projectDoc)

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

      return {
        id: docRef.id,
        ...projectDoc,
        issuerAddress,
      }
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
      const projectDoc = await getAdminDb().collection('projects').doc(projectId).get()

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
   * 公開プロジェクト一覧を取得
   */
  static async getPublicProjects(
    options: ProjectPublicQueryParams
  ): Promise<PaginatedResult<PublicProject>> {
    try {
      let query: Query<DocumentData> = getAdminDb()
        .collection('projects')
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

          // TODO: 実際の統計情報を取得する処理を実装
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
      const countQuery = getAdminDb().collection('projects').where('status', '==', 'active')
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
   */
  static async getMaintainerProjects(
    ownerUid: string,
    options: ProjectQueryParams
  ): Promise<PaginatedResult<Project>> {
    try {
      let query: Query<DocumentData> = getAdminDb()
        .collection('projects')
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
        .collection('projects')
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
          // 統計情報を取得（現在はダミーデータ）
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
      await getAdminDb().collection('projects').doc(projectId).update(updateData)

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

      // TODO: 関連データの削除処理を実装
      // - 寄付記録の処理
      // - トークン発行記録の処理
      // - 統計データの処理

      // プロジェクトを削除
      await getAdminDb().collection('projects').doc(projectId).delete()
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
      const projectDoc = await getAdminDb().collection('projects').doc(projectId).get()
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
    if (data.name) {
      let nameQuery = db
        .collection('projects')
        .where('name', '==', data.name)
        .where('ownerUid', '==', ownerUid)

      const nameSnapshot = await nameQuery.get()
      const duplicateName = nameSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateName) {
        throw new ProjectServiceError('プロジェクト名が既に存在します', 'DUPLICATE', 409)
      }
    }

    // トークンコードの重複チェック（全体）
    if (data.tokenCode) {
      const tokenQuery = db.collection('projects').where('tokenCode', '==', data.tokenCode)
      const tokenSnapshot = await tokenQuery.get()
      const duplicateToken = tokenSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateToken) {
        throw new ProjectServiceError('トークンコードが既に存在します', 'DUPLICATE', 409)
      }
    }

    // リポジトリURLの重複チェック（全体）
    if (data.repositoryUrl) {
      const repoQuery = db.collection('projects').where('repositoryUrl', '==', data.repositoryUrl)
      const repoSnapshot = await repoQuery.get()
      const duplicateRepo = repoSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateRepo) {
        throw new ProjectServiceError('リポジトリが既に登録されています', 'DUPLICATE', 409)
      }
    }
  }

  /**
   * 公開プロジェクトの統計情報を取得
   * TODO: 実際の統計データを計算する処理を実装
   */
  private static async getPublicProjectStats(projectId: string): Promise<PublicProjectStats> {
    // TODO: 実際の統計情報を取得する処理を実装
    return {
      totalDonations: 0,
      donorCount: 0,
      currentPrice: 1.0,
      priceHistory: [
        { date: '2024-01-01', price: 1.0 },
        { date: '2024-01-02', price: 1.1 },
        { date: '2024-01-03', price: 1.2 },
      ],
    }
  }

  /**
   * メンテナー向けプロジェクトの統計情報を取得
   * TODO: 実際の統計データを計算する処理を実装
   */
  private static async getMaintainerProjectStats(
    projectId: string
  ): Promise<MaintainerProjectStats> {
    // TODO: 実際の統計情報を取得する処理を実装
    // - Firestoreから該当プロジェクトの寄付履歴を取得
    // - XRPLから該当トークンの詳細情報（供給量、価格等）を取得
    // - 最近の寄付履歴の取得と表示
    return {
      totalDonations: 0,
      donorCount: 0,
      currentPrice: 1.0,
      priceHistory: [
        { date: '2024-01-01', price: 1.0 },
        { date: '2024-01-02', price: 1.1 },
        { date: '2024-01-03', price: 1.2 },
      ],
      tokenSupply: 0,
      recentDonations: [],
    }
  }
}
