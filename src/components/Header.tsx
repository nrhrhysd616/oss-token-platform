'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { useTheme } from '@/lib/theme-context'

export default function Header() {
  const { user, loading, signInWithGithub, signOut, userRoles, currentMode, switchMode } = useAuth()
  const { colorTheme, toggleColorTheme } = useTheme()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // カラーテーマに基づくスタイル
  const accentColor = colorTheme === 'red' ? 'text-red-500' : 'text-yellow-500'
  const buttonBg =
    colorTheme === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'

  // ユーザー名の頭文字を取得する関数
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <header className="bg-black text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* ロゴ */}
        <Link href="/" className="text-2xl font-bold tracking-tight">
          <span className="text-white">OSS </span>
          <span className={accentColor}>Token</span>
          <span className="text-white"> PF</span>
        </Link>

        {/* 右側のナビゲーション */}
        <nav className="flex items-center space-x-4">
          {/* カラーテーマ切り替えボタン */}
          <button
            onClick={toggleColorTheme}
            className="text-sm px-4 py-2 border border-gray-600 rounded-md hover:bg-gray-800 transition-colors font-medium"
          >
            {colorTheme === 'red' ? '🟡' : '🔴'} テーマ
          </button>

          {!loading && (
            <>
              {user ? (
                <div className="flex items-center space-x-4">
                  {/* モード表示とダッシュボードリンク */}
                  {currentMode && (
                    <Link
                      href={`/${currentMode}`}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-colors ${
                        currentMode === 'donor'
                          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      <span>{currentMode === 'donor' ? '🎁' : '🛠'}</span>
                      <span className="text-sm font-medium">
                        {currentMode === 'donor' ? '寄付者' : 'OSS管理者'}
                      </span>
                    </Link>
                  )}

                  {/* モード選択リンク（常時表示） */}
                  <Link
                    href="/mode-select"
                    className="text-sm px-3 py-1.5 border border-gray-600 rounded-md hover:bg-gray-800 transition-colors"
                    title="モードを選択・変更"
                  >
                    ⚙️ モード
                  </Link>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="focus:outline-none"
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'ユーザー'}
                          className="w-8 h-8 rounded-full bg-blue-500 border-2 border-blue-500 hover:border-blue-400 transition-colors"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm hover:bg-blue-400 transition-colors">
                          {user.displayName ? getInitials(user.displayName) : '👤'}
                        </div>
                      )}
                    </button>
                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg py-2 z-10 border border-gray-200">
                        <Link
                          href="/settings"
                          className="block px-4 py-2 hover:bg-gray-100 transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          設定
                        </Link>
                        <button
                          onClick={() => {
                            signOut()
                            setIsDropdownOpen(false)
                          }}
                          className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                        >
                          ログアウト
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={signInWithGithub}
                  className={`${buttonBg} text-white px-6 py-2.5 rounded-md transition-colors font-medium shadow-sm`}
                >
                  GitHubでログイン
                </button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
