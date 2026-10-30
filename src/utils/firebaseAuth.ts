import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
// Firebase configuration (embedded so external git/Vercel builds never fail on missing json)
const firebaseConfig = {
  projectId: 'gen-lang-client-0420908951',
  appId: '1:858171444036:web:1a0d7768626e1b4c88e511',
  apiKey: 'AIzaSyCwN44CwT55_j3EK5QXM-tMkkzDXcxskps',
  authDomain: 'gen-lang-client-0420908951.firebaseapp.com',
  storageBucket: 'gen-lang-client-0420908951.firebasestorage.app',
  messagingSenderId: '858171444036',
  measurementId: '',
  oAuthClientId: '858171444036-ka4qalqf8405v3bsdgep53mgtm8nis9f.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive app file scope and full drive scope (approved by user)
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Access token persistent storage
const TOKEN_KEY = 'gdrive_oauth_token_v3';
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export function setToken(token: string | null) {
  cachedAccessToken = token;
  if (token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {}
  } else {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
}

export function clearStoredToken() {
  setToken(null);
}

export function getStoredToken(): string | null {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  try {
    const raw = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (raw) {
      cachedAccessToken = raw;
      return cachedAccessToken;
    }
  } catch {}

  return null;
}

export function hasValidAccessToken(): boolean {
  return getStoredToken() !== null;
}

/**
 * Initialize auth state listener. Call this on app load.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const activeToken = getStoredToken();
      if (activeToken) {
        if (onAuthSuccess) onAuthSuccess(user, activeToken);
      } else if (!isSigningIn) {
        // User is logged in to Firebase but token expired or needs fresh auth for Drive
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      setToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google Popup and obtain access token.
 * Returns null if the user cancelled or closed the popup.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Drive.');
    }

    setToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    // If the user closed or cancelled the popup, handle gracefully without error logs
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      (typeof error?.message === 'string' && error.message.includes('popup-closed-by-user'))
    ) {
      return null;
    }
    if (error?.code === 'auth/popup-blocked' || (typeof error?.message === 'string' && error.message.includes('popup-blocked'))) {
      throw new Error('El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio o usa la descarga local .JSON.');
    }
    if (error?.code === 'auth/unauthorized-domain' || (typeof error?.message === 'string' && error.message.includes('unauthorized-domain'))) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      throw new Error(`Dominio (${hostname}) pendiente de autorización en Firebase Auth. Puedes salir con respaldo local .JSON sin problemas.`);
    }
    console.warn('Sign in info:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached access token or request sign in if missing
 */
export const getAccessToken = async (): Promise<string | null> => {
  return getStoredToken();
};

/**
 * Sign out and clear cached token
 */
export const logout = async (clearDriveToken = true): Promise<void> => {
  await auth.signOut();
  if (clearDriveToken) {
    setToken(null);
  }
};
