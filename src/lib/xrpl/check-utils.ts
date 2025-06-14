/**
 * XRPL Check関連のユーティリティ関数
 */

import { createHash } from 'crypto'
import { decodeAccountID } from 'xrpl'

/**
 * CheckIDを生成する
 * XRPLの仕様に従って、以下の値を連結したSHA-512ハーフハッシュを計算する：
 * 1. Checkスペースキー (0x0043)
 * 2. CheckCreateトランザクションの送信者のAccountID
 * 3. CheckCreateトランザクションのシーケンス番号
 *
 * @param account - CheckCreateトランザクションの送信者のアカウントアドレス
 * @param sequence - CheckCreateトランザクションのシーケンス番号
 * @returns CheckID (64文字の16進数文字列)
 */
export function generateCheckId(account: string, sequence: number): string {
  // Checkスペースキー (0x0043)
  const spaceKey = Buffer.from([0x00, 0x43])

  // アカウントアドレスをAccountIDに変換（20バイト）
  const accountId = decodeAccountId(account)

  // シーケンス番号を4バイトのビッグエンディアンに変換
  const sequenceBuffer = Buffer.alloc(4)
  sequenceBuffer.writeUInt32BE(sequence, 0)

  // 全てを連結
  const combined = Buffer.concat([spaceKey, accountId, sequenceBuffer])

  // SHA-512ハッシュを計算し、前半256ビット（32バイト）を取得
  const hash = createHash('sha512').update(combined).digest()
  const halfHash = hash.subarray(0, 32)

  // 16進数文字列として返す（大文字）
  return halfHash.toString('hex').toUpperCase()
}

/**
 * XRPLアドレスをAccountID（20バイト）にデコードする
 *
 * @param address - XRPLアドレス（rから始まる文字列）
 * @returns AccountID（20バイトのBuffer）
 */
function decodeAccountId(address: string): Buffer {
  try {
    // XRPLライブラリの関数を使用してAccountIDを取得
    const accountIdBytes = decodeAccountID(address)
    // Uint8ArrayをBufferに変換
    return Buffer.from(accountIdBytes)
  } catch (error) {
    throw new Error(`Failed to decode XRPL address: ${address}. ${error}`)
  }
}

/**
 * CheckIDの妥当性を検証する
 *
 * @param checkId - 検証するCheckID
 * @returns 妥当性の検証結果
 */
export function validateCheckId(checkId: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 必須チェック
  if (!checkId) {
    errors.push('CheckIDは必須です')
    return { valid: false, errors }
  }

  // 文字列型チェック
  if (typeof checkId !== 'string') {
    errors.push('CheckIDは文字列である必要があります')
    return { valid: false, errors }
  }

  // 長さチェック（64文字の16進数）
  if (checkId.length !== 64) {
    errors.push('CheckIDは64文字である必要があります')
  }

  // 16進数チェック
  const hexPattern = /^[0-9A-Fa-f]+$/
  if (!hexPattern.test(checkId)) {
    errors.push('CheckIDは16進数文字列である必要があります')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
