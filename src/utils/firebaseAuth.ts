import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

// Configuración de Firebase integrada directamente
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
// Permisos para Google Drive
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Almacenamiento seguro del token de acceso
const TOKEN_KEY = 'gdrive_oauth_token_v1';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutos
let cachedAccessToken: { token: string; timestamp: number } | null = null;
let isSigningIn = false;

export function setToken(token: string | null) {
  if (token) {
    cachedAccessToken = { token, timestamp: Date.now() };
    try {
      const payload = JSON.stringify(cachedAccessToken);
      sessionStorage.setItem(TOKEN_KEY, payload);
      localStorage.setItem(TOKEN_KEY, payload);
    } catch {}
  } else {
    cachedAccessToken = null;
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
}

export function clearStoredToken() {
  setToken(null);
}

export function getStoredToken(): string | null {
  if (cachedAccessToken) {
    if (Date.now() - cachedAccessToken.timestamp < TOKEN_TTL_MS) {
      return cachedAccessToken.token;
    }
    cachedAccessToken = null;
  }

  try {
    const raw = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && typeof parsed.timestamp === 'number') {
        if (Date.now() - parsed.timestamp < TOKEN_TTL_MS) {
          cachedAccessToken = { token: parsed.token, timestamp: parsed.timestamp };
          return cachedAccessToken.token;
        }
      }
    }
  } catch {}

  clearStoredToken();
  return null;
}

export function hasValidAccessToken(): boolean {
  return getStoredToken() !== null;
}

/**
 * Listener de sesión
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
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      setToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Inicio de sesión con Google Drive Popup
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
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      (typeof error?.message === 'string' && error.message.includes('popup-closed-by-user'))
    ) {
      return null;
    }
    console.warn('Sign in info:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredToken();
};

export const logout = async (): Promise<void> => {
  await auth.signOut();
  setToken(null);
};
