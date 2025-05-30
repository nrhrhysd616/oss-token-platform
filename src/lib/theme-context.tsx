'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

// テーマコンテキストの型定義
type ThemeContextType = {
  colorTheme: 'red' | 'yellow'
  toggleColorTheme: () => void
}

// テーマコンテキストの作成
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// テーマプロバイダーコンポーネント
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorTheme] = useState<'red' | 'yellow'>('red')

  const toggleColorTheme = () => {
    setColorTheme(prev => (prev === 'red' ? 'yellow' : 'red'))
  }

  return (
    <ThemeContext.Provider value={{ colorTheme, toggleColorTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// テーマコンテキストを使用するためのフック
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
