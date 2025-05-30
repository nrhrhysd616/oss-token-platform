import { NextRequest, NextResponse } from 'next/server'
import { WalletService } from '@/lib/xaman/WalletService'
import { getAdminAuth } from '@/lib/firebase/admin'

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

    // ウォレットサービスを初期化
    const walletService = new WalletService()

    // ユーザーのウォレット一覧を取得
    const wallets = await walletService.getUserWallets(userId)

    return NextResponse.json({
      success: true,
      data: wallets,
    })
  } catch (error) {
    console.error('Failed to get user wallets:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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

    // ウォレットサービスを初期化
    const walletService = new WalletService()

    // ウォレット連携リクエストを作成
    const linkRequest = await walletService.createWalletLinkRequest(userId)

    return NextResponse.json({
      success: true,
      data: {
        payloadUuid: linkRequest.xamanPayloadUuid,
        qrData: linkRequest.qrData,
        expiresAt: linkRequest.expiresAt,
      },
    })
  } catch (error) {
    console.error('Failed to create wallet link request:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
