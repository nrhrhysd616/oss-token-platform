/**
 * トラストライン設定用Xamanペイロード生成API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { DonationService } from '@/services/DonationService'
import { z } from 'zod'
import { trustlineRequestSchema } from '@/validations/xaman'

export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json()
    const validatedData = trustlineRequestSchema.parse(body)

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')
    const donorAddress = searchParams.get('donorAddress')
    const projectId = searchParams.get('projectId')

    // 特定のリクエストIDで検索
    if (requestId) {
      const requestData = await DonationService.getTrustLineRequest(requestId)
      if (!requestData) {
        return NextResponse.json({ error: 'リクエストが見つかりません' }, { status: 404 })
      }

      // リクエストの期限確認
      if (new Date() > requestData.expiresAt) {
        return NextResponse.json({ error: 'リクエストが期限切れです' }, { status: 410 })
      }

      // Xamanペイロードのステータス確認
      let xamanStatus = null
      try {
        xamanStatus = await DonationService.checkPayloadStatus(requestData.xamanPayloadUuid)
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
      // プロジェクト情報を取得するためにProjectServiceを使用
      const { ProjectService } = await import('@/services/ProjectService')
      const projectData = await ProjectService.getProjectById(projectId)

      if (!projectData) {
        return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
      }

      // プロジェクトのissuerAddressが設定されているかチェック
      if (!projectData.issuerAddress) {
        return NextResponse.json(
          { error: 'プロジェクトのIssuerアドレスが設定されていません' },
          { status: 400 }
        )
      }

      const hasTrustLine = await DonationService.checkTrustLineStatus(
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
