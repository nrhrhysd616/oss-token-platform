import { NextRequest, NextResponse } from 'next/server'
import { WalletService } from '@/lib/xaman/WalletService'

/**
 * Xamanサーバーからのコールバックを処理
 */
export async function POST(request: NextRequest) {
  try {
    // Xamanサーバーからのコールバックを処理
    const body = await request.json()
    const { payloadUuid, signed, txid, account } = body
    if (!payloadUuid) {
      return NextResponse.json({ error: 'Payload UUID is required' }, { status: 400 })
    }
    // ウォレットサービスを初期化
    const walletService = new WalletService()
    // ウォレット連携リクエストを取得
    const linkRequest = await walletService.getWalletLinkRequest(payloadUuid)
    if (!linkRequest) {
      return NextResponse.json({ error: 'Wallet link request not found' }, { status: 404 })
    }
    if (signed && account) {
      // 署名が完了している場合、Xamanステータスを再取得して連携を完了
      const xamanStatus = await walletService.checkPayloadStatus(payloadUuid)
      if (xamanStatus.meta.signed && xamanStatus.response) {
        await walletService.completeWalletLink(payloadUuid, xamanStatus)
        return NextResponse.json({
          success: true,
          message: 'Wallet link completed successfully',
        })
      }
    }
    // 署名が完了していない場合やエラーの場合
    return NextResponse.json({
      success: true,
      message: 'Callback received',
    })
  } catch (error) {
    console.error('Failed to process Xaman callback:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
