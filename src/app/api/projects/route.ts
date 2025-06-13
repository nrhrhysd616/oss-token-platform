/**
 * 公開プロジェクト一覧 API
 * 寄付者・一般ユーザー向けの公開プロジェクトのみを返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { ProjectService } from '@/services/ProjectService'
import { projectPublicQuerySchema } from '@/validations/project'
import { z } from 'zod'
import { ServiceError } from '@/services/shared/ServiceError'

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得・バリデーション
    const { searchParams } = new URL(request.url)
    const queryParams = projectPublicQuerySchema.parse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    })

    // ProjectServiceを使用して公開プロジェクト一覧を取得
    const result = await ProjectService.getPublicProjects(queryParams)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Public projects fetch error:', error)

    if (error instanceof ServiceError) {
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
