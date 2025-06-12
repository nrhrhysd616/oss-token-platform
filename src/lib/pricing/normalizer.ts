/**
 * 品質指標の正規化処理
 *
 * 正規化とは：
 * 異なるスケールの指標（例：スター数は数千、ダウンロード数は数万）を
 * 統一的に比較できるよう0-1の範囲に変換する処理。
 * これにより、各指標を公平に重み付けして総合スコアを計算できる。
 */

import type {
  QualityParameter,
  GitHubMetrics,
  QualityScoreBreakdown,
  QualityMetricValue,
} from '@/types/pricing'

/**
 * 線形正規化（0-1の範囲に正規化）
 *
 * 用途：一般的な数値指標（スター数、フォーク数など）の正規化
 *
 * 例：スター数が500、最小値0、最大値1000の場合
 * → (500 - 0) / (1000 - 0) = 0.5 となり、0.5のスコアが付く
 */
function linearNormalize(value: number, min: number, max: number): number {
  if (max <= min) {
    throw new Error('Max value must be greater than min value')
  }

  // 線形変換：値を最小値〜最大値の範囲で0-1に変換
  // 計算式：(現在の値 - 最小値) / (最大値 - 最小値)
  // これにより、最小値なら0、最大値なら1、中間値なら0-1の間の値になる
  const normalized = (value - min) / (max - min)

  // クランプ処理：結果を0-1の範囲内に制限
  // Math.max(0, x)：0未満の値を0に制限（負の値を防ぐ）
  // Math.min(1, x)：1を超える値を1に制限（上限を設ける）
  // 例：値が範囲外でも安全に0-1の範囲内に収める
  return Math.max(0, Math.min(1, normalized))
}

/**
 * 対数正規化（対数スケールで正規化）
 *
 * 用途：指数的に増加する指標の正規化
 * 大きな値の差を圧縮し、小さな値の差を拡大することで、より公平な比較が可能
 *
 * 例： 値が10,000、最小値100、最大値1,000,000の場合
 * 線形正規化だと小さな差が無視されがちだが、対数正規化により適切に評価される
 */
function logarithmicNormalize(value: number, min: number, max: number): number {
  if (min <= 0 || max <= 0) {
    throw new Error('Min and max values must be positive for logarithmic normalization')
  }

  // 対数変換：指数的な値を線形スケールに変換
  // Math.max(value, min)で最小値未満の場合は最小値を使用（対数の定義域エラーを防ぐ）
  const logValue = Math.log(Math.max(value, min))
  const logMin = Math.log(min)
  const logMax = Math.log(max)

  // 対数変換後の値を線形正規化
  const normalized = (logValue - logMin) / (logMax - logMin)
  return Math.max(0, Math.min(1, normalized))
}

/**
 * 逆数正規化（値が小さいほど高スコア）
 *
 * 用途：値が小さいほど良い指標（最終コミットからの日数、オープンイシュー数など）の正規化
 * 通常の正規化とは逆に、小さな値ほど高いスコア（1に近い値）を付ける
 *
 * 例：最終コミットから5日、最小値1日、最大値30日の場合
 * → 5日は比較的最近なので高スコア（約0.83）が付く
 * → 25日だと古いので低スコア（約0.2）が付く
 */
function inverseNormalize(value: number, min: number, max: number): number {
  if (min < 0) {
    throw new Error('Min value must be non-negative for inverse normalization')
  }

  // 値を逆転：小さな値ほど大きな値になるよう変換
  // 計算式：(最大値 + 最小値) - 現在の値
  // 例：値5、最小1、最大30の場合 → 30 + 1 - 5 = 26（大きな値に変換）
  const inverted = max + min - value

  // 逆転した値を線形正規化（これで小さな元の値ほど高スコアになる）
  return linearNormalize(inverted, min, max)
}

/**
 * 指標値を正規化
 *
 * 指定されたパラメータ設定に基づいて、生の指標値を0-1の範囲に正規化する
 * 正規化タイプ（linear/logarithmic/inverse）に応じて適切な正規化関数を選択
 *
 * @param value - 正規化する生の指標値
 * @param parameter - 正規化設定を含む品質パラメータ
 * @returns 0-1の範囲に正規化された値
 */
export function normalizeMetric(value: number, parameter: QualityParameter): number {
  const { normalizationConfig } = parameter
  const { type, minValue, maxValue } = normalizationConfig

  // 正規化タイプに応じて適切な正規化関数を呼び出し
  switch (type) {
    case 'linear':
      return linearNormalize(value, minValue, maxValue)
    case 'logarithmic':
      return logarithmicNormalize(value, minValue, maxValue)
    case 'inverse':
      return inverseNormalize(value, minValue, maxValue)
    default:
      throw new Error(`Unknown normalization type: ${type}`)
  }
}

/**
 * GitHub指標を品質スコアの内訳に変換
 *
 * GitHubから取得した生の指標値（スター数、ダウンロード数など）を
 * 正規化された品質スコアの内訳に変換する
 *
 * @param metrics - GitHubから取得した生の指標値
 * @param parameters - 各指標の正規化設定とウェイト
 * @returns 生の値と正規化された値を含む品質スコアの内訳
 */
