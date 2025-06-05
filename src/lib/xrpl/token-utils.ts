/**
 * XRPLトークン関連のユーティリティ関数
 */

/**
 * tokenCodeをXRPL形式に変換
 * 3文字以下はそのまま、4文字以上は16進数形式に変換
 *
 * @param tokenCode - 変換するトークンコード
 * @returns XRPL形式のcurrencyCode
 */
export function convertTokenCodeToXRPLFormat(tokenCode: string): string {
  // 文字数 = 3 かつ 各文字のバイト値が 0x21–0x7E かつ XRP ではない場合はそのまま返す
  if (
    tokenCode.length === 3 &&
    isValidStandardCurrency(tokenCode) &&
    tokenCode.toUpperCase() !== 'XRP'
  ) {
    return tokenCode
  }

  return Buffer.from(tokenCode, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
}

/**
 * 標準通貨コード（3文字、各文字が0x21-0x7E）かどうかを判定
 */
function isValidStandardCurrency(tokenCode: string): boolean {
  if (tokenCode.length !== 3) {
    return false
  }

  for (let i = 0; i < tokenCode.length; i++) {
    const charCode = tokenCode.charCodeAt(i)
    if (charCode < 0x21 || charCode > 0x7e) {
      return false
    }
  }

  return true
}

/**
 * XRPL形式のcurrencyCodeを元のtokenCodeに逆変換
 *
 * @param currencyCode - XRPL形式のcurrencyCode
 * @returns 元のtokenCode
 */
export function convertXRPLFormatToTokenCode(currencyCode: string): string {
  // 3文字以下の場合はそのまま返す
  if (currencyCode.length <= 3) {
    return currencyCode
  }

  // 40文字の16進数形式の場合は元の文字列に戻す
  if (currencyCode.length === 40) {
    // 末尾の0を除去
    const trimmedHex = currencyCode.replace(/0+$/, '')

    // 16進数から文字列に変換
    try {
      return Buffer.from(trimmedHex, 'hex').toString('utf8')
    } catch (error) {
      // 変換に失敗した場合は元の値を返す
      return currencyCode
    }
  }

  // その他の場合はそのまま返す
  return currencyCode
}

/**
 * tokenCodeの妥当性検証
 *
 * @param tokenCode - 検証するトークンコード
 * @returns 検証結果
 */
export function validateTokenCode(tokenCode: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 必須チェック
  if (!tokenCode) {
    errors.push('トークンコードは必須です')
    return { valid: false, errors }
  }

  // 文字列型チェック
  if (typeof tokenCode !== 'string') {
    errors.push('トークンコードは文字列である必要があります')
    return { valid: false, errors }
  }

  // 長さチェック
  if (tokenCode.length === 0) {
    errors.push('トークンコードは空文字列にできません')
  } else if (tokenCode.length > 20) {
    errors.push('トークンコードは20文字以下である必要があります')
  }

  // 文字チェック（英数字とアンダースコア、ハイフンのみ許可）
  const validCharPattern = /^[A-Za-z0-9_-]+$/
  if (!validCharPattern.test(tokenCode)) {
    errors.push('トークンコードは英数字、アンダースコア、ハイフンのみ使用できます')
  }

  // XRPは予約語
  if (tokenCode.toUpperCase() === 'XRP') {
    errors.push('XRPは予約語のため使用できません')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * XRPL形式のcurrencyCodeかどうかを判定
 *
 * @param currencyCode - 判定するcurrencyCode
 * @returns XRPL形式かどうか
 */
export function isXRPLFormat(currencyCode: string): boolean {
  // 3文字以下は標準形式
  if (currencyCode.length <= 3) {
    return true
  }

  // 40文字の16進数形式
  if (currencyCode.length === 40) {
    const hexPattern = /^[0-9A-F]+$/
    return hexPattern.test(currencyCode)
  }

  return false
}

/**
 * トークンコードの表示用フォーマット
 * XRPL形式の場合は元の文字列に戻して表示
 *
 * @param currencyCode - フォーマットするcurrencyCode
 * @returns 表示用の文字列
 */
export function formatTokenCodeForDisplay(currencyCode: string): string {
  if (isXRPLFormat(currencyCode)) {
    return convertXRPLFormatToTokenCode(currencyCode)
  }
  return currencyCode
}
