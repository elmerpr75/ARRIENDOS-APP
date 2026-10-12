import React, { useState, useRef, useEffect } from 'react';
import { LandlordProfile, NotificationSettings, Administrator, CURRENCY_OPTIONS } from '../types';
import {
  X,
  Building2,
  Upload,
  Trash2,
  CheckCircle2,
  Download,
  RefreshCw,
  Smartphone,
  Laptop,
  Check,
  AlertCircle,
  Plus,
  Coins,
  Globe,
  Shield,
  Layers,
  Copy,
  Sparkles,
  Database,
  Server,
  Key,
} from 'lucide-react';
import { exportAppData, importAppData, loadAdministrators, saveAdministrators } from '../utils/storage';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendNativeNotification,
  saveNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../utils/notifications';
import { SupportedLanguage, translations } from '../utils/i18n';
import { isLifetimeVip, SubscriptionState } from '../utils/subscription';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
  verifyServerSubscription,
  testSupabaseConnectionDetailed,
  syncAppDataToSupabase,
  fetchAppDataFromSupabase,
} from '../utils/supabase';
import { ThemeMode, getSavedThemeMode, applyThemeMode } from '../utils/theme';
import { ThemeSelector } from './ThemeSelector';
import { Palette } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: LandlordProfile;
  onSaveProfile: (profile: LandlordProfile) => void;
  onDataReload: () => void;
  onOpenGoogleDriveModal?: () => void;
  currentLanguage?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  currentTheme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  subscriptionState?: SubscriptionState;
  onOpenSubscriptionModal?: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  onDataReload,
  onOpenGoogleDriveModal,
  currentLanguage = 'es',
  onLanguageChange,
  currentTheme,
  onThemeChange,
  subscriptionState,
  onOpenSubscriptionModal,
}) => {
  const t = translations[currentLanguage];
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(currentLanguage);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(
    currentTheme || profile.themeMode || getSavedThemeMode()
  );

  // Administrators state (up to 7 companies)
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [activeAdminId, setActiveAdminId] = useState<string>('');
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);

  // Global settings state
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState('');
  const [googleDriveAccountEmail, setGoogleDriveAccountEmail] = useState('');

  // Notification Settings State
  const [notifEnabled, setNotifEnabled] = useState(
    profile.notificationSettings?.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled
  );
  const [daysBeforeRentDue, setDaysBeforeRentDue] = useState(
    profile.notificationSettings?.daysBeforeRentDue ?? DEFAULT_NOTIFICATION_SETTINGS.daysBeforeRentDue
  );
  const [notifyOnDueDay, setNotifyOnDueDay] = useState(
    profile.notificationSettings?.notifyOnDueDay ?? DEFAULT_NOTIFICATION_SETTINGS.notifyOnDueDay
  );
  const [notifyOnOverdue, setNotifyOnOverdue] = useState(
    profile.notificationSettings?.notifyOnOverdue ?? DEFAULT_NOTIFICATION_SETTINGS.notifyOnOverdue
  );
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermissionStatus());
  const [testNotificationFeedback, setTestNotificationFeedback] = useState<string | null>(null);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Supabase Backend state
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getSupabaseConfig().anonKey);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseFeedback, setSupabaseFeedback] = useState<{ success?: boolean; message: string } | null>(null);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loadedAdmins = loadAdministrators();
      setAdministrators(loadedAdmins);
      setActiveAdminId(loadedAdmins[0]?.id || 'admin-1');
      setGoogleDriveFolderId(profile.googleDriveFolderId || '');
      setGoogleDriveAccountEmail(profile.googleDriveAccountEmail || '');
      setSelectedLang(currentLanguage);
      setSelectedTheme(currentTheme || profile.themeMode || getSavedThemeMode());
      setPermissionStatus(getNotificationPermissionStatus());
      const cfg = getSupabaseConfig();
      setSupabaseUrl(cfg.url);
      setSupabaseAnonKey(cfg.anonKey);
    }
  }, [isOpen, profile, currentLanguage, currentTheme]);

  const handleSaveSupabase = () => {
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setSupabaseFeedback({ success: true, message: '✓ Configuración de Supabase guardada exitosamente.' });
    setTimeout(() => setSupabaseFeedback(null), 3500);
  };

  const handleTestSupabase = async () => {
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setSupabaseTesting(true);
    setSupabaseFeedback(null);
    try {
      const emailToTest =
        profile.email ||
        googleDriveAccountEmail ||
        (administrators[0] ? administrators[0].email : '');

      const diag = await testSupabaseConnectionDetailed(
        supabaseUrl,
        supabaseAnonKey,
        emailToTest
      );

      if (diag.success) {
        setSupabaseFeedback({
          success: true,
          message: diag.message,
          details: diag.details,
        });
      } else {
        setSupabaseFeedback({
          success: false,
          message: diag.message,
          details: diag.details,
        });
      }
    } catch (e: any) {
      setSupabaseFeedback({
        success: false,
        message: `Error al conectar: ${e?.message || 'Verifica la URL y la clave anon'}.`,
      });
    } finally {
      setSupabaseTesting(false);
    }
  };

  const handleSyncToSupabase = async () => {
    setSupabaseSyncing(true);
    try {
      const backupRaw = exportAppData();
      const backupParsed = JSON.parse(backupRaw);
      const res = await syncAppDataToSupabase(backupParsed);
      setSupabaseFeedback({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setSupabaseFeedback({
        success: false,
        message: 'Error al exportar datos: ' + (err?.message || 'Error desconocido'),
      });
    } finally {
      setSupabaseSyncing(false);
    }
  };

  if (!isOpen) return null;

  const activeAdminIndex = administrators.findIndex((a) => a.id === activeAdminId);
  const currentAdmin: Administrator =
    activeAdminIndex >= 0
      ? administrators[activeAdminIndex]
      : administrators[0] || {
          id: 'admin-1',
          companyName: 'Inmobiliaria & Arrendamientos Premier',
          landlordName: 'Ing. Alejandro Morales V.',
          taxId: 'IAP-920415-XYZ',
          phone: '+52 55 4123 9876',
          email: 'administracion@inmobiliariapremier.com',
          address: 'Av. Reforma 1240, Piso 5, CDMX',
          bankDetails: 'Banco BBVA • Cuenta: 0123 4567 8901 • CLABE: 012 180 00123456789 0',
          invoiceNote: 'El pago debe realizarse dentro de los primeros días estipulados en contrato.',
          currencyCode: 'USD',
          currencySymbol: '$',
          isDefault: true,
        };

  const updateCurrentAdmin = (updates: Partial<Administrator>) => {
    setAdministrators((prev) => {
      const idx = prev.findIndex((a) => a.id === currentAdmin.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  const handleAddNewAdmin = () => {
    if (administrators.length >= 7) return;
    const newId = `admin-${Date.now()}`;
    const newAdmin: Administrator = {
      id: newId,
      companyName: `Empresa Administradora ${administrators.length + 1}`,
      landlordName: '',
      taxId: '',
      phone: '',
      email: '',
      address: '',
      bankDetails: '',
      invoiceNote: 'El pago debe realizarse dentro de los primeros días estipulados en contrato.',
      currencyCode: 'USD',
      currencySymbol: '$',
      isDefault: false,
    };
    const updated = [...administrators, newAdmin];
    setAdministrators(updated);
    setActiveAdminId(newId);
  };

  const handleConfirmDeleteAdmin = () => {
    if (!adminToDelete || administrators.length <= 1) return;
    const filtered = administrators.filter((a) => a.id !== adminToDelete);
    if (!filtered.some((a) => a.isDefault)) {
      filtered[0].isDefault = true;
    }
    setAdministrators(filtered);
    setActiveAdminId(filtered[0].id);
    setAdminToDelete(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setImportStatus('Error: Por favor selecciona una imagen menor a 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          updateCurrentAdmin({ logoUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    updateCurrentAdmin({ logoUrl: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCurrencySelect = (code: string) => {
    const found = CURRENCY_OPTIONS.find((c) => c.code === code);
    if (found) {
      updateCurrentAdmin({
        currencyCode: found.code,
        currencySymbol: found.symbol,
      });
    }
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      setTestNotificationFeedback('✓ Permisos concedidos. Notificaciones listas para Android y Windows.');
    } else if (res === 'denied') {
      setTestNotificationFeedback('⚠️ Las notificaciones están bloqueadas en este navegador o sistema.');
    }
  };

  const handleSendTestNotification = async () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      setTestNotificationFeedback(
        currentLanguage === 'en'
          ? '⚠️ Push notifications require an active subscription after the 6-week trial ends.'
          : '⚠️ Las alertas push requieren una suscripción activa al finalizar las 6 semanas de prueba.'
      );
      if (onOpenSubscriptionModal) {
        onOpenSubscriptionModal();
      }
      return;
    }

    if (permissionStatus !== 'granted') {
      const res = await requestNotificationPermission();
      setPermissionStatus(res);
      if (res !== 'granted') {
        setTestNotificationFeedback('⚠️ Debes permitir notificaciones en este dispositivo para recibir alertas.');
        return;
      }
    }

    const success = await sendNativeNotification({
      title: '📄 Recordatorio de Facturación - Prueba',
      body: `Faltan ${daysBeforeRentDue} días para el 1er día de mes. Notificación enviada con éxito a este dispositivo.`,
    });

    if (success) {
      setTestNotificationFeedback('✓ ¡Notificación enviada! Revisa el banner en tu pantalla o barra de estado.');
    } else {
      setTestNotificationFeedback('⚠️ No se pudo enviar la notificación. Verifica los permisos del navegador.');
    }

    setTimeout(() => setTestNotificationFeedback(null), 6000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLanguageChange && selectedLang !== currentLanguage) {
      onLanguageChange(selectedLang);
    }

    const notificationSettings: NotificationSettings = {
      enabled: notifEnabled,
      daysBeforeRentDue: Math.max(1, Math.min(30, Number(daysBeforeRentDue) || 5)),
      notifyOnDueDay,
      notifyOnOverdue,
      notifyContractExpiry: true,
      contractExpiryDays: 30,
    };
    saveNotificationSettings(notificationSettings);

    // Save all administrators
    saveAdministrators(administrators);

    // Sync primary administrator to profile
    const primary = administrators.find((a) => a.isDefault) || administrators[0];
    const updatedProfile: LandlordProfile = {
      companyName: primary.companyName || 'Arrendamientos & Inmuebles',
      landlordName: primary.landlordName,
      taxId: primary.taxId,
      phone: primary.phone,
      email: primary.email,
      address: primary.address,
      logoUrl: primary.logoUrl,
      bankDetails: primary.bankDetails,
      invoiceNote: primary.invoiceNote,
      currencyCode: primary.currencyCode,
      currencySymbol: primary.currencySymbol,
      themeMode: selectedTheme,
      googleDriveFolderId: googleDriveFolderId.trim() || undefined,
      googleDriveAccountEmail: googleDriveAccountEmail.trim() || undefined,
      notificationSettings,
      administrators,
    };

    applyThemeMode(selectedTheme);
    if (onThemeChange) {
      onThemeChange(selectedTheme);
    }

    onSaveProfile(updatedProfile);
    onDataReload();
    onClose();
  };

  const handleExportBackup = () => {
    const jsonStr = exportAppData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-arrendamientos-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = importAppData(reader.result);
          if (res.success) {
            setImportStatus(`✓ Base de datos restaurada (${res.propertiesCount} prop., ${res.paymentsCount} pagos)`);
            onDataReload();
            setTimeout(() => {
              setImportStatus(null);
              onClose();
            }, 1400);
          } else {
            setImportStatus(`Error: ${res.error || 'Archivo JSON no válido'}`);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Configuración de Empresas & Logo / Timbre
              </h2>
              <p className="text-xs text-sky-200/80">
                Administra hasta 7 empresas independientes con sus propios logos, cuentas bancarias y monedas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Administrator / Company Tabs (Up to 7) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600" />
                Empresas / Administradores de Renta ({administrators.length}/7)
              </label>
              {administrators.length < 7 && (
                <button
                  type="button"
                  onClick={handleAddNewAdmin}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Empresa
                </button>
              )}
            </div>

            {/* Tabs List */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {administrators.map((admin, idx) => {
                const isActive = admin.id === currentAdmin.id;
                return (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => setActiveAdminId(admin.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-800 dark:text-sky-200 shadow-xs ring-1 ring-sky-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {admin.logoUrl ? (
                      <img
                        src={admin.logoUrl}
                        alt="Logo"
                        className="w-4 h-4 rounded-full object-contain bg-white"
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="truncate max-w-[130px]">
                      {admin.companyName || `Empresa ${idx + 1}`}
                    </span>
                    <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                      {admin.currencySymbol || '$'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Administrator Card */}
          <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-sky-600 text-white text-[10px] font-black rounded-md">
                  Editando Empresa
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {currentAdmin.companyName || 'Empresa Administradora'}
                </h3>
              </div>

              {administrators.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAdminToDelete(currentAdmin.id)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition"
                  title="Eliminar esta empresa"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar Empresa
                </button>
              )}
            </div>

            {/* Logo Upload Section for this company */}
            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Logotipo de la Empresa (Timbre)
                </span>
                {currentAdmin.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Quitar Logo
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4">
                {currentAdmin.logoUrl ? (
                  <div className="w-16 h-16 rounded-xl border-2 border-slate-300 dark:border-slate-600 p-1 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={currentAdmin.logoUrl}
                      alt="Logo Empresa"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-1 text-center text-[9px] shrink-0 bg-white/50">
                    <Upload className="w-5 h-5 mb-0.5 text-slate-400" />
                    Sin Logo
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Sube el logo de esta empresa para sus facturas, recibos y avisos de cobro.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id={`logo-file-input-${currentAdmin.id}`}
                  />
                  <label
                    htmlFor={`logo-file-input-${currentAdmin.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" /> Subir Imagen de Logo
                  </label>
                  <span className="block text-[10px] text-slate-400">
                    PNG, JPG o SVG (máx. 2MB)
                  </span>
                </div>
              </div>
            </div>

            {/* Company Details Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de la Empresa o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={currentAdmin.companyName}
                  onChange={(e) => updateCurrentAdmin({ companyName: e.target.value })}
                  placeholder="Ej: Inmobiliaria & Arrendamientos Premier"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Propietario o Representante
                </label>
                <input
                  type="text"
                  value={currentAdmin.landlordName}
                  onChange={(e) => updateCurrentAdmin({ landlordName: e.target.value })}
                  placeholder="Ej: Ing. Alejandro Morales"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  RFC / Identificación Fiscal / Tax ID
                </label>
                <input
                  type="text"
                  value={currentAdmin.taxId}
                  onChange={(e) => updateCurrentAdmin({ taxId: e.target.value })}
                  placeholder="Ej: IAP-920415-XYZ o DNI / Cédula"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono de Contacto para Pagos
                </label>
                <input
                  type="tel"
                  value={currentAdmin.phone}
                  onChange={(e) => updateCurrentAdmin({ phone: e.target.value })}
                  placeholder="Ej: +52 55 4123 9876"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico para Recibir Notificaciones
                </label>
                <input
                  type="email"
                  value={currentAdmin.email}
                  onChange={(e) => updateCurrentAdmin({ email: e.target.value })}
                  placeholder="Ej: pagos@inmobiliaria.com"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección de la Empresa / Oficina
                </label>
                <input
                  type="text"
                  value={currentAdmin.address}
                  onChange={(e) => updateCurrentAdmin({ address: e.target.value })}
                  placeholder="Ej: Av. Reforma 1240, Piso 5, CDMX"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* CURRENCY SELECTION SECTION */}
            <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-sky-600" />
                    Tipo de Moneda & Símbolo a Usar *
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    En facturas, recibos e informes solo aparecerá el símbolo monetario elegido.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-black shadow-xs">
                  Símbolo: {currentAdmin.currencySymbol || '$'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <select
                    value={currentAdmin.currencyCode || 'USD'}
                    onChange={(e) => handleCurrencySelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.symbol}) {c.region ? `• ${c.region}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">Rápidos:</span>
                  {CURRENCY_OPTIONS.slice(0, 5).map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCurrencySelect(c.code)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition shrink-0 cursor-pointer ${
                        currentAdmin.currencyCode === c.code
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {c.name} ({c.symbol})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bank Details for this company */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Datos Bancarios para Recibir Pagos de Renta de esta Empresa
              </label>
              <textarea
                rows={3}
                value={currentAdmin.bankDetails}
                onChange={(e) => updateCurrentAdmin({ bankDetails: e.target.value })}
                placeholder="Ej: Banco BBVA • Cuenta: 0123 4567 8901 • CLABE: 012 180 00123456789 0 • Beneficiario: Inmobiliaria Premier"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-400">
                Esta información bancaria aparecerá en las facturas, avisos y mensajes de WhatsApp enviados a los inquilinos de esta empresa.
              </span>
            </div>

            {/* Terms and Legal Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nota al Pie / Términos de la Factura
              </label>
              <textarea
                rows={2}
                value={currentAdmin.invoiceNote}
                onChange={(e) => updateCurrentAdmin({ invoiceNote: e.target.value })}
                placeholder="Ej: El pago debe realizarse dentro de los primeros días estipulados en contrato para evitar cargos por mora."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Delete Admin Modal Confirmation */}
          {adminToDelete && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> ¿Eliminar esta empresa administradora?
              </h4>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Las propiedades asignadas a esta empresa serán reasignadas automáticamente a la empresa principal para no perder su información ni pagos.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdminToDelete(null)}
                  className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAdmin}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          )}

          {/* Section: Google Drive Folder */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Carpeta o Enlace de Google Drive para Backups
            </label>
            <input
              type="text"
              value={googleDriveFolderId}
              onChange={(e) => setGoogleDriveFolderId(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/... o dejar vacío para Mi Unidad"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Section: Language */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-500" />
              {t.languageSectionTitle}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLang('es')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  selectedLang === 'es'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-300 dark:border-slate-700'
                }`}
              >
                Español
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang('en')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  selectedLang === 'en'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-300 dark:border-slate-700'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Section: Theme & Appearance */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-sky-500" />
                {t.themeSectionTitle}
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t.themeSectionDesc}
              </p>
            </div>
            <ThemeSelector
              currentTheme={selectedTheme}
              onThemeChange={(newTheme) => {
                setSelectedTheme(newTheme);
                applyThemeMode(newTheme);
                if (onThemeChange) {
                  onThemeChange(newTheme);
                }
              }}
              lang={currentLanguage}
              variant="cards"
            />
          </div>

          {/* Push Notifications Section */}
          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  {t.pushNotificationsTitle}
                </h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  {t.pushNotificationsDesc}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifEnabled}
                  onChange={(e) => setNotifEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {notifEnabled && (
              <div className="space-y-3 pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                      <Laptop className="w-3.5 h-3.5 text-slate-500" />
                      Dispositivo actual:
                    </span>
                    {permissionStatus === 'granted' ? (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Permisos Concedidos
                      </span>
                    ) : permissionStatus === 'denied' ? (
                      <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px] rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Bloqueado en Navegador
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-full">
                        Permiso Pendiente
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {permissionStatus !== 'granted' && (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[11px] transition shadow-xs"
                      >
                        Activar Notificaciones
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg text-[11px] transition"
                    >
                      Probar Notificación Ahora
                    </button>
                  </div>
                </div>

                {testNotificationFeedback && (
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                    {testNotificationFeedback}
                  </p>
                )}

                <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 dark:text-slate-200">
                      Anticipación para recordar enviar factura:
                    </label>
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold rounded-md">
                      {daysBeforeRentDue} días antes
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="range"
                      min={1}
                      max={15}
                      value={daysBeforeRentDue}
                      onChange={(e) => setDaysBeforeRentDue(Number(e.target.value))}
                      className="flex-1 accent-amber-500 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={daysBeforeRentDue}
                      onChange={(e) => setDaysBeforeRentDue(Number(e.target.value))}
                      className="w-14 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold text-xs"
                    />
                    <span className="text-slate-500 text-xs">días</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={notifyOnDueDay}
                      onChange={(e) => setNotifyOnDueDay(e.target.checked)}
                      className="rounded-sm text-amber-600 focus:ring-amber-500"
                    />
                    Recordatorio el día exacto de cobro
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={notifyOnOverdue}
                      onChange={(e) => setNotifyOnOverdue(e.target.checked)}
                      className="rounded-sm text-amber-600 focus:ring-amber-500"
                    />
                    Alerta de retraso si no ha pagado
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Subscription & Plans Section */}
          <div className="p-3.5 bg-gradient-to-r from-slate-50 via-sky-50/50 to-slate-50 dark:from-slate-800/80 dark:via-slate-850 dark:to-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  {currentLanguage === 'en' ? 'License & Subscription Plan' : 'Licencia y Plan de Suscripción'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {subscriptionState?.isLifetime
                    ? (currentLanguage === 'en' ? 'Lifetime VIP Account (Unrestricted access)' : 'Cuenta Vitalicia VIP (Acceso permanente sin costo)')
                    : subscriptionState?.status === 'active'
                    ? (currentLanguage === 'en' ? 'Active Paid Subscription' : 'Suscripción de Pago Activa')
                    : subscriptionState?.status === 'trial'
                    ? (currentLanguage === 'en' ? `6-Week Trial (${subscriptionState.daysRemainingInTrial} days remaining)` : `Prueba de 6 Semanas (Quedan ${subscriptionState.daysRemainingInTrial} días)`)
                    : (currentLanguage === 'en' ? '6-Week Trial Expired' : 'Periodo de Prueba de 6 Semanas Finalizado')}
                </p>
              </div>

              {onOpenSubscriptionModal && (
                <button
                  type="button"
                  onClick={onOpenSubscriptionModal}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                >
                  {currentLanguage === 'en' ? 'Manage Plan' : 'Ver Planes'}
                </button>
              )}
            </div>
          </div>

          {/* Supabase Backend Integration (Database & Security) - Exclusivo para desarrollador / VIP */}
          {isLifetimeVip([profile.email, profile.googleDriveAccountEmail, googleDriveAccountEmail]) && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 dark:from-emerald-950/20 dark:via-slate-850 dark:to-slate-800/80 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      {currentLanguage === 'en' ? 'Supabase Backend & PostgreSQL' : 'Backend en Supabase (PostgreSQL & RLS)'}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                          isSupabaseConfigured()
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isSupabaseConfigured()
                          ? currentLanguage === 'en'
                            ? 'Connected'
                            : 'Conectado'
                          : currentLanguage === 'en'
                          ? 'Not configured'
                          : 'No configurado'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {currentLanguage === 'en'
                        ? 'Protected server verification for subscriptions, VIP accounts, and database sync.'
                        : 'Validación en servidor para suscripciones, cuentas VIP y base de datos protegida.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSupabaseOpen(!isSupabaseOpen)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  {isSupabaseOpen
                    ? currentLanguage === 'en'
                      ? 'Hide'
                      : 'Ocultar'
                    : currentLanguage === 'en'
                    ? 'Configure'
                    : 'Configurar'}
                </button>
              </div>

              {isSupabaseOpen && (
                <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 space-y-3">
                  <div className="grid grid-cols-1 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Server className="w-3 h-3 text-emerald-600" /> SUPABASE_URL
                      </label>
                      <input
                        type="url"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="https://xyzcompany.supabase.co"
                        className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Key className="w-3 h-3 text-emerald-600" /> SUPABASE_ANON_KEY (Public Key)
                      </label>
                      <input
                        type="password"
                        value={supabaseAnonKey}
                        onChange={(e) => setSupabaseAnonKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {currentLanguage === 'en'
                          ? 'Safe for frontend & GitHub. Row-level security enforces access rules.'
                          : 'Seguro para el frontend público y GitHub. La base de datos está blindada con RLS.'}
                      </p>
                    </div>
                  </div>

                  {supabaseFeedback && (
                    <div
                      className={`p-2 rounded-lg text-xs ${
                        supabaseFeedback.success
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200'
                      }`}
                    >
                      {supabaseFeedback.message}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSupabase}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      {currentLanguage === 'en' ? 'Save Credentials' : 'Guardar Credenciales'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={supabaseTesting || !supabaseUrl}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {supabaseTesting
                        ? currentLanguage === 'en'
                          ? 'Testing...'
                          : 'Probando...'
                        : currentLanguage === 'en'
                        ? 'Test Server RPC'
                        : 'Probar Conexión RPC'}
                    </button>

                    {isSupabaseConfigured() && (
                      <button
                        type="button"
                        onClick={handleSyncToSupabase}
                        disabled={supabaseSyncing}
                        className="px-3 py-1.5 bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 text-sky-800 dark:text-sky-200 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${supabaseSyncing ? 'animate-spin' : ''}`} />
                        {supabaseSyncing
                          ? currentLanguage === 'en'
                            ? 'Syncing...'
                            : 'Sincronizando...'
                          : currentLanguage === 'en'
                          ? 'Sync App Data'
                          : 'Sincronizar a Supabase'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Backup & Restore Data */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-500" /> {t.backupAndRestore}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Guarda tus propiedades, empresas administradoras, inquilinos y recibos en un archivo de respaldo seguro.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> {t.downloadBackupJson}
              </button>

              <input
                type="file"
                ref={jsonImportRef}
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
                id="json-import-input"
              />
              <label
                htmlFor="json-import-input"
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t.restoreBackupJson}
              </label>
            </div>
            {importStatus && (
              <p className="text-xs text-emerald-600 font-semibold mt-1.5">{importStatus}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Guardar Cambios de Empresas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
