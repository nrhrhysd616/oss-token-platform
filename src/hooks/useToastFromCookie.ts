/**
 * Cookieからtoastメッセージを取得・表示するカスタムフック
 */

import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { getAllToastMessages } from '@/lib/toast-utils'

/**
 * Cookieからtoastメッセージを取得して表示し、cookieを削除するフック
 */
export const useToastFromCookie = () => {
  useEffect(() => {
    const handleToastMessages = () => {
      const messages = getAllToastMessages()

      messages.forEach(({ type, message }) => {
        if (type === 'success') {
          toast.success(message)
        } else {
          toast.error(message)
        }
      })
    }

    // コンポーネントマウント時にメッセージをチェック
    handleToastMessages()
  }, [])
}
