/**
 * Toast関連の型定義
 */

export type ToastType = 'success' | 'error'

export type ToastCookieKey =
  | 'toast-success'
  | 'toast-error'
  | 'github-installation-success'
  | 'github-installation-error'

export type ToastMessage = {
  type: ToastType
  message: string
}
