import { describe, test, expect } from 'bun:test'

// UserServiceクラスのインポート
// 注: 実際のプロジェクトでは適切なパスからインポートする
import { UserService } from '../index'

describe('UserService', () => {
  test('should add a user correctly', () => {
    // UserServiceのインスタンスを作成
    const userService = new UserService()

    // テスト用のユーザーデータ
    const testUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      isActive: true,
    }

    // ユーザーを追加
    userService.addUser(testUser)

    // 追加したユーザーを取得
    const users = userService.getAllUsers()

    // 検証
    expect(users.length).toBe(1)
    expect(users[0]).toEqual(testUser)
  })

  test('should get user by id', () => {
    const userService = new UserService()

    // テスト用のユーザーデータ
    const testUser = {
      id: 2,
      name: 'Another User',
      email: 'another@example.com',
      isActive: false,
    }

    // ユーザーを追加
    userService.addUser(testUser)

    // IDでユーザーを取得
    const user = userService.getUserById(2)

    // 検証
    expect(user).toEqual(testUser)
  })

  test('should return undefined for non-existent user id', () => {
    const userService = new UserService()

    // 存在しないIDでユーザーを取得
    const user = userService.getUserById(999)

    // 検証
    expect(user).toBeUndefined()
  })
})
