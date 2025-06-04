#!/usr/bin/env bun

import { execSync } from 'child_process'
import { createInterface } from 'readline'

/**
 * 確認プロンプト付きでFirebaseデータをリセットするスクリプト
 */

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, resolve)
  })
}

async function confirmReset(): Promise<void> {
  try {
    console.log('🔥 Firebase Development環境 データリセット')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('⚠️  以下のデータが完全に削除されます:')
    console.log('   • Firestore: 全てのコレクション・ドキュメント')
    console.log('   • Firebase Auth: 全てのユーザーアカウント')
    console.log('')
    console.log('📋 対象環境: oss-token-platform-development')
    console.log('')

    // 現在のFirebaseプロジェクトを確認
    try {
      const currentProject = execSync('bun firebase use', { encoding: 'utf8' }).trim()
      console.log(`🎯 現在のプロジェクト: ${currentProject}`)
    } catch (error) {
      console.warn('⚠️  Firebaseプロジェクトの確認に失敗しました')
    }

    console.log('')
    console.log('❌ この操作は取り消せません!')
    console.log('')

    // 確認プロンプト1
    const confirm1 = await question('本当にdevelopment環境をリセットしますか？ (yes/no): ')
    if (confirm1.toLowerCase() !== 'yes') {
      console.log('🚫 リセットをキャンセルしました')
      rl.close()
      return
    }

    // 確認プロンプト2
    const confirm2 = await question('最終確認: "RESET" と入力してください: ')
    if (confirm2 !== 'RESET') {
      console.log('🚫 リセットをキャンセルしました')
      rl.close()
      return
    }

    rl.close()

    console.log('')
    console.log('🚀 リセット開始...')
    console.log('')

    // Firestoreリセット
    console.log('1️⃣ Firestoreデータを削除中...')
    try {
      execSync('bun run db:reset:dev', { stdio: 'inherit' })
      console.log('✅ Firestoreリセット完了')
    } catch (error) {
      console.error('❌ Firestoreリセットエラー:', (error as Error).message)
      process.exit(1)
    }

    console.log('')

    // Firebase Authリセット
    console.log('2️⃣ Firebase Authユーザーを削除中...')
    try {
      execSync('bun run auth:reset:dev', { stdio: 'inherit' })
      console.log('✅ Firebase Authリセット完了')
    } catch (error) {
      console.error('❌ Firebase Authリセットエラー:', (error as Error).message)
      process.exit(1)
    }

    console.log('')
    console.log('🎉 全てのリセットが完了しました!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('❌ リセット処理エラー:', (error as Error).message)
    rl.close()
    process.exit(1)
  }
}

// スクリプト実行
confirmReset()
