/**
 * The Mini App is dark-only. We still sync Telegram's header and background
 * colors so the surrounding client chrome matches our dark surfaces.
 */
const DARK_BACKGROUND = '#0d0b09';
const DARK_HEADER = '#12100e';

export function applyTheme() {
  const root = document.documentElement;
  root.classList.add('dark');
  root.style.colorScheme = 'dark';

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', DARK_BACKGROUND);

  try {
    window.Telegram?.WebApp?.setHeaderColor?.(DARK_HEADER);
    window.Telegram?.WebApp?.setBackgroundColor?.(DARK_BACKGROUND);
  } catch {
    // Older Telegram clients do not support these methods.
  }
}
