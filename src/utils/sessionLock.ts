export const STORAGE_KEY_SESSION_LOCKED = 'gestor_arrendamientos_session_locked_v1';

/**
 * Checks whether the application session is currently locked
 */
export function isAppSessionLocked(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return (
        localStorage.getItem(STORAGE_KEY_SESSION_LOCKED) === 'true' ||
        sessionStorage.getItem(STORAGE_KEY_SESSION_LOCKED) === 'true'
      );
    }
  } catch (e) {
    console.error('Error reading session lock:', e);
  }
  return false;
}

/**
 * Locks the app session to protect data on shared devices
 */
export function lockAppSession(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SESSION_LOCKED, 'true');
      sessionStorage.setItem(STORAGE_KEY_SESSION_LOCKED, 'true');
    }
  } catch (e) {
    console.error('Error locking session:', e);
  }
}

/**
 * Unlocks the app session upon successful authentication
 */
export function unlockAppSession(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
      sessionStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
    }
  } catch (e) {
    console.error('Error unlocking session:', e);
  }
}

/**
 * Normalizes email for case-insensitive and whitespace-free comparison
 */
export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Verifies if an entered email matches any authorized profile, admin, or Google email
 */
export function validateUserAccessEmail(
  enteredEmail: string,
  authorizedEmails: (string | null | undefined)[]
): boolean {
  const norm = normalizeEmail(enteredEmail);
  if (!norm || !norm.includes('@')) return false;

  return authorizedEmails.some((authEmail) => {
    return normalizeEmail(authEmail) === norm;
  });
}
