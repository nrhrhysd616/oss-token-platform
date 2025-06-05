/**
 * メンテナー向けプロジェクト管理 API
 * プロジェクト登録・一覧取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { ProjectService, ProjectServiceError } from '@/services/ProjectService'
import { projectCreateApiSchema, projectQuerySchema } from '@/validations/project'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    const validatedData = projectCreateApiSchema.parse(await request.json())

    // 重複チェック（route層でバリデーション）
    await ProjectService.validateUniqueConstraints(
      {
        name: validatedData.name,
        tokenCode: validatedData.tokenCode,
        repositoryUrl: validatedData.repositoryUrl,
      },
      decodedToken.uid
    )

    // ProjectServiceを使用してプロジェクトを作成
    const project = await ProjectService.createProject(validatedData, decodedToken.uid)

    return NextResponse.json({
      project,
      message: 'Project created successfully',
    })
  } catch (error) {
    console.error('Project creation error:', error)

    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    // クエリパラメータを取得・バリデーション
    const { searchParams } = new URL(request.url)
    const queryParams = projectQuerySchema.parse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      status: searchParams.get('status') || undefined,
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    })

    // ProjectServiceを使用してプロジェクト一覧を取得（統計情報・権限情報付き）
    const result = await ProjectService.getMaintainerProjectsWithDetails(
      decodedToken.uid,
      queryParams
    )

    return NextResponse.json({
      projects: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    })
  } catch (error) {
    console.error('Maintainer projects fetch error:', error)

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
