import { NextRequest, NextResponse } from 'next/server'
import { WalletLinkService } from '@/services/WalletLinkService'
import { getAdminAuth } from '@/lib/firebase/admin'
import { ServiceError } from '@/services/shared/ServiceError'

/**
 * ユーザーのウォレット一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 認証トークンを取得
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]

    // Firebase Admin SDKでトークンを検証
    const decodedToken = await getAdminAuth().verifyIdToken(token)
    const userId = decodedToken.uid

    // ユーザーのウォレット一覧を取得
    const result = await WalletLinkService.getUserWallets(userId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to get user wallets:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * ウォレット連携リクエストを作成
 */
export async function POST(request: NextRequest) {
  try {
    // 認証トークンを取得
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]

    // Firebase Admin SDKでトークンを検証
    const decodedToken = await getAdminAuth().verifyIdToken(token)
    const userId = decodedToken.uid

    // ウォレット連携リクエストを作成
    const linkRequest = await WalletLinkService.createWalletLinkRequest(userId)

    return NextResponse.json({
      success: true,
      data: {
        payloadUuid: linkRequest.xamanPayloadUuid,
        qrPng: linkRequest.qrPng,
        expiresAt: linkRequest.expiresAt,
        websocketUrl: linkRequest.websocketUrl,
      },
    })
  } catch (error) {
    console.error('Failed to create wallet link request:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
