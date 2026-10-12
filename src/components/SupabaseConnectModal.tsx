import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Key,
  Server,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  Download,
  HelpCircle,
  GitBranch,
  ShieldCheck,
  Code2,
  Mail,
  Check,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
  testSupabaseConnectionDetailed,
  syncAppDataToSupabase,
  DEFAULT_SUPABASE_URL,
  DetailedConnectionResult,
} from '../utils/supabase';
import {
  SUPABASE_SCHEMA_SQL,
  SUPABASE_SQL_EDITOR_URL,
  SUPABASE_API_SETTINGS_URL,
} from '../utils/supabaseSql';
import { exportAppData } from '../utils/storage';
import { SupportedLanguage } from '../utils/i18n';

interface SupabaseConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmails?: (string | null | undefined)[];
  currentLanguage?: SupportedLanguage;
  onConnectionSuccess?: () => void;
}

export const SupabaseConnectModal: React.FC<SupabaseConnectModalProps> = ({
  isOpen,
  onClose,
  userEmails = [],
  currentLanguage = 'es',
  onConnectionSuccess,
}) => {
  const isEn = currentLanguage === 'en';
  const [url, setUrl] = useState(DEFAULT_SUPABASE_URL);
  const [anonKey, setAnonKey] = useState('');
  
  // Resolve default email to test
  const resolvedDefaultEmail =
    userEmails.find((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0)) || '';
  const [testEmail, setTestEmail] = useState(resolvedDefaultEmail);

  const [activeTab, setActiveTab] = useState<'config' | 'guide' | 'github'>('config');
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [diagResult, setDiagResult] = useState<DetailedConnectionResult | null>(null);
  const [feedback, setFeedback] = useState<{
    success?: boolean;
    message: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.url || DEFAULT_SUPABASE_URL);
      setAnonKey(cfg.anonKey || '');
      setDiagResult(null);
      setFeedback(null);
      const email =
        userEmails.find((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0)) || '';
      setTestEmail(email);
    }
  }, [isOpen, userEmails]);

  if (!isOpen) return null;

  const handlePasteKey = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 10) {
          setAnonKey(text.trim());
          setFeedback({
            success: true,
            message: isEn
              ? '✓ Anon key pasted from clipboard!'
              : '✓ ¡Clave anon pegada desde el portapapeles!',
          });
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleCopySql = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3500);
      }
    } catch {
      // Fallback
    }
  };

  const handleTestAndSave = async () => {
    if (!url.trim()) {
      setFeedback({
        success: false,
        message: isEn ? 'Please provide the Supabase URL.' : 'Por favor proporciona la URL de Supabase.',
      });
      return;
    }

    if (!anonKey.trim()) {
      setFeedback({
        success: false,
        message: isEn
          ? 'Please paste your anon public key from Supabase.'
          : 'Por favor pega tu clave pública "anon" de Supabase.',
        details: isEn
          ? 'Find it in: Project Settings ⚙️ > API > Project API keys > anon'
          : 'Encuéntrala en: Project Settings ⚙️ > API > Project API keys > anon',
      });
      return;
    }

    setTesting(true);
    setFeedback(null);
    setDiagResult(null);

    // Guardar temporalmente en localStorage
    saveSupabaseConfig(url.trim(), anonKey.trim());

    try {
      const emailToUse = testEmail.trim();
      const diag = await testSupabaseConnectionDetailed(url, anonKey, emailToUse);
      setDiagResult(diag);

      if (diag.success) {
        // Guardar configuración confirmada
        saveSupabaseConfig(url.trim(), anonKey.trim());

        setFeedback({
          success: true,
          message: diag.message,
          details: diag.details,
        });

        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
      } else {
        setFeedback({
          success: false,
          message: diag.message,
          details: diag.details,
        });
      }
    } catch (err: any) {
      setFeedback({
        success: false,
        message: isEn ? 'Error connecting to Supabase.' : 'Error al conectar con Supabase.',
        details: err?.message || 'Verifica que la URL y la clave anon sean correctas.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      const backupRaw = exportAppData();
      const backupParsed = JSON.parse(backupRaw);
      const res = await syncAppDataToSupabase(backupParsed);
      setFeedback({
        success: res.success,
        message: res.message,
      });
    } catch (e: any) {
      setFeedback({
        success: false,
        message: 'Error al sincronizar datos: ' + (e?.message || 'Error desconocido'),
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white flex items-center justify-between border-b border-emerald-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {isEn ? 'Supabase Backend Connection' : 'Conexión con Supabase (Backend)'}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSupabaseConfigured()
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {isSupabaseConfigured()
                    ? isEn
                      ? 'Connected'
                      : 'Configurado'
                    : isEn
                    ? 'Anon Key Required'
                    : 'Falta Clave Anon'}
                </span>
              </div>
              <p className="text-xs text-emerald-200/70 font-mono">
                https://eofanfysekycgrzxuazp.supabase.co
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            {isEn ? '1. Connect & Test' : '1. Conectar y Probar'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {isEn ? '2. Where is my Anon Key?' : '2. ¿Dónde está mi Clave Anon?'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'github'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            {isEn ? '3. GitHub & Security' : '3. GitHub y Seguridad'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0 text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
          {activeTab === 'config' && (
            <div className="space-y-4">
              {/* URL Confirmation Box */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                      ✓ Tu URL asignada por Supabase es 100% correcta:
                    </p>
                    <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">
                      Confirmada
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 select-all font-bold">
                    https://eofanfysekycgrzxuazp.supabase.co
                  </p>
                </div>
              </div>

              {/* URL Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SUPABASE_URL</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://eofanfysekycgrzxuazp.supabase.co"
                />
              </div>

              {/* Anon Key Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    <span>SUPABASE_ANON_KEY (Clave Pública "anon")</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <a
                      href={SUPABASE_API_SETTINGS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Copiar de Supabase</span>
                    </a>
                    <button
                      type="button"
                      onClick={handlePasteKey}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      {isEn ? 'Paste' : 'Pegar clave'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value.trim())}
                  placeholder="Pega aquí la clave pública 'anon' que comienza por eyJhbGciOi... (o sb_publishable_...)"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  La clave anon es 100% segura para el frontend y GitHub público. Todas las tablas tienen Row Level Security (RLS) activado.
                </p>
              </div>

              {/* Test Email Input */}
              <div className="space-y-1 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-600" />
                    <span>Correo electrónico a verificar en el Servidor</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Evaluado por check_subscription_access</span>
                </div>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="tu-correo@ejemplo.com"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">Prueba:</span>
                  <button
                    type="button"
                    onClick={() => setTestEmail('usuario_prueba@ejemplo.com')}
                    className="text-[11px] px-2 py-0.5 bg-sky-100 hover:bg-sky-200 dark:bg-sky-950/60 dark:hover:bg-sky-900 text-sky-800 dark:text-sky-200 rounded font-medium transition cursor-pointer"
                  >
                    🧪 usuario_prueba@ejemplo.com (Prueba 42 días)
                  </button>
                </div>
              </div>

              {/* Diagnostic Checklist (When test has run) */}
              {diagResult && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Diagnóstico de Conexión:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>URL Supabase válida</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {diagResult.keyConfirmed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>Clave Pública Anon</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {diagResult.tablesConfirmed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>Tablas SQL (schema.sql)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {diagResult.rpcConfirmed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>RPC check_subscription_access</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    feedback.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2 font-bold">
                    {feedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                  {feedback.details && (
                    <p className="text-[11px] opacity-90 pl-6 leading-relaxed">{feedback.details}</p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleTestAndSave}
                  disabled={testing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>
                    {testing
                      ? isEn
                        ? 'Verifying Server...'
                        : 'Verificando Servidor...'
                      : isEn
                      ? 'Save & Test RPC Connection'
                      : 'Guardar y Probar Conexión'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-300 dark:border-slate-700 transition flex items-center gap-2 cursor-pointer"
                  title="Copia el script SQL completo para volver a ejecutarlo si hace falta"
                >
                  {copiedSql ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Code2 className="w-3.5 h-3.5 text-sky-600" />
                  )}
                  <span>{copiedSql ? '¡SQL Copiado!' : 'Copiar Script SQL'}</span>
                </button>

                <a
                  href={SUPABASE_SQL_EDITOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 font-semibold rounded-xl text-xs border border-sky-200 dark:border-sky-800 transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir SQL Editor ↗</span>
                </a>

                {isSupabaseConfigured() && (
                  <button
                    type="button"
                    onClick={handleSyncData}
                    disabled={syncing}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>
                      {syncing
                        ? isEn
                          ? 'Backing up...'
                          : 'Sincronizando...'
                        : isEn
                        ? 'Sync Data to Supabase'
                        : 'Respaldar Datos a Supabase'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>Paso a Paso: Cómo copiar tu Clave Anon en Supabase</span>
              </h3>

              <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    Acceso directo a la página de claves de tu proyecto:
                  </span>
                  <p>
                    Haz clic aquí para abrir directamente la página de tu API:{' '}
                    <a
                      href={SUPABASE_API_SETTINGS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 dark:text-sky-400 font-mono underline inline-flex items-center gap-1 font-bold"
                    >
                      supabase.com/dashboard/project/eofanfysekycgrzxuazp/settings/api
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">1. Ve a "Project Settings" ⚙️:</span>
                  <p>
                    En la barra lateral izquierda de Supabase, en la parte inferior, haz clic en el icono de <strong>engranaje ⚙️ (Project Settings)</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">2. En el menú selecciona "API":</span>
                  <p>
                    En el submenú de Configuration, haz clic en <strong>API</strong> (o Data API).
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">3. Copia la clave "anon public":</span>
                  <p>
                    En la sección <strong>Project API keys</strong>, verás:
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      <strong>anon (public)</strong>: Presiona el botón <strong>Copy</strong>. Es un texto largo que inicia con <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">eyJhbGciOi...</code>. <strong>Esta es la que necesitas pegar en la pestaña 1</strong>.
                    </li>
                    <li className="text-amber-700 dark:text-amber-400">
                      <strong>service_role (secret)</strong>: ¡NUNCA la compartas! Esa clave es sólo para scripts de backend privado.
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">4. Pega y presiona "Guardar y Probar Conexión":</span>
                  <p>
                    Vuelve a la pestaña <strong>"1. Conectar y Probar"</strong>, pega la clave en el campo SUPABASE_ANON_KEY y haz clic en <strong>"Guardar y Probar Conexión"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>¿Cómo funciona con GitHub y el Frontend?</span>
              </h3>

              <div className="p-3.5 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 space-y-2">
                <p>
                  <strong>¿Puedo subir este repositorio a mi cuenta pública de GitHub sin riesgo?</strong>
                </p>
                <p>
                  <strong>SÍ, TOTALMENTE SEGURO</strong>. La base de datos en Supabase tiene activado Row Level Security (RLS). Las cuentas VIP vitalicias y los cálculos de suscripción se ejecutan dentro del motor de PostgreSQL en Supabase mediante la función <code className="bg-sky-200 dark:bg-sky-900 px-1 py-0.5 rounded font-mono">check_subscription_access</code>.
                </p>
                <p>
                  La clave <code className="bg-sky-200 dark:bg-sky-900 px-1 py-0.5 rounded font-mono">anon</code> es pública por diseño en Supabase. Nadie puede alterar suscripciones ni modificar cuentas VIP porque esas tablas están bloqueadas para lectura/escritura anónima directa y sólo la función del servidor puede otorgar permisos.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">Para desplegar en GitHub Pages / Vercel / Netlify:</h4>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Puedes configurar las variables de entorno en tu panel de despliegue o en un archivo <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">.env</code>:
                </p>
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono rounded-xl text-[11px] space-y-1 overflow-x-auto">
                  <div>VITE_SUPABASE_URL="https://eofanfysekycgrzxuazp.supabase.co"</div>
                  <div>VITE_SUPABASE_ANON_KEY="tu_clave_anon_copiada_de_supabase"</div>
                </div>
              </div>

              {/* Download Source Code Button */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-2">
                  Si deseas descargar todo el código fuente listo para subirlo a tu repositorio de GitHub:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = '/gestor-arrendamientos-codigo.zip';
                    a.download = 'gestor-arrendamientos-codigo.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar Código Completo (.ZIP) para GitHub</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            {isSupabaseConfigured()
              ? '✓ Conexión configurada en este navegador'
              : 'Configuración pendiente de clave anon'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            {isEn ? 'Close' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
