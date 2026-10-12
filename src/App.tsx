import React, { useState, useEffect } from 'react';
import { Property, Payment, LandlordProfile, PropertyFinancialStatus, Administrator } from './types';
import {
  loadProperties,
  saveProperties,
  loadPayments,
  savePayments,
  loadLandlordProfile,
  saveLandlordProfile,
  loadAdministrators,
  saveAdministrators,
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
import { PropertyFormModal } from './components/PropertyFormModal';
import { PaymentModal } from './components/PaymentModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal';
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
import { initAuth } from './utils/firebaseAuth';
import { ThemeMode, getSavedThemeMode, applyThemeMode, subscribeToSystemThemeChanges } from './utils/theme';
import { ThemeSelector } from './components/ThemeSelector';
import {
  Building2,
  Calendar,
  DollarSign,
  Bell,
  FileSpreadsheet,
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
} from 'lucide-react';

export default function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<LandlordProfile>(loadLandlordProfile());
  const [administrators, setAdministrators] = useState<Administrator[]>([]);

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
  const [activeTab, setActiveTab] = useState<'properties' | 'tracking' | 'reminders' | 'report'>('properties');

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

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<PropertyFinancialStatus | null>(null);
  const [invoiceMode, setInvoiceMode] = useState<'current' | 'next_month' | 'payment_receipt'>('current');
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);

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
    setProfile({ ...loadLandlordProfile() });
    setAdministrators([...loadAdministrators()]);
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
    let updated = [...payments];
    for (const p of listToSave) {
      const idx = updated.findIndex((item) => item.id === p.id);
      if (idx >= 0) {
        updated[idx] = p;
      } else {
        updated = [p, ...updated];
      }
    }
    setPayments(updated);
    savePayments(updated);
  };

  const handleDeletePayment = (paymentId: string) => {
    const updated = payments.filter((p) => p.id !== paymentId);
    setPayments(updated);
    savePayments(updated);
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

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-16 md:pb-6">
      {/* Top Application Header */}
      <header className="no-print sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt="Logo Empresa"
                className="w-10 h-10 object-contain rounded-xl bg-white p-0.5 shadow-xs border border-slate-700 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            )}

            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight flex items-center gap-1.5 leading-tight">
                <span>{t.appTitle}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-sky-500/20 text-sky-400 font-semibold rounded-md border border-sky-500/30">
                  {t.androidWeb}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-xs sm:max-w-md">
                {profile.companyName}
              </p>
            </div>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />

            {/* Theme Selector (Claro / Oscuro / Equipo) */}
            <div className="hidden sm:inline-flex">
              <ThemeSelector
                currentTheme={themeMode}
                onThemeChange={handleThemeChange}
                lang={currentLang}
                variant="segmented"
              />
            </div>
            <div className="sm:hidden">
              <ThemeSelector
                currentTheme={themeMode}
                onThemeChange={handleThemeChange}
                lang={currentLang}
                variant="compact"
              />
            </div>

            {/* Language Quick Switcher */}
            <button
              onClick={() => handleLanguageChange(currentLang === 'es' ? 'en' : 'es')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span className="uppercase">{currentLang === 'es' ? 'ES' : 'EN'}</span>
            </button>

            {/* Subscription & Plan Status Pill */}
            <button
              type="button"
              onClick={() => setIsSubscriptionModalOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer border ${
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

            {/* Google Drive Direct Sync Button */}
            <button
              onClick={() => setIsGoogleDriveModalOpen(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
              title="Sincronizar y respaldar con Google Drive"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Drive</span>
            </button>

            {/* Notifications Pill */}
            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                totalAlerts > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title={`${totalAlerts} ${t.pendingAlerts}`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{totalAlerts}</span>
            </button>

            {/* Company & Timbre Settings */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center gap-1"
              title="Configuración de logotipo y datos fiscales"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">{t.logoTimbre}</span>
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
            administrators={administrators}
            onAddProperty={handleOpenNewProperty}
            onEditProperty={handleEditProperty}
            onDeleteProperty={handleDeleteProperty}
            onOpenInvoice={handleOpenInvoice}
            onRegisterPayment={handleOpenPayment}
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
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex justify-around items-center text-[10px] font-medium text-slate-400 shadow-lg">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
            activeTab === 'properties' ? 'text-sky-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <Building2 className="w-5 h-5 mb-0.5" />
          <span>{currentLang === 'es' ? 'Propiedades' : 'Properties'}</span>
        </button>

        <button
          onClick={() => setActiveTab('tracking')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
            activeTab === 'tracking' ? 'text-sky-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-5 h-5 mb-0.5" />
          <span>{currentLang === 'es' ? 'Seguimiento' : 'Tracking'}</span>
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition relative ${
            activeTab === 'reminders' ? 'text-sky-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <Bell className="w-5 h-5 mb-0.5" />
          <span>{currentLang === 'es' ? 'Alertas' : 'Alerts'}</span>
          {totalAlerts > 0 && (
            <span className="absolute top-0.5 right-1 w-2 h-2 bg-amber-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
            activeTab === 'report' ? 'text-sky-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5 mb-0.5" />
          <span>{currentLang === 'es' ? 'Reporte' : 'Report'}</span>
        </button>

        <button
          onClick={() => setIsGoogleDriveModalOpen(true)}
          className="flex flex-col items-center py-1 px-2 rounded-lg transition hover:text-slate-200 text-sky-400"
        >
          <Cloud className="w-5 h-5 mb-0.5" />
          <span>Drive</span>
        </button>

        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex flex-col items-center py-1 px-2 rounded-lg transition hover:text-slate-200"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span>{currentLang === 'es' ? 'Ajustes' : 'Config'}</span>
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
    </div>
  );
}
