/**
 * GitHub品質指標取得機能
 */

import type { GitHubMetrics } from '@/types/pricing'
import { getInstallationAccessToken } from '@/lib/github/app'

// TODO: octokitのライブラリ使用を検討
// import { Octokit } from '@octokit/rest'

/**
 * GitHubリポジトリの品質指標を取得
 */
export async function fetchGitHubMetrics(
  owner: string,
  repo: string,
  installationId: number
): Promise<GitHubMetrics> {
  try {
    // Installation Access Tokenを取得
    const accessToken = await getInstallationAccessToken(installationId)

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OSS-Token-Platform',
      Authorization: `token ${accessToken}`,
    }

    // 基本リポジトリ情報を取得
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    })

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        throw new Error(`Repository not found or not accessible: ${owner}/${repo}`)
      }
      if (repoResponse.status === 403) {
        throw new Error(
          `Access denied to repository: ${owner}/${repo}. Check installation permissions.`
        )
      }
      throw new Error(`GitHub API error: ${repoResponse.status} ${repoResponse.statusText}`)
    }

    const repoData = await repoResponse.json()

    // 並行して各指標を取得
    const [commits, issues, releases] = await Promise.allSettled([
      fetchRecentCommits(owner, repo, headers),
      fetchIssueMetrics(owner, repo, headers),
      fetchReleaseMetrics(owner, repo, headers),
    ])

    // 各結果から値を抽出（エラーの場合はデフォルト値）
    const commitData = commits.status === 'fulfilled' ? commits.value : { lastCommitDays: 999 }
    const issueData =
      issues.status === 'fulfilled' ? issues.value : { openIssues: 0, avgResponseHours: 999 }
    const releaseData = releases.status === 'fulfilled' ? releases.value : { weeklyDownloads: 0 }

    return {
      stars: repoData.stargazers_count || 0,
      weeklyDownloads: releaseData.weeklyDownloads,
      lastCommitDays: commitData.lastCommitDays,
      openIssues: issueData.openIssues,
      fetchedAt: new Date(),
    }
  } catch (error) {
    console.error('Failed to fetch GitHub metrics:', error)

    // Installation関連のエラーの場合は詳細なエラーメッセージを含める
    if (error instanceof Error) {
      if (error.message.includes('Installation') || error.message.includes('Access denied')) {
        throw error
      }
    }

    // その他のエラー時はデフォルト値を返す
    return {
      stars: 0,
      weeklyDownloads: 0,
      lastCommitDays: 999,
      openIssues: 0,
      fetchedAt: new Date(),
    }
  }
}

/**
 * 最近のコミット情報を取得
 */
async function fetchRecentCommits(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<{ lastCommitDays: number }> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch commits: ${response.status}`)
  }

  const commits = await response.json()

  if (commits.length === 0) {
    return { lastCommitDays: 999 }
  }

  const lastCommitDate = new Date(commits[0].commit.committer.date)
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24))

  return { lastCommitDays: daysDiff }
}

/**
 * Issue関連の指標を取得
 */
async function fetchIssueMetrics(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<{ openIssues: number; avgResponseHours: number }> {
  // オープンなIssue数を取得
  const issuesResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`,
    { headers }
  )

  if (!issuesResponse.ok) {
    throw new Error(`Failed to fetch issues: ${issuesResponse.status}`)
  }

  const issues = await issuesResponse.json()
  const openIssues = issues.length

  // 最近のIssueの平均応答時間を計算
  let totalResponseHours = 0
  let responseCount = 0

  for (const issue of issues.slice(0, 10)) {
    // 最新10件のみ
    if (issue.comments > 0) {
      try {
        const commentsResponse = await fetch(issue.comments_url, { headers })
        if (commentsResponse.ok) {
          const comments = await commentsResponse.json()
          if (comments.length > 0) {
            const issueCreated = new Date(issue.created_at)
            const firstResponse = new Date(comments[0].created_at)
            const responseHours =
              (firstResponse.getTime() - issueCreated.getTime()) / (1000 * 60 * 60)

            if (responseHours >= 0) {
              totalResponseHours += responseHours
              responseCount++
            }
          }
        }
      } catch (error) {
        // 個別のコメント取得エラーは無視
        console.warn('Failed to fetch issue comments:', error)
      }
    }
  }

  const avgResponseHours = responseCount > 0 ? totalResponseHours / responseCount : 999

  return { openIssues, avgResponseHours }
}

/**
 * リリース・ダウンロード関連の指標を取得
 */
async function fetchReleaseMetrics(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<{ weeklyDownloads: number }> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`,
      { headers }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.status}`)
    }

    const releases = await response.json()

    // 最近1週間のダウンロード数を計算
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    let weeklyDownloads = 0

    for (const release of releases) {
      const releaseDate = new Date(release.published_at)
      if (releaseDate >= oneWeekAgo) {
        for (const asset of release.assets || []) {
          weeklyDownloads += asset.download_count || 0
        }
      }
    }

    return { weeklyDownloads }
  } catch (error) {
    console.warn('Failed to fetch release metrics:', error)
    return { weeklyDownloads: 0 }
  }
}

/**
 * GitHub APIのレート制限情報を取得（Installation Access Token使用）
 */
export async function getGitHubRateLimit(installationId: number): Promise<{
  limit: number
  remaining: number
  reset: Date
}> {
  try {
    // Installation Access Tokenを取得
    const accessToken = await getInstallationAccessToken(installationId)

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OSS-Token-Platform',
      Authorization: `token ${accessToken}`,
    }

    const response = await fetch('https://api.github.com/rate_limit', { headers })

    if (!response.ok) {
      throw new Error(`Rate limit API error: ${response.status}`)
    }

    const data = await response.json()
    const coreLimit = data.rate

    return {
      limit: coreLimit.limit,
      remaining: coreLimit.remaining,
      reset: new Date(coreLimit.reset * 1000),
    }
  } catch (error) {
    console.error('Failed to fetch rate limit:', error)

    // デフォルト値を返す（GitHub Appの場合の制限）
    return {
      limit: 5000, // GitHub Appの場合の制限
      remaining: 0,
      reset: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
    }
  }
}
