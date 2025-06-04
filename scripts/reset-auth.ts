#!/usr/bin/env bun

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'fs'

/**
 * Firebase Auth の全ユーザーを削除するスクリプト
 * development環境専用
 */

async function resetFirebaseAuth(): Promise<void> {
  try {
    console.log('🔥 Firebase Auth リセット開始...')

    // Firebase Admin SDK初期化
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })

    const auth = getAuth(app)

    // 全ユーザーを取得して削除
    let deletedCount = 0
    let nextPageToken: string | undefined

    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken)

      if (listUsersResult.users.length === 0) {
        break
      }

      // ユーザーのUIDを収集
      const uids = listUsersResult.users.map(user => user.uid)

      // 一括削除
      const deleteResult = await auth.deleteUsers(uids)

      deletedCount += deleteResult.successCount

      if (deleteResult.failureCount > 0) {
        console.warn(`⚠️  ${deleteResult.failureCount}件のユーザー削除に失敗しました`)
        deleteResult.errors.forEach(error => {
          console.error(`   - インデックス: ${error.index}, エラー: ${error.error.message}`)
        })
      }

      nextPageToken = listUsersResult.pageToken

      console.log(`📝 ${deletedCount}件のユーザーを削除しました...`)
    } while (nextPageToken)

    console.log(`✅ Firebase Auth リセット完了: ${deletedCount}件のユーザーを削除しました`)
  } catch (error) {
    console.error('❌ Firebase Auth リセットエラー:', (error as Error).message)
    process.exit(1)
  }
}

// スクリプト実行
resetFirebaseAuth()
