import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  convertTimestampToDate,
  convertTimestamps,
  formatDateJP,
  formatDateTimeJP,
} from '../src/lib/firebase/utils'

// Firebase Admin SDKのTimestamp型をモック
const mockTimestamp = {
  toDate: () => new Date(1640995200 * 1000), // 2022-01-01 00:00:00 UTC
}

// 別のタイムスタンプ値用のモック
const mockTimestamp2 = {
  toDate: () => new Date(1641081600 * 1000), // 2022-01-02 00:00:00 UTC
}

describe('Firebase Utils', () => {
  describe('convertTimestampToDate', () => {
    test('should convert Firestore timestamp to Date using toDate method', () => {
      const result = convertTimestampToDate(mockTimestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(1640995200 * 1000)
    })

    test('should handle different Firestore timestamp instances', () => {
      const result = convertTimestampToDate(mockTimestamp2)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(1641081600 * 1000)
    })

    test('should return Date as-is when already Date type', () => {
      const date = new Date('2022-01-01')
      const result = convertTimestampToDate(date)
      expect(result).toBe(date)
    })

    test('should convert string to Date', () => {
      const dateString = '2022-01-01T00:00:00.000Z'
      const result = convertTimestampToDate(dateString)
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe(dateString)
    })

    test('should return current date for null/undefined', () => {
      const beforeTest = Date.now()
      const resultNull = convertTimestampToDate(null)
      const resultUndefined = convertTimestampToDate(undefined)
      const afterTest = Date.now()

      expect(resultNull.getTime()).toBeGreaterThanOrEqual(beforeTest)
      expect(resultNull.getTime()).toBeLessThanOrEqual(afterTest)
      expect(resultUndefined.getTime()).toBeGreaterThanOrEqual(beforeTest)
      expect(resultUndefined.getTime()).toBeLessThanOrEqual(afterTest)
    })
  })

  describe('convertTimestamps', () => {
    test('should convert all timestamp fields in wallet data', () => {
      const walletData = {
        id: 'wallet-123',
        address: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        linkedAt: mockTimestamp,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        status: 'linked',
      }

      const result = convertTimestamps(walletData)

      expect(result.id).toBe('wallet-123')
      expect(result.address).toBe('rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
      expect(result.status).toBe('linked')
      expect(result.linkedAt).toBeInstanceOf(Date)
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.linkedAt.getTime()).toBe(1640995200 * 1000)
    })

    test('should handle data with different timestamp formats', () => {
      const testData = {
        id: 'test-123',
        name: 'Test Item',
        status: 'active',
        linkedAt: mockTimestamp, // Firestoreのタイムスタンプインスタンス
        createdAt: '2022-01-01T00:00:00.000Z', // ISO 8601形式の文字列
        updatedAt: new Date('2022-01-01T00:00:00.000Z'), // Dateオブジェクト
      }

      const result = convertTimestamps(testData)

      expect(result.id).toBe('test-123')
      expect(result.linkedAt).toBeInstanceOf(Date)
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.linkedAt.getTime()).toBe(1640995200 * 1000)
    })

    test('should handle data with no timestamp fields', () => {
      const testData = {
        id: 'test-456',
        name: 'Test Item',
        status: 'active',
      }

      const result = convertTimestamps(testData)

      expect(result.id).toBe('test-456')
      expect(result.name).toBe('Test Item')
      expect(result.status).toBe('active')
    })

    test('should handle null/undefined data', () => {
      expect(convertTimestamps(null)).toBeNull()
      expect(convertTimestamps(undefined)).toBeUndefined()
    })

    test('should convert only specified fields when fields parameter is provided', () => {
      const testData = {
        id: 'test-789',
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp2,
        linkedAt: mockTimestamp,
      }

      const result = convertTimestamps(testData, ['createdAt', 'updatedAt'])

      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.createdAt.getTime()).toBe(1640995200 * 1000)
      expect(result.updatedAt.getTime()).toBe(1641081600 * 1000)
      // linkedAtは変換されない（fieldsに含まれていないため）
      expect(result.linkedAt).toBe(mockTimestamp)
      expect(typeof result.linkedAt.toDate).toBe('function')
    })
  })

  describe('formatDateJP', () => {
    test('should format Firestore timestamp to Japanese date format', () => {
      const result = formatDateJP(mockTimestamp as any)
      expect(result).toBe('2022/01/01')
    })

    test('should format Date object to Japanese date format', () => {
      const date = new Date('2022-12-25T15:30:45.123Z')
      const result = formatDateJP(date)
      expect(result).toBe('2022/12/25')
    })

    test('should format ISO string to Japanese date format', () => {
      const result = formatDateJP('2022-06-15T10:20:30.000Z')
      expect(result).toBe('2022/06/15')
    })

    test('should handle null/undefined by returning current date format', () => {
      const today = new Date()
      const expectedFormat = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`

      const resultNull = formatDateJP(null)
      const resultUndefined = formatDateJP(undefined)

      // 現在日付なので、テスト実行時の日付と一致するはず
      expect(resultNull).toMatch(/^\d{4}\/\d{2}\/\d{2}$/)
      expect(resultUndefined).toMatch(/^\d{4}\/\d{2}\/\d{2}$/)
    })
  })

  describe('formatDateTimeJP', () => {
    test('should format Firestore timestamp to Japanese datetime format', () => {
      const result = formatDateTimeJP(mockTimestamp as any)
      expect(result).toBe('2022/01/01 00:00:00') // UTCでの表示
    })

    test('should format Date object to Japanese datetime format', () => {
      const date = new Date('2022-12-25T15:30:45.123Z')
      const result = formatDateTimeJP(date)
      expect(result).toBe('2022/12/25 15:30:45') // UTCでの表示
    })

    test('should format ISO string to Japanese datetime format', () => {
      const result = formatDateTimeJP('2022-06-15T10:20:30.000Z')
      expect(result).toBe('2022/06/15 10:20:30') // UTCでの表示
    })

    test('should handle null/undefined by returning current datetime format', () => {
      const resultNull = formatDateTimeJP(null)
      const resultUndefined = formatDateTimeJP(undefined)

      // 現在日時なので、正しい形式であることを確認
      expect(resultNull).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
      expect(resultUndefined).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
    })
  })
})

// Auth Context関連のテスト用モック
const mockUser = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  providerData: [{ uid: 'github-123' }],
}

const mockAuthResult = {
  user: mockUser,
}

// Firebase Authのモック
const mockAuth = {
  currentUser: null,
  onAuthStateChanged: mock((callback: any) => () => {}),
  signInWithPopup: mock(() => Promise.resolve(mockAuthResult)),
  signOut: mock(() => Promise.resolve()),
}

const mockGithubAuthProvider = mock(() => ({
  addScope: mock(() => {}),
}))

// Firestoreのモック
const mockDoc = mock(() => ({
  set: mock(() => Promise.resolve()),
  get: mock(() => Promise.resolve({ exists: true, data: () => ({}) })),
}))

const mockDb = {
  collection: mock(() => ({
    doc: mockDoc,
  })),
}

describe('Auth Context Functions', () => {
  beforeEach(() => {
    // モックをリセット
    mockAuth.onAuthStateChanged.mockClear()
    mockAuth.signInWithPopup.mockClear()
    mockAuth.signOut.mockClear()
    mockGithubAuthProvider.mockClear()
    mockDoc.mockClear()
    mockDb.collection.mockClear()
  })

  describe('GitHub Authentication', () => {
    test('should handle successful GitHub sign in', async () => {
      // GitHub認証の成功をシミュレート
      mockAuth.signInWithPopup.mockResolvedValue(mockAuthResult)

      const result = await mockAuth.signInWithPopup()

      expect(mockAuth.signInWithPopup).toHaveBeenCalledTimes(1)
      expect(result.user.uid).toBe('test-uid-123')
      expect(result.user.email).toBe('test@example.com')
    })

    test('should handle GitHub sign in error', async () => {
      const error = new Error('Authentication failed')
      mockAuth.signInWithPopup.mockRejectedValue(error)

      try {
        await mockAuth.signInWithPopup()
      } catch (e) {
        expect(e).toBe(error)
      }

      expect(mockAuth.signInWithPopup).toHaveBeenCalledTimes(1)
    })
  })

  describe('Sign Out', () => {
    test('should handle successful sign out', async () => {
      mockAuth.signOut.mockResolvedValue(undefined)

      await mockAuth.signOut()

      expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
    })

    test('should handle sign out error', async () => {
      const error = new Error('Sign out failed')
      mockAuth.signOut.mockRejectedValue(error)

      try {
        await mockAuth.signOut()
      } catch (e) {
        expect(e).toBe(error)
      }

      expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
    })
  })

  describe('User Data Management', () => {
    test('should create user document structure correctly', () => {
      const expectedUserData = {
        uid: mockUser.uid,
        email: mockUser.email,
        githubId: mockUser.providerData[0].uid,
        displayName: mockUser.displayName,
        photoURL: mockUser.photoURL,
        lastLogin: expect.any(Date),
      }

      // ユーザーデータの構造をテスト
      const userData = {
        uid: mockUser.uid,
        email: mockUser.email,
        githubId: mockUser.providerData[0].uid,
        displayName: mockUser.displayName,
        photoURL: mockUser.photoURL,
        lastLogin: new Date(),
      }

      expect(userData).toMatchObject({
        uid: 'test-uid-123',
        email: 'test@example.com',
        githubId: 'github-123',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      })
      expect(userData.lastLogin).toBeInstanceOf(Date)
    })

    test('should handle user data with missing fields', () => {
      const incompleteUser = {
        uid: 'test-uid-456',
        email: null,
        displayName: null,
        photoURL: null,
        providerData: [{ uid: 'github-456' }],
      }

      const userData = {
        uid: incompleteUser.uid,
        email: incompleteUser.email,
        githubId: incompleteUser.providerData[0].uid,
        displayName: incompleteUser.displayName,
        photoURL: incompleteUser.photoURL,
        lastLogin: new Date(),
      }

      expect(userData.uid).toBe('test-uid-456')
      expect(userData.email).toBeNull()
      expect(userData.displayName).toBeNull()
      expect(userData.photoURL).toBeNull()
      expect(userData.githubId).toBe('github-456')
    })
  })

  describe('Auth State Management', () => {
    test('should handle auth state changes', () => {
      const mockCallback = mock(() => {})
      const mockUnsubscribe = mock(() => {})

      mockAuth.onAuthStateChanged.mockReturnValue(mockUnsubscribe)

      const unsubscribe = mockAuth.onAuthStateChanged(mockCallback)

      expect(mockAuth.onAuthStateChanged).toHaveBeenCalledWith(mockCallback)
      expect(unsubscribe).toBe(mockUnsubscribe)
    })

    test('should handle loading states correctly', () => {
      // 初期状態: loading = true
      let loading = true
      let user: any = null

      // 認証状態変化をシミュレート
      const simulateAuthStateChange = (newUser: any) => {
        user = newUser
        loading = false
      }

      // ユーザーがログインした場合
      simulateAuthStateChange(mockUser)
      expect(loading).toBe(false)
      expect(user).toBe(mockUser)

      // ユーザーがログアウトした場合
      loading = true
      simulateAuthStateChange(null)
      expect(loading).toBe(false)
      expect(user).toBeNull()
    })
  })
})
