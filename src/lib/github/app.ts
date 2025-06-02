import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import jwt from 'jsonwebtoken'
import { GitHubRepository } from '@/types/github'

// GitHub App設定
function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`)
  }
  return value
}

const GITHUB_APP_ID = parseInt(getRequiredEnv('GITHUB_APP_ID'), 10)
const GITHUB_APP_PRIVATE_KEY = getRequiredEnv('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n')
const GITHUB_APP_CLIENT_ID = getRequiredEnv('GITHUB_APP_CLIENT_ID')
const GITHUB_APP_CLIENT_SECRET = getRequiredEnv('GITHUB_APP_CLIENT_SECRET')

// GitHub App JWT トークンを生成
export function generateAppJWT(): string {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 60, // 1分前から有効
    exp: now + 600, // 10分後まで有効
    iss: GITHUB_APP_ID.toString(),
  }

  return jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, { algorithm: 'RS256' })
}

// GitHub App認証用のOctokitインスタンスを作成
export function createAppOctokit(): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY,
      clientId: GITHUB_APP_CLIENT_ID,
      clientSecret: GITHUB_APP_CLIENT_SECRET,
    },
  })
}

// Installation Access Tokenを取得
export async function getInstallationAccessToken(installationId: number): Promise<string> {
  const octokit = createAppOctokit()

  const { data } = await octokit.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
  })

  return data.token
}

// Installation ID付きのOctokitインスタンスを作成
export async function createInstallationOctokit(installationId: number): Promise<Octokit> {
  const token = await getInstallationAccessToken(installationId)

  return new Octokit({
    auth: token,
  })
}

// GitHub App情報を取得
export async function getGitHubAppInfo() {
  const octokit = createAppOctokit()

  try {
    const { data } = await octokit.rest.apps.getAuthenticated()
    return data
  } catch (error) {
    console.error('GitHub App情報の取得に失敗:', error)
    throw error
  }
}

// ユーザーのInstallation情報を取得
export async function getUserInstallations(userAccessToken: string) {
  const octokit = new Octokit({
    auth: userAccessToken,
  })

  try {
    const { data } = await octokit.rest.apps.listInstallationsForAuthenticatedUser()
    return data.installations
  } catch (error) {
    console.error('Installation情報の取得に失敗:', error)
    throw error
  }
}

// リポジトリのInstallation IDを取得
export async function getRepositoryInstallation(owner: string, repo: string) {
  const octokit = createAppOctokit()

  try {
    const { data } = await octokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    })
    return data
  } catch (error) {
    console.error('リポジトリのInstallation情報取得に失敗:', error)
    throw error
  }
}

// Installation用のリポジトリ一覧を取得する関数
export async function getInstallationRepositories(
  installationId: number
): Promise<GitHubRepository[]> {
  const octokit = await createInstallationOctokit(installationId)

  try {
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation()

    return data.repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      htmlUrl: repo.html_url,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      language: repo.language,
      updatedAt: repo.updated_at || new Date().toISOString(),
      owner: {
        login: repo.owner.login,
        type: repo.owner.type,
        avatarUrl: repo.owner.avatar_url,
      },
    }))
  } catch (error) {
    console.error(`Installation ${installationId} のリポジトリ取得に失敗:`, error)
    return []
  }
}

// 複数のInstallationからすべてのリポジトリを取得する関数
export async function getAllRepositoriesFromInstallations(
  installationIds: number[]
): Promise<(GitHubRepository & { installationId: number })[]> {
  const allRepositories: (GitHubRepository & { installationId: number })[] = []

  const results = await Promise.allSettled(
    installationIds.map(async installationId => {
      const repositories = await getInstallationRepositories(installationId)
      return repositories.map(repo => ({
        ...repo,
        installationId,
      }))
    })
  )

  // 成功した結果のみを収集
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      allRepositories.push(...result.value)
    }
  })

  // リポジトリを更新日時でソート（新しい順）
  return allRepositories.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}
