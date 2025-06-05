/**
 * トラストライン設定用Xamanペイロード生成API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { DonationService } from '@/services/DonationService'
import { z } from 'zod'
import { trustlineCreateApiSchema } from '@/validations'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json()
    const validatedData = trustlineCreateApiSchema.parse(body)

    // 認証チェック（オプション - トラストライン設定は匿名でも可能）
    let donorUid: string | undefined = undefined
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1]
        const decodedToken = await getAdminAuth().verifyIdToken(idToken)
        donorUid = decodedToken.uid
      } catch (error) {
        // 認証エラーは無視（匿名でのトラストライン設定を許可）
        console.warn('Authentication failed for trustline setup, proceeding anonymously:', error)
      }
    }

    // トラストライン設定リクエストの作成（プロジェクト確認とFirestore保存を含む）
    const { request: trustlineRequest, payload: trustlinePayload } =
      await DonationService.createTrustLineRequest(
        validatedData.projectId,
        validatedData.donorAddress,
        donorUid
      )

    return NextResponse.json({
      request: {
        id: trustlineRequest.id,
        projectId: trustlineRequest.projectId,
        projectName: trustlineRequest.projectName,
        tokenCode: trustlineRequest.tokenCode,
        expiresAt: trustlineRequest.expiresAt.toISOString(),
      },
      xamanPayload: {
        uuid: trustlinePayload.uuid,
        qrPng: trustlinePayload.qrPng,
        websocketUrl: trustlinePayload.websocketUrl,
      },
    })
  } catch (error) {
    console.error('Trustline setup error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'リクエストデータが無効です', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'トラストライン設定の作成に失敗しました' }, { status: 500 })
  }
}
