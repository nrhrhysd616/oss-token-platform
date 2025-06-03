/**
 * 公開プロジェクト一覧 API
 * 寄付者・一般ユーザー向けの公開プロジェクトのみを返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { PublicProject, PublicProjectStats, Project } from '@/types/project'
import { Query, DocumentData } from 'firebase-admin/firestore'

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 公開プロジェクト（status: 'active'）のみを取得
    let query: Query<DocumentData> = getAdminDb()
      .collection('projects')
      .where('status', '==', 'active')

    // ソートとページネーション
    query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset)

    const snapshot = await query.get()

    // 公開情報のみを含むプロジェクトリストを作成
    const publicProjects: PublicProject[] = snapshot.docs.map(doc => {
      const projectData = { id: doc.id, ...doc.data() } as Project

      // TODO: 統計情報を実際のデータから取得する処理を実装する必要があります
      // 優先度: 中 - 寄付者向けの重要な情報表示機能
      // - Firestoreから実際の寄付履歴を取得
      // - XRPLから現在のトークン価格を取得
      // - 価格履歴データの計算と保存
      const stats: PublicProjectStats = {
        totalDonations: Math.floor(Math.random() * 1000), // TODO: 実際の寄付総額を計算
        donorCount: Math.floor(Math.random() * 50), // TODO: 実際の寄付者数を計算
        currentPrice: 1.0 + Math.random() * 2, // TODO: XRPLから現在価格を取得
        priceHistory: [
          // TODO: 実際の価格履歴データを取得
          { date: '2024-01-01', price: 1.0 },
          { date: '2024-01-02', price: 1.1 },
          { date: '2024-01-03', price: 1.2 },
        ],
      }

      // 公開情報のみを返却（ownerUid, githubInstallationIdを除外）
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

    return NextResponse.json({
      projects: publicProjects,
      total: snapshot.size,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Public projects fetch error:', error)
    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}
