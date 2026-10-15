import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Building2,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Upload,
  UserPlus,
  Loader2,
  Crown,
  Clock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { googleSignIn } from '../utils/firebaseAuth';
import { validateUserAccessEmail } from '../utils/sessionLock';
import { importAppData } from '../utils/storage';
import { LandlordProfile, Administrator } from '../types';
import { SupportedLanguage } from '../utils/i18n';
import { isLifetimeVip } from '../utils/subscription';

interface SessionLockScreenProps {
  profile: LandlordProfile;
  administrators: Administrator[];
  currentLang?: SupportedLanguage;
  onUnlockSuccess: (authenticatedEmail?: string) => void;
  onResetForNewUser?: () => void;
  onDataRestored?: () => void;
}

export const SessionLockScreen: React.FC<SessionLockScreenProps> = ({
  profile,
  administrators,
  currentLang = 'es',
  onUnlockSuccess,
  onResetForNewUser,
  onDataRestored,
}) => {
  const isEn = currentLang === 'en';

  const [enteredEmail, setEnteredEmail] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isAuthenticatingGoogle, setIsAuthenticatingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showNewUserConfirm, setShowNewUserConfirm] = useState(false);

  // Collect all recognized authorized emails for this installation
  const authorizedEmails = React.useMemo(() => {
    return [
      profile.email,
      profile.googleDriveAccountEmail,
      ...administrators.map((a) => a.email),
    ].filter((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0));
  }, [profile.email, profile.googleDriveAccountEmail, administrators]);

  const hasPinConfigured = Boolean(profile.securityPin && profile.securityPin.trim().length > 0);

  // 1. Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsAuthenticatingGoogle(true);
      setErrorMessage(null);
      const res = await googleSignIn();
      if (!res) {
        // User closed the popup
        setIsAuthenticatingGoogle(false);
        return;
      }

      const email = res.user.email;
      setSuccessNotice(
        isEn
          ? `✓ Authenticated as ${email}. Unlocking session...`
          : `✓ Autenticado con éxito como ${email}. Desbloqueando...`
      );

      setTimeout(() => {
        onUnlockSuccess(email || undefined);
      }, 500);
    } catch (err: any) {
      console.warn('Google sign in error:', err);
      setErrorMessage(
        isEn
          ? `Could not sign in with Google: ${err?.message || err}`
          : `Error al iniciar sesión con Google: ${err?.message || err}`
      );
    } finally {
      setIsAuthenticatingGoogle(false);
    }
  };

  // 2. Email & PIN validation
  const handleEmailUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = enteredEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(
        isEn
          ? 'Please enter a valid registered email address.'
          : 'Por favor introduce un correo electrónico registrado válido.'
      );
      return;
    }

    // Check if email matches authorized profile/admin emails, or if it is a VIP
    const isAuthorized =
      validateUserAccessEmail(cleanEmail, authorizedEmails) ||
      isLifetimeVip(cleanEmail);

    if (!isAuthorized && authorizedEmails.length > 0) {
      setErrorMessage(
        isEn
          ? 'This email is not associated with this property manager account.'
          : 'Este correo electrónico no coincide con la cuenta administradora registrada en este dispositivo.'
      );
      return;
    }

    // If PIN is configured, verify PIN
    if (hasPinConfigured) {
      if (enteredPin.trim() !== profile.securityPin?.trim()) {
        setErrorMessage(
          isEn
            ? 'Incorrect Security PIN. Please verify and try again.'
            : 'PIN de seguridad incorrecto. Por favor verifica e intenta de nuevo.'
        );
        return;
      }
    }

    setSuccessNotice(isEn ? '✓ Access verified. Welcome back!' : '✓ Acceso verificado. ¡Bienvenido!');
    setTimeout(() => {
      onUnlockSuccess(cleanEmail);
    }, 400);
  };

  // 3. Import JSON backup from lock screen
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = importAppData(content);
        if (result.success) {
          setSuccessNotice(
            isEn
              ? `✓ Database restored! Loaded ${result.propertiesCount} properties.`
              : `✓ ¡Base de datos restaurada! Se cargaron ${result.propertiesCount} propiedades.`
          );
          if (onDataRestored) onDataRestored();
          setTimeout(() => {
            onUnlockSuccess();
          }, 800);
        } else {
          setErrorMessage(
            result.error || (isEn ? 'Invalid JSON backup file.' : 'Archivo de respaldo inválido.')
          );
        }
      } catch (err: any) {
        setErrorMessage(
          isEn
            ? `Error reading backup file: ${err?.message || err}`
            : `Error al leer archivo de respaldo: ${err?.message || err}`
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 animate-fade-in">
        
        {/* Security Shield & Lock Badge */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-lg mx-auto">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 bg-rose-600 text-white rounded-full shadow-md">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {profile.companyName || (isEn ? 'ARRIENDOS Rent Manager' : 'ARRIENDOS - Gestor')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isEn ? 'Session Locked & Protected' : 'Sesión Protegida & Acceso Bloqueado'}</span>
            </p>
          </div>
        </div>

        {/* Notifications / Alerts */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-xs text-rose-300 font-medium flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successNotice && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-medium flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Option 1: Fast Google Sign-In */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={isAuthenticatingGoogle}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-3 transition shadow-md cursor-pointer disabled:opacity-60"
          >
            {isAuthenticatingGoogle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                <span>{isEn ? 'Authenticating with Google...' : 'Autenticando con Google...'}</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isEn ? 'Continue with Google' : 'Continuar con Google'}</span>
              </>
            )}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-800"></div>
            <span className="shrink-0 mx-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {isEn ? 'or with registered email' : 'o con correo registrado'}
            </span>
            <div className="grow border-t border-slate-800"></div>
          </div>

          {/* Option 2: Registered Email / PIN Form */}
          <form onSubmit={handleEmailUnlock} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isEn ? 'Registered Email' : 'Correo Electrónico Registrado'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={enteredEmail}
                  onChange={(e) => setEnteredEmail(e.target.value)}
                  placeholder={profile.email || (isEn ? 'your@email.com' : 'tu-correo@ejemplo.com')}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  required
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            {hasPinConfigured && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isEn ? 'Security PIN' : 'PIN de Seguridad'}
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    maxLength={8}
                    placeholder="••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white tracking-widest placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono"
                    required
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>{isEn ? 'Unlock & Validate Access' : 'Validar & Desbloquear Acceso'}</span>
            </button>
          </form>
        </div>

        {/* Footer utilities: Restore JSON or New Account */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5 hover:text-sky-400 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{isEn ? 'Restore from .JSON' : 'Restaurar respaldo .JSON'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>

          {onResetForNewUser && (
            <button
              type="button"
              onClick={() => setShowNewUserConfirm(true)}
              className="flex items-center gap-1.5 hover:text-amber-400 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isEn ? 'New Account / Switch' : 'Nuevo Registro / Cambiar'}</span>
            </button>
          )}
        </div>

        {/* Confirmation modal if user wants to start a fresh registration */}
        {showNewUserConfirm && (
          <div className="p-3.5 bg-amber-950/70 border border-amber-800/80 rounded-2xl space-y-2 text-xs">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              {isEn ? 'Switch user or start new account?' : '¿Cambiar de usuario o iniciar nuevo registro?'}
            </h4>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              {isEn
                ? 'Make sure you have downloaded or backed up your current database before switching.'
                : 'Asegúrate de contar con una copia de respaldo antes de iniciar un registro nuevo.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewUserConfirm(false)}
                className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
              >
                {isEn ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewUserConfirm(false);
                  if (onResetForNewUser) onResetForNewUser();
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
              >
                {isEn ? 'Yes, Open Registration' : 'Sí, Iniciar Registro'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
