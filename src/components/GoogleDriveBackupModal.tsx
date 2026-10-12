import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  initAuth,
  googleSignIn,
  getAccessToken,
  hasValidAccessToken,
  clearStoredToken,
  logout,
} from '../utils/firebaseAuth';
import {
  extractFolderId,
  uploadBackupToDrive,
  listBackupsFromDrive,
  downloadBackupFromDrive,
  DriveBackupFile,
} from '../utils/googleDrive';
import { exportAppData, importAppData } from '../utils/storage';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Check,
  Loader2,
  ExternalLink,
  LogOut,
  RefreshCw,
  FolderCheck,
  Copy,
} from 'lucide-react';
import { SupportedLanguage, translations } from '../utils/i18n';
import { isLifetimeVip } from '../utils/subscription';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderIdOrUrl: string;
  onUpdateFolderId: (newFolderId: string) => void;
  onDataRestored: () => void;
  currentLanguage?: SupportedLanguage;
  userEmail?: string;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  folderIdOrUrl,
  onUpdateFolderId,
  onDataRestored,
  currentLanguage = 'es',
  userEmail,
}) => {
  const t = translations[currentLanguage];
  const currentLangIsEs = currentLanguage === 'es';
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [hasValidToken, setHasValidToken] = useState<boolean>(hasValidAccessToken());
  const [folderInput, setFolderInput] = useState(folderIdOrUrl || '');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [backupFiles, setBackupFiles] = useState<DriveBackupFile[]>([]);
  const [confirmingRestore, setConfirmingRestore] = useState<{
    fileId: string;
    fileName: string;
    modifiedTime?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    setFolderInput(folderIdOrUrl || '');
  }, [folderIdOrUrl]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingRestore(null);
      return;
    }

    // Check existing auth state
    const user = auth.currentUser;
    setCurrentUser(user);
    const hasToken = hasValidAccessToken();
    setHasValidToken(hasToken);

    if (user && hasToken) {
      fetchDriveFiles();
    } else if (user && !hasToken) {
      // User is logged in to Firebase but needs fresh token
      setStatusMessage({
        type: 'info',
        text: 'Sesión de Google Drive expirada. Haz clic en "Renovar Conexión" o "Actualizar lista" para cargar los respaldos.',
      });
    }

    // Subscribe to Firebase auth state changes
    const unsubscribe = initAuth(
      (authUser, token) => {
        setCurrentUser(authUser);
        if (token) {
          setHasValidToken(true);
          fetchDriveFiles(token);
        } else {
          setHasValidToken(false);
        }
      },
      () => {
        setCurrentUser(null);
        setHasValidToken(false);
        setBackupFiles([]);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isOpen]);

  const fetchDriveFiles = async (token?: string, interactive = false) => {
    try {
      setIsLoadingList(true);
      let activeToken = token || (await getAccessToken());

      if (!activeToken) {
        if (interactive) {
          // Trigger sign-in popup to renew token with user gesture
          const res = await googleSignIn();
          if (!res?.accessToken) {
            setStatusMessage({
              type: 'info',
              text: 'Operación cancelada o ventana de inicio de sesión cerrada.',
            });
            setIsLoadingList(false);
            return;
          }
          activeToken = res.accessToken;
          setCurrentUser(res.user);
          setHasValidToken(true);
        } else {
          setHasValidToken(false);
          setIsLoadingList(false);
          return;
        }
      }

      const files = await listBackupsFromDrive(activeToken, folderInput);
      setBackupFiles(files);
      setHasValidToken(true);
    } catch (err: any) {
      if (err?.message?.includes('AUTH_EXPIRED') || err?.status === 401) {
        clearStoredToken();
        setHasValidToken(false);
        if (interactive) {
          // Token was expired during an interactive refresh click, re-authenticate
          try {
            const res = await googleSignIn();
            if (res?.accessToken) {
              setCurrentUser(res.user);
              setHasValidToken(true);
              const files = await listBackupsFromDrive(res.accessToken, folderInput);
              setBackupFiles(files);
              return;
            }
          } catch {}
        }
        setStatusMessage({
          type: 'info',
          text: 'La sesión de Google Drive ha expirado. Haz clic en "Renovar Conexión" o "Actualizar lista" para renovar el acceso.',
        });
      } else {
        console.warn('Could not list drive files:', err);
        setStatusMessage({
          type: 'error',
          text: `Error al consultar Google Drive: ${err.message || err}`,
        });
      }
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setStatusMessage(null);
      const res = await googleSignIn();
      if (!res) {
        setStatusMessage({
          type: 'info',
          text: 'Inicio de sesión cancelado o ventana cerrada.',
        });
        return;
      }
      if (res.user && res.accessToken) {
        setCurrentUser(res.user);
        setHasValidToken(true);
        setStatusMessage({
          type: 'success',
          text: `Conectado como ${res.user.displayName || res.user.email}`,
        });
        await fetchDriveFiles(res.accessToken);
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup-closed-by-user')) {
        setStatusMessage({
          type: 'info',
          text: 'Ventana de inicio de sesión cerrada.',
        });
        return;
      }
      console.warn('Login issue:', error);
      setStatusMessage({
        type: 'error',
        text: `Error al conectar con Google Drive: ${error.message || error}`,
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    clearStoredToken();
    setCurrentUser(null);
    setHasValidToken(false);
    setBackupFiles([]);
    setStatusMessage({ type: 'info', text: 'Sesión de Google cerrada.' });
  };

  const handleFolderSave = () => {
    const clean = extractFolderId(folderInput);
    onUpdateFolderId(folderInput.trim());
    setStatusMessage({
      type: 'success',
      text: `Carpeta configurada (ID: ${clean || 'Mi Unidad / Raíz'}).`,
    });
    // refresh files for this folder
    fetchDriveFiles(undefined, true);
  };

  // One-click Backup to Google Drive
  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      setStatusMessage(null);

      let token = await getAccessToken();
      if (!token) {
        // Trigger login popup first
        const signResult = await googleSignIn();
        if (!signResult?.accessToken) {
          setStatusMessage({
            type: 'info',
            text: 'Operación cancelada. Por favor conecta tu cuenta de Google para respaldar.',
          });
          return;
        }
        token = signResult.accessToken;
        setCurrentUser(signResult.user);
        setHasValidToken(true);
      }

      const backupContent = exportAppData();
      const cleanFolder = extractFolderId(folderInput);

      const result = await uploadBackupToDrive(token, backupContent, cleanFolder);

      const locationNotice = result.isRootBackup && cleanFolder
        ? ' (Guardado en Mi Unidad / Raíz de Drive por permisos de carpeta)'
        : '';

      setStatusMessage({
        type: 'success',
        text: `¡Copia de seguridad subida con éxito a Google Drive!${locationNotice} Archivo: ${result.fileName}`,
      });

      // Refresh file list
      await fetchDriveFiles(token);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setStatusMessage({
          type: 'info',
          text: 'Ventana de Google cerrada sin completar el inicio de sesión.',
        });
        return;
      }
      if (err?.message?.includes('AUTH_EXPIRED')) {
        clearStoredToken();
        setHasValidToken(false);
        setStatusMessage({
          type: 'error',
          text: 'Tu sesión de Google Drive ha expirado. Haz clic en "Renovar Conexión" y vuelve a intentar.',
        });
        return;
      }
      console.warn('Backup issue:', err);
      setStatusMessage({
        type: 'error',
        text: `Fallo al respaldar en Google Drive: ${err.message || err}`,
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Request restore confirmation
  const handleRequestRestore = (fileId: string, fileName: string, modifiedTime?: string) => {
    setStatusMessage(null);
    setConfirmingRestore({ fileId, fileName, modifiedTime });
  };

  // Execute restore after user confirms in-app
  const executeRestore = async (fileId: string, fileName: string) => {
    try {
      setIsRestoring(true);
      setStatusMessage({
        type: 'info',
        text: `Descargando y aplicando copia "${fileName}" desde Google Drive...`,
      });

      let token = await getAccessToken();
      if (!token) {
        const signResult = await googleSignIn();
        if (!signResult?.accessToken) {
          setStatusMessage({
            type: 'info',
            text: 'Operación cancelada. Inicia sesión con tu cuenta de Google para restaurar archivos.',
          });
          return;
        }
        token = signResult.accessToken;
        setCurrentUser(signResult.user);
        setHasValidToken(true);
      }

      const fileContent = await downloadBackupFromDrive(token, fileId);
      const result = importAppData(fileContent);

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `✓ ¡Base de datos restaurada con éxito! Se cargaron ${result.propertiesCount} propiedad(es) y ${result.paymentsCount} pago(s) desde "${fileName}".`,
        });
        setConfirmingRestore(null);
        onDataRestored();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        throw new Error(result.error || 'El archivo descargado no tiene el formato JSON de respaldo válido.');
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setStatusMessage({
          type: 'info',
          text: 'Ventana de Google cerrada sin completar el inicio de sesión.',
        });
        return;
      }
      if (err?.message?.includes('AUTH_EXPIRED')) {
        clearStoredToken();
        setHasValidToken(false);
        setStatusMessage({
          type: 'error',
          text: 'Sesión expirada. Por favor renueva la conexión e intenta restaurar nuevamente.',
        });
        return;
      }
      console.warn('Restore issue:', err);
      setStatusMessage({
        type: 'error',
        text: `Error al restaurar desde Google Drive: ${err.message || err}`,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // One-click restore the newest available backup
  const handleRestoreLatest = async () => {
    // If no files or token expired, trigger interactive list refresh first
    if (!hasValidToken || backupFiles.length === 0) {
      await fetchDriveFiles(undefined, true);
    }

    if (backupFiles.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'No se encontraron copias de respaldo disponibles en Google Drive para restaurar.',
      });
      return;
    }

    const latest = backupFiles[0];
    handleRequestRestore(latest.id, latest.name, latest.modifiedTime);
  };

  if (!isOpen) return null;

  const currentFolderCleanId = extractFolderId(folderInput);
  const fullDriveFolderUrl = currentFolderCleanId
    ? `https://drive.google.com/drive/folders/${currentFolderCleanId}`
    : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-sky-900 via-sky-800 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 text-sky-200 rounded-xl">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  Sincronización & Backup con Google Drive
                </h2>
                <p className="text-xs text-sky-200/80">
                  Respalda y restaura tu base de datos en un solo paso
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1.5 rounded-lg transition"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Status Message Banner */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                    : 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Cloud className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">{statusMessage.text}</div>
              </div>
            )}

            {/* 1. Google Account Connection Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Cuenta de Google Conectada
                </span>
                {currentUser && (
                  hasValidToken ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Conectado a Drive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Sesión de Drive expirada
                    </span>
                  )
                )}
              </div>

              {currentUser ? (
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {currentUser.photoURL ? (
                        <img
                          src={currentUser.photoURL}
                          alt="Avatar"
                          className="w-9 h-9 rounded-full border border-sky-300 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                          {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {currentUser.displayName || 'Usuario de Google'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!hasValidToken && (
                        <button
                          type="button"
                          onClick={handleSignIn}
                          disabled={isSigningIn}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSigningIn ? 'animate-spin' : ''}`} />
                          Renovar Conexión
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Desconectar
                      </button>
                    </div>
                  </div>

                  {!hasValidToken && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>El permiso temporal de Google Drive expiró. Renueva el acceso para consultar los respaldos disponibles.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignIn}
                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-md shrink-0 cursor-pointer"
                      >
                        Renovar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                    Conecta tu cuenta de Google Drive para permitir el guardado automático y la recuperación de tus copias de seguridad directamente en la nube.
                  </p>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold text-xs flex items-center justify-center gap-2.5 shadow-xs transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isSigningIn ? 'Conectando con Google...' : 'Vincular cuenta de Google Drive'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. Folder Configuration */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Carpeta o Enlace de Google Drive de Destino (Opcional)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Pega el enlace de una carpeta de Google Drive o déjalo vacío para usar la raíz (Mi Unidad). El sistema buscará copias en ambos lugares automáticamente.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="Ej: https://drive.google.com/drive/folders/... o dejar vacío para Mi Unidad"
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleFolderSave}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer"
                >
                  Guardar Folder
                </button>
              </div>

              {currentFolderCleanId && fullDriveFolderUrl && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ID de Carpeta: {currentFolderCleanId}
                  </span>
                  <a
                    href={fullDriveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir carpeta en Google Drive
                  </a>
                </div>
              )}
            </div>

            {/* 3. One-Click Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Direct Backup Button */}
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="p-4 bg-gradient-to-br from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-2xl font-semibold shadow-md transition flex flex-col items-center justify-center gap-2 group cursor-pointer disabled:opacity-60"
              >
                <div className="p-2.5 bg-white/15 rounded-xl group-hover:scale-105 transition">
                  {isBackingUp ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  ) : (
                    <CloudUpload className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="text-center">
                  <span className="text-sm block font-bold">
                    {isBackingUp
                      ? (currentLangIsEs ? 'Subiendo Copia a Google Drive...' : 'Uploading Backup to Google Drive...')
                      : (currentLangIsEs ? 'Hacer Backup a Google Drive' : 'Backup to Google Drive')}
                  </span>
                  <span className="text-[11px] text-sky-100 font-normal">
                    {currentLangIsEs
                      ? 'Sube y resguarda propiedades, inquilinos y pagos en tu Drive'
                      : 'Upload and protect properties, tenants and payments into your Google Drive'}
                  </span>
                </div>
              </button>

              {/* Direct Restore Latest Button */}
              <button
                type="button"
                onClick={handleRestoreLatest}
                disabled={isRestoring}
                className={`p-4 rounded-2xl font-semibold border transition flex flex-col items-center justify-center gap-2 group cursor-pointer ${
                  backupFiles.length > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="p-2.5 bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-105 transition">
                  {isRestoring ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <CloudDownload className="w-6 h-6" />
                  )}
                </div>
                <div className="text-center">
                  <span className="text-sm block font-bold">
                    {isRestoring
                      ? (currentLangIsEs ? 'Restaurando...' : 'Restoring...')
                      : (currentLangIsEs ? 'Restaurar Copia Más Reciente' : 'Restore Most Recent Backup')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    {backupFiles.length > 0
                      ? `${currentLangIsEs ? 'Copia más reciente:' : 'Latest:'} ${backupFiles[0].name.slice(0, 26)}...`
                      : !hasValidToken
                      ? (currentLangIsEs ? 'Haz clic para conectar y buscar copias' : 'Click to connect and find backups')
                      : (currentLangIsEs ? 'Buscar y cargar la última copia en Drive' : 'Search and load latest backup')}
                  </span>
                </div>
              </button>
            </div>

            {/* 4. Backup History in Google Drive */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FolderCheck className="w-3.5 h-3.5 text-sky-500" />
                  Copias Disponibles en Google Drive ({backupFiles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => fetchDriveFiles(undefined, true)}
                  disabled={isLoadingList}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingList ? 'animate-spin' : ''}`} />
                  Actualizar lista
                </button>
              </div>

              {isLoadingList ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                  Consultando Google Drive...
                </div>
              ) : !hasValidToken && currentUser ? (
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-center space-y-2">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    Tu sesión de Google Drive requiere renovar permisos para mostrar los respaldos guardados.
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchDriveFiles(undefined, true)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Renovar Conexión y Ver Respaldos
                  </button>
                </div>
              ) : backupFiles.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs text-slate-400">
                  {currentUser
                    ? 'No se encontraron archivos de respaldo en Google Drive. Haz clic en "Hacer Backup a Google Drive" para generar la primera copia.'
                    : 'Conecta tu cuenta de Google Drive arriba para ver tus copias de seguridad.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {backupFiles.map((file, idx) => (
                    <div
                      key={file.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                        idx === 0
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {file.name}
                          </span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded">
                              Más reciente
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(file.modifiedTime).toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRequestRestore(file.id, file.name, file.modifiedTime)}
                        disabled={isRestoring}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer"
                      >
                        <CloudDownload className="w-3.5 h-3.5" /> Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>

      {/* Centered Modal Confirmation Popup for Restore (Always in view, z-70 overlay) */}
      {confirmingRestore && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border-2 border-amber-400 dark:border-amber-600 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ¿Confirmar restauración de datos?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Se importarán y aplicarán los datos desde Google Drive:
                </p>
                <div className="mt-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-xs text-sky-700 dark:text-sky-300 font-semibold break-all border border-slate-200 dark:border-slate-700">
                  📄 {confirmingRestore.fileName}
                </div>
                {confirmingRestore.modifiedTime && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Fecha del archivo: {new Date(confirmingRestore.modifiedTime).toLocaleString()}
                  </p>
                )}
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  ⚠️ <strong>Aviso importante:</strong> La información actual de contratos, propiedades y recibos en este dispositivo será reemplazada por los datos contenidos en este archivo de respaldo.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setConfirmingRestore(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => executeRestore(confirmingRestore.fileId, confirmingRestore.fileName)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-60"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Descargando y aplicando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Sí, Restaurar Datos Ahora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
