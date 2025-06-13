/**
 * 価格算出システムの初期データ設定スクリプト
 */

import { PricingParameters, QualityParameter } from '@/types/pricing'
import { getAdminDb } from '../src/lib/firebase/admin'

const pricingParameters: PricingParameters = {
  basePrice: 0.2, // P0 = 0.2 RLUSD - 寄付ゼロでも付く床価格
  qualityCoefficient: 0.45, // α = 0.45 - 品質スコアQの影響係数
  donationCoefficient: 0.075, // β = 0.075 - 寄付累計F_RLの影響係数
  referenceDonation: 3000, // F0 = 3000 RLUSD - ログ曲線の緩さ（基準寄付額）
  lastUpdated: new Date(),
}

const qualityParameters: QualityParameter[] = [
  {
    id: 'stars',
    name: 'スター数',
    weight: 0.3,
    normalizationConfig: {
      maxValue: 2500,
      minValue: 0,
      type: 'linear' as const,
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'downloads',
    name: '週間ダウンロード数',
    weight: 0.25,
    normalizationConfig: {
      maxValue: 66667, // 20000 / 0.30 で正規化値0.30になる値
      minValue: 0,
      type: 'linear' as const,
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'commits',
    name: 'コミット鮮度（日数）',
    weight: 0.25,
    normalizationConfig: {
      maxValue: 365, // 1年
      minValue: 0,
      type: 'inverse' as const, // 日数が少ないほど高スコア
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'issues',
    name: 'Issue数',
    weight: 0.2,
    normalizationConfig: {
      maxValue: 1200, // 300 / 0.25 で正規化値0.25になる値
      minValue: 0,
      type: 'linear' as const,
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

/**
 * 価格算出パラメータの初期設定
 */
async function setupPricingParameters(param: PricingParameters) {
  const db = getAdminDb()
  await db.collection('settings').doc('pricing').collection('parameters').doc('global').set(param)
  console.log('✅ 価格算出パラメータを設定しました')
}

/**
 * 品質指標パラメータの初期設定
 */
async function setupQualityParameters(params: QualityParameter[]) {
  const db = getAdminDb()

  const totalWeight = params.reduce((sum, param) => sum + param.weight, 0)
  if (totalWeight !== 1) {
    throw new Error(`品質指標パラメータの重みの合計が1ではありません: ${totalWeight}`)
  }

  // 各パラメータを個別に設定
  for (const param of params) {
    await db.collection('settings').doc('quality').collection('parameters').doc(param.id).set(param)
    console.log(`✅ 品質指標パラメータ「${param.name}」を設定しました`)
  }
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    console.log('🚀 価格算出システムの初期データ設定を開始します...')

    await setupPricingParameters(pricingParameters)
    await setupQualityParameters(qualityParameters)

    console.log('✨ 初期データ設定が完了しました！')
    console.log('')
    console.log('設定された内容:')
    console.log('- 価格算出パラメータ:')
    console.log(`  * 配置場所: settings/pricing/parameters/global`)
    console.log(`  * 基準価格 (P0): ${pricingParameters.basePrice} RLUSD`)
    console.log(`  * 品質係数 (α): ${pricingParameters.qualityCoefficient}`)
    console.log(`  * 寄付係数 (β): ${pricingParameters.donationCoefficient}`)
    console.log(`  * 基準寄付額 (F0): ${pricingParameters.referenceDonation} RLUSD`)
    console.log(`- 品質指標パラメータ (${qualityParameters.length}種類):`)
    console.log(`  * 配置場所: settings/quality/parameters/{id}`)
    qualityParameters.forEach(param => {
      console.log(`  * ${param.name} (重み: ${param.weight})`)
    })
    console.log('')
    console.log('Firestoreコレクション構造:')
    console.log('settings/')
    console.log('├── pricing/')
    console.log('│   └── parameters/')
    console.log('│       └── global')
    console.log('└── quality/')
    console.log('    └── parameters/')
    console.log('        ├── stars')
    console.log('        ├── downloads')
    console.log('        ├── commits')
    console.log('        └── issues')
    console.log('')
    console.log('次のステップ:')
    console.log('1. プロジェクトの品質スコアを更新: QualityScoreService.updateQualityScore()')
    console.log('2. プロジェクトの価格を計算: PricingService.calculateTokenPrice()')
    console.log('3. 価格取得API: GET /api/projects/[id]/price')
  } catch (error) {
    console.error('❌ 初期データ設定中にエラーが発生しました:', error)
    process.exit(1)
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main()
}

export { setupPricingParameters, setupQualityParameters }
