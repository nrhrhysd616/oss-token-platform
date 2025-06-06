import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { createAppOctokit, createInstallationOctokit } from '@/lib/github/app'
import { setToastCookieOnResponse } from '@/lib/toast-utils'
import { FIRESTORE_COLLECTIONS } from '@/lib/firebase/collections'

// GitHub App インストール後のコールバックを処理
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')
    const state = searchParams.get('state') // ユーザー識別用のstate

    if (!installationId) {
      const response = NextResponse.redirect(new URL('/maintainer', request.url))
      setToastCookieOnResponse(response, 'error', 'Installation IDが見つかりません')
      return response
    }

    // GitHub APIからInstallation情報を取得
    const octokit = createAppOctokit()
    const { data: installation } = await octokit.rest.apps.getInstallation({
      installation_id: parseInt(installationId, 10),
    })

    // Installation情報をFirestoreに保存
    const adminDb = getAdminDb()
    const installationData = {
      id: installation.id,
      account: installation.account || null,
      permissions: installation.permissions || {},
      repositorySelection: installation.repository_selection || 'all',
      createdAt: new Date(installation.created_at),
      updatedAt: new Date(installation.updated_at),
      suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
      suspendedBy: installation.suspended_by || null,
      status: 'active',
      setupAction,
    }

    // Installationsコレクションに保存
    await adminDb
      .collection(FIRESTORE_COLLECTIONS.INSTALLATIONS)
      .doc(installation.id.toString())
      .set(installationData, { merge: true })

    // stateパラメータがある場合、ユーザーとの関連付けを試行
    if (state) {
      try {
        // stateからユーザー情報をデコード（Base64エンコードされたUID想定）
        const decodedState = Buffer.from(state, 'base64').toString('utf-8')
        const stateData = JSON.parse(decodedState)

        if (stateData.uid) {
          // ユーザーのInstallation情報を更新
          const userRef = adminDb.collection(FIRESTORE_COLLECTIONS.USERS).doc(stateData.uid)
          const userDoc = await userRef.get()

          if (userDoc.exists) {
            const existingInstallations = userDoc.data()?.githubInstallations || []
            const updatedInstallations = existingInstallations.filter(
              (inst: any) => inst.id !== installation.id
            )
            updatedInstallations.push({
              id: installation.id,
              account: installationData.account,
              permissions: installationData.permissions,
              repositorySelection: installationData.repositorySelection,
              updatedAt: new Date(),
            })

            await userRef.set(
              {
                githubInstallations: updatedInstallations,
                lastInstallationUpdate: new Date(),
              },
              { merge: true }
            )
          }
        }
      } catch (error) {
        console.error('State解析エラー:', error)
        // stateの解析に失敗してもInstallation保存は成功しているので続行
      }
    }

    // Installation対象のリポジトリ情報も取得・保存
    if (installation.repository_selection === 'selected') {
      try {
        // Installation認証用のOctokitインスタンスを作成
        const installationOctokit = await createInstallationOctokit(installation.id)
        const { data: repositories } =
          await installationOctokit.rest.apps.listReposAccessibleToInstallation()

        // リポジトリ情報を保存
        const batch = adminDb.batch()
        repositories.repositories.forEach(repo => {
          const repoRef = adminDb
            .collection(FIRESTORE_COLLECTIONS.INSTALLATION_REPOSITORIES)
            .doc(`${installation.id}_${repo.id}`)

          batch.set(repoRef, {
            installationId: installation.id,
            repositoryId: repo.id,
            repositoryName: repo.name,
            repositoryFullName: repo.full_name,
            repositoryPrivate: repo.private,
            repositoryDescription: repo.description,
            repositoryLanguage: repo.language,
            repositoryStars: repo.stargazers_count,
            repositoryForks: repo.forks_count,
            repositoryUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : new Date(),
            addedAt: new Date(),
          })
        })

        await batch.commit()
      } catch (error) {
        console.error('リポジトリ情報取得エラー:', error)
        // リポジトリ情報の取得に失敗してもInstallation保存は成功
      }
    }

    // 成功時のリダイレクト
    let successMessage = 'GitHub Appのインストールが完了しました'
    if (setupAction === 'update') {
      successMessage = 'GitHub Appの設定が更新されました'
    }

    const response = NextResponse.redirect(new URL('/maintainer', request.url))
    setToastCookieOnResponse(response, 'success', successMessage, 'github-installation')
    return response
  } catch (error) {
    console.error('Installation callback処理エラー:', error)

    const response = NextResponse.redirect(new URL('/maintainer', request.url))
    setToastCookieOnResponse(
      response,
      'error',
      'GitHub Appの設定処理中にエラーが発生しました',
      'github-installation'
    )
    return response
  }
}
