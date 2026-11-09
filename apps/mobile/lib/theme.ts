/** Ikki Do'st shared visual tokens for the Expo app. */
export const colors = {
  primary: '#1d5c3f',
  primaryDark: '#174a34',
  primaryLight: '#eef7f2',
  primaryBorder: '#d7ecdf',
  accent: '#d99434',
  accentLight: '#fdf4e6',
  accentBorder: '#faeacc',
  ink: '#1c241f',
  inkSoft: '#5e6b62',
  inkFaint: '#8a958d',
  paper: '#f6f5f1',
  card: '#ffffff',
  line: '#e7e4dc',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  success: '#059669',
  successLight: '#ecfdf5',
  warning: '#b45309',
  warningLight: '#fffbeb',
  info: '#0284c7',
  infoLight: '#f0f9ff',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Cross-platform elevation. */
export const cardShadow = {
  shadowColor: '#101814',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;
