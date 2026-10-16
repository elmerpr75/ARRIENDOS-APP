import React, { useState, useEffect } from 'react';
import { Property, Payment, LandlordProfile, PropertyFinancialStatus, Administrator, Expense } from './types';
import {
  loadProperties,
  saveProperties,
  loadPayments,
  savePayments,
  loadLandlordProfile,
  saveLandlordProfile,
  loadAdministrators,
  saveAdministrators,
  loadExpenses,
  saveExpenses,
  loadExpenseCategories,
  saveExpenseCategories,
  getAdministratorForProperty,
  exportAppData,
} from './utils/storage';
import { calculatePropertyStatus } from './utils/calculations';
import { checkAndTriggerAutomatedReminders } from './utils/notifications';
import {
  SupportedLanguage,
  getSavedLanguage,
  saveLanguage,
  hasCompletedOnboarding,
  translations,
} from './utils/i18n';
import { PropertiesListView } from './components/PropertiesListView';
import { TrackingView } from './components/TrackingView';
import { RemindersView } from './components/RemindersView';
import { StatusReportView } from './components/StatusReportView';
import { AccountingAuditView } from './components/AccountingAuditView';
import { PropertyExpensesModal } from './components/PropertyExpensesModal';
import { PropertyFormModal } from './components/PropertyFormModal';
import { PaymentModal } from './components/PaymentModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { SessionLockScreen } from './components/SessionLockScreen';
import { InitialLanguageModal, OnboardingRegistrationData } from './components/InitialLanguageModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SubscriptionModal } from './components/SubscriptionModal';
import { SupabaseConnectModal } from './components/SupabaseConnectModal';
import { isSupabaseConfigured } from './utils/supabase';
import {
  SubscriptionState,
  getSubscriptionState,
  syncSubscriptionWithServer,
  resetTrialStartDate,
} from './utils/subscription';
import { initAuth, logout, getAccessToken, googleSignIn } from './utils/firebaseAuth';
import { uploadBackupToDrive, extractFolderId } from './utils/googleDrive';
import { isAppSessionLocked, lockAppSession, unlockAppSession } from './utils/sessionLock';
import { ThemeMode, getSavedThemeMode, applyThemeMode, subscribeToSystemThemeChanges } from './utils/theme';
import { ThemeSelector } from './components/ThemeSelector';
import {
  Building2,
  Calendar,
  DollarSign,
  Bell,
  FileSpreadsheet,
  Scale,
  Settings,
  PlusCircle,
  FileText,
  Cloud,
  Globe,
  Crown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  Database,
  LogOut,
} from 'lucide-react';

