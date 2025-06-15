/**
 * テーマに基づいてアクセント色のクラス名を取得するユーティリティ関数
 */
export const getAccentClasses = (theme: 'red' | 'yellow') => ({
  // テキスト色
  text: theme === 'red' ? 'text-red-500' : 'text-yellow-500',
  textHover: theme === 'red' ? 'hover:text-red-600' : 'hover:text-yellow-600',

  // 背景色
  bg: theme === 'red' ? 'bg-red-500' : 'bg-yellow-500',
  bgHover: theme === 'red' ? 'hover:bg-red-600' : 'hover:bg-yellow-600',

  // ボーダー色
  border: theme === 'red' ? 'border-red-500' : 'border-yellow-500',
  borderHover: theme === 'red' ? 'hover:border-red-600' : 'hover:border-yellow-600',

  // フォーカス状態
  focus:
    theme === 'red'
      ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500'
      : 'focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500',

  // 背景色（透明度付き）
  bgOpacity: theme === 'red' ? 'bg-red-500/20' : 'bg-yellow-500/20',
  borderOpacity: theme === 'red' ? 'border-red-500/20' : 'border-yellow-500/20',
})

/**
 * テーマに基づいて組み合わせクラスを取得する関数
 */
export const getThemeButtonClasses = (theme: 'red' | 'yellow') => {
  const { bg, bgHover } = getAccentClasses(theme)
  return `${bg} ${bgHover} text-black font-medium transition-colors`
}

export const getThemeLinkClasses = (theme: 'red' | 'yellow') => {
  const { text, textHover } = getAccentClasses(theme)
  return `${text} ${textHover} transition-colors`
}

export const getThemeInputClasses = (theme: 'red' | 'yellow') => {
  const { focus } = getAccentClasses(theme)
  return `bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none ${focus}`
}
