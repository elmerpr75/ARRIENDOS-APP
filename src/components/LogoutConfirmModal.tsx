import React, { useState } from 'react';
import {
  LogOut,
  Cloud,
  Download,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  Shield,
  ArrowRight,
  FolderCheck,
} from 'lucide-react';
import { SupportedLanguage } from '../utils/i18n';
import { exportAppData } from '../utils/storage';

import { hasValidAccessToken } from '../utils/firebaseAuth';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: (backupChoice: 'gdrive' | 'local' | 'none') => Promise<void>;
  isGoogleDriveConnected: boolean;
  connectedGoogleEmail?: string;
  userEmail?: string;
  folderInput?: string;
  currentLang?: SupportedLanguage;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmLogout,
  isGoogleDriveConnected,
  connectedGoogleEmail,
  userEmail,
  currentLang = 'es',
}) => {
  const hasActiveGoogleToken = hasValidAccessToken();
  const [selectedAction, setSelectedAction] = useState<'gdrive' | 'local' | 'none'>(() =>
    hasActiveGoogleToken ? 'gdrive' : 'local'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEn = currentLang === 'en';

  const handleExecuteLogout = async (choice: 'gdrive' | 'local' | 'none') => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      await onConfirmLogout(choice);
    } catch (err: any) {
      console.error('Logout / backup error:', err);
      if (choice === 'gdrive') {
        try {
          const dataStr = exportAppData();
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `arriendos-respaldo-emergencia-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setErrorMessage(
            isEn
              ? 'Could not connect to Google Drive. As a safety measure, a local backup (.JSON) was automatically generated and downloaded to your device downloads folder.'
              : '⚠️ No se pudo conectar con Google Drive. Como medida de seguridad, se ha generado y descargado automáticamente una copia de respaldo local (JSON) en su dispositivo (carpeta de Descargas).'
          );
        } catch (localErr) {
          setErrorMessage(
            err?.message || (isEn ? 'Could not connect to Google Drive.' : 'No se pudo completar el respaldo en Google Drive.')
          );
        }
      } else {
        setErrorMessage(
          err?.message ||
            (isEn
              ? 'Could not complete backup or sign out.'
              : 'No se pudo completar el respaldo o cierre de sesión.')
        );
      }
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5 my-auto text-slate-900 dark:text-slate-100 relative">
        
        {/* Close button */}
        {!isProcessing && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isEn ? 'Cancel' : 'Cancelar'}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header with Shield & Warning */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{isEn ? 'Sign Out & Lock App' : 'Cerrar Sesión & Proteger Acceso'}</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {isEn
                ? 'Protect your financial records and tenant data on this shared computer or device.'
                : 'Protege tu información financiera y los datos de tus inquilinos en este equipo o celular compartido.'}
            </p>
          </div>
        </div>

        {/* Security Warning Box */}
        <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">
              {isEn ? 'Recommendation before exiting:' : 'Recomendación antes de salir:'}
            </span>{' '}
            {isEn
              ? 'Creating a backup (JSON) ensures your latest payments and edits are safe before locking access.'
              : 'Realizar una copia de seguridad te asegura tener a salvo tus cobros, inquilinos y contratos antes de bloquear la pantalla.'}
          </div>
        </div>

        {/* Error notification if any with instant fallback buttons */}
        {errorMessage && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl space-y-3">
            <div className="text-xs text-rose-700 dark:text-rose-300 font-medium">
              <span className="font-bold">{isEn ? 'Notice:' : 'Aviso:'} </span>
              {errorMessage}
            </div>
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExecuteLogout('local')}
                className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isEn ? 'Download Local JSON & Exit' : 'Descargar JSON Local y Salir'}</span>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExecuteLogout('none')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>{isEn ? 'Exit without Backup' : 'Salir sin Copia'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Backup Option Selection Cards */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isEn ? 'Choose backup preference:' : 'Elige cómo deseas proceder:'}
          </label>

          {/* Option 1: Google Drive */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setSelectedAction('gdrive')}
            className={`w-full p-4 rounded-2xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
              selectedAction === 'gdrive'
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/30'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              selectedAction === 'gdrive'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-sky-600 dark:text-sky-400'
            }`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {isEn ? 'Cloud Backup (Google Drive)' : 'Copia en la Nube (Google Drive)'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  hasActiveGoogleToken
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                }`}>
                  {hasActiveGoogleToken
                    ? (isEn ? 'Connected' : 'Conectado')
                    : (isEn ? 'Requires Google' : 'Requiere Google')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {isEn
                  ? 'Syncs a fresh JSON copy to Drive and automatically prunes old backups.'
                  : 'Sube un respaldo JSON a Google Drive y limpia automáticamente copias antiguas.'}
              </p>
              {hasActiveGoogleToken && (connectedGoogleEmail || userEmail) && (
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-sky-600 dark:text-sky-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isEn ? 'Connected as:' : 'Conectado como:'} {connectedGoogleEmail || userEmail}</span>
                </div>
              )}
            </div>
          </button>

          {/* Option 2: Local JSON file */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setSelectedAction('local')}
            className={`w-full p-4 rounded-2xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
              selectedAction === 'local'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              selectedAction === 'local'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-amber-600 dark:text-amber-400'
            }`}>
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {isEn ? 'Download Local Backup (.JSON)' : 'Descargar Copia Local (.JSON)'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  {isEn ? '100% Instant' : '100% Seguro & Rápido'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {isEn
                  ? 'Instantly downloads a .json file directly to this phone, tablet, or PC without Google login.'
                  : 'Descarga un archivo .json directo a la memoria o descargas de este celular o equipo (no requiere cuenta Google).'}
              </p>
            </div>
          </button>

          {/* Option 3: Omit and logout directly */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setSelectedAction('none')}
            className={`w-full p-4 rounded-2xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
              selectedAction === 'none'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              selectedAction === 'none'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-rose-500'
            }`}>
              <LogOut className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                {isEn ? 'Omit Backup and Exit Directly' : 'Omitir Respaldo y Salir Directamente'}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {isEn
                  ? 'Locks the app immediately without creating or downloading a new copy.'
                  : 'Cierra sesión y bloquea la pantalla de inmediato sin generar copia nueva.'}
              </p>
            </div>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {isEn ? 'Cancel / Keep Working' : 'Cancelar / Seguir Trabajando'}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleExecuteLogout(selectedAction)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {selectedAction === 'gdrive'
                    ? (isEn ? 'Saving to Drive & Signing out...' : 'Respaldando en Drive y saliendo...')
                    : (isEn ? 'Closing session...' : 'Cerrando sesión y bloqueando...')}
                </span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>
                  {selectedAction === 'gdrive'
                    ? (isEn ? 'Backup to Drive & Sign Out' : 'Respaldar en Drive y Salir')
                    : selectedAction === 'local'
                    ? (isEn ? 'Download JSON & Sign Out' : 'Descargar JSON y Salir')
                    : (isEn ? 'Sign Out & Lock Now' : 'Cerrar y Bloquear Ahora')}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
