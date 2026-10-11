import React, { useState, useEffect } from 'react';
import { Property, PropertyFinancialStatus, LandlordProfile, NotificationSettings } from '../types';
import { calculatePropertyStatus, formatCurrency, formatDate } from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import { openExternalUrl } from '../utils/pdfGenerator';
import {
  Bell,
  Calendar,
  FileText,
  Send,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Smartphone,
  Laptop,
  Sliders,
  AlertCircle,
  Clock,
  Sparkles,
  Volume2,
  Lock
} from 'lucide-react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendNativeNotification,
  getUpcomingInvoiceReminders,
  UpcomingInvoiceReminder,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../utils/notifications';
import { SubscriptionState } from '../utils/subscription';

interface RemindersViewProps {
  properties: Property[];
  payments: any[];
  profile: LandlordProfile;
  onEditProperty: (property: Property) => void;
  onOpenInvoice: (status: PropertyFinancialStatus, mode?: 'current' | 'next_month') => void;
  onRegisterPayment: (propertyId: string, payerName: string, amount: number) => void;
  onSaveProfile?: (profile: LandlordProfile) => void;
  subscriptionState?: SubscriptionState;
  onOpenSubscriptionModal?: () => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  properties,
  payments,
  profile,
  onEditProperty,
  onOpenInvoice,
  onRegisterPayment,
  onSaveProfile,
  subscriptionState,
  onOpenSubscriptionModal,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'upcoming_invoices' | 'contracts' | 'invoices'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    getNotificationSettings(profile)
  );
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermissionStatus());
  const [testNotificationFeedback, setTestNotificationFeedback] = useState<string | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus());
  }, []);

  // Update settings helper
  const handleUpdateSettings = (newSettings: NotificationSettings) => {
    setNotifSettings(newSettings);
    saveNotificationSettings(newSettings);
    if (onSaveProfile) {
      onSaveProfile({
        ...profile,
        notificationSettings: newSettings,
      });
    }
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      setTestNotificationFeedback('✓ ¡Permisos concedidos! Las alertas push están activas en este dispositivo.');
    } else if (res === 'denied') {
      setTestNotificationFeedback('⚠️ Las notificaciones están bloqueadas en la configuración de este navegador.');
    }
    setTimeout(() => setTestNotificationFeedback(null), 5000);
  };

  const handleSendTestNotification = async () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      setTestNotificationFeedback('⚠️ Las notificaciones push requieren un plan activo tras las 6 semanas de prueba.');
      setTimeout(() => setTestNotificationFeedback(null), 6000);
      return;
    }

    if (permissionStatus !== 'granted') {
      const res = await requestNotificationPermission();
      setPermissionStatus(res);
      if (res !== 'granted') {
        setTestNotificationFeedback('⚠️ Debes autorizar las notificaciones en este dispositivo para recibir alertas.');
        setTimeout(() => setTestNotificationFeedback(null), 5000);
        return;
      }
    }

    const testProp = properties[0];
    const tenantName = testProp?.tenant1?.name || 'Inquilino Ejemplo';
    const propName = testProp?.propertyIdentifier || 'Apto 101';
    const amount = testProp?.rentAmount || 12000;

    const success = await sendNativeNotification({
      title: `📄 Recordatorio: Enviar factura a ${tenantName}`,
      body: `Faltan ${notifSettings.daysBeforeRentDue} días para el 1er día de mes en ${propName} (${formatCurrency(amount)}). Envía la factura a tiempo.`,
    });

    if (success) {
      setTestNotificationFeedback('✓ Notificación de prueba enviada a la pantalla/barra de este dispositivo.');
    } else {
      setTestNotificationFeedback('⚠️ No se pudo desplegar la notificación. Verifica los permisos del navegador.');
    }

    setTimeout(() => setTestNotificationFeedback(null), 6000);
  };

  // 1. Calculate Upcoming Invoice Reminders within the configured anticipation window (e.g. 5 days before 1st of month)
  const upcomingWindowReminders = getUpcomingInvoiceReminders(properties, payments, notifSettings);

  // 2. Status for each property
  const propertyStatuses = properties.map((p) => calculatePropertyStatus(p, payments));

  // 3. Contract renewal reminders (contracts expiring in less than 60 days or expired)
  const renewalReminders = propertyStatuses
    .filter((s) => s.contractDaysLeft <= 60)
    .sort((a, b) => a.contractDaysLeft - b.contractDaysLeft);

  // 4. Invoice notification reminders (upcoming due dates or overdue)
  const invoiceReminders = propertyStatuses.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.totalPendingBalance - b.totalPendingBalance;
  });

  const cleanPhone = (phoneStr: string) => phoneStr.replace(/[^0-9]/g, '');

  const buildUpcomingInvoiceMessage = (reminder: UpcomingInvoiceReminder) => {
    const { property } = reminder;
    const admin = getAdministratorForProperty(property, profile.administrators);
    const daysText =
      reminder.daysRemaining === 0
        ? 'el día de hoy'
        : reminder.daysRemaining === 1
        ? 'el día de mañana'
        : `en ${reminder.daysRemaining} días (el ${formatDate(reminder.dueDateStr)})`;

    const waterAmt = property.utilitiesWaterActive ? Math.max(0, Number(property.utilitiesWaterAmount) || 0) : 0;
    const elecAmt = property.utilitiesElectricActive ? Math.max(0, Number(property.utilitiesElectricAmount) || 0) : 0;
    const utilitiesLastMonthTotal = waterAmt + elecAmt;
    // En el recordatorio de pago próximo NO se suma al total el costo de utilidades del mes anterior
    const totalToPay = property.rentAmount;

    const hasUtilities = property.utilitiesWaterActive || property.utilitiesElectricActive;
    let utilitiesReminderNote = '';
    if (hasUtilities) {
      const parts: string[] = [];
      if (property.utilitiesWaterActive && waterAmt > 0) parts.push(`Agua: ${formatCurrency(waterAmt, admin.currencySymbol)}`);
      if (property.utilitiesElectricActive && elecAmt > 0) parts.push(`LUMA / AEE: ${formatCurrency(elecAmt, admin.currencySymbol)}`);
      const breakdownText = parts.length > 0 ? ` (${parts.join(', ')})` : '';

      utilitiesReminderNote = `💡 *Nota sobre utilidades:* En la última factura recibida el costo de utilidades fue de ${formatCurrency(utilitiesLastMonthTotal, admin.currencySymbol)}${breakdownText}. El costo para este próximo ciclo variará según el consumo real. No se incluye en este total preliminar; tan pronto llegue la próxima factura de los proveedores se le indicará y agregará la cantidad exacta a pagar por dicho concepto.\n\n`;
    }

    return `📋 *RECORDATORIO DE FACTURA DE RENTA*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${reminder.tenantName}*, le saludamos cordialmente.

Le compartimos con anticipación los datos correspondientes a su renta del periodo *${reminder.period}*, con vencimiento ${daysText}:

🏠 *Inmueble:* ${property.propertyIdentifier}
🗓️ *Periodo:* ${reminder.period}
📅 *Fecha límite de pago:* ${formatDate(reminder.dueDateStr)}

💰 *DESGLOSE DE CARGOS:*
▪️ Renta convenida en contrato: ${formatCurrency(property.rentAmount, admin.currencySymbol)}
━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL PRELIMINAR A PAGAR: ${formatCurrency(totalToPay, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

${utilitiesReminderNote}🏦 *DATOS PARA TRANSFERENCIA O DEPÓSITO:*
${admin.bankDetails}

${admin.invoiceNote ? `ℹ️ *Términos:* ${admin.invoiceNote}\n\n` : ''}Agradecemos compartir su comprobante por este medio al realizar el pago.
¡Que tenga un excelente día!`;
  };

  const buildRenewalMessage = (status: PropertyFinancialStatus) => {
    const { property } = status;
    const admin = getAdministratorForProperty(property, profile.administrators);
    return `🏢 *RECORDATORIO DE RENOVACIÓN DE CONTRATO*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${property.tenant1.name}*, le saluda cordialmente ${admin.landlordName || admin.companyName}.

Le escribimos con respecto al contrato de arrendamiento del inmueble:
🏠 *Propiedad:* ${property.propertyIdentifier}
📍 *Dirección:* ${property.address}
📅 *Fecha de vencimiento:* ${formatDate(property.contractEndDate)} (${status.contractDaysLeft < 0 ? 'Contrato vencido' : `quedan ${status.contractDaysLeft} días`}).

Nos gustaría coordinar con usted la formalización de la renovación del contrato para el próximo periodo.

Quedamos a su disposición para acordar las condiciones y fecha de firma.
Saludos cordiales.`;
  };

  const buildPaymentNoticeMessage = (status: PropertyFinancialStatus) => {
    const { property } = status;
    const admin = getAdministratorForProperty(property, profile.administrators);
    if (status.isOverdue) {
      return `⚠️ *AVISO DE SALDO Y RECORDATORIO DE PAGO*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${property.tenant1.name}*, le saludamos de ${admin.companyName}.

Le informamos que al día de hoy presenta un saldo pendiente en su cuenta:
🏠 *Inmueble:* ${property.propertyIdentifier}
🗓️ *Periodo:* ${status.currentPeriod}
⏰ *Días de retraso:* ${status.daysOverdue} días

💰 *DESGLOSE DE SALDOS PENDIENTES:*
▪️ Renta contractual pendiente: ${formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
${property.utilitiesWaterActive ? `▪️ Utilidad de Agua pendiente: ${formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive ? `▪️ Utilidad Electricidad (LUMA/AEE) pendiente: ${formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}\n` : ''}${status.totalLateFees > 0 ? `🚨 Recargos por mora aplicados: ${formatCurrency(status.pendingLateFeesBalance, admin.currencySymbol)}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL PENDIENTE: ${formatCurrency(status.totalPendingBalance, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

🏦 *DATOS BANCARIOS PARA PAGO:*
${admin.bankDetails}

Agradecemos regularizar su pago a la brevedad y enviar su comprobante por este medio.`;
    } else {
      const graceDays = property.graceDays ?? 3;
      const [dueY, dueM, dueD] = status.dueDate.split('-').map(Number);
      const graceDate = new Date(dueY || new Date().getFullYear(), (dueM || 1) - 1, (dueD || property.rentDueDay || 1) + graceDays);
      const graceDateStr = `${graceDate.getFullYear()}-${String(graceDate.getMonth() + 1).padStart(2, '0')}-${String(graceDate.getDate()).padStart(2, '0')}`;

      // En el aviso previo de recordatorio SÍ se suma la renta a pagar, porque informa lo que deberá pagar una vez llegue su día de pago
      const totalUpcomingToPay = !status.isRentDueReached
        ? status.rentAmount + status.pendingUtilitiesBalance + status.previousBalance - status.paidRentThisMonth
        : status.totalPendingBalance;

      return `📋 *AVISO PREVIO & RECORDATORIO DE PAGO DE RENTA*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${property.tenant1.name}*, le saludamos cordialmente.

Le compartimos los datos de su programación de pago correspondiente al presente ciclo:
🏠 *Inmueble:* ${property.propertyIdentifier}
🗓️ *Periodo:* ${status.currentPeriod}
📅 *Fecha convenida de cobro:* ${formatDate(status.dueDate)} (Día ${property.rentDueDay} de cada mes)

💰 *DESGLOSE DE CARGOS:*
▪️ Renta convenida en contrato: ${formatCurrency(status.rentAmount, admin.currencySymbol)}${!status.isRentDueReached ? ` (Inicia el ${formatDate(status.dueDate)})` : ''}
${property.utilitiesWaterActive && status.waterAmount > 0 ? `▪️ Utilidad de Agua (Consumo según proveedor): ${formatCurrency(status.waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && status.electricAmount > 0 ? `▪️ Utilidad Electricidad LUMA/AEE (Consumo según proveedor): ${formatCurrency(status.electricAmount, admin.currencySymbol)}\n` : ''}${status.previousBalance > 0 ? `▪️ Saldos atrasados de meses anteriores: ${formatCurrency(status.previousBalance, admin.currencySymbol)}\n` : ''}${status.paidRentThisMonth > 0 ? `▪️ Abonos registrados: -${formatCurrency(status.paidRentThisMonth, admin.currencySymbol)}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL A PAGAR AL LLEGAR SU DÍA DE PAGO: ${formatCurrency(totalUpcomingToPay, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️ *Términos de Pago y Gracia:*
Su renta vence el *${formatDate(status.dueDate)}*. Cuenta con *${property.graceDays} días de gracia* para realizar su pago oportunamente sin cargos por demora hasta el *${formatDate(graceDateStr)}*.

🏦 *DATOS BANCARIOS PARA TRANSFERENCIA O DEPÓSITO:*
${admin.bankDetails}

${admin.invoiceNote ? `Nota: ${admin.invoiceNote}\n\n` : ''}Agradecemos como siempre su puntualidad y compartir su comprobante por este medio al realizar el pago.`;
    }
  };

  const sendWhatsAppMessage = (phoneStr: string, text: string) => {
    const phone = cleanPhone(phoneStr);
    openExternalUrl(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Trial Expired Warning Banner */}
      {subscriptionState && !subscriptionState.canUseFullFeatures && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                Periodo de prueba de 6 semanas concluido
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                Las alertas automáticas y recordatorios por notificación push requieren una suscripción activa ($17.85/mes o $187.20/año). La consulta visual de balances y alertas en pantalla continúa 100% activa.
              </p>
            </div>
          </div>
          {onOpenSubscriptionModal && (
            <button
              type="button"
              onClick={onOpenSubscriptionModal}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs shrink-0 transition shadow-xs cursor-pointer"
            >
              Activar Plan ($17.85/mes o $187.20/año)
            </button>
          )}
        </div>
      )}

      {/* 1. Header Banner with Quick Status & Notification Hub */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <Bell className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Centro de Recordatorios y Notificaciones Push
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alertas automáticas en Android y Windows para enviar facturas y renovar contratos
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <Smartphone className="w-3.5 h-3.5" />
              <Laptop className="w-3.5 h-3.5" />
              Push:
            </span>
            {permissionStatus === 'granted' ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Activo
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
              >
                Activar Permiso
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              showSettingsPanel
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configurar Días ({notifSettings.daysBeforeRentDue} días)</span>
          </button>
        </div>
      </div>

      {/* Expandable Notification Settings Bar */}
      {showSettingsPanel && (
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl border-2 border-amber-200 dark:border-amber-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-amber-200 dark:border-amber-800/60">
            <div>
              <h4 className="text-xs font-bold text-amber-950 dark:text-amber-100 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-600" />
                Ajuste de Notificaciones para Facturas de Renta
              </h4>
              <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-0.5">
                El sistema emitirá una notificación push en Windows y Android antes del primer día de mes de cada renta.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendTestNotification}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" /> Probar Notificación Ahora
            </button>
          </div>

          {testNotificationFeedback && (
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
              {testNotificationFeedback}
            </div>
          )}

          {/* Slider & Presets */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                ¿Con cuántos días de anticipación antes del 1er día de renta deseas el recordatorio?
              </span>
              <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold rounded-lg text-sm">
                {notifSettings.daysBeforeRentDue} días antes
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min={1}
                max={15}
                value={notifSettings.daysBeforeRentDue}
                onChange={(e) =>
                  handleUpdateSettings({
                    ...notifSettings,
                    daysBeforeRentDue: Number(e.target.value),
                  })
                }
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={notifSettings.daysBeforeRentDue}
                  onChange={(e) =>
                    handleUpdateSettings({
                      ...notifSettings,
                      daysBeforeRentDue: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-14 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold text-xs"
                />
                <span className="text-xs text-slate-500">días</span>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-400">Opciones rápidas:</span>
              {[2, 3, 5, 7, 10].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    handleUpdateSettings({
                      ...notifSettings,
                      daysBeforeRentDue: days,
                    })
                  }
                  className={`px-2.5 py-0.5 rounded-lg font-semibold transition ${
                    notifSettings.daysBeforeRentDue === days
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {days} días {days === 5 ? '(Recomendado)' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold gap-1">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg transition ${
            filterType === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Todos ({upcomingWindowReminders.length + renewalReminders.length + invoiceReminders.length})
        </button>

        <button
          onClick={() => setFilterType('upcoming_invoices')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            filterType === 'upcoming_invoices'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Próximas Facturas a Enviar ({upcomingWindowReminders.length})</span>
        </button>

        <button
          onClick={() => setFilterType('contracts')}
          className={`px-3 py-1.5 rounded-lg transition ${
            filterType === 'contracts'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Renovaciones de Contrato ({renewalReminders.length})
        </button>

        <button
          onClick={() => setFilterType('invoices')}
          className={`px-3 py-1.5 rounded-lg transition ${
            filterType === 'invoices'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Estado General de Cobro ({invoiceReminders.length})
        </button>
      </div>

      {/* PRIORITY SECTION: Upcoming Invoices in Anticipation Window (e.g. 5 days before 1st of month) */}
      {(filterType === 'all' || filterType === 'upcoming_invoices') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Facturas por Enviar en los Próximos {notifSettings.daysBeforeRentDue} Días
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Inquilinos cuya renta vence en la ventana de anticipación configurada ({notifSettings.daysBeforeRentDue} días antes de la fecha de renta)
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {upcomingWindowReminders.length} en ventana
            </span>
          </div>

          {upcomingWindowReminders.length === 0 ? (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 space-y-1 shadow-xs">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                ✓ No hay facturas de renta por vencer en los próximos {notifSettings.daysBeforeRentDue} días.
              </p>
              <p className="text-[11px] text-slate-400">
                Cuando falten {notifSettings.daysBeforeRentDue} días o menos para el 1er día de renta de cada inquilino, aparecerán aquí y recibirás la notificación push.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingWindowReminders.map((reminder) => {
                const { property } = reminder;
                const message = buildUpcomingInvoiceMessage(reminder);
                const isCopied = copiedId === `upcoming-${property.id}`;
                const matchedStatus = propertyStatuses.find((s) => s.property.id === property.id);

                return (
                  <div
                    key={`upcoming-rem-${property.id}`}
                    className="p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            reminder.daysRemaining === 0
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 animate-pulse'
                              : reminder.daysRemaining === 1
                              ? 'bg-amber-500 text-white'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {reminder.daysRemaining === 0
                            ? '¡Hoy es día de renta!'
                            : reminder.daysRemaining === 1
                            ? 'Vence mañana'
                            : `Faltan ${reminder.daysRemaining} días (Día ${property.rentDueDay || 1})`}
                        </span>

                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          {formatDate(reminder.dueDateStr)}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {reminder.propertyIdentifier}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        Inquilino: {reminder.tenantName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Tel: {property.tenant1.phone}
                      </p>

                      <div className="mt-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Periodo de factura:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{reminder.period}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
                          <span className="text-slate-700 dark:text-slate-300">Renta preliminar:</span>
                          <span className="text-slate-900 dark:text-white text-sm">
                            {formatCurrency(reminder.rentAmount)}
                          </span>
                        </div>
                        {(property.utilitiesWaterActive || property.utilitiesElectricActive) && (
                          <div className="pt-1.5 border-t border-amber-200/40 dark:border-amber-900/40 text-[10.5px] text-amber-900 dark:text-amber-300 leading-tight space-y-0.5">
                            <span className="font-bold block">💡 Utilidades (Consumo variable):</span>
                            <span>
                              Último mes: {formatCurrency(
                                (property.utilitiesWaterActive ? Number(property.utilitiesWaterAmount) || 0 : 0) +
                                (property.utilitiesElectricActive ? Number(property.utilitiesElectricAmount) || 0 : 0)
                              )}. No se suma al total ya que variará; se notificará al recibir la próxima factura.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => sendWhatsAppMessage(property.tenant1.phone, message)}
                        className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition"
                        title="Enviar recordatorio y datos de pago por WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" /> Enviar WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(`upcoming-${property.id}`, message)}
                        className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center transition"
                        title="Copiar texto con formato"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {matchedStatus && (
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(matchedStatus, 'next_month')}
                          className="py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs"
                          title="Generar Factura / Aviso Anticipado para el Próximo Mes"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Factura Próx. Mes
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRegisterPayment(property.id, reminder.tenantName, reminder.rentAmount)}
                        className="py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center transition"
                        title="Registrar pago recibido"
                      >
                        + Pago
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Contract Renewal Reminders */}
      {(filterType === 'all' || filterType === 'contracts') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-lg">
                <Calendar className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Recordatorios para Formalizar Renovación de Contrato
              </h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {renewalReminders.length} por atender
            </span>
          </div>

          {renewalReminders.length === 0 ? (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
              ✓ Todos los contratos de arrendamiento tienen vigencia superior a 60 días.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renewalReminders.map((status) => {
                const { property } = status;
                const isExpired = status.contractDaysLeft < 0;
                const isCopied = copiedId === `renewal-${property.id}`;
                const message = buildRenewalMessage(status);

                return (
                  <div
                    key={`renewal-${property.id}`}
                    className={`p-4 rounded-2xl border transition bg-white dark:bg-slate-900 shadow-xs ${
                      isExpired
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20'
                        : 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            isExpired
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                          }`}
                        >
                          {isExpired
                            ? `Contrato Vencido hace ${Math.abs(status.contractDaysLeft)} días`
                            : `Vence en ${status.contractDaysLeft} días`}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {property.propertyIdentifier}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {property.address}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-500">Vencimiento:</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {formatDate(property.contractEndDate)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                      <div>
                        <strong>Inquilino 1:</strong> {property.tenant1.name} • {property.tenant1.phone}
                      </div>
                      {property.tenant2 && (
                        <div>
                          <strong>Inquilino 2:</strong> {property.tenant2.name} • {property.tenant2.phone}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => sendWhatsAppMessage(property.tenant1.phone, message)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" /> Enviar WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`renewal-${property.id}`, message)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copiado' : 'Copiar Texto'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProperty(property)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ml-auto"
                      >
                        Renovar Contrato
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: General Invoices & Overdue Tracking */}
      {(filterType === 'all' || filterType === 'invoices') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-sky-100 dark:bg-sky-950/60 text-sky-600 rounded-lg">
                <FileText className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Estado General de Facturación y Cobranza
              </h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
              Periodo: {propertyStatuses[0]?.currentPeriod}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {invoiceReminders.map((status) => {
              const { property } = status;
              const isPaid = status.totalPendingBalance <= 0;
              const isOverdue = status.isOverdue;
              const isCopied = copiedId === `notice-${property.id}`;
              const message = buildPaymentNoticeMessage(status);

              return (
                <div
                  key={`invoice-rem-${property.id}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                        }`}
                      >
                        {isPaid ? 'Cuenta al Día' : isOverdue ? `${status.daysOverdue} días de mora` : !status.isRentDueReached ? `Inicia Día ${property.rentDueDay}` : 'Por Vencer'}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        Vence: Día {property.rentDueDay}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {property.propertyIdentifier}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Inquilino: {property.tenant1.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Tel: {property.tenant1.phone}
                    </p>

                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Renta mensual:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(property.rentAmount)}
                        </span>
                      </div>
                      {status.previousBalance > 0 && (
                        <div className="flex justify-between text-amber-700 dark:text-amber-400">
                          <span>Balance previo:</span>
                          <span className="font-semibold">{formatCurrency(status.previousBalance)}</span>
                        </div>
                      )}
                      {status.totalLateFees > 0 && (
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>Cargos por mora:</span>
                          <span className="font-semibold">{formatCurrency(status.totalLateFees)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                        <span>Total por pagar:</span>
                        <span
                          className={
                            status.totalPendingBalance > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {formatCurrency(status.totalPendingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(status, 'current')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs text-white ${
                        isPaid ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'
                      }`}
                      title={isPaid ? 'Ver Recibo de Pago Liquidado' : 'Ver Factura del Mes Actual'}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isPaid ? 'Recibo' : 'Factura Actual'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(status, 'next_month')}
                      className="py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs"
                      title="Generar Factura / Recordatorio del Próximo Mes"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Próx. Mes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendWhatsAppMessage(property.tenant1.phone, message)}
                      className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs"
                      title="Enviar recordatorio vía WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`notice-${property.id}`, message)}
                      className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center transition"
                      title="Copiar texto con formato"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => onRegisterPayment(property.id, property.tenant1.name, status.totalPendingBalance)}
                        className="py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center transition"
                        title="Registrar pago rápido"
                      >
                        + Pago
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
