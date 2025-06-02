import { NextRequest, NextResponse } from 'next/server'
import { getUserInstallations } from '@/lib/github/app'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

// ユーザーのGitHub App Installationを取得・保存するエンドポイント
// export async function POST(request: NextRequest) {
//   try {
//     // Firebase認証トークンを検証
//     const authHeader = request.headers.get('Authorization')
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: '認証が必要です',
//         },
//         { status: 401 }
//       )
//     }
//
//     const idToken = authHeader.split('Bearer ')[1]
//     const decodedToken = await getAdminAuth().verifyIdToken(idToken)
//     const uid = decodedToken.uid
//
//     const body = await request.json()
//     const { accessToken } = body
//
//     if (!accessToken) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: 'GitHub アクセストークンが必要です',
//         },
//         { status: 400 }
//       )
//     }
//
//     // ユーザーのInstallation情報を取得
//     const installations = await getUserInstallations(accessToken)
//
//     // Firestoreにinstallation情報を保存
//     const adminDb = getAdminDb()
//     const userRef = adminDb.collection('users').doc(uid)
//     await userRef.set(
//       {
//         githubInstallations: installations.map(installation => ({
//           id: installation.id,
//           account: installation.account
//             ? {
//                 login:
//                   'login' in installation.account
//                     ? installation.account.login
//                     : installation.account.name,
//                 type: 'type' in installation.account ? installation.account.type : 'Organization',
//               }
//             : null,
//           permissions: installation.permissions,
//           repositorySelection: installation.repository_selection,
//           updatedAt: new Date(),
//         })),
//         lastInstallationUpdate: new Date(),
//       },
//       { merge: true }
//     )
//
//     return NextResponse.json({
//       success: true,
//       data: {
//         installations: installations.length,
//         message: 'Installation情報を保存しました',
//       },
//     })
//   } catch (error) {
//     console.error('Installation情報取得エラー:', error)
//     return NextResponse.json(
//       {
//         success: false,
//         error: 'Installation情報の取得に失敗しました',
//       },
//       { status: 500 }
//     )
//   }
// }

// ユーザーのInstallation情報を取得するエンドポイント
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
    const userRef = adminDb.collection('users').doc(uid)
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

    return NextResponse.json({
      success: true,
      data: {
        installations,
        lastUpdate: userData?.lastInstallationUpdate,
      },
    })
  } catch (error) {
    console.error('Installation情報取得エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Installation情報の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}
