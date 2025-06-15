/**
 * プロジェクト関連の共通サービス
 */

import { assignIssuerWallet } from '../lib/xrpl/config'
import { collectionPath, docPath } from '../lib/firebase/collections'
import { QualityScoreService } from './QualityScoreService'
import { PricingService } from './PricingService'
import { DonationService } from './DonationService'
import {
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
import { ServiceError } from './shared/ServiceError'
import { BaseService, type PaginatedResult } from './shared/BaseService'

/**
 * プロジェクトサービスエラークラス
 */
export class ProjectServiceError extends ServiceError {
  public readonly name = 'ProjectServiceError'
}

/**
 * プロジェクトサービスクラス
 */
export class ProjectService extends BaseService {
  // === CREATE ===

  /**
   * プロジェクトを作成
   */
  static async createProject(
    projectData: ProjectCreateApiData,
    ownerUid: string
  ): Promise<Project> {
    const now = new Date()
    const projectDoc: Omit<Project, 'id'> = {
      name: projectData.name,
      description: projectData.description,
      repositoryUrl: projectData.repositoryUrl,
      ownerUid,
      githubOwner: projectData.githubOwner,
      githubRepo: projectData.githubRepo,
      githubInstallationId: projectData.githubInstallationId,
      tokenCode: projectData.tokenCode,
      issuerAddress: '', // 初期は空文字、後で割り当て
      donationUsages: projectData.donationUsages,
      status: projectData.status,
      createdAt: now,
      updatedAt: now,
    }

    // BaseServiceのcreateDocumentByPathを使用してプロジェクトを作成
    const createdProject = await this.createDocumentByPath<Project>(
      collectionPath.projects(),
      projectDoc
    )

    // Issuerウォレットを割り当て
    let issuerAddress: string
    try {
      const assignedWallet = assignIssuerWallet(createdProject.id)
      issuerAddress = assignedWallet.address
    } catch (error) {
      // プロジェクト作成は成功したが、Issuerウォレット割り当てに失敗した場合はプロジェクトを削除
      await this.deleteDocumentByPath(docPath.project(createdProject.id))
      throw new ProjectServiceError('Issuerアドレスの割り当てに失敗しました', 'INTERNAL_ERROR', 500)
    }

    // BaseServiceのupdateDocumentByPathを使用してissuerAddressを追加
    await this.updateDocumentByPath<Project>(docPath.project(createdProject.id), {
      issuerAddress,
    })

    const project = {
      ...createdProject,
      issuerAddress,
    }

    // 品質スコアを更新（非同期、失敗してもプロジェクト作成は成功）
    await QualityScoreService.updateQualityScore(createdProject).catch(qualityScoreError => {
      console.error(
        `品質スコアの更新に失敗しました (プロジェクトID: ${createdProject.id}):`,
        qualityScoreError
      )
    })
    return project
  }

  // === READ ===

  /**
   * プロジェクトIDからプロジェクト情報を取得
   */
  static async getProjectById(projectId: string): Promise<Project | null> {
    return await this.getDocumentByPath<Project>(docPath.project(projectId))
  }

  /**
   * 公開プロジェクトIDから公開プロジェクト情報を取得（統計情報付き）
   */
  static async getPublicProjectById(projectId: string): Promise<PublicProject | null> {
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
  }

  /**
   * 公開プロジェクト一覧を取得
   *
   * インデックス設定済み
   */
  static async getPublicProjects(
    options: ProjectPublicQueryParams
  ): Promise<PaginatedResult<PublicProject>> {
    const baseQuery = this.createQueryByPath(collectionPath.projects()).where(
      'status',
      '==',
      'active'
    )

    const result = await this.executePaginatedQuery<Project>(baseQuery, {
      limit: options.limit,
      offset: options.offset,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    })

    // 公開情報のみを含むプロジェクトリストを作成
    const publicProjects: PublicProject[] = await Promise.all(
      result.items.map(async project => {
        const stats: PublicProjectStats = await this.getPublicProjectStats(project.id)

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
      })
    )

    return {
      items: publicProjects,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    }
  }

  /**
   * メンテナーのプロジェクト一覧を取得
   *
   * インデックス設定済み
   */
  static async getMaintainerProjects(
    ownerUid: string,
    options: ProjectQueryParams
  ): Promise<PaginatedResult<Project>> {
    // BaseServiceのexecutePaginatedQueryを使用
    let baseQuery = this.createQueryByPath(collectionPath.projects()).where(
      'ownerUid',
      '==',
      ownerUid
    )

    // ステータスフィルタリング
    if (options.status) {
      baseQuery = baseQuery.where('status', '==', options.status)
    }

    const result = await this.executePaginatedQuery<Project>(baseQuery, {
      limit: options.limit,
      offset: options.offset,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    })
    return result
  }

  /**
   * メンテナーのプロジェクト一覧を取得（統計情報付き）
   *
   * メンテナーの一覧にスタッツは不要と判断し、利用していない状況
   */
  static async getMaintainerProjectsWithDetails(
    ownerUid: string,
    options: ProjectQueryParams
  ): Promise<PaginatedResult<MaintainerProject>> {
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
    // 所有者チェック
    await this.checkProjectOwnership(projectId, ownerUid)

    // BaseServiceのupdateDocumentByPathを使用
    await this.updateDocumentByPath<Project>(docPath.project(projectId), updates)

    // 更新されたプロジェクトを取得
    const updatedProject = await this.getProjectById(projectId)

    if (updates.status === 'active') {
      // 品質スコアを更新（非同期、失敗してもプロジェクト更新は成功）
      await QualityScoreService.updateQualityScore(updatedProject!).catch(qualityScoreError => {
        console.error(
          `品質スコアの更新に失敗しました (プロジェクトID: ${projectId}):`,
          qualityScoreError
        )
      })
    }
    return updatedProject!
  }

  // === DELETE ===

  /**
   * プロジェクトを削除
   * 現在は未実装
   */
  //   static async deleteProject(projectId: string, ownerUid: string): Promise<void> {
  //   }

  // === VALIDATION & UTILITIES ===

  /**
   * プロジェクトの存在確認
   */
  static async projectExists(projectId: string): Promise<boolean> {
    return await this.documentExistsByPath(docPath.project(projectId))
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
    // プロジェクト名の重複チェック（同一オーナー内）
    // 使用インデックス: name + ownerUid
    if (data.name) {
      let nameQuery = this.createQueryByPath(collectionPath.projects())
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
      const tokenQuery = this.createQueryByPath(collectionPath.projects()).where(
        'tokenCode',
        '==',
        data.tokenCode
      )
      const tokenSnapshot = await tokenQuery.get()
      const duplicateToken = tokenSnapshot.docs.find(doc => doc.id !== excludeProjectId)

      if (duplicateToken) {
        throw new ProjectServiceError('トークンコードが既に存在します', 'DUPLICATE', 409)
      }
    }

    // リポジトリURLの重複チェック（全体）
    // 使用インデックス: repositoryUrl（単一フィールドインデックス）
    if (data.repositoryUrl) {
      const repoQuery = this.createQueryByPath(collectionPath.projects()).where(
        'repositoryUrl',
        '==',
        data.repositoryUrl
      )
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
    // 寄付統計を取得
    const donationStats = await DonationService.getProjectDonationStats(projectId)

    // 現在価格を取得
    const tokenPrice = await PricingService.calculateTokenPrice(projectId)
    const currentPrice = tokenPrice.xrp

    // 価格履歴を取得
    let priceHistory: { price: number; createdAt: string }[] = []
    const priceHistoryData = await PricingService.getPriceHistory(projectId, 30)
    priceHistory = priceHistoryData.map(record => ({
      price: record.priceXRP,
      createdAt: record.createdAt.toISOString(),
    }))

    return {
      totalXrpDonations: donationStats.totalXrpAmount,
      donorCount: donationStats.donorCount,
      currentPrice,
      priceHistory,
    }
  }

  /**
   * メンテナー向けプロジェクトの統計情報を取得
   */
  private static async getMaintainerProjectStats(
    projectId: string
  ): Promise<MaintainerProjectStats> {
    // 公開統計を取得
    const publicStats = await this.getPublicProjectStats(projectId)

    // トークン総発行量を取得
    const tokenSupply = await DonationService.getTotalTokenSupply(projectId)

    // 最近の寄付履歴を取得
    const recentDonationsData = await DonationService.getDonationHistory({ projectId, limit: 10 })
    const recentDonations = recentDonationsData
      .filter(donation => donation.projectId === projectId)
      .map(donation => ({
        xrpAmount: donation.xrpAmount,
        donorAddress: donation.donorAddress,
        timestamp: donation.createdAt.toISOString(),
        txHash: donation.txHash,
      }))

    return {
      ...publicStats,
      tokenSupply,
      recentDonations,
    }
  }
}
