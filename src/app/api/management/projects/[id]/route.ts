/**
 * メンテナー向けプロジェクト詳細 API
 * 所有者向けの全情報を返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import {
  MaintainerProject,
  MaintainerProjectStats,
  ProjectPermissions,
  Project,
} from '@/types/project'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'プロジェクトIDが必要です' }, { status: 400 })
    }

    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    // プロジェクトを取得
    const projectDoc = await getAdminDb().collection('projects').doc(id).get()

    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project

    // 所有者チェック
    if (projectData.ownerUid !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'このプロジェクトにアクセスする権限がありません' },
        { status: 403 }
      )
    }

    // TODO: 統計情報を実際のデータから取得する処理を実装する必要があります
    // 優先度: 中 - メンテナー向けの詳細な統計情報表示
    // - Firestoreから該当プロジェクトの寄付履歴を取得
    // - XRPLから該当トークンの詳細情報（供給量、価格等）を取得
    // - 最近の寄付履歴の取得と表示
    const stats: MaintainerProjectStats = {
      totalDonations: 1500, // TODO: 実際の寄付総額を計算
      donorCount: 25, // TODO: 実際の寄付者数を計算
      currentPrice: 1.2, // TODO: XRPLから現在価格を取得
      priceHistory: [
        // TODO: 実際の価格履歴データを取得
        { date: '2024-01-01', price: 1.0 },
        { date: '2024-01-02', price: 1.1 },
        { date: '2024-01-03', price: 1.2 },
      ],
      tokenSupply: 10000, // TODO: XRPLから実際のトークン供給量を取得
      recentDonations: [
        // TODO: 実際の寄付履歴をFirestoreから取得
        {
          amount: 100,
          donorAddress: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // TODO: 実際の寄付者アドレス
          timestamp: '2024-01-03T10:00:00Z',
          txHash: 'ABCDEF1234567890', // TODO: 実際のトランザクションハッシュ
        },
        {
          amount: 50,
          donorAddress: 'rYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY', // TODO: 実際の寄付者アドレス
          timestamp: '2024-01-02T15:30:00Z',
          txHash: 'FEDCBA0987654321', // TODO: 実際のトランザクションハッシュ
        },
      ],
    }

    // 権限情報を設定
    const permissions: ProjectPermissions = {
      canEdit: true,
      canIssueToken: !projectData.tokenCode,
      tokenIssued: !!projectData.tokenCode,
    }

    // 管理者向け全情報を返却
    const maintainerProject: MaintainerProject = {
      ...projectData,
      stats,
      permissions,
    }

    return NextResponse.json({
      project: maintainerProject,
    })
  } catch (error) {
    console.error('Maintainer project fetch error:', error)
    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}
