'use client'

import { useTheme } from '@/lib/theme-context'

export default function EnvironmentBanner() {
  // 本番環境の場合は表示しない
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    return null
  }

  const { colorTheme } = useTheme()

  // テーマ色に応じて警告色を決定
  const bannerStyles =
    colorTheme === 'red'
      ? 'bg-yellow-500 text-black border-yellow-600'
      : 'bg-red-500 text-white border-red-600'

  return (
    <div
      className={`${bannerStyles} border-b-2 px-4 py-2 text-center text-sm font-medium shadow-sm sticky top-0 z-50`}
    >
      <div className="flex items-center justify-center space-x-2">
        <span className="text-lg">⚠️</span>
        <span>テスト環境 - 本番環境ではありません</span>
      </div>
    </div>
  )
}
