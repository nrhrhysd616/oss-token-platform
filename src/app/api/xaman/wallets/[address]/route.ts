import { NextRequest, NextResponse } from 'next/server'
import { WalletLinkService, WalletLinkServiceError } from '@/services/WalletLinkService'
import { getAdminAuth } from '@/lib/firebase/admin'
import { z } from 'zod'
import { xrplAddressSchema } from '@/validations/common'

/**
 * 特定のウォレット情報を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
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

    const { address } = await params

    // アドレスのバリデーション
    const validatedAddress = xrplAddressSchema.parse(address)

    // ユーザーのウォレット一覧を取得して、指定されたアドレスのウォレットを検索
    const wallets = await WalletLinkService.getUserWallets(userId)
    const wallet = wallets.find(w => w.address === validatedAddress)

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: wallet,
    })
  } catch (error) {
    console.error('Failed to get wallet:', error)

    if (error instanceof WalletLinkServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * ウォレット情報を更新（将来的な拡張用）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
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

    const { address } = await params

    // アドレスのバリデーション
    const validatedAddress = xrplAddressSchema.parse(address)

    // TODO: ウォレット情報更新機能を実装する必要があります
    // 優先度: 低 - 将来的な拡張機能
    // - ウォレットのニックネーム変更
    // - プライマリウォレットの変更
    // - ウォレット設定の更新
    return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 })
  } catch (error) {
    console.error('Failed to update wallet:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * ウォレットを削除（将来的な拡張用）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
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

    const { address } = await params

    // アドレスのバリデーション
    const validatedAddress = xrplAddressSchema.parse(address)

    // TODO: ウォレット削除機能を実装する必要があります
    // 優先度: 低 - 将来的な拡張機能
    // - ウォレットの安全な削除処理
    // - プライマリウォレットの場合の処理
    // - 関連データの整合性確保
    return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 })
  } catch (error) {
    console.error('Failed to delete wallet:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
