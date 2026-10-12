import { primary, secondary, neutral } from './brand-theme.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary,
        secondary,
        gray: neutral,
        accent: secondary,
        success: secondary[700],
        danger:  '#AD4C48',
        surface: neutral[50],
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      boxShadow: {
        'premium': '0 4px 18px rgba(6, 49, 144, 0.05)',
        'glow': 'none',
      },
    },
  },
  plugins: [],
}
