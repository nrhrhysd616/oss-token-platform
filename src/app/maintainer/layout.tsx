import React from 'react'
import Header from '@/components/Header'
import AuthGuard from '@/components/AuthGuard'
import { ToastManager } from '@/components/ToastManager'

export default function MaintainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Header />
      <ToastManager />
      <main className="container mx-auto p-4">{children}</main>
    </AuthGuard>
  )
}
