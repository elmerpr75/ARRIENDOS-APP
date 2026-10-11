export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'arriendos_theme_mode_v1';

/**
 * Retrieves the user's saved theme mode preference ('light' | 'dark' | 'system').
 * Defaults to 'system' (device preference).
 */
export function getSavedThemeMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return 'system';
}

/**
 * Returns whether the device OS currently prefers dark mode.
 */
export function isSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves whether dark mode should be applied for the given ThemeMode.
 */
export function resolveThemeIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return isSystemDark();
}

/**
 * Applies the selected theme mode to the document and persists the preference.
 * Adds/removes the 'dark' class on <html>, updates data-theme attribute,
 * updates the <meta name="theme-color"> tag, and saves to localStorage.
 */
export function applyThemeMode(mode: ThemeMode): boolean {
  const isDark = resolveThemeIsDark(mode);

  if (typeof document !== 'undefined') {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Sync mobile browser status bar color (Android / iOS)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
    }
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  } catch (e) {
    console.error(e);
  }

  return isDark;
}

/**
 * Subscribes to OS / device theme changes when the user has selected 'system'.
 * Returns an unsubscription function.
 */
export function subscribeToSystemThemeChanges(callback?: (isDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent) => {
    const currentMode = getSavedThemeMode();
    if (currentMode === 'system') {
      const isDark = e.matches;
      if (typeof document !== 'undefined') {
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.setAttribute('data-theme', 'light');
        }
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
        }
      }
      if (callback) callback(isDark);
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  } else if ('addListener' in mediaQuery) {
    (mediaQuery as unknown as { addListener: (cb: typeof listener) => void; removeListener: (cb: typeof listener) => void }).addListener(listener);
    return () => (mediaQuery as unknown as { addListener: (cb: typeof listener) => void; removeListener: (cb: typeof listener) => void }).removeListener(listener);
  }

  return () => {};
}
