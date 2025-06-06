/**
 * トラストライン状態確認API
 * XRPLネットワークから直接状態を確認（Xaman不要）
 */

import { NextRequest, NextResponse } from 'next/server'
import { DonationService } from '@/services/DonationService'
import { ProjectService } from '@/services/ProjectService'
import { trustlineCheckSchema } from '@/validations/project'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const donorAddress = searchParams.get('donorAddress')
    const projectId = searchParams.get('projectId')

    // パラメータバリデーション
    const validatedData = trustlineCheckSchema.parse({
      donorAddress,
      projectId,
    })

    // プロジェクト情報を取得
    const project = await ProjectService.getProjectById(validatedData.projectId)
    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // プロジェクトの基本検証
    ProjectService.validateProject(project)

    // トラストライン状態確認
    const hasTrustLine = await DonationService.checkTrustLineStatus(
      validatedData.donorAddress,
      project.tokenCode,
      project.issuerAddress
    )

    // XRP残高取得
    const xrpBalance = await DonationService.getXrpBalance(validatedData.donorAddress)

    // プロジェクトトークン残高取得
    const tokenBalance = await DonationService.getTokenBalance(
      validatedData.donorAddress,
      validatedData.projectId
    )

    // 寄付可能判定
    const canDonate = hasTrustLine && xrpBalance > 0

    return NextResponse.json({
      success: true,
      data: {
        canDonate,
        hasTrustLine,
        tokenCode: project.tokenCode,
        issuerAddress: project.issuerAddress,
        xrpBalance,
        tokenBalance,
      },
    })
  } catch (error) {
    console.error('Trustline check error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'リクエストパラメータが無効です', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'トラストライン状態の確認に失敗しました' }, { status: 500 })
  }
}