export function createQualityScoreBreakdown(
  metrics: GitHubMetrics,
  parameters: QualityParameter[]
): QualityScoreBreakdown {
  // パラメータIDをキーとするMapを作成（高速な検索のため）
  const parameterMap = new Map(parameters.map(p => [p.id, p]))

  // 各指標の生の値と正規化された値を含むオブジェクトを作成
  const createMetricValue = (metricId: string, rawValue: number): QualityMetricValue => {
    const parameter = parameterMap.get(metricId)

    // パラメータが存在しないか無効化されている場合は正規化値を0に
    if (!parameter || !parameter.enabled) {
      return { value: rawValue, normalized: 0 }
    }

    // パラメータ設定に基づいて正規化を実行
    const normalized = normalizeMetric(rawValue, parameter)
    return { value: rawValue, normalized }
  }

  // 各GitHub指標を対応する品質指標に変換
  return {
    stars: createMetricValue('stars', metrics.stars), // スター数
    downloads: createMetricValue('downloads', metrics.weeklyDownloads), // 週間ダウンロード数
    commits: createMetricValue('commits', metrics.lastCommitDays), // 最終コミットからの日数
    issues: createMetricValue('issues', metrics.openIssues), // オープンイシュー数
  }
}

/**
 * 品質スコアの内訳から総合スコアを計算
 *
 * 各指標の正規化された値に重みを掛けて加重平均を計算し、
 * 最終的な品質スコア（0-1の範囲）を算出する
 *
 * 計算式：総合スコア = Σ(正規化値 × 重み) / Σ(重み)
 *
 * @param breakdown - 各指標の生の値と正規化された値を含む内訳
 * @param parameters - 各指標の重み設定
 * @returns 0-1の範囲の総合品質スコア
 */
export function calculateOverallQualityScore(
  breakdown: QualityScoreBreakdown,
  parameters: QualityParameter[]
): number {
  // パラメータIDをキーとするMapを作成（高速な検索のため）
  const parameterMap = new Map(parameters.map(p => [p.id, p]))

  let totalWeightedScore = 0 // 重み付きスコアの合計
  let totalWeight = 0 // 重みの合計

  // 各指標の重み付きスコアを計算
  const metrics = [
    { id: 'stars', value: breakdown.stars },
    { id: 'downloads', value: breakdown.downloads },
    { id: 'commits', value: breakdown.commits },
    { id: 'issues', value: breakdown.issues },
  ]

  for (const metric of metrics) {
    const parameter = parameterMap.get(metric.id)

    // パラメータが存在し、有効化されている場合のみ計算に含める
    if (parameter && parameter.enabled) {
      // 重み付きスコア = 正規化された値 × 重み
      const weightedScore = parameter.weight * metric.value.normalized
      totalWeightedScore += weightedScore
      totalWeight += parameter.weight
    }
  }

  // 重みの合計が0の場合（全指標が無効化されている場合）は0を返す
  if (totalWeight === 0) {
    return 0
  }

  // 加重平均を計算：重み付きスコアの合計 ÷ 重みの合計
  // 例：スター0.3×0.4 + ダウンロード0.8×0.3 + コミット0.6×0.3 = 0.54
  return totalWeightedScore / totalWeight
}

/**
 * 正規化パラメータのバリデーション
 *
 * 品質パラメータの設定値が正しいかどうかをチェックし、
 * 不正な設定の場合はエラーを投げる
 *
 * @param parameter - 検証する品質パラメータ
 * @throws {Error} 設定値が不正な場合
 */
export function validateNormalizationConfig(parameter: QualityParameter): void {
  const { normalizationConfig } = parameter
  const { type, minValue, maxValue } = normalizationConfig

  // 最大値が最小値以下の場合はエラー（正規化の分母が0以下になるため）
  if (maxValue <= minValue) {
    throw new Error(
      `Invalid range for ${parameter.id}: max (${maxValue}) must be greater than min (${minValue})`
    )
  }

  // 対数正規化では最小値が正の数である必要がある（対数の定義域制約のため）
  if (type === 'logarithmic') {
    if (minValue <= 0) {
      throw new Error(
        `Invalid min value for ${parameter.id}: must be positive for logarithmic normalization`
      )
    }
  }

  // 逆数正規化では最小値が非負である必要がある
  if (type === 'inverse') {
    if (minValue < 0) {
      throw new Error(
        `Invalid min value for ${parameter.id}: must be non-negative for inverse normalization`
      )
    }
  }

  // 重みは負の値にできない（負の重みは意味をなさないため）
  if (parameter.weight < 0) {
    throw new Error(`Invalid weight for ${parameter.id}: must be non-negative`)
  }
}

/**
 * 全パラメータの重みの合計をチェック
 *
 * 有効化されているパラメータの重みの合計が1.0に近いかチェックし、
 * 大きく異なる場合は警告を出力する
 *
 * 重みの合計が1.0でない場合でも動作するが、
 * 意図した重み付けになっているかを確認するためのチェック
 *
 * @param parameters - チェックする品質パラメータの配列
 */
export function validateWeightSum(parameters: QualityParameter[]): void {
  // 有効化されているパラメータのみを対象とする
  const enabledParameters = parameters.filter(p => p.enabled)

  // 重みの合計を計算
  const totalWeight = enabledParameters.reduce((sum, p) => sum + p.weight, 0)

  // 重みの合計が1.0に近いかチェック（誤差許容範囲: ±0.01）
  // 例：0.99〜1.01の範囲なら正常、0.8や1.2なら警告
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    console.warn(`Warning: Total weight sum is ${totalWeight}, expected 1.0`)
  }
}