export default function App() {
  const [properties, setProperties] = useState<Property[]>(() => loadProperties());
  const [payments, setPayments] = useState<Payment[]>(() => loadPayments());
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => loadExpenseCategories());
  const [profile, setProfile] = useState<LandlordProfile>(() => loadLandlordProfile());
  const [administrators, setAdministrators] = useState<Administrator[]>(() => loadAdministrators());

  // Internationalization state
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getSavedLanguage());
  const [showInitialOnboarding, setShowInitialOnboarding] = useState(false);
  const t = translations[currentLang];

  // Theme mode state ('light' | 'dark' | 'system')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedThemeMode());

  useEffect(() => {
    applyThemeMode(themeMode);
    const unsubscribe = subscribeToSystemThemeChanges();
    return () => unsubscribe();
  }, [themeMode]);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setThemeMode(newTheme);
    applyThemeMode(newTheme);
  };

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'properties' | 'tracking' | 'audit' | 'reminders' | 'report'>('properties');

  // Modals
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentDefaults, setPaymentDefaults] = useState<{
    propertyId?: string;
    payerName?: string;
    amount?: number;
  }>({});

  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
  const [selectedPropertyForExpenses, setSelectedPropertyForExpenses] = useState<Property | null>(null);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<PropertyFinancialStatus | null>(null);
  const [invoiceMode, setInvoiceMode] = useState<'current' | 'next_month' | 'payment_receipt'>('current');
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(() => isAppSessionLocked());
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [logoutNotice, setLogoutNotice] = useState<{
    type: 'gdrive_success' | 'local_success' | 'fallback_warning' | 'none';
    fileName?: string;
  } | null>(null);

  // Listen to Google/Firebase auth for user email (silent VIP recognition)
  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      if (user?.email) {
        setAuthUserEmail(user.email);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const subscriptionEmails = React.useMemo(() => {
    return [
      authUserEmail,
      profile.email,
      profile.googleDriveAccountEmail,
      ...administrators.map((a) => a.email),
    ].filter((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0));
  }, [authUserEmail, profile.email, profile.googleDriveAccountEmail, administrators]);

  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(() =>
    getSubscriptionState(subscriptionEmails)
  );

  useEffect(() => {
    // 1. Initial immediate state
    setSubscriptionState(getSubscriptionState(subscriptionEmails));

    // 2. Asynchronously verify against Supabase backend
    let isMounted = true;
    syncSubscriptionWithServer(subscriptionEmails).then((remoteState) => {
      if (isMounted) {
        setSubscriptionState(remoteState);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [subscriptionEmails]);

  const handleSubscriptionUpdated = () => {
    setSubscriptionState(getSubscriptionState(subscriptionEmails));
    syncSubscriptionWithServer(subscriptionEmails).then((remoteState) => {
      setSubscriptionState(remoteState);
    });
  };

  // Initialize data from storage and check onboarding
  useEffect(() => {
    setProperties(loadProperties());
    setPayments(loadPayments());
    setProfile(loadLandlordProfile());
    setAdministrators(loadAdministrators());
    setCurrentLang(getSavedLanguage());

    // Check if initial language selection has happened
    if (!hasCompletedOnboarding()) {
      setShowInitialOnboarding(true);
    }
  }, []);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setCurrentLang(newLang);
    saveLanguage(newLang);
  };

  const handleCompleteRegistration = (data: OnboardingRegistrationData) => {
    // 1. Set language
    handleLanguageChange(data.lang);

    // 2. Start the 42-day trial clock from right now
    resetTrialStartDate(new Date());

    // 3. Update profile with user's company and email
    const updatedProfile: LandlordProfile = {
      ...profile,
      companyName: data.companyName,
      landlordName: data.landlordName,
      email: data.email,
      currencyCode: data.currencyCode,
      currencySymbol: data.currencySymbol,
      themeMode: data.themeMode,
      googleDriveAccountEmail: '',
    };
    if (data.themeMode) {
      applyThemeMode(data.themeMode);
      setThemeMode(data.themeMode);
    }
    setProfile(updatedProfile);
    saveLandlordProfile(updatedProfile);

    // 4. Update administrator
    const updatedAdmin: Administrator = {
      id: 'admin-1',
      companyName: data.companyName,
      landlordName: data.landlordName,
      taxId: '',
      phone: '',
      email: data.email,
      address: '',
      bankDetails: '',
      invoiceNote: 'El pago debe realizarse dentro de los primeros días estipulados en contrato.',
      currencyCode: data.currencyCode,
      currencySymbol: data.currencySymbol,
      isDefault: true,
    };
    setAdministrators([updatedAdmin]);
    saveAdministrators([updatedAdmin]);

    // 5. Handle sample properties vs blank slate
    if (!data.useSampleData) {
      setProperties([]);
      saveProperties([]);
      setPayments([]);
      savePayments([]);
    } else {
      setProperties(loadProperties());
      setPayments(loadPayments());
    }

    // 6. Recalculate subscription state for this user's email
    const userEmails = [data.email];
    setSubscriptionState(getSubscriptionState(userEmails));
    syncSubscriptionWithServer(userEmails).then((remoteState) => {
      setSubscriptionState(remoteState);
    });

    setShowInitialOnboarding(false);
  };

  // Automated Push Notification trigger check on startup and periodically (Windows & Android)
  // Only active during trial or with active/lifetime subscription
  useEffect(() => {
    if (properties.length > 0 && subscriptionState.canUseFullFeatures) {
      checkAndTriggerAutomatedReminders(properties, payments, profile);
    }
    const timer = setInterval(() => {
      if (properties.length > 0 && subscriptionState.canUseFullFeatures) {
        checkAndTriggerAutomatedReminders(properties, payments, profile);
      }
    }, 30 * 60 * 1000); // Check every 30 minutes
    return () => clearInterval(timer);
  }, [properties, payments, profile, subscriptionState.canUseFullFeatures]);

  // Reload data helper
  const reloadData = () => {
    setProperties([...loadProperties()]);
    setPayments([...loadPayments()]);
    setExpenses([...loadExpenses()]);
    setExpenseCategories([...loadExpenseCategories()]);
    setProfile({ ...loadLandlordProfile() });
    setAdministrators([...loadAdministrators()]);
  };

  // Expense handlers
  const handleOpenExpenses = (property: Property) => {
    setSelectedPropertyForExpenses(property);
    setIsExpensesModalOpen(true);
  };

  const handleSaveExpense = (savedExpense: Expense) => {
    setExpenses((prev) => {
      const exists = prev.some((e) => e.id === savedExpense.id);
      const updated = exists
        ? prev.map((e) => (e.id === savedExpense.id ? savedExpense : e))
        : [savedExpense, ...prev];
      saveExpenses(updated);
      return updated;
    });
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== expenseId);
      saveExpenses(updated);
      return updated;
    });
  };

  const handleAddExpenseCategory = (newCategoryName: string) => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setExpenseCategories((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      saveExpenseCategories(updated);
      return updated;
    });
  };

  // Sign out, backup, and lock session handlers
  const handleConfirmLogout = async (backupChoice: 'gdrive' | 'local' | 'none') => {
    // 1. Force flush all current in-memory state to persistent storage first
    // This ensures exportAppData() reads the latest data without losing anything.
    saveProperties(properties);
    savePayments(payments);
    saveExpenses(expenses);
    saveExpenseCategories(expenseCategories);
    saveLandlordProfile(profile);
    saveAdministrators(administrators);

    const dateStr = new Date().toISOString().split('T')[0];
    const triggerLocalDownload = (prefix = 'arriendos-respaldo') => {
      const fileName = `${prefix}-${dateStr}.json`;
      try {
        const dataStr = exportAppData();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('Local download fallback error:', err);
      }
      return fileName;
    };

    if (backupChoice === 'local') {
      const savedName = triggerLocalDownload('arriendos-respaldo');
      setLogoutNotice({ type: 'local_success', fileName: savedName });
    } else if (backupChoice === 'gdrive') {
      let token = await getAccessToken();
      let driveUploaded = false;

      if (!token) {
        try {
          const signResult = await googleSignIn();
          if (signResult?.accessToken) {
            token = signResult.accessToken;
            setAuthUserEmail(signResult.user.email);
          }
        } catch (authErr: any) {
          console.warn('Google sign-in popup error / blocked:', authErr);
        }
      }

      if (token) {
        try {
          const backupContent = exportAppData();
          const cleanFolder = extractFolderId(profile.googleDriveFolderId || '');
          await uploadBackupToDrive(token, backupContent, cleanFolder);
          driveUploaded = true;
          setLogoutNotice({ type: 'gdrive_success' });
        } catch (uploadErr: any) {
          console.warn('Google drive upload error during logout:', uploadErr);
          // If token was expired or 401, attempt fresh re-authentication once
          if (uploadErr?.message?.includes('AUTH_EXPIRED') || uploadErr?.message?.includes('401')) {
            try {
              const signResult = await googleSignIn();
              if (signResult?.accessToken) {
                token = signResult.accessToken;
                setAuthUserEmail(signResult.user.email);
                const backupContent = exportAppData();
                const cleanFolder = extractFolderId(profile.googleDriveFolderId || '');
                await uploadBackupToDrive(token, backupContent, cleanFolder);
                driveUploaded = true;
                setLogoutNotice({ type: 'gdrive_success' });
              }
            } catch (reauthErr) {
              console.warn('Re-auth retry failed during logout:', reauthErr);
            }
          }
        }
      }

      // If Google Drive backup could not be completed:
      // Automatically download the local JSON copy so user data is NEVER lost!
      if (!driveUploaded) {
        const savedName = triggerLocalDownload('arriendos-respaldo-seguridad');
        setLogoutNotice({ type: 'fallback_warning', fileName: savedName });
      }
    } else {
      setLogoutNotice(null);
    }

    try {
      await logout();
    } catch (e) {
      console.warn('Logout notice:', e);
    }
    setAuthUserEmail(null);
    lockAppSession();
    setIsSessionLocked(true);
    setIsLogoutModalOpen(false);
  };

  const handleUnlockSession = (authenticatedEmail?: string) => {
    unlockAppSession();
    setIsSessionLocked(false);
    setLogoutNotice(null);
    if (authenticatedEmail) {
      setAuthUserEmail(authenticatedEmail);
      const checkEmails = [
        authenticatedEmail,
        profile.email,
        profile.googleDriveAccountEmail,
        ...administrators.map((a) => a.email),
      ].filter((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0));
      setSubscriptionState(getSubscriptionState(checkEmails));
      syncSubscriptionWithServer(checkEmails).then((remoteState) => {
        setSubscriptionState(remoteState);
      });
    }
    reloadData();
  };

  // Property handlers
  const handleSaveProperty = (savedProp: Property) => {
    let updated: Property[];
    const exists = properties.some((p) => p.id === savedProp.id);
    if (exists) {
      updated = properties.map((p) => (p.id === savedProp.id ? savedProp : p));
    } else {
      updated = [savedProp, ...properties];
    }
    setProperties(updated);
    saveProperties(updated);
  };

  const handleDeleteProperty = (propertyId: string) => {
    const updated = properties.filter((p) => p.id !== propertyId);
    setProperties(updated);
    saveProperties(updated);
  };

  const handleUpdatePropertyAdministrator = (propertyId: string, administratorId: string) => {
    const updated = properties.map((p) =>
      p.id === propertyId ? { ...p, administratorId } : p
    );
    setProperties(updated);
    saveProperties(updated);
  };

  const handleUpdatePropertyUtilities = (
    propertyId: string,
    waterAmount: number,
    electricAmount: number,
    waterActive?: boolean,
    electricActive?: boolean
  ) => {
    const updated = properties.map((p) => {
      if (p.id !== propertyId) return p;
      return {
        ...p,
        utilitiesWaterAmount: waterAmount,
        utilitiesElectricAmount: electricAmount,
        utilitiesWaterActive: waterActive !== undefined ? waterActive : p.utilitiesWaterActive,
        utilitiesElectricActive: electricActive !== undefined ? electricActive : p.utilitiesElectricActive,
      };
    });
    setProperties(updated);
    saveProperties(updated);
  };

  const handleOpenReceipt = (payment: Payment) => {
    setIsPaymentModalOpen(false);
    const prop = properties.find((p) => p.id === payment.propertyId);
    if (!prop) return;
    const status = calculatePropertyStatus(prop, payments);
    setSelectedInvoiceStatus(status);
    setSelectedReceiptPayment(payment);
    setInvoiceMode('payment_receipt');
    setIsInvoiceModalOpen(true);
  };

  // Payment handlers
  const handleSavePayment = (savedPayment: Payment | Payment[]) => {
    const listToSave = Array.isArray(savedPayment) ? savedPayment : [savedPayment];
    setPayments((prev) => {
      // Merge with latest disk state to ensure no concurrent writes or previous payments are lost
      const diskPayments = loadPayments();
      const map = new Map<string, Payment>();
      diskPayments.forEach((p) => map.set(p.id, p));
      prev.forEach((p) => map.set(p.id, p));
      listToSave.forEach((p) => map.set(p.id, p));
      const updated = Array.from(map.values()).sort(
        (a, b) => (b.date || '').localeCompare(a.date || '')
      );
      savePayments(updated);
      return updated;
    });
  };

  const handleDeletePayment = (paymentId: string) => {
    setPayments((prev) => {
      const diskPayments = loadPayments();
      const filtered = diskPayments.filter((p) => p.id !== paymentId);
      savePayments(filtered);
      return filtered;
    });
  };

  const handleEditPayment = (payment: Payment) => {
    setPaymentDefaults({});
    setEditingPayment(payment);
    setIsPaymentModalOpen(true);
  };

  // Profile handler
  const handleSaveProfile = (updatedProfile: LandlordProfile) => {
    setProfile(updatedProfile);
    saveLandlordProfile(updatedProfile);
    if (updatedProfile.themeMode) {
      setThemeMode(updatedProfile.themeMode);
      applyThemeMode(updatedProfile.themeMode);
    }
  };

  // Action helpers
  const handleOpenNewProperty = () => {
    setEditingProperty(null);
    setIsPropertyModalOpen(true);
  };

  const handleEditProperty = (prop: Property) => {
    setEditingProperty(prop);
    setIsPropertyModalOpen(true);
  };

  const handleOpenPayment = (propertyId?: string, payerName?: string, amount?: number) => {
    setEditingPayment(null);
    setPaymentDefaults({ propertyId, payerName, amount });
    setIsPaymentModalOpen(true);
  };

  const handleOpenInvoice = (status: PropertyFinancialStatus, mode: 'current' | 'next_month' = 'current') => {
    setSelectedInvoiceStatus(status);
    setInvoiceMode(mode);
    setIsInvoiceModalOpen(true);
  };

  // Alerts counter
  const allStatuses = properties.map((p) => calculatePropertyStatus(p, payments));
  const contractAlerts = allStatuses.filter((s) => s.contractDaysLeft <= 60).length;
  const overdueAlerts = allStatuses.filter((s) => s.isOverdue).length;
  const totalAlerts = contractAlerts + overdueAlerts;

  // If the session has been closed/locked, display the secure unlock/login screen
  if (isSessionLocked) {
    return (
      <SessionLockScreen
        profile={profile}
        administrators={administrators}
        currentLang={currentLang}
        logoutNotice={logoutNotice}
        onUnlockSuccess={handleUnlockSession}
        onResetForNewUser={() => {
          unlockAppSession();
          setIsSessionLocked(false);
          setLogoutNotice(null);
          setShowInitialOnboarding(true);
        }}
        onDataRestored={reloadData}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-20 md:pb-6 overflow-x-hidden w-full max-w-full">
      {/* Top Application Header */}
      <header className="no-print sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-sm w-full max-w-full overflow-x-clip">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3 w-full">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt="Logo Empresa"
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-xl bg-white p-0.5 shadow-xs border border-slate-700 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-bold tracking-tight flex items-center gap-1 sm:gap-1.5 leading-tight truncate">
                <span className="truncate">{t.appTitle}</span>
                <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 bg-sky-500/20 text-sky-400 font-semibold rounded-md border border-sky-500/30 shrink-0">
                  {t.androidWeb}
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block truncate max-w-xs sm:max-w-md">
                {profile.companyName}
              </p>
            </div>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton />

            {/* Theme Selector (Claro / Oscuro / Equipo) - Desktop & Tablet */}
            <div className="hidden sm:inline-flex">
              <ThemeSelector
                currentTheme={themeMode}
                onThemeChange={handleThemeChange}
                lang={currentLang}
                variant="segmented"
              />
            </div>

            {/* Language Quick Switcher */}
            <button
              onClick={() => handleLanguageChange(currentLang === 'es' ? 'en' : 'es')}
              className="px-2 py-1.5 sm:px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              title={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="uppercase text-[11px] sm:text-xs">{currentLang === 'es' ? 'ES' : 'EN'}</span>
            </button>

            {/* Subscription & Plan Status Pill */}
            <button
              type="button"
              onClick={() => setIsSubscriptionModalOpen(true)}
              className={`px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 shadow-xs cursor-pointer border ${
                subscriptionState.isLifetime
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  : subscriptionState.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  : subscriptionState.status === 'trial'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25'
                  : 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30 animate-pulse'
              }`}
              title={
                subscriptionState.isLifetime
                  ? (currentLang === 'en' ? 'Lifetime VIP Account - Permanent access' : 'Cuenta Vitalicia VIP - Acceso permanente')
                  : subscriptionState.status === 'active'
                  ? (currentLang === 'en' ? 'Active Paid Plan' : 'Plan de Pago Activo')
                  : subscriptionState.status === 'trial'
                  ? (currentLang === 'en' ? `6-Week Trial: ${subscriptionState.daysRemainingInTrial} days remaining` : `Prueba de 6 Semanas: Quedan ${subscriptionState.daysRemainingInTrial} días`)
                  : (currentLang === 'en' ? 'Trial Expired - Activate Plan' : 'Prueba Vencida - Activar Plan')
              }
            >
              {subscriptionState.isLifetime ? (
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : subscriptionState.status === 'active' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : subscriptionState.status === 'trial' ? (
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {subscriptionState.isLifetime
                  ? (currentLang === 'en' ? 'VIP' : 'VIP Vitalicio')
                  : subscriptionState.status === 'active'
                  ? (subscriptionState.plan === 'annual' ? (currentLang === 'en' ? 'Annual' : 'Plan Anual') : (currentLang === 'en' ? 'Monthly' : 'Plan Mensual'))
                  : subscriptionState.status === 'trial'
                  ? (currentLang === 'en' ? `Trial: ${subscriptionState.daysRemainingInTrial}d` : `Prueba: ${subscriptionState.daysRemainingInTrial}d`)
                  : (currentLang === 'en' ? 'Subscribe' : 'Activar Plan')}
              </span>
            </button>

            {/* Google Drive Direct Sync Button (Desktop & Tablet only - on mobile it is in bottom nav & settings) */}
            <button
              onClick={() => setIsGoogleDriveModalOpen(true)}
              className="hidden sm:flex px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition shadow-xs items-center gap-1.5 cursor-pointer"
              title="Sincronizar y respaldar con Google Drive"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </button>

            {/* Notifications Pill */}
            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-1 px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                totalAlerts > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title={`${totalAlerts} ${t.pendingAlerts}`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>{totalAlerts}</span>
            </button>

            {/* Company & Timbre Settings (Desktop & Tablet only - on mobile it is in bottom nav) */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="hidden md:flex p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 items-center gap-1 cursor-pointer"
              title="Configuración de logotipo y datos fiscales"
            >
              <Settings className="w-4 h-4" />
              <span>{t.logoTimbre}</span>
            </button>

            {/* Logout / Exit App & Lock Session */}
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="px-2.5 py-1.5 sm:p-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={currentLang === 'en' ? 'Sign out and protect access' : 'Cerrar sesión y proteger acceso'}
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
              <span className="text-[11px] sm:text-xs">{currentLang === 'en' ? 'Exit' : 'Salir'}</span>
            </button>
          </div>
        </div>

        {/* Desktop / Tablet Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 hidden md:flex items-center gap-1 border-t border-slate-800/80 py-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('properties')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'properties'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{t.tabProperties} ({properties.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tracking')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'tracking'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{t.tabTracking}</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'audit'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Libro de contabilidad segregado: Rentas, utilidades, moras y penalizaciones con exportación a PDF"
          >
            <Scale className="w-4 h-4" />
            <span>{t.tabAudit}</span>
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition relative ${
              activeTab === 'reminders'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>{t.tabReminders}</span>
            {totalAlerts > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full text-[10px]">
                {totalAlerts}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'report'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t.tabReports}</span>
          </button>
        </div>
      </header>

      {/* Main App Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'properties' && (
          <PropertiesListView
            properties={properties}
            payments={payments}
            expenses={expenses}
            administrators={administrators}
            onAddProperty={handleOpenNewProperty}
            onEditProperty={handleEditProperty}
            onDeleteProperty={handleDeleteProperty}
            onOpenInvoice={handleOpenInvoice}
            onRegisterPayment={handleOpenPayment}
            onOpenExpenses={handleOpenExpenses}
            onEditPayment={handleEditPayment}
            onUpdatePropertyAdministrator={handleUpdatePropertyAdministrator}
            onUpdatePropertyUtilities={handleUpdatePropertyUtilities}
            onOpenReceipt={handleOpenReceipt}
          />
        )}

        {activeTab === 'tracking' && (
          <TrackingView
            properties={properties}
            payments={payments}
            administrators={administrators}
            onOpenPaymentModal={handleOpenPayment}
            onEditPayment={handleEditPayment}
            onDeletePayment={handleDeletePayment}
            onOpenInvoice={handleOpenInvoice}
          />
        )}

        {activeTab === 'audit' && (
          <AccountingAuditView
            properties={properties}
            payments={payments}
            expenses={expenses}
            expenseCategories={expenseCategories}
            administrators={administrators}
            profile={profile}
            onOpenInvoice={handleOpenInvoice}
            onRegisterPayment={handleOpenPayment}
            canExportCode={subscriptionState.canExportCode}
          />
        )}

        {activeTab === 'reminders' && (
          <RemindersView
            properties={properties}
            payments={payments}
            profile={profile}
            onOpenInvoice={handleOpenInvoice}
            onEditProperty={handleEditProperty}
            onRegisterPayment={handleOpenPayment}
            onSaveProfile={handleSaveProfile}
            subscriptionState={subscriptionState}
            onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
          />
        )}

        {activeTab === 'report' && (
          <StatusReportView
            properties={properties}
            payments={payments}
            profile={profile}
            administrators={administrators}
            onOpenInvoice={handleOpenInvoice}
          />
        )}
      </main>

      {/* Android Style Bottom Navigation Bar for Mobile (Hidden on Desktop & Print) */}
      {/* Android/Mobile Bottom Navigation Bar (Horizontally scrollable with smooth touch scrolling) */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 shadow-2xl px-2 py-1.5 flex items-center justify-start overflow-x-auto scrollbar-none touch-pan-x text-[10px] font-medium text-slate-400 gap-1.5 select-none pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <button
          onClick={() => setActiveTab('properties')}
          className={`shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition ${
            activeTab === 'properties' ? 'text-sky-400 font-bold bg-sky-500/15 border border-sky-500/30' : 'hover:text-slate-200'
          }`}
        >
          <Building2 className="w-5 h-5 mb-0.5 shrink-0" />
          <span>{currentLang === 'es' ? 'Propiedades' : 'Properties'}</span>
        </button>

        <button
          onClick={() => setActiveTab('tracking')}
          className={`shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition ${
            activeTab === 'tracking' ? 'text-sky-400 font-bold bg-sky-500/15 border border-sky-500/30' : 'hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-5 h-5 mb-0.5 shrink-0" />
          <span>{currentLang === 'es' ? 'Cobranza' : 'Tracking'}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition ${
            activeTab === 'audit' ? 'text-sky-400 font-bold bg-sky-500/15 border border-sky-500/30' : 'hover:text-slate-200'
          }`}
        >
          <Scale className="w-5 h-5 mb-0.5 shrink-0" />
          <span>{currentLang === 'es' ? 'Libro' : 'Ledger'}</span>
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition relative ${
            activeTab === 'reminders' ? 'text-sky-400 font-bold bg-sky-500/15 border border-sky-500/30' : 'hover:text-slate-200'
          }`}
        >
          <Bell className="w-5 h-5 mb-0.5 shrink-0" />
          <span>{currentLang === 'es' ? 'Alertas' : 'Alerts'}</span>
          {totalAlerts > 0 && (
            <span className="absolute top-0.5 right-2 w-2 h-2 bg-amber-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition ${
            activeTab === 'report' ? 'text-sky-400 font-bold bg-sky-500/15 border border-sky-500/30' : 'hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5 mb-0.5 shrink-0" />
          <span>{currentLang === 'es' ? 'Reporte' : 'Report'}</span>
        </button>

        <button
          onClick={() => setIsGoogleDriveModalOpen(true)}
          className="shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition hover:text-slate-200 text-sky-400 cursor-pointer"
        >
          <Cloud className="w-5 h-5 mb-0.5 shrink-0" />
          <span>Drive</span>
        </button>

        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="shrink-0 min-w-[58px] flex flex-col items-center py-1 px-1.5 rounded-xl transition hover:text-slate-200 cursor-pointer"
        >
          <Settings className="w-5 h-5 mb-0.5 shrink-0" />
          <span>{currentLang === 'es' ? 'Ajustes' : 'Config'}</span>
        </button>

        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="shrink-0 min-w-[64px] flex flex-col items-center py-1 px-2 rounded-xl transition bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 font-bold cursor-pointer"
          title={currentLang === 'en' ? 'Sign out' : 'Cerrar sesión'}
        >
          <LogOut className="w-5 h-5 mb-0.5 shrink-0 text-rose-400" />
          <span>{currentLang === 'en' ? 'Exit' : 'Salir'}</span>
        </button>
      </nav>

      {/* Initial Bilingual Onboarding Language Selection Modal */}
      <InitialLanguageModal
        isOpen={showInitialOnboarding}
        currentLang={currentLang}
        onSelectLanguage={handleLanguageChange}
        onClose={() => setShowInitialOnboarding(false)}
        onCompleteRegistration={handleCompleteRegistration}
      />

      {/* Modals */}
      <PropertyFormModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        onSave={handleSaveProperty}
        initialProperty={editingProperty}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setEditingPayment(null);
        }}
        onSavePayment={handleSavePayment}
        properties={properties}
        payments={payments}
        administrators={administrators}
        initialPayment={editingPayment}
        defaultPropertyId={paymentDefaults.propertyId}
        defaultPayerName={paymentDefaults.payerName}
        defaultAmount={paymentDefaults.amount}
        onDeletePayment={handleDeletePayment}
        onViewReceipt={handleOpenReceipt}
      />

      {selectedInvoiceStatus && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoiceStatus(null);
            setSelectedReceiptPayment(null);
          }}
          status={selectedInvoiceStatus}
          profile={profile}
          administrators={administrators}
          allPayments={payments}
          initialMode={invoiceMode}
          initialSpecificPayment={selectedReceiptPayment}
          onUpdatePropertyUtilities={handleUpdatePropertyUtilities}
          currentLanguage={currentLang}
          subscriptionState={subscriptionState}
          onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        />
      )}

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        onDataReload={reloadData}
        currentLanguage={currentLang}
        onLanguageChange={handleLanguageChange}
        currentTheme={themeMode}
        onThemeChange={handleThemeChange}
        subscriptionState={subscriptionState}
        onOpenSubscriptionModal={() => {
          setIsProfileModalOpen(false);
          setIsSubscriptionModalOpen(true);
        }}
        onOpenGoogleDriveModal={() => {
          setIsProfileModalOpen(false);
          setIsGoogleDriveModalOpen(true);
        }}
      />

      <GoogleDriveBackupModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
        folderIdOrUrl={profile.googleDriveFolderId || ''}
        userEmail={authUserEmail || profile.googleDriveAccountEmail || profile.email}
        currentLanguage={currentLang}
        onUpdateFolderId={(newFolderId) => {
          const updatedProfile = { ...profile, googleDriveFolderId: newFolderId };
          setProfile(updatedProfile);
          saveLandlordProfile(updatedProfile);
        }}
        onDataRestored={reloadData}
      />

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        subscriptionState={subscriptionState}
        userEmail={
          authUserEmail ||
          profile.googleDriveAccountEmail ||
          profile.email ||
          ''
        }
        onSubscriptionUpdated={handleSubscriptionUpdated}
        currentLanguage={currentLang}
      />

      <SupabaseConnectModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        userEmails={subscriptionEmails}
        currentLanguage={currentLang}
        onConnectionSuccess={handleSubscriptionUpdated}
      />

      {selectedPropertyForExpenses && (
        <PropertyExpensesModal
          isOpen={isExpensesModalOpen}
          onClose={() => {
            setIsExpensesModalOpen(false);
            setSelectedPropertyForExpenses(null);
          }}
          property={selectedPropertyForExpenses}
          expenses={expenses}
          expenseCategories={expenseCategories}
          admin={getAdministratorForProperty(selectedPropertyForExpenses, administrators)}
          onSaveExpense={handleSaveExpense}
          onDeleteExpense={handleDeleteExpense}
          onAddCategory={handleAddExpenseCategory}
          currentLang={currentLang}
        />
      )}

      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirmLogout={handleConfirmLogout}
        isGoogleDriveConnected={Boolean(authUserEmail || profile.googleDriveAccountEmail)}
        connectedGoogleEmail={authUserEmail || profile.googleDriveAccountEmail}
        userEmail={profile.email}
        folderInput={profile.googleDriveFolderId}
        currentLang={currentLang}
      />
    </div>
  );
}
