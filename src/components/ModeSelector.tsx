'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { UserRole } from '@/types/user'

interface ModeSelectorProps {
  onModeSelected: () => void
}

export default function ModeSelector({ onModeSelected }: ModeSelectorProps) {
  const { userRoles, currentMode, switchMode, updateUserRoles } = useAuth()
  const [selectedMode, setSelectedMode] = useState<UserRole>(currentMode || 'donor')
  const [isUpdating, setIsUpdating] = useState(false)

  const handleModeSelect = async (mode: UserRole) => {
    setSelectedMode(mode)

    if (userRoles.includes(mode)) {
      // 既存のロールの場合はすぐに切り替え
      switchMode(mode)
      onModeSelected()
    } else {
      // 新しいロールの場合は追加
      setIsUpdating(true)
      try {
        const newRoles = [...userRoles, mode]
        await updateUserRoles(newRoles, mode)
        onModeSelected()
      } catch (error) {
        console.error('ロール更新エラー:', error)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  const handleContinueWithCurrent = () => {
    if (currentMode) {
      onModeSelected()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">利用モードを選択</h2>
          <p className="text-gray-300">
            どちらのモードでプラットフォームをご利用になりますか？
            <br />
            後から変更することも可能です
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* 寄付者モード */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedMode === 'donor'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => setSelectedMode('donor')}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    selectedMode === 'donor' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                  }`}
                >
                  {selectedMode === 'donor' && (
                    <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                  )}
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-white font-semibold mb-1">
                  🎁 寄付者モード
                  {userRoles.includes('donor') && (
                    <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                      設定済み
                    </span>
                  )}
                </h3>
                <p className="text-gray-300 text-sm">
                  OSSプロジェクトへの寄付を行い、トークンを受け取ることができます
                </p>
                <ul className="text-gray-400 text-xs mt-2 space-y-1">
                  <li>• プロジェクト一覧の閲覧</li>
                  <li>• 寄付の実行とトークン受け取り</li>
                  <li>• 寄付履歴の確認</li>
                  <li>• 保有トークンの管理</li>
                </ul>
              </div>
            </div>
          </div>

          {/* OSS管理者モード */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedMode === 'maintainer'
                ? 'border-green-500 bg-green-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => setSelectedMode('maintainer')}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    selectedMode === 'maintainer'
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-400'
                  }`}
                >
                  {selectedMode === 'maintainer' && (
                    <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                  )}
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-white font-semibold mb-1">
                  🛠 OSS管理者モード
                  {userRoles.includes('maintainer') && (
                    <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                      設定済み
                    </span>
                  )}
                </h3>
                <p className="text-gray-300 text-sm">
                  OSSプロジェクトを登録し、寄付の受け取りや収益分析を行えます
                </p>
                <ul className="text-gray-400 text-xs mt-2 space-y-1">
                  <li>• プロジェクトの登録・管理</li>
                  <li>• トークンの発行・設定</li>
                  <li>• 寄付の受け取り</li>
                  <li>• 収益・分析データの確認</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={() => handleModeSelect(selectedMode)}
            disabled={isUpdating}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              selectedMode === 'donor'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            } disabled:bg-gray-600 disabled:cursor-not-allowed`}
          >
            {isUpdating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                設定中...
              </div>
            ) : (
              `${selectedMode === 'donor' ? '寄付者' : 'OSS管理者'}モードで開始`
            )}
          </button>

          {currentMode && (
            <button
              onClick={handleContinueWithCurrent}
              className="w-full py-2 px-4 text-gray-300 hover:text-white transition-colors text-sm"
            >
              現在のモード（{currentMode === 'donor' ? '寄付者' : 'OSS管理者'}）で続行
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
