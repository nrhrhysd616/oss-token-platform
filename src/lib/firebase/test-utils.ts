// Firestoreテスト用ユーティリティ
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext,
} from '@firebase/rules-unit-testing'
import { collection, addDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore'
import { firebaseConfig } from './config'

// テスト用のコレクション名
const TEST_COLLECTION = 'test_collection'

// テスト環境の参照
let testEnv: RulesTestEnvironment
let testContext: RulesTestContext

/**
 * テスト環境をセットアップする関数
 * テスト実行前に呼び出す
 */
export const setupTestEnvironment = async () => {
  try {
    // テスト環境を初期化
    testEnv = await initializeTestEnvironment({
      projectId: firebaseConfig.projectId,
      firestore: {
        host: 'localhost',
        port: 8080,
      },
    })

    // テスト用の認証コンテキストを作成（認証済みユーザーとして）
    // 'test-user'はテスト用のユーザーID
    testContext = testEnv.authenticatedContext('test-user')

    console.log('Test environment setup completed')
    return testEnv
  } catch (error) {
    console.error('Error setting up test environment:', error)
    throw error
  }
}

/**
 * テスト環境をクリーンアップする関数
 * テスト終了後に呼び出す
 */
export const cleanupTestEnvironment = async () => {
  try {
    // テストデータをクリーンアップ
    await cleanupTestData()

    // テスト環境をクリーンアップ
    await testEnv?.cleanup()
    console.log('Test environment cleaned up')
  } catch (error) {
    console.error('Error cleaning up test environment:', error)
  }
}

/**
 * テストデータをFirestoreに書き込む関数
 * @param data 書き込むデータオブジェクト
 * @returns 作成されたドキュメントのID
 */
export const writeTestData = async (data: any) => {
  try {
    // 認証済みコンテキストを使用してFirestoreにアクセス
    const firestore = testContext.firestore()

    const docRef = await addDoc(collection(firestore, TEST_COLLECTION), {
      ...data,
      timestamp: new Date(),
    })
    console.log('Document written with ID:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('Error adding document:', error)
    throw error
  }
}

/**
 * Firestoreからテストデータを読み取る関数
 * @param field 検索するフィールド名
 * @param value 検索する値
 * @returns 検索結果の配列
 */
export const readTestData = async (field: string, value: any) => {
  try {
    // 認証済みコンテキストを使用してFirestoreにアクセス
    const firestore = testContext.firestore()

    const q = query(collection(firestore, TEST_COLLECTION), where(field, '==', value))
    const querySnapshot = await getDocs(q)
    const results: any[] = []
    querySnapshot.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() })
    })
    return results
  } catch (error) {
    console.error('Error getting documents:', error)
    throw error
  }
}

/**
 * テストデータをクリーンアップする関数
 * テスト終了後に呼び出して、テストデータを削除する
 */
export const cleanupTestData = async () => {
  try {
    if (!testContext) return

    const firestore = testContext.firestore()
    const querySnapshot = await getDocs(collection(firestore, TEST_COLLECTION))
    const deletePromises: Promise<void>[] = []
    querySnapshot.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref))
    })
    await Promise.all(deletePromises)
    console.log('Test data cleaned up')
  } catch (error) {
    console.error('Error cleaning up test data:', error)
    throw error
  }
}
