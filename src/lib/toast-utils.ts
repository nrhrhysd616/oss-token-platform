/**
 * Toast用Cookie操作ユーティリティ
 */

import { ToastType, ToastCookieKey, ToastMessage } from '@/types/toast'
import { NextResponse } from 'next/server'

/**
 * Cookieにtoastメッセージを設定
 */
export const setToastCookie = (type: ToastType, message: string, prefix?: string): void => {
  const cookieKey: ToastCookieKey = prefix
    ? (`${prefix}-${type}` as ToastCookieKey)
    : (`toast-${type}` as ToastCookieKey)

  document.cookie = `${cookieKey}=${encodeURIComponent(message)}; path=/; max-age=60`
}

/**
 * Cookieからtoastメッセージを取得
 */
export const getToastFromCookie = (cookieKey: ToastCookieKey): string | null => {
  const cookie = document.cookie.split('; ').find(row => row.startsWith(`${cookieKey}=`))

  if (!cookie) return null

  const value = cookie.split('=')[1]
  return value ? decodeURIComponent(value) : null
}

/**
 * Cookieからtoastメッセージを削除
 */
export const clearToastCookie = (cookieKey: ToastCookieKey): void => {
  document.cookie = `${cookieKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

/**
 * 全てのtoast関連cookieを取得して削除
 */
export const getAllToastMessages = (): ToastMessage[] => {
  const toastCookieKeys: ToastCookieKey[] = [
    'toast-success',
    'toast-error',
    'github-installation-success',
    'github-installation-error',
  ]

  const messages: ToastMessage[] = []

  toastCookieKeys.forEach(cookieKey => {
    const message = getToastFromCookie(cookieKey)
    if (message) {
      // cookieキーからtoastタイプを判定
      const type: ToastType = cookieKey.includes('success') ? 'success' : 'error'
      messages.push({ type, message })

      // cookieを削除
      clearToastCookie(cookieKey)
    }
  })

  return messages
}

/**
 * サーバーサイド用: NextResponseにtoastメッセージのcookieを設定
 */
export const setToastCookieOnResponse = (
  response: NextResponse,
  type: ToastType,
  message: string,
  prefix?: string
): void => {
  const cookieKey: ToastCookieKey = prefix
    ? (`${prefix}-${type}` as ToastCookieKey)
    : (`toast-${type}` as ToastCookieKey)

  response.cookies.set(cookieKey, message, {
    maxAge: 60, // 60秒で期限切れ
    httpOnly: false, // クライアントサイドからアクセス可能
    path: '/',
  })
}
