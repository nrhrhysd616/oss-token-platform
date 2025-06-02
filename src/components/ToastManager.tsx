/**
 * Toast管理コンポーネント
 * Toasterコンポーネントとcookie処理を統合
 */

'use client'

import { Toaster } from 'react-hot-toast'
import { useToastFromCookie } from '@/hooks/useToastFromCookie'

export const ToastManager = () => {
  // Cookieからtoastメッセージを取得・表示
  useToastFromCookie()

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#374151',
          color: '#fff',
          border: '1px solid #4B5563',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#fff',
          },
        },
      }}
    />
  )
}
