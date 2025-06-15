import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/firebase/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import EnvironmentBanner from '@/components/EnvironmentBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OSSトークンプラットフォーム',
  description: 'GitHubとXRPLを連携したOSSトークン化プラットフォーム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        <ThemeProvider>
          <EnvironmentBanner />
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
