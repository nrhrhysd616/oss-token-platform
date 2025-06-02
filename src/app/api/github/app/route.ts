import { NextResponse } from 'next/server'
import { getGitHubAppInfo } from '@/lib/github/app'
import { GitHubAppInfo } from '@/types/github'

// GitHub App情報を取得するエンドポイント
export async function GET() {
  try {
    const appInfo = await getGitHubAppInfo()

    if (!appInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'GitHub App情報が取得できませんでした',
        },
        { status: 404 }
      )
    }

    return NextResponse.json<GitHubAppInfo>({
      name: appInfo.name,
      description: appInfo.description,
      url: appInfo.html_url,
      permissions: appInfo.permissions,
    })
  } catch (error) {
    console.error('GitHub App情報取得エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'GitHub App情報の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}
