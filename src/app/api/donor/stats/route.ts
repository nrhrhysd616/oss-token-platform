/**
 * 寄付者統計情報 API
 * 認証されたユーザーの寄付統計を取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { DonationService } from '@/services/DonationService'
import { ProjectService } from '@/services/ProjectService'
import { ServiceError } from '@/services/shared/ServiceError'
import { DonorDonationItem, DonorStats, ReceivedToken } from '@/types/stats'

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

    // 統計情報を取得
    const stats = await getDonorStats(userUid)

    return NextResponse.json<DonorStats>(stats)
  } catch (error) {
    console.error('Donor stats fetch error:', error)

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: '統計情報の取得に失敗しました' }, { status: 500 })
  }
}

/**
 * 寄付者の統計情報を取得（寄付統計とトークン統計を一括処理）
 */
async function getDonorStats(donorUid: string): Promise<DonorStats> {
  const projectsMap = new Map<string, { name: string; tokenCode: string }>()
  let totalDonationXrpAmount = 0
  const allRecentDonations: DonorDonationItem[] = []
  const tokenTypes = new Set<string>()
  const tokenStatsMap = new Map<string, ReceivedToken>()

  try {
    // donorUidで寄付履歴を取得（一度だけ）
    const donationHistory = await DonationService.getDonationHistory({
      donorUid,
    })

    // 必要なプロジェクトIDを収集
    const projectIds = [...new Set(donationHistory.map(donation => donation.projectId))]

    // プロジェクト情報を並列で取得
    const projectPromises = projectIds.map(async projectId => {
      try {
        const project = await ProjectService.getProjectById(projectId)
        if (project) {
          projectsMap.set(projectId, {
            name: project.name,
            tokenCode: project.tokenCode,
          })
        }
      } catch (error) {
        console.warn(`プロジェクト情報取得失敗: ${projectId}`, error)
        // エラーが発生してもデフォルト値を設定
        projectsMap.set(projectId, {
          name: 'Unknown Project',
          tokenCode: 'UNKNOWN',
        })
      }
    })

    await Promise.all(projectPromises)

    // 寄付履歴を一度だけループして両方の統計を計算
    for (const donation of donationHistory) {
      // 寄付統計の計算
      totalDonationXrpAmount += donation.xrpAmount

      const projectInfo = projectsMap.get(donation.projectId)
      const projectName = projectInfo?.name || 'Unknown Project'

      allRecentDonations.push({
        projectId: donation.projectId,
        projectName,
        xrpAmount: donation.xrpAmount,
        createdAt: donation.createdAt.toISOString(),
        txHash: donation.txHash,
      })

      // トークン統計の計算
      if (donation.tokenIssued && donation.tokenAmount && donation.tokenAmount > 0) {
        if (projectInfo && projectInfo.tokenCode !== 'UNKNOWN') {
          tokenTypes.add(projectInfo.tokenCode)

          // 受け取ったトークンの詳細統計を集計
          const tokenKey = `${donation.projectId}_${projectInfo.tokenCode}`
          const existingTokenStats = tokenStatsMap.get(tokenKey)

          if (existingTokenStats) {
            // 既存のトークン統計を更新
            existingTokenStats.totalAmount += donation.tokenAmount
            existingTokenStats.transactionCount += 1
            if (donation.createdAt > new Date(existingTokenStats.lastReceivedAt)) {
              existingTokenStats.lastReceivedAt = donation.createdAt.toISOString()
            }
          } else {
            // 新しいトークン統計を作成
            tokenStatsMap.set(tokenKey, {
              projectId: donation.projectId,
              projectName,
              tokenCode: projectInfo.tokenCode,
              totalAmount: donation.tokenAmount,
              lastReceivedAt: donation.createdAt.toISOString(),
              transactionCount: 1,
            })
          }
        }
      }
    }
  } catch (error) {
    console.warn(`寄付統計取得失敗: ${donorUid}`, error)
    // エラーが発生しても処理を続行
  }

  // 最近の寄付を時系列順にソート（最新5件）
  const recentDonations = allRecentDonations
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  // 受け取ったトークン一覧を作成（最終受取日時の降順でソート）
  const receivedTokens = Array.from(tokenStatsMap.values()).sort(
    (a, b) => new Date(b.lastReceivedAt).getTime() - new Date(a.lastReceivedAt).getTime()
  )

  return {
    totalDonationXrpAmount,
    tokenTypesCount: tokenTypes.size,
    recentDonations,
    receivedTokens,
  }
}
