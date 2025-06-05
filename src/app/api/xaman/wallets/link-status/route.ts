import { NextRequest, NextResponse } from 'next/server'
import { WalletLinkService, WalletLinkServiceError } from '@/services/WalletLinkService'
import { getAdminAuth } from '@/lib/firebase/admin'
import { walletLinkStatusQuerySchema } from '@/validations/wallet-link'
import { z } from 'zod'

/**
 * ウォレット連携ステータスを確認
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

    // URLパラメータからpayloadUuidを取得してバリデーション
    const { searchParams } = new URL(request.url)
    const queryParams = {
      payloadUuid: searchParams.get('payloadUuid'),
    }

    const validatedQuery = walletLinkStatusQuerySchema.parse(queryParams)
    const { payloadUuid } = validatedQuery

    // ウォレット連携リクエストを取得して所有者を確認
    const linkRequest = await WalletLinkService.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      return NextResponse.json({ error: 'Wallet link request not found' }, { status: 404 })
    }

    if (linkRequest.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // まず、ウォレット連携が既に完了しているかチェック
    const linkCompletionStatus = await WalletLinkService.isWalletLinkCompleted(payloadUuid)

    if (linkCompletionStatus.completed && linkCompletionStatus.wallet) {
      // 既に連携完了済みの場合、既存のウォレット情報を返す
      return NextResponse.json({
        success: true,
        data: {
          status: 'completed',
          wallet: linkCompletionStatus.wallet,
        },
      })
    }

    // Xamanペイロードの状態をチェック
    const xamanStatus = await WalletLinkService.checkPayloadStatus(payloadUuid)

    // 署名が完了している場合、ウォレット連携を完了
    if (xamanStatus.meta.signed && xamanStatus.response) {
      const wallet = await WalletLinkService.completeWalletLink(payloadUuid, xamanStatus)

      return NextResponse.json({
        success: true,
        data: {
          status: 'completed',
          wallet,
          xamanStatus,
        },
      })
    }

    // 署名が完了していない場合、現在の状態を返す
    return NextResponse.json({
      success: true,
      data: {
        status: xamanStatus.meta.cancelled
          ? 'cancelled'
          : xamanStatus.meta.expired
            ? 'expired'
            : 'pending',
        xamanStatus,
      },
    })
  } catch (error) {
    console.error('Failed to check wallet link status:', error)

    if (error instanceof WalletLinkServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
