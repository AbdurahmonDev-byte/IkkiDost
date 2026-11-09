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
          300: '#7fbfa0',
          500: '#2e7f5b',
          600: '#1d5c3f',
          700: '#174a34',
          900: '#0d2d20',
        },
        accent: { DEFAULT: '#d99434', 100: '#faeacc', 500: '#d99434', 600: '#b87723' },
        ink: { DEFAULT: '#1c241f', soft: '#5e6b62' },
        paper: '#f7f5f0',
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 20, 0.04), 0 8px 24px -12px rgba(16, 24, 20, 0.18)',
      },
      keyframes: {
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        'slide-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'pulse-soft': 'pulse-soft 2s ease-in-out infinite', 'slide-in': 'slide-in 0.18s ease-out' },
    },
  },
  plugins: [],
};

export default config;
