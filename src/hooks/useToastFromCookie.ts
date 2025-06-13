/**
 * Cookieからtoastメッセージを取得・表示するカスタムフック
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { getAllToastMessages } from '@/lib/toast-utils'

/**
 * Cookieからtoastメッセージを取得して表示し、cookieを削除するフック
 */
export const useToastFromCookie = () => {
  const pathname = usePathname()

  useEffect(() => {
    const handleToastMessages = () => {
      const messages = getAllToastMessages()

      messages.forEach(({ type, message, duration }) => {
        const toastOptions = duration ? { duration } : {}

        if (type === 'success') {
          toast.success(message, toastOptions)
        } else {
          toast.error(message, toastOptions)
        }
      })
    }

    // コンポーネントマウント時とパス変更時にメッセージをチェック
    handleToastMessages()
  }, [pathname])
}
