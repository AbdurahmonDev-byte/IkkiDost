/**
 * Design tokens for the Ikki Do'st ecosystem.
 * Premium, warm, teahouse-inspired palette: deep green primary, warm amber accent,
 * paper-like neutrals. Consumed by Tailwind configs and React Native styles.
 */
export const tokens = {
  colors: {
    primary: {
      DEFAULT: '#1d5c3f',
      50: '#eef7f2',
      100: '#d7ecdf',
      200: '#b0d9c3',
      300: '#7fbfa0',
      400: '#4b9c77',
      500: '#2e7f5b',
      600: '#1d5c3f',
      700: '#174a34',
      800: '#123b2a',
      900: '#0d2d20',
    },
    accent: {
      DEFAULT: '#d99434',
      50: '#fdf6ea',
      100: '#faeacc',
      200: '#f4d28e',
      300: '#ecb85c',
      400: '#e3a34a',
      500: '#d99434',
      600: '#b87723',
      700: '#945c1e',
      800: '#78491e',
      900: '#653d1d',
    },
    neutral: {
      0: '#ffffff',
      50: '#faf9f7',
      100: '#f4f2ee',
      200: '#e8e4dc',
      300: '#d5cfc5',
      400: '#b4ab9f',
      500: '#93897c',
      600: '#756d63',
      700: '#5e574f',
      800: '#4c463f',
      900: '#2b2620',
    },
    success: '#2e9e63',
    warning: '#e0a32e',
    danger: '#d4453a',
    info: '#3a7bd4',
  },
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },
  spacing: (n: number) => n * 4,
  font: {
    sans: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  },
} as const;

/** Tailwind preset fragment (spread into theme.extend). */
export const tailwindTheme = {
  colors: {
    primary: tokens.colors.primary,
    accent: tokens.colors.accent,
    success: tokens.colors.success,
    warning: tokens.colors.warning,
    danger: tokens.colors.danger,
    info: tokens.colors.info,
  },
  borderRadius: {
    sm: `${tokens.radius.sm}px`,
    md: `${tokens.radius.md}px`,
    lg: `${tokens.radius.lg}px`,
    xl: `${tokens.radius.xl}px`,
  },
  fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'] },
} as const;

export type Tokens = typeof tokens;
