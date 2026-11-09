/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf8f2',
          100: '#f5eee0',
          200: '#ebd9bf',
          300: '#ddbd94',
          400: '#ce9d67',
          500: '#b87d40',
          600: '#a36634',
          700: '#844e2b',
          800: '#6c3f27',
          900: '#583422',
        },
      },
    },
  },
  plugins: [],
};
