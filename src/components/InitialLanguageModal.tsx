import React, { useState } from 'react';
import { SupportedLanguage, setOnboardingCompleted } from '../utils/i18n';
import {
  Globe,
  Check,
  Bell,
  FileText,
  Cloud,
  ArrowRight,
  ShieldCheck,
  Building2,
  Mail,
  Coins,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export interface OnboardingRegistrationData {
  lang: SupportedLanguage;
  companyName: string;
  landlordName: string;
  email: string;
  currencyCode: string;
  currencySymbol: string;
  useSampleData: boolean;
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

  // Step 2 Form fields
  const [companyName, setCompanyName] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCY_OPTIONS[0]);
  const [useSampleData, setUseSampleData] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEn = selectedLang === 'en';

  const handleNextToRegistration = () => {
    onSelectLanguage(selectedLang);
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
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 my-auto">
        {step === 1 ? (
          /* STEP 1: Idioma */
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
                  Paso 1 de 2: Selecciona tu idioma preferido<br />
                  <span className="italic">Step 1 of 2: Select your preferred language</span>
                </p>
              </div>
            </div>

            {/* Language Selection Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedLang('es')}
                className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ${
                  selectedLang === 'es'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇪🇸</span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      Español
                      <span className="text-[10px] px-2 py-0.5 bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 rounded-full font-bold">
                        Predeterminado
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Interfaz completa, recibos en español y formato regional
                    </p>
                  </div>
                </div>
                {selectedLang === 'es' && (
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedLang('en')}
                className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-center justify-between cursor-pointer ${
                  selectedLang === 'en'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇸</span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      English
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-bold">
                        Translation
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Full English user interface, invoices and notifications
                    </p>
                  </div>
                </div>
                {selectedLang === 'en' && (
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            </div>

            {/* Feature Highlights */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {selectedLang === 'es'
                    ? 'Notificaciones push en Android y Windows con 5 días de anticipación'
                    : 'Native push notifications in Android & Windows with 5-day advance notice'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                <span>
                  {selectedLang === 'es'
                    ? 'Facturas y recibos PDF listos para imprimir y enviar por WhatsApp'
                    : 'Official PDF invoices & receipts ready to print and send via WhatsApp'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
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
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-gradient-to-tr from-sky-600 to-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                <Clock className="w-7 h-7" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {isEn ? 'Start Your 6-Week Free Trial' : 'Activar Prueba Gratuita de 6 Semanas'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEn
                  ? '42 days with 100% of features included. No credit card required.'
                  : '42 días con el 100% de funciones incluidas sin costo. Sin tarjeta requerida.'}
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
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
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Data Toggle */}
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {isEn ? 'Initial Properties Data' : 'Propiedades Iniciales:'}
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setUseSampleData(true)}
                    className={`flex-1 p-2.5 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                      useSampleData
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 font-semibold text-sky-900 dark:text-sky-200'
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
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 font-semibold text-sky-900 dark:text-sky-200'
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
