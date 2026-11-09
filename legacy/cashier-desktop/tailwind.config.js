module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1d5c3f', 50: '#eef7f2', 100: '#d7ecdf', 500: '#2e7f5b', 600: '#1d5c3f', 700: '#174a34' },
        accent: { DEFAULT: '#d99434', 100: '#faeacc', 500: '#d99434', 600: '#b87723' },
        ink: { DEFAULT: '#1c241f', soft: '#5e6b62', faint: '#8a958d' },
        paper: '#f6f5f1',
        line: '#e7e4dc',
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,20,.04), 0 8px 24px -14px rgba(16,24,20,.18)' },
    },
  },
  plugins: [],
};
