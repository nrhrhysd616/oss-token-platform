/**
 * 品質スコア管理サービス
 */

import { BaseService } from './shared/BaseService'
import { ServiceError } from './shared/ServiceError'
import { getAdminDb } from '@/lib/firebase/admin'
import { fetchGitHubMetrics } from '@/lib/pricing/quality-metrics'
import {
  createQualityScoreBreakdown,
  calculateOverallQualityScore,
  validateNormalizationConfig,
  validateWeightSum,
} from '@/lib/pricing/normalizer'
import type {
  QualityScore,
  QualityParameter,
  GitHubMetrics,
  QualityScoreBreakdown,
} from '@/types/pricing'

export class QualityScoreServiceError extends ServiceError {
  constructor(
    message: string,
    code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'VALIDATION_ERROR'
      | 'DUPLICATE'
      | 'EXPIRED'
      | 'INTERNAL_ERROR' = 'INTERNAL_ERROR',
    statusCode: number = 500
  ) {
    super(message, code, statusCode)
    this.name = 'QualityScoreServiceError'
  }
}

export class QualityScoreService extends BaseService {
  /**
   * プロジェクトの品質スコアを更新
   */
  static async updateQualityScore(projectId: string): Promise<QualityScore> {
    try {
      const db = getAdminDb()
      // プロジェクト情報を取得
      const projectDoc = await db.collection('projects').doc(projectId).get()
      if (!projectDoc.exists) {
        throw new QualityScoreServiceError(`Project not found: ${projectId}`, 'NOT_FOUND', 404)
      }

      const project = projectDoc.data()
      if (!project) {
        throw new QualityScoreServiceError('Project data is empty', 'VALIDATION_ERROR', 400)
      }

      // Installation IDを取得
      const installationId = project.githubInstallationId
      if (!installationId) {
        throw new QualityScoreServiceError(
          `GitHub Installation ID not found for project: ${projectId}`,
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

      // Firestoreに保存
      await db
        .collection('projects')
        .doc(projectId)
        .update({
          qualityScore: {
            overall: qualityScore.overall,
            breakdown: qualityScore.breakdown,
            lastUpdated: qualityScore.lastUpdated,
          },
        })

      return qualityScore
    } catch (error) {
      if (error instanceof QualityScoreServiceError) {
        throw error
      }
      throw new QualityScoreServiceError(
        `Failed to update quality score: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * プロジェクトの品質スコアを取得
   */
  static async getQualityScore(projectId: string): Promise<QualityScore | null> {
    try {
      const db = getAdminDb()
      const projectDoc = await db.collection('projects').doc(projectId).get()
      if (!projectDoc.exists) {
        return null
      }

      const project = projectDoc.data()
      const qualityScoreData = project?.qualityScore

      if (!qualityScoreData) {
        return null
      }

      return {
        overall: qualityScoreData.overall,
        breakdown: qualityScoreData.breakdown,
        lastUpdated: qualityScoreData.lastUpdated.toDate(),
      }
    } catch (error) {
      throw new QualityScoreServiceError(
        `Failed to get quality score: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 品質スコアを計算
   */
  static async calculateQualityScore(
    githubMetrics: GitHubMetrics,
    qualityParameters: QualityParameter[]
  ): Promise<QualityScore> {
    try {
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
    } catch (error) {
      throw new QualityScoreServiceError(
        `Failed to calculate quality score: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 品質パラメータを取得
   */
  static async getQualityParameters(): Promise<QualityParameter[]> {
    try {
      const db = getAdminDb()
      const snapshot = await db
        .collection('settings')
        .doc('quality')
        .collection('parameters')
        .where('enabled', '==', true)
        .get()

      const parameters: QualityParameter[] = []
      snapshot.forEach(doc => {
        const data = doc.data()
        parameters.push({
          id: doc.id,
          name: data.name,
          weight: data.weight,
          normalizationConfig: data.normalizationConfig,
          enabled: data.enabled,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        })
      })

      if (parameters.length === 0) {
        throw new QualityScoreServiceError(
          'No enabled quality parameters found',
          'VALIDATION_ERROR',
          404
        )
      }

      return parameters
    } catch (error) {
      if (error instanceof QualityScoreServiceError) {
        throw error
      }
      throw new QualityScoreServiceError(
        `Failed to get quality parameters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 全プロジェクトの品質スコアを一括更新
   */
  static async updateAllQualityScores(): Promise<{
    success: number
    failed: number
    errors: Array<{ projectId: string; error: string }>
  }> {
    try {
      const db = getAdminDb()
      const projectsSnapshot = await db.collection('projects').where('status', '==', 'active').get()

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ projectId: string; error: string }>,
      }

      // 並行処理でレート制限を考慮（同時実行数を制限）
      const batchSize = 5
      const projectIds = projectsSnapshot.docs.map(doc => doc.id)

      for (let i = 0; i < projectIds.length; i += batchSize) {
        const batch = projectIds.slice(i, i + batchSize)

        await Promise.allSettled(
          batch.map(async projectId => {
            try {
              await this.updateQualityScore(projectId)
              results.success++
            } catch (error) {
              results.failed++
              results.errors.push({
                projectId,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          })
        )

        // レート制限対策: バッチ間で少し待機
        if (i + batchSize < projectIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      return results
    } catch (error) {
      throw new QualityScoreServiceError(
        `Failed to update all quality scores: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }

  /**
   * 品質スコアが古いプロジェクトを取得
   */
  static async getStaleQualityScores(maxAgeHours: number = 24): Promise<string[]> {
    try {
      const db = getAdminDb()
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)

      const snapshot = await db.collection('projects').where('status', '==', 'active').get()

      const staleProjectIds: string[] = []

      snapshot.forEach(doc => {
        const project = doc.data()
        const lastUpdated = project.qualityScore?.lastUpdated?.toDate()

        if (!lastUpdated || lastUpdated < cutoffTime) {
          staleProjectIds.push(doc.id)
        }
      })

      return staleProjectIds
    } catch (error) {
      throw new QualityScoreServiceError(
        `Failed to get stale quality scores: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
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
    try {
      const db = getAdminDb()
      const snapshot = await db.collection('projects').where('status', '==', 'active').get()

      const scores: number[] = []
      let latestUpdate: Date | null = null

      snapshot.forEach(doc => {
        const project = doc.data()
        const qualityScore = project.qualityScore

        if (qualityScore?.overall !== undefined) {
          scores.push(qualityScore.overall)

          const lastUpdated = qualityScore.lastUpdated?.toDate()
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
        totalProjects: snapshot.size,
        averageScore,
        scoreDistribution,
        lastUpdated: latestUpdate,
      }
    } catch (error) {
      throw new QualityScoreServiceError(
        `Failed to get quality score stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INTERNAL_ERROR',
        500
      )
    }
  }
}
