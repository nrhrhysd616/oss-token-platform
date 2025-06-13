/**
 * 品質スコア管理サービス
 */

import { BaseService } from './shared/BaseService'
import { ServiceError } from './shared/ServiceError'
import { fetchGitHubMetrics } from '@/lib/pricing/quality-metrics'
import {
  createQualityScoreBreakdown,
  calculateOverallQualityScore,
  validateNormalizationConfig,
  validateWeightSum,
} from '@/lib/pricing/normalizer'
import type { QualityScore, QualityParameter, GitHubMetrics } from '@/types/pricing'
import { Project } from '@/types/project'
import { collectionPath, docPath } from '@/lib/firebase/collections'

export class QualityScoreServiceError extends ServiceError {
  public readonly name = 'QualityScoreServiceError'
}

export class QualityScoreService extends BaseService {
  /**
   * プロジェクトの品質スコアを更新
   */
  static async updateQualityScore(project: Project): Promise<QualityScore> {
    // Installation IDを取得
    const installationId = project.githubInstallationId
    if (!installationId) {
      throw new QualityScoreServiceError(
        `GitHub Installation ID not found for project: ${project.id}`,
        'VALIDATION_ERROR',
        400
      )
    }

    // GitHub指標を取得
    let githubMetrics: GitHubMetrics
    try {
      githubMetrics = await fetchGitHubMetrics(
        project.githubOwner,
        project.githubRepo,
        installationId
      )
    } catch (githubError) {
      // GitHub関連のエラーを詳細に処理
      if (githubError instanceof Error) {
        if (githubError.message.includes('Access denied')) {
          throw new QualityScoreServiceError(
            `GitHub App installation does not have access to repository ${project.githubOwner}/${project.githubRepo}. Please check installation permissions.`,
            'UNAUTHORIZED',
            403
          )
        }
        if (githubError.message.includes('Repository not found')) {
          throw new QualityScoreServiceError(
            `Repository ${project.githubOwner}/${project.githubRepo} not found or not accessible.`,
            'NOT_FOUND',
            404
          )
        }
        if (githubError.message.includes('Installation')) {
          throw new QualityScoreServiceError(
            `GitHub App installation error: ${githubError.message}`,
            'UNAUTHORIZED',
            403
          )
        }
      }
      // その他のGitHubエラーは再スロー
      throw githubError
    }

    // 品質パラメータを取得
    const qualityParameters = await this.getQualityParameters()

    // 品質スコアを計算
    const qualityScore = await this.calculateQualityScore(githubMetrics, qualityParameters)

    // BaseServiceのupdateDocumentByPathを使用してFirestoreに保存
    await this.updateDocumentByPath(docPath.project(project.id), {
      qualityScore: {
        overall: qualityScore.overall,
        breakdown: qualityScore.breakdown,
        lastUpdated: qualityScore.lastUpdated,
      },
    })

    return qualityScore
  }

