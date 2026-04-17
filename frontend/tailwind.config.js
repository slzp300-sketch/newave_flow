/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          500: '#4F6AF5',
          600: '#3D5AFE',
          700: '#2C46E8',
          900: '#1A2E9E',
        },
        accent: {
          400: '#FFB74D',
          500: '#FF9800',
        },
        success: '#00BFA5',
        danger:  '#F44336',
        surface: '#F5F7FA',
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      boxShadow: {
        'premium': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 20px rgba(79, 70, 229, 0.15)',
      },
    },
  },
  plugins: [],
}
