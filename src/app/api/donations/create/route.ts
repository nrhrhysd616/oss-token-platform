/**
 * 寄付セッション作成API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { DonationService } from '@/lib/xrpl/donation-service'
import type { DonationSession } from '@/types/donation'
import { z } from 'zod'
import { createDonationSchema } from '@/validations/donation'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json()
    const validatedData = createDonationSchema.parse(body)

    // 認証チェック（オプション - 寄付は匿名でも可能）
    let donorUid: string | null = null
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
        { error: 'このプロジェクトは現在寄付を受け付けていません' },
        { status: 400 }
      )
    }

    // 寄付サービスの初期化
    const donationService = new DonationService()

    // 寄付金額の妥当性確認
    if (!donationService.validateDonationAmount(validatedData.amount)) {
      return NextResponse.json({ error: '寄付金額が無効です' }, { status: 400 })
    }

    // 寄付セッションの作成
    const session = await donationService.createDonationSession(
      validatedData.projectId,
      validatedData.donorAddress,
      validatedData.amount
    )

    // Firestoreに寄付セッションを保存
    const sessionData = {
      ...session,
      donorUid,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }

    await getAdminDb().collection('donationSessions').doc(session.id).set(sessionData)

    // 寄付用Xamanペイロードの生成
    const donationPayload = await donationService.createDonationPayload(session)

    // セッションにXamanペイロードIDを追加
    await getAdminDb().collection('donationSessions').doc(session.id).update({
      xamanPayloadId: donationPayload.uuid,
    })

    return NextResponse.json({
      session: {
        id: session.id,
        projectId: session.projectId,
        amount: session.amount,
        destinationTag: session.destinationTag,
        expiresAt: session.expiresAt.toISOString(),
      },
      xamanPayload: {
        uuid: donationPayload.uuid,
        qr_png: donationPayload.qr_png,
        qr_uri: donationPayload.qr_uri,
        websocket_status: donationPayload.websocket_status,
      },
    })
  } catch (error) {
    console.error('Donation session creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'リクエストデータが無効です', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: '寄付セッションの作成に失敗しました' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'セッションIDが必要です' }, { status: 400 })
    }

    // セッション情報を取得
    const sessionDoc = await getAdminDb().collection('donationSessions').doc(sessionId).get()

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const sessionData = sessionDoc.data() as DonationSession

    // プロジェクト情報を動的に取得
    const projectDoc = await getAdminDb().collection('projects').doc(sessionData.projectId).get()
    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }
    const projectData = projectDoc.data()!

    // セッションの期限確認
    const donationService = new DonationService()
    if (donationService.isSessionExpired(sessionData)) {
      return NextResponse.json({ error: 'セッションが期限切れです' }, { status: 410 })
    }

    // Xamanペイロードのステータス確認
    let xamanStatus = null
    if (sessionData.xamanPayloadId) {
      try {
        xamanStatus = await donationService.checkPayloadStatus(sessionData.xamanPayloadId)
      } catch (error) {
        console.warn('Failed to check Xaman payload status:', error)
      }
    }

    return NextResponse.json({
      session: {
        id: sessionData.id,
        projectId: sessionData.projectId,
        projectName: projectData.name,
        amount: sessionData.amount,
        status: sessionData.status,
        destinationTag: sessionData.destinationTag,
        createdAt: sessionData.createdAt,
        expiresAt: sessionData.expiresAt,
        txHash: sessionData.txHash,
      },
      xamanStatus,
    })
  } catch (error) {
    console.error('Donation session fetch error:', error)
    return NextResponse.json({ error: 'セッション情報の取得に失敗しました' }, { status: 500 })
  }
}