  /**
   * 全プロジェクトの品質スコアを一括更新
   */
  static async updateAllQualityScores(): Promise<{
    success: number
    failed: number
    errors: { projectId: string; error: string }[]
  }> {
    // BaseServiceのexecutePaginatedQueryを使用してアクティブプロジェクトを取得
    const baseQuery = this.createQueryByPath(collectionPath.projects()).where(
      'status',
      '==',
      'active'
    )

    const result = await this.executePaginatedQuery<Project>(baseQuery, {
      limit: 1000, // 大きな値を設定して全件取得
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { projectId: string; error: string }[],
    }

    // 並行処理でレート制限を考慮（同時実行数を制限）
    const batchSize = 5

    for (let i = 0; i < result.items.length; i += batchSize) {
      const batch = result.items.slice(i, i + batchSize)

      await Promise.allSettled(
        batch.map(async project => {
          try {
            await this.updateQualityScore(project)
            results.success++
          } catch (error) {
            results.failed++
            results.errors.push({
              projectId: project.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        })
      )

      // レート制限対策: バッチ間で少し待機
      if (i + batchSize < result.items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    return results
  }

  /**
   * 品質スコアが古いプロジェクトを取得
   */
  static async getStaleQualityScores(maxAgeHours: number = 24): Promise<string[]> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)

    // BaseServiceのexecutePaginatedQueryを使用してアクティブプロジェクトを取得
    const baseQuery = this.createQueryByPath(collectionPath.projects()).where(
      'status',
      '==',
      'active'
    )

    const result = await this.executePaginatedQuery<Project>(baseQuery, {
      limit: 1000, // 大きな値を設定して全件取得
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    const staleProjectIds: string[] = []

    result.items.forEach(project => {
      const lastUpdated = project.qualityScore?.lastUpdated

      if (!lastUpdated || lastUpdated < cutoffTime) {
        staleProjectIds.push(project.id)
      }
    })

    return staleProjectIds
  }

  /**
   * 品質スコアの統計情報を取得
   */
  static async getQualityScoreStats(): Promise<{
    totalProjects: number
    averageScore: number
    scoreDistribution: Record<string, number>
    lastUpdated: Date | null
  }> {
    // BaseServiceのexecutePaginatedQueryを使用してアクティブプロジェクトを取得
    const baseQuery = this.createQueryByPath(collectionPath.projects()).where(
      'status',
      '==',
      'active'
    )

    const result = await this.executePaginatedQuery<Project>(baseQuery, {
      limit: 1000, // 大きな値を設定して全件取得
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    const scores: number[] = []
    let latestUpdate: Date | null = null

    result.items.forEach(project => {
      const qualityScore = project.qualityScore

      if (qualityScore?.overall !== undefined) {
        scores.push(qualityScore.overall)

        const lastUpdated = qualityScore.lastUpdated
        if (lastUpdated && (!latestUpdate || lastUpdated > latestUpdate)) {
          latestUpdate = lastUpdated
        }
      }
    })

    const averageScore =
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0

    // スコア分布を計算（0.1刻み）
    const scoreDistribution: Record<string, number> = {}
    for (let i = 0; i <= 10; i++) {
      const range = `${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}`
      scoreDistribution[range] = 0
    }

    scores.forEach(score => {
      const bucket = Math.min(Math.floor(score * 10), 9)
      const range = `${(bucket / 10).toFixed(1)}-${((bucket + 1) / 10).toFixed(1)}`
      scoreDistribution[range]++
    })

    return {
      totalProjects: result.total,
      averageScore,
      scoreDistribution,
      lastUpdated: latestUpdate,
    }
  }

  /**
   * 品質スコアを計算
   */
  private static async calculateQualityScore(
    githubMetrics: GitHubMetrics,
    qualityParameters: QualityParameter[]
  ): Promise<QualityScore> {
    // パラメータのバリデーション
    for (const parameter of qualityParameters) {
      validateNormalizationConfig(parameter)
    }
    validateWeightSum(qualityParameters)

    // 品質スコアの内訳を作成
    const breakdown = createQualityScoreBreakdown(githubMetrics, qualityParameters)

    // 総合スコアを計算
    const overall = calculateOverallQualityScore(breakdown, qualityParameters)

    return {
      overall,
      breakdown,
      lastUpdated: new Date(),
    }
  }

  /**
   * プロジェクトの品質スコアを取得
   */
  static async getQualityScore(projectId: string): Promise<QualityScore | null> {
    // BaseServiceのgetDocumentByPathを使用してプロジェクト情報を取得
    const project = await this.getDocumentByPath<Project>(docPath.project(projectId))
    if (!project) {
      return null
    }

    const qualityScoreData = project.qualityScore

    if (!qualityScoreData) {
      return null
    }

    return {
      overall: qualityScoreData.overall,
      breakdown: qualityScoreData.breakdown,
      lastUpdated: qualityScoreData.lastUpdated,
    }
  }

  /**
   * 品質パラメータを取得
   */
  static async getQualityParameters(): Promise<QualityParameter[]> {
    // 新しいパス文字列ベースのメソッドを使用してベースクエリを作成
    const baseQuery = this.createQueryByPath(collectionPath.settingsQualityParameters()).where(
      'enabled',
      '==',
      true
    )

    // BaseServiceのexecutePaginatedQueryを使用して効率的に取得
    const result = await baseQuery.get()

    if (result.empty) {
      throw new QualityScoreServiceError(
        'No enabled quality parameters found',
        'VALIDATION_ERROR',
        404
      )
    }

    return result.docs.map(doc => doc.data() as QualityParameter)
  }
}
