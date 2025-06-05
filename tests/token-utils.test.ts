/**
 * token-utils.tsのテスト
 */

import { describe, it, expect } from 'bun:test'
import {
  convertTokenCodeToXRPLFormat,
  convertXRPLFormatToTokenCode,
  validateTokenCode,
  isXRPLFormat,
  formatTokenCodeForDisplay,
} from '../src/lib/xrpl/token-utils'

describe('token-utils', () => {
  describe('convertTokenCodeToXRPLFormat', () => {
    it('3文字かつ0x21-0x7EかつXRPでない場合はそのまま返す', () => {
      expect(convertTokenCodeToXRPLFormat('USD')).toBe('USD')
      expect(convertTokenCodeToXRPLFormat('ABC')).toBe('ABC')
      expect(convertTokenCodeToXRPLFormat('123')).toBe('123')
    })

    it('XRPは16進数形式に変換する', () => {
      const result = convertTokenCodeToXRPLFormat('XRP')
      expect(result).toBe('5852500000000000000000000000000000000000')
      expect(result.length).toBe(40)
    })

    it('3文字未満は16進数形式に変換する', () => {
      const result = convertTokenCodeToXRPLFormat('AB')
      expect(result).toBe('4142000000000000000000000000000000000000')
      expect(result.length).toBe(40)
    })

    it('4文字以上のトークンコードは16進数形式に変換する', () => {
      const result = convertTokenCodeToXRPLFormat('TEST')
      expect(result).toBe('5445535400000000000000000000000000000000')
      expect(result.length).toBe(40)
    })

    it('3文字でも無効な文字が含まれる場合は16進数形式に変換する', () => {
      const result = convertTokenCodeToXRPLFormat('あいう') // ひらがなは範囲外
      expect(result.length).toBe(40)
      expect(result).toMatch(/^[0-9A-F]+$/)
    })

    it('日本語のトークンコードは16進数形式に変換する', () => {
      const result = convertTokenCodeToXRPLFormat('テスト')
      expect(result.length).toBe(40)
      expect(result).toMatch(/^[0-9A-F]+$/)
    })
  })

  describe('convertXRPLFormatToTokenCode', () => {
    it('3文字以下のcurrencyCodeはそのまま返す', () => {
      expect(convertXRPLFormatToTokenCode('USD')).toBe('USD')
      expect(convertXRPLFormatToTokenCode('JP')).toBe('JP')
    })

    it('40文字の16進数形式は元の文字列に戻す', () => {
      const xrplFormat = '5445535400000000000000000000000000000000'
      expect(convertXRPLFormatToTokenCode(xrplFormat)).toBe('TEST')
    })

    it('変換に失敗した場合は元の値を返す', () => {
      const invalidHex = 'INVALID_HEX_STRING_WITH_40_CHARACTERS_000'
      expect(convertXRPLFormatToTokenCode(invalidHex)).toBe(invalidHex)
    })
  })

  describe('validateTokenCode', () => {
    it('有効なトークンコードは通す', () => {
      const result = validateTokenCode('TEST')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('空文字列は無効', () => {
      const result = validateTokenCode('')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('トークンコードは必須です')
    })

    it('XRPは予約語として無効', () => {
      const result = validateTokenCode('XRP')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('XRPは予約語のため使用できません')
    })

    it('21文字以上は無効', () => {
      const result = validateTokenCode('A'.repeat(21))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('トークンコードは20文字以下である必要があります')
    })

    it('無効な文字を含む場合は無効', () => {
      const result = validateTokenCode('TEST@')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'トークンコードは英数字、アンダースコア、ハイフンのみ使用できます'
      )
    })
  })

  describe('isXRPLFormat', () => {
    it('3文字以下は標準形式として有効', () => {
      expect(isXRPLFormat('USD')).toBe(true)
      expect(isXRPLFormat('JP')).toBe(true)
    })

    it('40文字の16進数形式は有効', () => {
      const xrplFormat = '5445535400000000000000000000000000000000'
      expect(isXRPLFormat(xrplFormat)).toBe(true)
    })

    it('無効な形式は無効', () => {
      expect(isXRPLFormat('INVALID')).toBe(false)
      expect(isXRPLFormat('1234567890123456789012345678901234567890X')).toBe(false)
    })
  })

  describe('formatTokenCodeForDisplay', () => {
    it('XRPL形式の場合は元の文字列に戻す', () => {
      const xrplFormat = '5445535400000000000000000000000000000000'
      expect(formatTokenCodeForDisplay(xrplFormat)).toBe('TEST')
    })

    it('標準形式の場合はそのまま返す', () => {
      expect(formatTokenCodeForDisplay('USD')).toBe('USD')
    })
  })

  describe('往復変換テスト', () => {
    it('tokenCode -> XRPL形式 -> tokenCodeの往復変換が正しく動作する', () => {
      const originalTokens = ['TEST', 'MyToken', 'PROJECT_TOKEN', 'テスト']

      for (const original of originalTokens) {
        const xrplFormat = convertTokenCodeToXRPLFormat(original)
        const restored = convertXRPLFormatToTokenCode(xrplFormat)
        expect(restored).toBe(original)
      }
    })

    it('有効な3文字トークンは変換されない', () => {
      const validTokens = ['USD', 'ABC', '123']

      for (const token of validTokens) {
        const xrplFormat = convertTokenCodeToXRPLFormat(token)
        expect(xrplFormat).toBe(token)

        const restored = convertXRPLFormatToTokenCode(xrplFormat)
        expect(restored).toBe(token)
      }
    })

    it('無効な3文字未満や特殊文字を含むトークンは16進数形式に変換される', () => {
      const invalidTokens = ['AB', 'A', 'あいう']

      for (const token of invalidTokens) {
        const xrplFormat = convertTokenCodeToXRPLFormat(token)
        expect(xrplFormat.length).toBe(40)
        expect(xrplFormat).toMatch(/^[0-9A-F]+$/)

        const restored = convertXRPLFormatToTokenCode(xrplFormat)
        expect(restored).toBe(token)
      }
    })
  })
})
