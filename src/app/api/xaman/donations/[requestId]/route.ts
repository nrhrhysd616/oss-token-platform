/**
 * 寄付リクエスト状態取得API
 */

import { NextRequest, NextResponse } from 'next/server'
import { DonationService, DonationServiceError } from '@/services/DonationService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    // リクエスト情報を取得
    const requestData = await DonationService.getDonationRequest(requestId)
    if (!requestData) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // リクエストの期限確認
    if (DonationService.isDonationRequestExpired(requestData)) {
      return NextResponse.json({ error: 'Request expired' }, { status: 410 })
    }

    // 寄付完了チェック
    const { completed, record } = await DonationService.isDonationCompleted(requestId)

    return NextResponse.json({
      success: true,
      data: {
        request: {
          id: requestData.id,
          projectId: requestData.projectId,
          amount: requestData.amount,
          status: requestData.status,
          destinationTag: requestData.destinationTag,
          createdAt: requestData.createdAt,
          expiresAt: requestData.expiresAt,
          txHash: requestData.txHash,
        },
        completed,
        record: record || null,
      },
    })
  } catch (error) {
    console.error('Donation request fetch error:', error)

    if (error instanceof DonationServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
