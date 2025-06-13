/**
 * 寄付リクエスト作成API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { DonationService } from '@/services/DonationService'
import { donationCreateApiSchema } from '@/validations'
import { z } from 'zod'
import { ServiceError } from '@/services/shared/ServiceError'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json()
    const validatedData = donationCreateApiSchema.parse(body)

    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    let donorUid: string
    try {
      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await getAdminAuth().verifyIdToken(idToken)
      donorUid = decodedToken.uid
    } catch (error) {
      console.error('Authentication failed:', error)
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // 寄付リクエスト作成とXamanペイロード生成を統合実行
    const { request: donationRequest, payload } =
      await DonationService.createDonationRequestWithPayload(
        validatedData.projectId,
        validatedData.xrpAmount,
        donorUid
      )

    return NextResponse.json({
      request: donationRequest,
      payload,
    })
  } catch (error) {
    console.error('Donation request creation error:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
