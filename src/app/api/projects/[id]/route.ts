/**
 * 公開プロジェクト詳細 API
 * 寄付者・一般ユーザー向けの公開情報のみを返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { PublicProject, PublicProjectStats, Project } from '@/types/project'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'プロジェクトIDが必要です' }, { status: 400 })
    }

    // プロジェクトを取得
    const projectDoc = await getAdminDb().collection('projects').doc(id).get()

    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project

    // 公開プロジェクトのみアクセス可能
    if (projectData.status !== 'active') {
      return NextResponse.json({ error: 'このプロジェクトは公開されていません' }, { status: 403 })
    }

    // TODO: 統計情報を実際のデータから取得する処理を実装する必要があります
    // 優先度: 中 - プロジェクト詳細ページでの重要な情報表示
    // - 該当プロジェクトの寄付履歴をFirestoreから取得
    // - XRPLから該当トークンの現在価格を取得
    // - 価格履歴の計算と表示
    const stats: PublicProjectStats = {
      totalDonations: 0, // TODO: 実際の寄付総額を計算
      donorCount: 0, // TODO: 実際の寄付者数を計算
      currentPrice: 1.0, // TODO: XRPLから現在価格を取得
      priceHistory: [
        // TODO: 実際の価格履歴データを取得
        { date: '2024-01-01', price: 1.0 },
        { date: '2024-01-02', price: 1.1 },
        { date: '2024-01-03', price: 1.2 },
      ],
    }

    // 公開情報のみを返却（ownerUid, githubInstallationIdを除外）
    const publicProject: PublicProject = {
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

    return NextResponse.json({
      project: publicProject,
    })
  } catch (error) {
    console.error('Public project fetch error:', error)
    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}
