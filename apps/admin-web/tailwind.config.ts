import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1d5c3f',
          50: '#eef7f2',
          100: '#d7ecdf',
          200: '#b4dcc5',
          300: '#7fbfa0',
          500: '#2e7f5b',
          600: '#1d5c3f',
          700: '#174a34',
          800: '#123a29',
          900: '#0d2d20',
        },
        accent: { DEFAULT: '#d99434', 50: '#fdf4e6', 100: '#faeacc', 500: '#d99434', 600: '#b87723' },
        ink: { DEFAULT: '#1c241f', soft: '#5e6b62', faint: '#8a958d' },
        paper: '#f6f5f1',
        line: '#e7e4dc',
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 20, 0.04), 0 8px 24px -14px rgba(16, 24, 20, 0.18)',
      },
      keyframes: {
        'slide-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'slide-in': 'slide-in 0.18s ease-out' },
    },
  },
  plugins: [],
};

export default config;
