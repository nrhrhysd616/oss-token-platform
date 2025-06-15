/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // アクセント色のクラス
    'text-red-500',
    'text-yellow-500',
    'bg-red-500',
    'bg-yellow-500',
    'border-red-500',
    'border-yellow-500',
    'hover:bg-red-600',
    'hover:bg-yellow-600',
    'hover:text-red-600',
    'hover:text-yellow-600',
    'focus:border-red-500',
    'focus:border-yellow-500',
    'focus:ring-red-500',
    'focus:ring-yellow-500',
    // 透明度付きクラス
    'bg-red-500/20',
    'bg-yellow-500/20',
    'border-red-500/20',
    'border-yellow-500/20',
    'hover:border-red-500/50',
    'hover:border-yellow-500/50',
    'hover:shadow-red-500/10',
    'hover:shadow-yellow-500/10',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          red: '#ef4444',
          'red-hover': '#dc2626',
          yellow: '#eab308',
          'yellow-hover': '#ca8a04',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
