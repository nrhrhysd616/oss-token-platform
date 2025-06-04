/**
 * レート制限対応クラス
 * XRPLテストネットのAPI制限に対応するため、呼び出し間隔を制御
 */
export class RateLimiter {
  private lastCall = 0
  private readonly interval: number

  constructor(intervalMs = 1000) {
    this.interval = intervalMs
  }

  /**
   * 前回の呼び出しから指定時間経過するまで待機
   */
  async wait(): Promise<void> {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastCall
    if (timeSinceLastCall < this.interval) {
      const waitTime = this.interval - timeSinceLastCall
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    this.lastCall = Date.now()
  }

  /**
   * 複数の非同期処理を順次実行（レート制限付き）
   */
  async executeSequentially<T>(
    tasks: (() => Promise<T>)[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<T[]> {
    const results: T[] = []

    for (let i = 0; i < tasks.length; i++) {
      if (i > 0) {
        await this.wait()
      }

      const result = await tasks[i]()
      results.push(result)

      if (onProgress) {
        onProgress(i + 1, tasks.length)
      }
    }

    return results
  }
}

/**
 * グローバルレート制限インスタンス
 */
export const globalRateLimiter = new RateLimiter(1000) // 1秒間隔
