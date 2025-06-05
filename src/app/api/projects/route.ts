/**
 * 公開プロジェクト一覧 API
 * 寄付者・一般ユーザー向けの公開プロジェクトのみを返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { ProjectService, ProjectServiceError } from '@/services/ProjectService'
import { publicProjectQuerySchema } from '@/validations/project'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得・バリデーション
    const { searchParams } = new URL(request.url)
    const queryParams = publicProjectQuerySchema.parse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    })

    // ProjectServiceを使用して公開プロジェクト一覧を取得
    const result = await ProjectService.getPublicProjects(queryParams)

    return NextResponse.json({
      projects: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    })
  } catch (error) {
    console.error('Public projects fetch error:', error)

    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}
