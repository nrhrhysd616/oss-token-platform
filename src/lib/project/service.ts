/**
 * プロジェクト関連の共通サービス
 */

import { getAdminDb } from '../firebase/admin'
import type { Project } from '../../types/project'

/**
 * プロジェクトサービスクラス
 */
export class ProjectService {
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

      return {
        id: projectDoc.id,
        ...projectData,
        createdAt: projectData.createdAt?.toDate() || new Date(),
        updatedAt: projectData.updatedAt?.toDate() || new Date(),
      } as Project
    } catch (error) {
      console.error('プロジェクト取得エラー:', error)
      throw new Error(`プロジェクトの取得に失敗しました: ${projectId}`)
    }
  }

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
}
