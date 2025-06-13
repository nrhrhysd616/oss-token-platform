/**
 * 寄付リクエスト状態取得API
 */

import { NextRequest, NextResponse } from 'next/server'
import { DonationService } from '@/services/DonationService'
import { ServiceError } from '@/services/shared/ServiceError'

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
    const donationRequest = await DonationService.getDonationRequest(requestId)
    if (!donationRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // リクエストの期限確認
    if (DonationService.isDonationRequestExpired(donationRequest)) {
      return NextResponse.json({ error: 'Request expired' }, { status: 410 })
    }

    // 寄付完了チェック
    const { completed, record } = await DonationService.isDonationCompleted(requestId)

    return NextResponse.json({
      completed,
      request: donationRequest,
      record: record || null,
    })
  } catch (error) {
    console.error('Donation request fetch error:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
