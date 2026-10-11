import React, { useState } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  Crown,
  Sparkles,
  Lock,
  Calendar,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Info,
  Clock,
  ArrowRight,
  Server,
} from 'lucide-react';
import {
  SubscriptionState,
  SUBSCRIPTION_PRICING,
  activateSubscription,
  cancelSubscription,
} from '../utils/subscription';
import { SupportedLanguage } from '../utils/i18n';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionState: SubscriptionState;
  userEmail?: string;
  onSubscriptionUpdated: () => void;
  currentLanguage?: SupportedLanguage;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  subscriptionState,
  userEmail = '',
  onSubscriptionUpdated,
  currentLanguage = 'es',
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [emailInput, setEmailInput] = useState(userEmail);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEn = currentLanguage === 'en';
  const { status, daysRemainingInTrial, totalTrialDays, elapsedTrialDays, isLifetime } =
    subscriptionState;

  const handleActivate = () => {
    setIsProcessing(true);
    setTimeout(() => {
      activateSubscription(selectedPlan, emailInput.trim() || userEmail);
      setIsProcessing(false);
      setSuccessMessage(
        isEn
          ? `✓ Successfully activated ${selectedPlan === 'annual' ? 'Annual Plan ($187.20/yr)' : 'Monthly Plan ($17.85/mo)'}!`
          : `✓ ¡Plan ${selectedPlan === 'annual' ? 'Anual ($187.20/año)' : 'Mensual ($17.85/mes)'} activado con éxito!`
      );
      onSubscriptionUpdated();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1800);
    }, 600);
  };

  const handleCancel = () => {
    if (
      window.confirm(
        isEn
          ? 'Are you sure you want to cancel the active subscription?'
          : '¿Estás seguro de cancelar la suscripción activa?'
      )
    ) {
      cancelSubscription();
      onSubscriptionUpdated();
      onClose();
    }
  };

  const progressPercent = Math.min(100, Math.round((elapsedTrialDays / totalTrialDays) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[96vh] flex flex-col animate-fadeIn">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-md">
              {isLifetime ? <Crown className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {isEn ? 'Plans & Usage License' : 'Planes y Licencia de Uso'}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-slate-400">
                  {isEn
                    ? 'Rent Manager • 6-Week Free Trial & Flexible Pricing'
                    : 'Rent Manager • 6 Semanas de Prueba Gratuita y Planes Flexibles'}
                </p>
                {subscriptionState.isServerVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Server className="w-2.5 h-2.5 text-emerald-400" />
                    {isEn ? 'Supabase Backend Active' : 'Backend Supabase Activo'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title={isEn ? 'Close' : 'Cerrar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0 text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
          {/* Status Banner */}
          {isLifetime ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border border-amber-400/30 flex items-start gap-3">
              <Crown className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-amber-900 dark:text-amber-200 text-sm block">
                  {isEn ? 'Lifetime VIP Account Authorized' : 'Cuenta Vitalicia VIP Autorizada'}
                </span>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  {isEn
                    ? `This account (${userEmail || 'Developer'}) has permanent, lifetime access to 100% of features at no cost.`
                    : `Esta cuenta (${userEmail || 'Desarrollador'}) cuenta con acceso permanente y vitalicio al 100% de las funciones sin costo.`}
                </p>
              </div>
            </div>
          ) : status === 'trial' ? (
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5 text-sm">
                  <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  {isEn
                    ? `Free Trial Active (${daysRemainingInTrial} days left)`
                    : `Prueba Gratuita de 6 Semanas Activa (Quedan ${daysRemainingInTrial} días)`}
                </span>
                <span className="px-2 py-0.5 bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200 rounded-md text-[11px] font-bold">
                  {isEn ? `Day ${elapsedTrialDays} of 42` : `Día ${elapsedTrialDays} de 42`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-sky-800 dark:text-sky-300">
                {isEn
                  ? 'All features (WhatsApp delivery, Email, PDF creation, and push notifications) are completely free during your 6-week trial.'
                  : 'Todas las funciones (WhatsApp, Email, PDFs y notificaciones push) están 100% activas y sin costo durante tus 6 semanas de prueba.'}
              </p>
            </div>
          ) : status === 'active' ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 text-sm block">
                    {isEn ? 'Active Subscription' : 'Suscripción Activa'} (
                    {subscriptionState.plan === 'annual'
                      ? isEn
                        ? 'Annual Plan'
                        : 'Plan Anual'
                      : isEn
                      ? 'Monthly Plan'
                      : 'Plan Mensual'}
                    )
                  </span>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    {isEn
                      ? `Valid until ${new Date(subscriptionState.expiryDate || '').toLocaleDateString()}. Full access enabled.`
                      : `Válida hasta el ${new Date(subscriptionState.expiryDate || '').toLocaleDateString()}. Todas las funciones desbloqueadas.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 font-semibold hover:underline"
              >
                {isEn ? 'Cancel Plan' : 'Cancelar Plan'}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {isEn
                    ? '6-Week Free Trial Has Ended'
                    : 'El Periodo de Prueba de 6 Semanas ha Finalizado'}
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {isEn
                  ? 'To continue using automated push reminders, WhatsApp and email document dispatch, PDF creation, and printing, please choose one of the advance payment plans below.'
                  : 'Para continuar utilizando recordatorios push automáticos, envío de facturas/recibos por WhatsApp y Email, creación de PDF e impresión, acójase a uno de los planes de pago por adelantado.'}
              </p>
              <div className="p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 border border-amber-200/50 dark:border-amber-800/50">
                🛡️{' '}
                <strong>
                  {isEn ? 'Your data is 100% safe:' : 'Tu información está siempre protegida:'}
                </strong>{' '}
                {isEn
                  ? 'You can always record received payments, view financial balances on screen, and perform Google Drive backup/restoration at no cost.'
                  : 'Siempre podrás registrar pagos recibidos (+ Pago), consultar balances en pantalla y hacer respaldos/restauraciones en Google Drive sin costo adicional.'}
              </div>
            </div>
          )}

          {/* Pricing Plans Selection */}
          {!isLifetime && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                {isEn ? 'Choose Your Advance Payment Plan' : 'Elige tu Plan de Pago por Adelantado'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Plan 1: Mensual */}
                <div
                  onClick={() => setSelectedPlan('monthly')}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    selectedPlan === 'monthly'
                      ? 'border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {isEn ? 'Monthly Plan' : 'Plan Mensual'}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedPlan === 'monthly'
                            ? 'border-sky-600 bg-sky-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {selectedPlan === 'monthly' && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        ${SUBSCRIPTION_PRICING.monthly.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {isEn ? 'USD / month' : 'USD / mes'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isEn
                        ? 'Pay month by month in advance. Cancel anytime.'
                        : 'Pago mensual por adelantado. Cancela en cualquier momento.'}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'Unlimited Invoices & Receipts' : 'Facturas y Recibos Ilimitados'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'WhatsApp & Email Delivery' : 'Envío por WhatsApp y Correo'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'PDF Creation & Direct Printing' : 'Creación de PDF e Impresión'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'Automated Push Notifications' : 'Recordatorios Push Nativos'}</span>
                    </li>
                  </ul>
                </div>

                {/* Plan 2: Anual (Destacado) */}
                <div
                  onClick={() => setSelectedPlan('annual')}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between relative ${
                    selectedPlan === 'annual'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-[10px] font-extrabold uppercase rounded-full shadow-xs tracking-wider">
                    {isEn ? 'Best Value • Save ~13%' : 'Mejor Opción • Ahorra ~13%'}
                  </span>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {isEn ? 'Annual Plan (Reduced)' : 'Plan Anual Reducido'}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedPlan === 'annual'
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {selectedPlan === 'annual' && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        ${SUBSCRIPTION_PRICING.annual.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {isEn ? 'USD / year' : 'USD / año'}
                      </span>
                    </div>

                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                      {isEn
                        ? `Equivalent to only $${SUBSCRIPTION_PRICING.monthlyEquivalentAnnual.toFixed(2)} USD/month by paying annually in advance.`
                        : `Equivalente a solo $${SUBSCRIPTION_PRICING.monthlyEquivalentAnnual.toFixed(2)} USD/mes al pagar el año adelantado.`}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'Full Year Coverage (365 days)' : 'Cobertura Anual Completa (365 días)'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'All Premium Functions Included' : 'Todas las funciones premium'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'Google Drive Cloud Sync' : 'Respaldo seguro en Google Drive'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{isEn ? 'Android & PC Desktop support' : 'Uso ilimitado en Android y PC'}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Email Assignment Input */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isEn ? 'License Email Account:' : 'Correo para vincular la licencia:'}
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="tu-correo@gmail.com"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              {/* Commercial Legal Note */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-[10px] text-slate-600 dark:text-slate-400 space-y-1 border border-slate-200 dark:border-slate-700/80 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    {isEn ? 'Pricing & Currency Terms:' : 'Términos de Facturación y Divisa:'}
                  </span>
                </div>
                <p>
                  {isEn
                    ? 'All amounts are calculated in United States Dollars (US$) or converted to local currency according to current exchange rates, subject to conversion fees and payment processor charges without affecting the developer net rate, except for applicable app store platform fees.'
                    : 'Todos los valores calculados en dólares de Estados Unidos (US$) o su conversión a moneda local según la tasa de cambio vigente, sujeta a cargos por conversión y servicios que el sistema de cobros imponga sin que afecte la tarifa a devengar por el desarrollador, salvo lo impuesto por la plataforma de la tienda de aplicaciones.'}
                </p>
              </div>

              {/* Action Button */}
              {successMessage ? (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold rounded-xl text-center">
                  {successMessage}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span>{isEn ? 'Processing...' : 'Procesando...'}</span>
                  ) : (
                    <>
                      <span>
                        {selectedPlan === 'annual'
                          ? isEn
                            ? `Activate Annual Plan ($${SUBSCRIPTION_PRICING.annual.toFixed(2)} USD / year)`
                            : `Activar Plan Anual ($${SUBSCRIPTION_PRICING.annual.toFixed(2)} USD / año)`
                          : isEn
                          ? `Activate Monthly Plan ($${SUBSCRIPTION_PRICING.monthly.toFixed(2)} USD / month)`
                          : `Activar Plan Mensual ($${SUBSCRIPTION_PRICING.monthly.toFixed(2)} USD / mes)`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{isEn ? 'Secured Cloud Licensing' : 'Licenciamiento Seguro'}</span>
          </div>

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
