/**
 * メンテナー向けプロジェクト詳細 API
 * 所有者向けの全情報を返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { ProjectService, ProjectServiceError } from '@/services/ProjectService'
import { projectUpdateApiSchema } from '@/validations/project'
import { MaintainerProject, MaintainerProjectStats } from '@/types/project'
import { z } from 'zod'

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

    // ProjectServiceを使用してプロジェクトを取得（所有者チェック込み）
    const projectData = await ProjectService.checkProjectOwnership(id, decodedToken.uid)

    // 統計情報を取得（現在はダミーデータ）
    const stats: MaintainerProjectStats = {
      totalDonations: 0, // TODO: 実際の寄付総額を計算
      donorCount: 0, // TODO: 実際の寄付者数を計算
      currentPrice: 1.0, // TODO: XRPLから現在価格を取得
      priceHistory: [
        // TODO: 実際の価格履歴データを取得
        { date: '2024-01-01', price: 1.0 },
        { date: '2024-01-02', price: 1.1 },
        { date: '2024-01-03', price: 1.2 },
      ],
      tokenSupply: 0, // TODO: XRPLから実際のトークン供給量を取得
      recentDonations: [], // TODO: 実際の寄付履歴をFirestoreから取得
    }

    // 管理者向け全情報を返却
    const maintainerProject: MaintainerProject = {
      ...projectData,
      stats,
    }

    return NextResponse.json({
      project: maintainerProject,
    })
  } catch (error) {
    console.error('Maintainer project fetch error:', error)

    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const validatedData = projectUpdateApiSchema.parse(await request.json())

    // 名前の重複チェック（名前が変更される場合、route層でバリデーション）
    if (validatedData.name) {
      await ProjectService.validateUniqueConstraints(
        { name: validatedData.name },
        decodedToken.uid,
        id
      )
    }

    // ProjectServiceを使用してプロジェクトを更新
    const updatedProject = await ProjectService.updateProject(id, validatedData, decodedToken.uid)

    return NextResponse.json({
      project: updatedProject,
      message: 'Project updated successfully',
    })
  } catch (error) {
    console.error('Project update error:', error)

    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'プロジェクトの更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // ProjectServiceを使用してプロジェクトを削除
    await ProjectService.deleteProject(id, decodedToken.uid)

    return NextResponse.json({
      message: 'Project deleted successfully',
    })
  } catch (error) {
    console.error('Project delete error:', error)

    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'プロジェクトの削除に失敗しました' }, { status: 500 })
  }
}
