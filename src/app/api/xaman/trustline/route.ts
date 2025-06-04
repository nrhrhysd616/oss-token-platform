/**
 * トラストライン設定用Xamanペイロード生成API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { DonationService } from '@/lib/xrpl/donation-service'
import { getActiveIssuerWallet } from '@/lib/xrpl/config'
import { z } from 'zod'
import { trustlineRequestSchema, trustlineStatusQuerySchema } from '@/validations/xaman'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json()
    const validatedData = trustlineRequestSchema.parse(body)

    // 認証チェック（オプション - トラストライン設定は匿名でも可能）
    let donorUid: string | null = null
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

    // プロジェクトの存在確認
    const projectDoc = await getAdminDb().collection('projects').doc(validatedData.projectId).get()
    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const projectData = projectDoc.data()
    if (!projectData) {
      return NextResponse.json({ error: 'プロジェクトデータが無効です' }, { status: 400 })
    }

    // プロジェクトがアクティブかチェック
    if (projectData.status !== 'active') {
      return NextResponse.json(
        { error: 'このプロジェクトは現在アクティブではありません' },
        { status: 400 }
      )
    }

    // 寄付サービスの初期化
    const donationService = new DonationService()

    // プロジェクトのissuerAddressが設定されているかチェック
    if (!projectData.issuerAddress) {
      return NextResponse.json(
        { error: 'プロジェクトのIssuerアドレスが設定されていません' },
        { status: 400 }
      )
    }

    // 既存のトラストラインをチェック
    const existingTrustLine = await donationService.checkTrustLine(
      validatedData.donorAddress,
      projectData.tokenCode,
      projectData.issuerAddress
    )

    if (existingTrustLine) {
      return NextResponse.json({
        message: 'トラストラインは既に設定されています',
        alreadySet: true,
      })
    }

    // トラストライン設定用Xamanペイロードの生成
    const trustlinePayload = await donationService.createTrustLinePayload(
      validatedData.projectId,
      validatedData.donorAddress
    )

    // トラストライン設定リクエストをFirestoreに保存
    const trustlineRequest = {
      id: `trustline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: validatedData.projectId,
      projectName: projectData.name,
      tokenCode: projectData.tokenCode,
      issuerAddress: projectData.issuerAddress,
      donorAddress: validatedData.donorAddress,
      donorUid,
      xamanPayloadId: trustlinePayload.uuid,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分後に期限切れ
    }

    await getAdminDb()
      .collection('trustlineRequests')
      .doc(trustlineRequest.id)
      .set(trustlineRequest)

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
        qr_png: trustlinePayload.qr_png,
        qr_uri: trustlinePayload.qr_uri,
        websocket_status: trustlinePayload.websocket_status,
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')
    const donorAddress = searchParams.get('donorAddress')
    const projectId = searchParams.get('projectId')

    // 特定のリクエストIDで検索
    if (requestId) {
      const requestDoc = await getAdminDb().collection('trustlineRequests').doc(requestId).get()

      if (!requestDoc.exists) {
        return NextResponse.json({ error: 'リクエストが見つかりません' }, { status: 404 })
      }

      const requestData = requestDoc.data()!

      // リクエストの期限確認
      if (new Date() > requestData.expiresAt.toDate()) {
        return NextResponse.json({ error: 'リクエストが期限切れです' }, { status: 410 })
      }

      // Xamanペイロードのステータス確認
      const donationService = new DonationService()
      let xamanStatus = null
      try {
        xamanStatus = await donationService.checkPayloadStatus(requestData.xamanPayloadId)
      } catch (error) {
        console.warn('Failed to check Xaman payload status:', error)
      }

      return NextResponse.json({
        request: {
          id: requestData.id,
          projectId: requestData.projectId,
          projectName: requestData.projectName,
          tokenCode: requestData.tokenCode,
          status: requestData.status,
          createdAt: requestData.createdAt,
          expiresAt: requestData.expiresAt,
        },
        xamanStatus,
      })
    }

    // 寄付者アドレスとプロジェクトIDでトラストライン状態を確認
    if (donorAddress && projectId) {
      const projectDoc = await getAdminDb().collection('projects').doc(projectId).get()
      if (!projectDoc.exists) {
        return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
      }

      const projectData = projectDoc.data()!

      // プロジェクトのissuerAddressが設定されているかチェック
      if (!projectData.issuerAddress) {
        return NextResponse.json(
          { error: 'プロジェクトのIssuerアドレスが設定されていません' },
          { status: 400 }
        )
      }

      const donationService = new DonationService()

      const hasTrustLine = await donationService.checkTrustLine(
        donorAddress,
        projectData.tokenCode,
        projectData.issuerAddress
      )

      return NextResponse.json({
        donorAddress,
        projectId,
        tokenCode: projectData.tokenCode,
        hasTrustLine,
        issuerAddress: projectData.issuerAddress,
      })
    }

    return NextResponse.json(
      { error: 'リクエストIDまたは寄付者アドレス・プロジェクトIDが必要です' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Trustline status check error:', error)
    return NextResponse.json({ error: 'トラストライン状態の確認に失敗しました' }, { status: 500 })
  }
}
