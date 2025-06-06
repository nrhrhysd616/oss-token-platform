import React from 'react'
import Header from '@/components/Header'
import AuthGuard from '@/components/AuthGuard'

export default function MaintainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Header />
      <main className="container mx-auto p-4">{children}</main>
    </AuthGuard>
  )
}
