/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EAF5F9',
          100: '#D7EDF5',
          200: '#AFE0EF',
          300: '#7CCFEA',
          400: '#54C4EE',
          500: '#0085B5',
          600: '#007FAE',
          700: '#006B94',
          800: '#15516A',
          900: '#10364B',
        },
        gray: { 50: '#F5F8FA', 100: '#EEF3F6', 200: '#E4EBEF', 300: '#A9B9C3', 400: '#718491', 500: '#607381', 600: '#4D6473', 700: '#334F60', 800: '#203D4E', 900: '#122F40' },
        accent: {
          400: '#FFB74D',
          500: '#FF9800',
        },
        success: '#26775D',
        danger:  '#AD4C48',
        surface: '#F5F8FA',
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      boxShadow: {
        'premium': '0 2px 8px rgba(16, 54, 75, 0.03)',
        'glow': 'none',
      },
    },
  },
  plugins: [],
}
