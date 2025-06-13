/**
 * メンテナー向けプロジェクト詳細 API
 * 所有者向けの全情報を返却
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { ProjectService } from '@/services/ProjectService'
import { DonationService } from '@/services/DonationService'
import { PricingService } from '@/services/PricingService'
import { projectUpdateApiSchema } from '@/validations/project'
import { MaintainerProject, MaintainerProjectStats, Project } from '@/types/project'
import { z } from 'zod'
import { ServiceError } from '@/services/shared/ServiceError'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'プロジェクトIDが必要です' }, { status: 400 })
    }

    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    // ProjectServiceを使用してプロジェクトを取得（所有者チェック込み）
    const projectData = await ProjectService.checkProjectOwnership(id, decodedToken.uid)

    // 統計情報を取得
    const stats = await getMaintainerProjectStats(projectData)

    // 管理者向け全情報を返却
    const maintainerProject: MaintainerProject = {
      ...projectData,
      stats,
    }

    return NextResponse.json({
      project: maintainerProject,
    })
  } catch (error) {
    console.error('Maintainer project fetch error:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'プロジェクトの取得に失敗しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'プロジェクトIDが必要です' }, { status: 400 })
    }

    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(idToken)

    const validatedData = projectUpdateApiSchema.parse(await request.json())

    // 名前の重複チェック（名前が変更される場合、route層でバリデーション）
    if (validatedData.name) {
      await ProjectService.validateUniqueConstraints(
        { name: validatedData.name },
        decodedToken.uid,
        id
      )
    }

    // ProjectServiceを使用してプロジェクトを更新
    const updatedProject = await ProjectService.updateProject(id, validatedData, decodedToken.uid)

    return NextResponse.json({
      project: updatedProject,
      message: 'Project updated successfully',
    })
  } catch (error) {
    console.error('Project update error:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'プロジェクトの更新に失敗しました' }, { status: 500 })
  }
}

/**
 * メンテナー向けプロジェクト統計情報を取得
 */
async function getMaintainerProjectStats(project: Project): Promise<MaintainerProjectStats> {
  try {
    // 寄付履歴を取得
    const donationHistory = await DonationService.getDonationHistory({
      projectId: project.id,
    })

    // 統計情報を計算
    const totalXrpDonations = donationHistory.reduce((sum, donation) => sum + donation.xrpAmount, 0)

    // 寄付者数を計算（重複排除）
    const uniqueDonors = new Set(donationHistory.map(donation => donation.donorAddress))
    const donorCount = uniqueDonors.size

    // 現在価格を取得
    let currentPrice = 1.0 // デフォルト価格
    try {
      const tokenPrice = await PricingService.calculateTokenPrice(project.id)
      currentPrice = tokenPrice.xrp
    } catch (error) {
      console.warn(`価格計算に失敗しました (${project.id}):`, error)
    }

    // 価格履歴を取得
    let priceHistory: Array<{ price: number; createdAt: string }> = []
    try {
      const priceHistoryRecords = await PricingService.getPriceHistory(project.id, 30)
      priceHistory = priceHistoryRecords.map(record => ({
        price: record.priceXRP,
        createdAt: record.createdAt.toISOString().split('T')[0],
      }))
    } catch (error) {
      console.warn(`価格履歴取得に失敗しました (${project.id}):`, error)
    }

    // トークン供給量を取得
    let tokenSupply = 0
    try {
      tokenSupply = await DonationService.getTotalTokenSupply(project.id)
    } catch (error) {
      console.warn(`トークン供給量取得に失敗しました (${project.id}):`, error)
    }

    // 最近の寄付（最新10件）
    const recentDonations = donationHistory
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(donation => ({
        xrpAmount: donation.xrpAmount,
        donorAddress: donation.donorAddress,
        timestamp: donation.createdAt.toISOString(),
        txHash: donation.txHash,
      }))

    return {
      totalXrpDonations,
      donorCount,
      currentPrice,
      priceHistory,
      tokenSupply,
      recentDonations,
    }
  } catch (error) {
    console.error(`統計情報取得エラー (${project.id}):`, error)

    // エラーが発生した場合はデフォルト値を返す
    return {
      totalXrpDonations: 0,
      donorCount: 0,
      currentPrice: 1.0,
      priceHistory: [],
      tokenSupply: 0,
      recentDonations: [],
    }
  }
}

// export async function DELETE(
//   request: NextRequest,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { id } = await params
//
//     if (!id) {
//       return NextResponse.json({ error: 'プロジェクトIDが必要です' }, { status: 400 })
//     }
//
//     // 認証チェック
//     const authHeader = request.headers.get('Authorization')
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
//     }
//
//     const idToken = authHeader.split('Bearer ')[1]
//     const decodedToken = await getAdminAuth().verifyIdToken(idToken)
//
//     // ProjectServiceを使用してプロジェクトを削除
//     await ProjectService.deleteProject(id, decodedToken.uid)
//
//     return NextResponse.json({
//       message: 'Project deleted successfully',
//     })
//   } catch (error) {
//     console.error('Project delete error:', error)
//
//     if (error instanceof ProjectServiceError) {
//       return NextResponse.json({ error: error.message }, { status: error.statusCode })
//     }
//
//     return NextResponse.json({ error: 'プロジェクトの削除に失敗しました' }, { status: 500 })
//   }
// }
