/**
 * メンテナー統計情報 API
 * 認証されたユーザーのプロジェクト管理統計を取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { ProjectService } from '@/services/ProjectService'
import { DonationService } from '@/services/DonationService'
import { Project } from '@/types/project'
import { ServiceError } from '@/services/shared/ServiceError'
import { MaintainerDonationItem, MaintainerStats } from '@/types/stats'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    const decodedToken = await getAdminAuth().verifyIdToken(token)
    const userUid = decodedToken.uid

    // メンテナーのプロジェクト一覧を取得
    const projects = await ProjectService.getMaintainerProjects(userUid, {
      limit: 100,
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    if (projects.items.length === 0) {
      // プロジェクトが存在しない場合はゼロ統計を返す
      return NextResponse.json<MaintainerStats>({
        projectCount: 0,
        totalReceivedXrpAmount: 0,
        totalSupportersCount: 0,
        recentDonations: [],
      })
    }

    // 統計情報を取得
    const stats = await getMaintainerStats(projects.items)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Maintainer stats fetch error:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: '統計情報の取得に失敗しました' }, { status: 500 })
  }
}

/**
 * メンテナーの統計情報を取得（寄付統計を一括処理）
 */
async function getMaintainerStats(projects: Project[]): Promise<MaintainerStats> {
  const projectsMap = new Map<string, { name: string }>()
  let totalReceivedXrpAmount = 0
  const allSupporters = new Set<string>()
  const allRecentDonations: MaintainerDonationItem[] = []

  // プロジェクト情報をMapに格納
  projects.forEach(project => {
    projectsMap.set(project.id, { name: project.name })
  })

  // 各プロジェクトの寄付履歴を並列で取得
  const donationHistoryPromises = projects.map(async project => {
    try {
      return await DonationService.getDonationHistory({
        projectId: project.id,
      })
    } catch (error) {
      console.warn(`寄付履歴取得失敗: ${project.id}`, error)
      return []
    }
  })

  const allDonationHistories = await Promise.all(donationHistoryPromises)

  // 全ての寄付履歴を統合して一度だけループで統計を計算
  for (const donationHistory of allDonationHistories) {
    for (const donation of donationHistory) {
      // 寄付統計の計算
      totalReceivedXrpAmount += donation.xrpAmount

      // 支援者の集計（donorAddressを使用）
      allSupporters.add(donation.donorAddress)

      const projectInfo = projectsMap.get(donation.projectId)
      const projectName = projectInfo?.name || 'Unknown Project'

      allRecentDonations.push({
        projectId: donation.projectId,
        projectName,
        xrpAmount: donation.xrpAmount,
        donorAddress: donation.donorAddress,
        createdAt: donation.createdAt.toISOString(),
        txHash: donation.txHash,
      })
    }
  }

  // 最近の寄付を時系列順にソート（最新10件）
  const recentDonations = allRecentDonations
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  return {
    projectCount: projects.length,
    totalReceivedXrpAmount,
    totalSupportersCount: allSupporters.size,
    recentDonations,
  }
}
