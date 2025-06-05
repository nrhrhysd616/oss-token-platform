// Xaman SDK初期化ファイル
import { Xumm } from 'xumm'

let xummInstance: Xumm

/**
 * Xummインスタンスを初期化
 */
function initializeXumm(): Xumm {
  if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
    throw new Error('Xaman API設定が不正です。XUMM_API_KEYとXUMM_API_SECRETを設定してください。')
  }

  return new Xumm(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET)
}

/**
 * Xummインスタンスを取得
 */
export function getXummInstance(): Xumm {
  if (!xummInstance) {
    xummInstance = initializeXumm()
  }
  return xummInstance
}
