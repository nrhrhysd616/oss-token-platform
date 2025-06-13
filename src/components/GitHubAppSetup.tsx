'use client'

import { useEffect, useState } from 'react'
import { useGitHubApp } from '@/hooks/useGitHubApp'
import { useAuth } from '@/lib/firebase/auth-context'

import { generateInstallationUrl } from '@/lib/github/installation'

export function GitHubAppSetup() {
  const { user } = useAuth()
  const { loading, appInfo, installations, fetchAppInfo, fetchInstallations } = useGitHubApp()

  const [installationMessage, setInstallationMessage] = useState<string | null>(null)
  const [installationError, setInstallationError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchAppInfo()
      fetchInstallations()
    }
  }, [user, fetchAppInfo, fetchInstallations])

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">GitHub App情報を読み込み中...</span>
      </div>
    )
  }

  const hasInstallations = installations.length > 0

  // stateパラメータ付きのインストールURLを生成
  const getInstallationUrl = () => {
    if (!user) return null

    try {
      return generateInstallationUrl({
        uid: user.uid,
        redirectPath: '/maintainer',
      })
    } catch (error) {
      console.error('Installation URL生成エラー:', error)
      return appInfo ? `${appInfo.url}/installations/new` : null
    }
  }

  const installationUrl = getInstallationUrl()

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">GitHub App連携情報</h3>
        {hasInstallations && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            連携済み
          </span>
        )}
      </div>

      {/* インストール成功メッセージ */}
      {installationMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{installationMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setInstallationMessage(null)}
                className="text-green-400 hover:text-green-600"
              >
                <span className="sr-only">閉じる</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* インストールエラーメッセージ */}
      {installationError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{installationError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setInstallationError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <span className="sr-only">閉じる</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {appInfo && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">{appInfo.name}</h4>
          <p className="text-sm text-gray-600 mb-3">{appInfo.description}</p>

          <div className="text-sm text-gray-500">
            <strong>権限:</strong>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(appInfo.permissions).map(([permission, level]) => (
                <div
                  key={permission}
                  className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-700 text-sm">{permission}</span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      level === 'write'
                        ? 'bg-orange-100 text-orange-800'
                        : level === 'read'
                          ? 'bg-blue-100 text-blue-800'
                          : level === 'admin'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasInstallations && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">
            インストール済みアカウントおよびOrganization
          </h4>
          <div className="space-y-2">
            {installations.map(installation => (
              <div
                key={installation.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {installation.account?.login || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {installation.account?.type || 'Unknown'} • {installation.repositorySelection}
                  </div>
                </div>
                <div className="text-xs text-gray-400">ID: {installation.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GitHub App連携が必要な場合の警告メッセージ */}
      {!hasInstallations && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">GitHub App連携が必要です</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  プロジェクト登録やリポジトリ情報の取得にはGitHub Appの連携が必要です。
                  <br />
                  下のボタンからGitHub Appをインストールしてください。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* インストールボタン（常に表示） */}
      {installationUrl && (
        <div className={hasInstallations ? 'mt-4' : ''}>
          <a
            href={installationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              hasInstallations
                ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                : 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                clipRule="evenodd"
              />
            </svg>
            {hasInstallations ? 'GitHub Appを追加インストール' : 'GitHub Appをインストール'}
          </a>
        </div>
      )}
    </div>
  )
}
