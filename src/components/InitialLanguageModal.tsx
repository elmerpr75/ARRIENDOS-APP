import React, { useState } from 'react';
import { SupportedLanguage, setOnboardingCompleted } from '../utils/i18n';
import { Globe, Check, Bell, FileText, Cloud, ArrowRight, ShieldCheck } from 'lucide-react';

interface InitialLanguageModalProps {
  isOpen: boolean;
  currentLang: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onClose: () => void;
}

export const InitialLanguageModal: React.FC<InitialLanguageModalProps> = ({
  isOpen,
  currentLang,
  onSelectLanguage,
  onClose,
}) => {
  const [selected, setSelected] = useState<SupportedLanguage>(currentLang);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelectLanguage(selected);
    setOnboardingCompleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Bilingual Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-sky-500 to-amber-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <Globe className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Configuración Inicial / Initial Setup
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Selecciona tu idioma preferido para comenzar<br />
              <span className="italic">Select your preferred language to get started</span>
            </p>
          </div>
        </div>

        {/* Language Selection Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected('es')}
            className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-center justify-between ${
              selected === 'es'
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
            {selected === 'es' && (
              <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSelected('en')}
            className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-center justify-between ${
              selected === 'en'
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
            {selected === 'en' && (
              <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
            )}
          </button>
        </div>

        {/* Feature Highlights Bilingual */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-2 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {selected === 'es'
                ? 'Notificaciones push en Android y Windows con 5 días de anticipación'
                : 'Native push notifications in Android & Windows with 5-day advance notice'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-500 shrink-0" />
            <span>
              {selected === 'es'
                ? 'Facturas y recibos PDF listos para imprimir y enviar por WhatsApp'
                : 'Official PDF invoices & receipts ready to print and send via WhatsApp'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {selected === 'es'
                ? 'Sincronización y respaldo en tu propia nube de Google Drive'
                : 'Synchronization & cloud backup to your own Google Drive'}
            </span>
          </div>
        </div>

        {/* Confirm Action Button */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-sm"
          >
            <span>
              {selected === 'es' ? 'Continuar en Español' : 'Continue in English'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-center text-slate-400">
            {selected === 'es'
              ? 'Puedes cambiar el idioma en cualquier momento en el menú superior o en Configuración.'
              : 'You can change the language anytime from the top bar or Settings.'}
          </p>
        </div>
      </div>
    </div>
  );
};
