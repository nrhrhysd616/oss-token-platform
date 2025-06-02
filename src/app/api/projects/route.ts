/**
 * プロジェクト管理 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { projectRegistrationSchema } from '@/validations/project'
import { Project } from '@/types/project'
import { Query, DocumentData } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    // Firebase認証トークンを検証
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: '認証が必要です',
        },
        { status: 401 }
      )
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    // クライアントサイドからの場合、Cookieから認証情報を取得
    const body = await request.json()

    // バリデーション
    const validationResult = projectRegistrationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, description } = validationResult.data
    const {
      githubInstallationId,
      repositoryUrl,
      githubOwner,
      githubRepo,
    }: {
      githubInstallationId: string
      repositoryUrl: string
      githubOwner: string
      githubRepo: string
    } = body

    // プロジェクト名の重複チェック
    const existingProjectByName = await getAdminDb()
      .collection('projects')
      .where('name', '==', name)
      .where('ownerUid', '==', decodedToken.uid)
      .get()

    if (!existingProjectByName.empty) {
      return NextResponse.json({ error: 'Project name already exists' }, { status: 409 })
    }

    // リポジトリURLの重複チェック
    const existingProjectByRepo = await getAdminDb()
      .collection('projects')
      .where('repositoryUrl', '==', repositoryUrl)
      .get()

    if (!existingProjectByRepo.empty) {
      return NextResponse.json({ error: 'Repository is already registered' }, { status: 409 })
    }

    // プロジェクトデータを作成
    const now = new Date()
    const projectData: Omit<Project, 'id'> = {
      name,
      description,
      repositoryUrl: repositoryUrl,
      ownerUid: decodedToken.uid,
      githubOwner,
      githubRepo,
      githubInstallationId,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }

    // Firestoreに保存
    const docRef = await getAdminDb().collection('projects').add(projectData)

    const createdProject: Project = {
      id: docRef.id,
      ...projectData,
    }

    return NextResponse.json({
      project: createdProject,
      message: 'Project created successfully',
    })
  } catch (error) {
    console.error('Project creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const ownerUid = searchParams.get('ownerUid')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query: Query<DocumentData> = getAdminDb().collection('projects')

    // フィルタリング
    if (ownerUid) {
      query = query.where('ownerUid', '==', ownerUid)
    }
    if (status) {
      query = query.where('status', '==', status)
    }

    // ソートとページネーション
    query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset)

    const snapshot = await query.get()
    const projects: Project[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Project[]

    return NextResponse.json({
      projects,
      total: snapshot.size,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Projects fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}
