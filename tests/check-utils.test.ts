/**
 * CheckID生成関数のテスト
 */

import { describe, test, expect } from 'bun:test'
import { generateCheckId, validateCheckId } from '@/lib/xrpl/check-utils'

describe('CheckID Utils', () => {
  describe('generateCheckId', () => {
    test('正しいCheckIDを生成する', () => {
      // テスト用のアカウントアドレスとシーケンス番号
      const account = 'rUn84CUYbNjRoTQ6mSW7BVJPSVJNLb1QLo'
      const sequence = 2

      const checkId = generateCheckId(account, sequence)

      // CheckIDは64文字の16進数文字列である必要がある
      expect(checkId).toHaveLength(64)
      expect(checkId).toMatch(/^[0-9A-F]+$/)
    })

    test('異なるアカウントで異なるCheckIDを生成する', () => {
      const account1 = 'rUn84CUYbNjRoTQ6mSW7BVJPSVJNLb1QLo'
      const account2 = 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy'
      const sequence = 2

      const checkId1 = generateCheckId(account1, sequence)
      const checkId2 = generateCheckId(account2, sequence)

      expect(checkId1).not.toBe(checkId2)
    })

    test('異なるシーケンス番号で異なるCheckIDを生成する', () => {
      const account = 'rUn84CUYbNjRoTQ6mSW7BVJPSVJNLb1QLo'
      const sequence1 = 2
      const sequence2 = 3

      const checkId1 = generateCheckId(account, sequence1)
      const checkId2 = generateCheckId(account, sequence2)

      expect(checkId1).not.toBe(checkId2)
    })

    test('無効なアカウントアドレスでエラーを投げる', () => {
      const invalidAccount = 'invalid-address'
      const sequence = 2

      expect(() => {
        generateCheckId(invalidAccount, sequence)
      }).toThrow()
    })
  })

  describe('validateCheckId', () => {
    test('有効なCheckIDを検証する', () => {
      const validCheckId = '49647F0D748DC3FE26BDACBC57F251AADEFFF391403EC9BF87C97F67E9977FB0'
      const result = validateCheckId(validCheckId)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('無効な長さのCheckIDを検証する', () => {
      const invalidCheckId = '49647F0D748DC3FE26BDACBC57F251AA'
      const result = validateCheckId(invalidCheckId)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('CheckIDは64文字である必要があります')
    })

    test('無効な文字を含むCheckIDを検証する', () => {
      const invalidCheckId = '49647F0D748DC3FE26BDACBC57F251AADEFFF391403EC9BF87C97F67E9977FBG'
      const result = validateCheckId(invalidCheckId)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('CheckIDは16進数文字列である必要があります')
    })

    test('空のCheckIDを検証する', () => {
      const result = validateCheckId('')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('CheckIDは必須です')
    })
  })
})
