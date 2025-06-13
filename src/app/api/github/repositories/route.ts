import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { getAllRepositoriesFromInstallations } from '@/lib/github/app'
import { FIRESTORE_COLLECTIONS } from '@/lib/firebase/collections'

// ユーザーが保有するすべてのリポジトリを取得するエンドポイント
export async function GET(request: NextRequest) {
  try {
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
    const uid = decodedToken.uid

    // Firestoreからinstallation情報を取得
    const adminDb = getAdminDb()
    const userRef = adminDb.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'ユーザー情報が見つかりません',
        },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    const installations = userData?.githubInstallations || []

    if (installations.length === 0) {
      return NextResponse.json([])
    }

    // 新しいヘルパー関数を使用して簡潔に処理
    const installationIds = installations.map((installation: any) => installation.id)
    const allRepositories = await getAllRepositoriesFromInstallations(installationIds)

    return NextResponse.json(allRepositories)
  } catch (error) {
    console.error('全リポジトリ取得エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'リポジトリ情報の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}
