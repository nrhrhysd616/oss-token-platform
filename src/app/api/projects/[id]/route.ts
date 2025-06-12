/**
 * 公開プロジェクト詳細 API
 * 寄付者・一般ユーザー向けの公開情報のみを返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { ProjectService, ProjectServiceError } from '@/services/ProjectService'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'プロジェクトIDが必要です' }, { status: 400 })
    }

    // ProjectServiceを使用して公開プロジェクト情報を取得（統計情報付き）
    const publicProject = await ProjectService.getPublicProjectById(id)

    if (!publicProject) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({
      project: publicProject,
    })
  } catch (error) {
    console.error('Public project fetch error:', error)

    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}
