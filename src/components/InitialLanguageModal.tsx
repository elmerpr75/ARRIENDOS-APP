import React, { useState } from 'react';
import { SupportedLanguage, setOnboardingCompleted } from '../utils/i18n';
import {
  ThemeMode,
  applyThemeMode,
  getSavedThemeMode,
  resolveThemeIsDark,
} from '../utils/theme';
import {
  Globe,
  Check,
  Bell,
  FileText,
  Cloud,
  ArrowRight,
  Building2,
  Mail,
  Coins,
  Clock,
  Sparkles,
  CheckCircle2,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';

export interface OnboardingRegistrationData {
  lang: SupportedLanguage;
  companyName: string;
  landlordName: string;
  email: string;
  currencyCode: string;
  currencySymbol: string;
  useSampleData: boolean;
  themeMode?: ThemeMode;
}

interface InitialLanguageModalProps {
  isOpen: boolean;
  currentLang: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onClose: () => void;
  onCompleteRegistration?: (data: OnboardingRegistrationData) => void;
}

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', name: 'Dólar Estadounidense ($ USD)' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano ($ MXN)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€ EUR)' },
  { code: 'COP', symbol: '$', name: 'Peso Colombiano ($ COP)' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano (S/ PEN)' },
  { code: 'CLP', symbol: '$', name: 'Peso Chileno ($ CLP)' },
  { code: 'ARS', symbol: '$', name: 'Peso Argentino ($ ARS)' },
];

