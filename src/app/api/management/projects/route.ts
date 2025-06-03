/**
 * メンテナー向けプロジェクト管理 API
 * プロジェクト登録・一覧取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { projectRegistrationSchema } from '@/validations/project'
import { Project } from '@/types/project'
import { Query, DocumentData } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    const body = await request.json()

    // バリデーション
    const validationResult = projectRegistrationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, description, status, tokenCode, donationUsages } = validationResult.data

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

    // トークンコードの重複チェック
    const existingProjectByTokenCode = await getAdminDb()
      .collection('projects')
      .where('tokenCode', '==', tokenCode)
      .get()

    if (!existingProjectByTokenCode.empty) {
      return NextResponse.json({ error: 'Token code already exists' }, { status: 409 })
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
      tokenCode,
      donationUsages,
      status,
      createdAt: now,
      updatedAt: now,
    }

    // TODO: ステータスがactiveの場合、指定されたtokenCodeでトークンを発行する
    // 優先度: 高 - プロジェクトの公開に必要な機能
    if (status === 'active') {
      // TODO: XRPLトークン発行処理を実装する必要があります
      // - XRPLネットワークへの接続
      // - トークンの発行トランザクション作成
      // - トランザクションの署名と送信
      // - 発行結果の検証とFirestoreへの保存
      console.log(`TODO: Issue token with code ${tokenCode} for project ${name}`)
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
    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    // クエリパラメータを取得
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query: Query<DocumentData> = getAdminDb()
      .collection('projects')
      .where('ownerUid', '==', decodedToken.uid)

    // ステータスフィルタリング
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

    // 総数を取得（ページネーション用）
    let countQuery: Query<DocumentData> = getAdminDb()
      .collection('projects')
      .where('ownerUid', '==', decodedToken.uid)

    if (status) {
      countQuery = countQuery.where('status', '==', status)
    }

    const countSnapshot = await countQuery.get()
    const total = countSnapshot.size

    return NextResponse.json({
      projects,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Maintainer projects fetch error:', error)
    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}
