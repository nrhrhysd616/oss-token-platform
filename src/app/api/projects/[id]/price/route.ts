/**
 * プロジェクト価格取得API
 */

import { NextRequest, NextResponse } from 'next/server'
import { PricingService } from '@/services/PricingService'
import { QualityScoreService } from '@/services/QualityScoreService'

/**
 * GET /api/projects/[id]/price
 * プロジェクトの現在価格を取得
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // 現在の価格を計算
    const tokenPrice = await PricingService.calculateTokenPrice(projectId)

    // 品質スコアを取得
    const qualityScore = await QualityScoreService.getQualityScore(projectId)

    // 寄付総額を取得
    const totalDonations = await PricingService.getTotalDonations(projectId)

    // 価格履歴を取得（最新10件）
    const priceHistory = await PricingService.getPriceHistory(projectId, 10)

    const response = {
      currentPrice: {
        rlusd: tokenPrice.rlusd,
        xrp: tokenPrice.xrp,
      },
      qualityScore: qualityScore?.overall || 0,
      totalDonations,
      priceHistory: priceHistory.map(record => ({
        date: record.date.toISOString(),
        priceRLUSD: record.priceRLUSD,
        priceXRP: record.priceXRP,
        trigger: record.trigger,
      })),
      lastUpdated: tokenPrice.lastUpdated.toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Price API error:', error)

    if (error instanceof Error) {
      // エラーの種類に応じてステータスコードを設定
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      if (error.message.includes('Quality score not found')) {
        return NextResponse.json(
          { error: 'Quality score not available. Please update quality metrics first.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/price
 * プロジェクトの価格を手動更新（プラットフォーム管理者のみ）
 * 現在は未実装 - 管理者認証機能実装後に有効化予定
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // プラットフォーム管理者のみが実行可能な機能のため、一時的に未実装レスポンスを返却
  return NextResponse.json(
    {
      error: 'This endpoint is reserved for platform administrators and is not yet implemented',
      status: 'not_implemented',
    },
    { status: 501 }
  )

  /* 
  // TODO: 管理者認証機能実装後に以下のコードを有効化
  try {
    const { id: projectId } = await params

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // 価格履歴を更新
    await PricingService.updatePriceHistory(projectId, 'manual')

    // 更新後の価格を取得
    const tokenPrice = await PricingService.calculateTokenPrice(projectId)

    const response = {
      message: 'Price updated successfully',
      currentPrice: {
        rlusd: tokenPrice.rlusd,
        xrp: tokenPrice.xrp,
      },
      lastUpdated: tokenPrice.lastUpdated.toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Price update API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      if (error.message.includes('Quality score not found')) {
        return NextResponse.json(
          { error: 'Quality score not available. Please update quality metrics first.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  */
}
