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
// Request Google Drive scopes
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Access token cache with session backup
const TOKEN_KEY = 'gdrive_oauth_token_v1';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes
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
    // Expired
    cachedAccessToken = null;
  }

  try {
    const raw = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.timestamp && Date.now() - parsed.timestamp < TOKEN_TTL_MS) {
        cachedAccessToken = parsed;
        return parsed.token;
      }
    }
  } catch {}

  return null;
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken?: string }> {
  if (isSigningIn) {
    throw new Error('A sign-in request is already in progress.');
  }

  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (token) {
      setToken(token);
    }

    return {
      user: result.user,
      accessToken: token,
    };
  } finally {
    isSigningIn = false;
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signOutUser() {
  clearStoredToken();
  await auth.signOut();
}