export const InitialLanguageModal: React.FC<InitialLanguageModalProps> = ({
  isOpen,
  currentLang,
  onSelectLanguage,
  onClose,
  onCompleteRegistration,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(currentLang);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(() => getSavedThemeMode());

  // Step 2 Form fields
  const [companyName, setCompanyName] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCY_OPTIONS[0]);
  const [useSampleData, setUseSampleData] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEn = selectedLang === 'en';
  const isDark = resolveThemeIsDark(selectedTheme);

  const inputStyle: React.CSSProperties = isDark
    ? {
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        WebkitTextFillColor: '#f8fafc',
        caretColor: '#38bdf8',
        borderColor: '#475569',
      }
    : {
        backgroundColor: '#ffffff',
        color: '#0f172a',
        WebkitTextFillColor: '#0f172a',
        caretColor: '#0284c7',
        borderColor: '#cbd5e1',
      };

  const handleThemeChange = (mode: ThemeMode) => {
    setSelectedTheme(mode);
    applyThemeMode(mode);
  };

  const handleNextToRegistration = () => {
    onSelectLanguage(selectedLang);
    applyThemeMode(selectedTheme);
    setStep(2);
  };

  const handleFinishOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError(
        isEn
          ? 'Please enter a valid email address to link your account and trial.'
          : 'Por favor ingresa un correo electrónico válido para registrar tu cuenta y prueba gratuita.'
      );
      return;
    }

    setFormError(null);
    onSelectLanguage(selectedLang);
    applyThemeMode(selectedTheme);
    setOnboardingCompleted();

    if (onCompleteRegistration) {
      onCompleteRegistration({
        lang: selectedLang,
        companyName: companyName.trim() || (isEn ? 'Property Management' : 'Inmobiliaria & Arrendamientos'),
        landlordName: landlordName.trim() || companyName.trim() || (isEn ? 'Property Owner' : 'Propietario / Administrador'),
        email: cleanEmail.toLowerCase(),
        currencyCode: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        useSampleData,
        themeMode: selectedTheme,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 my-auto text-slate-900 dark:text-slate-100">
        {step === 1 ? (
          /* STEP 1: Idioma y Tema Visual */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-amber-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                <Globe className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Configuración Inicial / Initial Setup
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Paso 1 de 2: Idioma y Apariencia Visual<br />
                  <span className="italic">Step 1 of 2: Language & Visual Appearance</span>
                </p>
              </div>
            </div>

            {/* Language Selection Buttons */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {isEn ? '1. Select Language:' : '1. Selecciona tu Idioma:'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedLang('es')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ${
                    selectedLang === 'es'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🇪🇸</span>
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Español
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Predeterminado
                      </p>
                    </div>
                  </div>
                  {selectedLang === 'es' && (
                    <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLang('en')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ${
                    selectedLang === 'en'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🇺🇸</span>
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        English
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Translation
                      </p>
                    </div>
                  </div>
                  {selectedLang === 'en' && (
                    <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Theme Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {isEn ? '2. Appearance Theme:' : '2. Apariencia Visual (Claro / Oscuro):'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    selectedTheme === 'light'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px]">{isEn ? 'Light' : 'Claro'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    selectedTheme === 'dark'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-[11px]">{isEn ? 'Dark' : 'Oscuro'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    selectedTheme === 'system'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <Laptop className="w-4 h-4 text-slate-500" />
                  <span className="text-[11px]">{isEn ? 'System' : 'Sistema'}</span>
                </button>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px]">
                  {selectedLang === 'es'
                    ? 'Notificaciones push en Android y Windows con 5 días de anticipación'
                    : 'Native push notifications in Android & Windows with 5-day advance notice'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="text-[11px]">
                  {selectedLang === 'es'
                    ? 'Facturas y recibos PDF listos para imprimir y enviar por WhatsApp'
                    : 'Official PDF invoices & receipts ready to print and send via WhatsApp'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-[11px]">
                  {selectedLang === 'es'
                    ? 'Sincronización y respaldo en tu propia nube de Google Drive'
                    : 'Synchronization & cloud backup to your own Google Drive'}
                </span>
              </div>
            </div>

            {/* Next Button */}
            <button
              type="button"
              onClick={handleNextToRegistration}
              className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span>{selectedLang === 'es' ? 'Continuar al Registro' : 'Continue to Registration'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* STEP 2: Registro de Usuario y Comienzo de Prueba de 6 Semanas */
          <form onSubmit={handleFinishOnboarding} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-tr from-sky-600 to-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {isEn ? 'Start Your 6-Week Free Trial' : 'Activar Prueba Gratuita (42 Días)'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isEn
                      ? 'All features included. No card required.'
                      : 'Todas las funciones incluidas. Sin tarjeta.'}
                  </p>
                </div>
              </div>

              {/* Quick Theme Toggle directly inside Step 2 */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  title={isEn ? 'Light Theme' : 'Tema Claro'}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    selectedTheme === 'light'
                      ? 'bg-white text-amber-600 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  title={isEn ? 'Dark Theme' : 'Tema Oscuro'}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    selectedTheme === 'dark'
                      ? 'bg-slate-700 text-sky-400 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  title={isEn ? 'Device Theme' : 'Tema según el Sistema'}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    selectedTheme === 'system'
                      ? 'bg-sky-500 text-white shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5 text-sky-500" />
                  {isEn ? 'Administrator Email Address *' : 'Correo Electrónico del Administrador *'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isEn ? 'your-email@example.com' : 'tu-correo@ejemplo.com'}
                  style={inputStyle}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border-2 focus:ring-2 focus:ring-sky-500 font-semibold transition"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {isEn
                    ? 'Identifies your account and validates your 6-week trial and licensing.'
                    : 'Identifica tu cuenta, valida tus 42 días de prueba gratuita y respalda tus licencias.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-sky-500" />
                    {isEn ? 'Company / Brand Name' : 'Nombre o Empresa Arrendadora'}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={isEn ? 'e.g. Skyline Rentals' : 'ej. Mis Arriendos'}
                    style={inputStyle}
                    className="w-full px-3 py-2 text-xs rounded-xl border-2 focus:ring-2 focus:ring-sky-500 font-medium transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-500" />
                    {isEn ? 'Working Currency' : 'Moneda de Cobro'}
                  </label>
                  <select
                    value={selectedCurrency.code}
                    onChange={(e) => {
                      const found = CURRENCY_OPTIONS.find((c) => c.code === e.target.value);
                      if (found) setSelectedCurrency(found);
                    }}
                    style={inputStyle}
                    className="w-full px-3 py-2 text-xs rounded-xl border-2 focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer transition"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option
                        key={c.code}
                        value={c.code}
                        style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a' }}
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Data Toggle */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {isEn ? 'Initial Properties Data:' : 'Propiedades Iniciales:'}
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setUseSampleData(true)}
                    className={`flex-1 p-2.5 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                      useSampleData
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 font-semibold text-sky-900 dark:text-sky-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{isEn ? 'Include 2 sample properties' : 'Cargar 2 propiedades de ejemplo'}</span>
                    {useSampleData && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseSampleData(false)}
                    className={`flex-1 p-2.5 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                      !useSampleData
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 font-semibold text-sky-900 dark:text-sky-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{isEn ? 'Start with empty clean account' : 'Empezar cuenta en blanco (vacía)'}</span>
                    {!useSampleData && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {isEn ? 'Back' : 'Atrás'}
              </button>

              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>
                  {isEn ? 'Activate 6-Week Free Trial' : 'Comenzar Prueba Gratuita (42 Días)'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
