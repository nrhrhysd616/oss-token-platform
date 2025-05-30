import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import {
  writeTestData,
  readTestData,
  setupTestEnvironment,
  cleanupTestEnvironment,
} from '../src/lib/firebase/test-utils'

// テスト実行前にテスト環境をセットアップ
beforeAll(async () => {
  try {
    console.log('Setting up test environment...')
    await setupTestEnvironment()
    console.log('Test environment setup completed')
  } catch (error) {
    console.error('Error in test setup:', error)
  }
})

// テスト終了後にテスト環境をクリーンアップ
afterAll(async () => {
  await cleanupTestEnvironment()
})

describe('Firestore Emulator Tests', () => {
  test('should write and read data from Firestore', async () => {
    // テスト用データ
    const testData = {
      name: 'Test Project',
      description: 'This is a test project for OSS Token Platform',
      testField: 'test-value',
    }

    // データを書き込む
    const docId = await writeTestData(testData)
    expect(docId).toBeTruthy()

    // データを読み取る
    const results = await readTestData('testField', 'test-value')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toBe('Test Project')
    expect(results[0].description).toBe('This is a test project for OSS Token Platform')
  })
})
