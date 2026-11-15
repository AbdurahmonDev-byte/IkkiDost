export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ikki_dost_theme';

const THEME_COLORS: Record<Theme, string> = {
  light: '#fdf9f2',
  dark: '#0d0b09',
};

/** A manual choice made from the header toggle, if the user ever made one. */
export function getStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

/** Telegram's own light/dark setting, falling back to the system preference. */
export function detectTheme(): Theme {
  const app = window.Telegram?.WebApp;
  // Outside Telegram the SDK stub always reports `colorScheme: 'light'` and
  // `platform: 'unknown'`, so trust the system preference there instead.
  const insideTelegram = Boolean(app?.initData) || (Boolean(app?.platform) && app?.platform !== 'unknown');
  const scheme = app?.colorScheme;
  if (insideTelegram && (scheme === 'light' || scheme === 'dark')) return scheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? detectTheme();
}

/** Applies the theme to <html> and syncs Telegram's header/background colors. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);

  try {
    window.Telegram?.WebApp?.setHeaderColor?.(THEME_COLORS[theme]);
    window.Telegram?.WebApp?.setBackgroundColor?.(THEME_COLORS[theme]);
  } catch {
    // Older Telegram clients do not support these methods.
  }
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
  applyTheme(theme);
}
