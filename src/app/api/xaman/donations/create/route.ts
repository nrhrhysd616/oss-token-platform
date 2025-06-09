/**
 * 寄付リクエスト作成API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { DonationService, DonationServiceError } from '@/services/DonationService'
import { donationCreateApiSchema } from '@/validations'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json()
    const validatedData = donationCreateApiSchema.parse(body)

    // 認証チェック（オプション - 寄付は匿名でも可能）
    let donorUid: string | undefined = undefined
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1]
        const decodedToken = await getAdminAuth().verifyIdToken(idToken)
        donorUid = decodedToken.uid
      } catch (error) {
        // 認証エラーは無視（匿名寄付を許可）
        console.warn('Authentication failed for donation, proceeding anonymously:', error)
      }
    }

    // 寄付リクエスト作成とXamanペイロード生成を統合実行
    const { request: donationRequest, payload } =
      await DonationService.createDonationRequestWithPayload(
        validatedData.projectId,
        validatedData.amount,
        donorUid
      )

    return NextResponse.json({
      success: true,
      data: {
        request: {
          id: donationRequest.id,
          projectId: donationRequest.projectId,
          amount: donationRequest.amount,
          destinationTag: donationRequest.destinationTag,
          expiresAt: donationRequest.expiresAt.toISOString(),
        },
        xamanPayload: {
          uuid: payload.uuid,
          qrPng: payload.qrPng,
          websocketUrl: payload.websocketUrl,
        },
      },
    })
  } catch (error) {
    console.error('Donation request creation error:', error)

    if (error instanceof DonationServiceError) {
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('sessirequestIdonId')

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
