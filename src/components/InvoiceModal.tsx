import React, { useState, useEffect, useMemo } from 'react';
import { Property, LandlordProfile, PropertyFinancialStatus, Payment, Administrator } from '../types';
import { formatCurrency, formatDate, calculateNextPeriodInvoiceInfo } from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import { downloadElementAsPdf, printElementSafely, openExternalUrl } from '../utils/pdfGenerator';
import { SupportedLanguage, translations, getSavedLanguage } from '../utils/i18n';
import {
  X,
  Printer,
  Download,
  Send,
  Mail,
  Copy,
  Check,
  Building2,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  ExternalLink,
  Sparkles,
  Clock,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Droplets,
  Zap,
  Edit3,
  Settings2,
  Scale,
  Save,
  Lock,
} from 'lucide-react';
import { SubscriptionState } from '../utils/subscription';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: PropertyFinancialStatus;
  profile: LandlordProfile;
  administrators?: Administrator[];
  allPayments: Payment[];
  initialMode?: 'current' | 'next_month' | 'payment_receipt';
  initialSpecificPayment?: Payment | null;
  onUpdatePropertyUtilities?: (propertyId: string, waterAmount: number, electricAmount: number) => void;
  currentLanguage?: SupportedLanguage;
  subscriptionState?: SubscriptionState;
  onOpenSubscriptionModal?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  status,
  profile,
  administrators,
  allPayments = [],
  initialMode = 'current',
  initialSpecificPayment,
  onUpdatePropertyUtilities,
  currentLanguage,
  subscriptionState,
  onOpenSubscriptionModal,
}) => {
  const lang: SupportedLanguage = currentLanguage || getSavedLanguage();
  const t = translations[lang] || translations.es;

  const [invoiceMode, setInvoiceMode] = useState<'current' | 'next_month' | 'payment_receipt'>(initialMode);
  const [recipientChoice, setRecipientChoice] = useState<'tenant1' | 'tenant2' | 'both'>('tenant1');
  const [customPeriod, setCustomPeriod] = useState(status?.currentPeriod || '');
  const [activeShareTab, setActiveShareTab] = useState<'preview' | 'whatsapp' | 'email'>('preview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedType, setCopiedType] = useState<'whatsapp' | 'email' | null>(null);
  const [customPhone, setCustomPhone] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [showAdvancedPeriodEdit, setShowAdvancedPeriodEdit] = useState(false);

  // Specific Payment Receipt handling
  const propertyPayments = useMemo(() => {
    if (!status?.property) return [];
    return allPayments.filter((p) => p.propertyId === status.property.id);
  }, [status?.property, allPayments]);

  const [selectedPaymentId, setSelectedPaymentId] = useState<string>(
    initialSpecificPayment?.id || propertyPayments[0]?.id || ''
  );

  // Quick Utilities Edit Inline
  const [showQuickUtilitiesEdit, setShowQuickUtilitiesEdit] = useState(false);
  const [quickWater, setQuickWater] = useState<string>(
    status?.property?.utilitiesWaterAmount !== undefined ? String(status.property.utilitiesWaterAmount) : ''
  );
  const [quickElectric, setQuickElectric] = useState<string>(
    status?.property?.utilitiesElectricAmount !== undefined ? String(status.property.utilitiesElectricAmount) : ''
  );
  const [quickEditSaved, setQuickEditSaved] = useState(false);

  // Active Administrator for this property
  const admin = getAdministratorForProperty(
    status?.property,
    administrators || profile?.administrators
  );

  // Calculate upcoming cycle / next month financial and date details
  const nextPeriodInfo = useMemo(() => {
    if (!status?.property) return null;
    return calculateNextPeriodInvoiceInfo(status.property, allPayments);
  }, [status?.property, allPayments]);

  // Manage invoice-modal-open class on body for print isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('invoice-modal-open');
      return () => {
        document.body.classList.remove('invoice-modal-open');
      };
    }
  }, [isOpen]);

  // Sync state whenever status or initialMode or recipientChoice changes
  useEffect(() => {
    if (status) {
      const mode = initialMode || 'current';
      setInvoiceMode(mode);
      if (mode === 'next_month' && nextPeriodInfo) {
        setCustomPeriod(nextPeriodInfo.nextPeriodName);
      } else {
        setCustomPeriod(status.currentPeriod);
      }

      if (initialSpecificPayment) {
        setSelectedPaymentId(initialSpecificPayment.id);
      } else if (propertyPayments.length > 0 && !selectedPaymentId) {
        setSelectedPaymentId(propertyPayments[0].id);
      }

      setQuickWater(status.property.utilitiesWaterAmount !== undefined ? String(status.property.utilitiesWaterAmount) : '');
      setQuickElectric(status.property.utilitiesElectricAmount !== undefined ? String(status.property.utilitiesElectricAmount) : '');

      const defaultPhone =
        recipientChoice === 'tenant2' && status.property.tenant2
          ? status.property.tenant2.phone
          : status.property.tenant1.phone;
      setCustomPhone(defaultPhone);

      const defaultEmail =
        recipientChoice === 'tenant2' && status.property.tenant2
          ? status.property.tenant2.email || ''
          : status.property.tenant1.email || '';
      setCustomEmail(defaultEmail);
    }
  }, [status, initialMode, initialSpecificPayment, recipientChoice, nextPeriodInfo, propertyPayments]);

  if (!isOpen || !status) return null;

  const { property } = status;
  const isNextMonth = invoiceMode === 'next_month';
  const isPaymentReceipt = invoiceMode === 'payment_receipt';
  const isRentDueReached = status.isRentDueReached;

  // Selected specific payment for receipt
  const activePayment = propertyPayments.find((p) => p.id === selectedPaymentId) || initialSpecificPayment || propertyPayments[0];

  // Active Period and Due Date
  const activePeriod = customPeriod || (isNextMonth ? nextPeriodInfo?.nextPeriodName || '' : status.currentPeriod);
  const activeDueDate = isNextMonth ? nextPeriodInfo?.nextDueDate || status.dueDate : status.dueDate;

  // Check if tenant has truly paid the rent for this period:
  const hasPaidRentForPeriod =
    (status.paidRentThisMonth || 0) >= property.rentAmount ||
    propertyPayments.some(
      (p) =>
        p.period.toLowerCase().trim() === activePeriod.toLowerCase().trim() &&
        ((p.appliedToRent || 0) >= property.rentAmount || (p.concept === 'renta' && p.amount >= property.rentAmount))
    );

  // A document is only marked as a "Paid Rent Receipt / Comprobante Liquidado" if rent was actually paid and no balance is pending:
  const isCurrentPaid = !isNextMonth && !isPaymentReceipt && hasPaidRentForPeriod && status.totalPendingBalance <= 0;

  const todayStr = new Date().toISOString().split('T')[0];

  // Document Type & Nomenclature
  let docTypeBadge = lang === 'en' ? 'Rent Invoice' : 'Factura de Renta';
  let docTypeTitle = lang === 'en' ? 'Statement of Account / Rent Invoice' : 'Estado de Cuenta / Factura de Renta';
  let folioPrefix = 'FAC';

  if (isPaymentReceipt) {
    docTypeBadge = lang === 'en' ? 'Payment Receipt' : 'Recibo de Pago';
    docTypeTitle = lang === 'en' ? 'Payment Receipt / Transaction Voucher' : 'Comprobante / Recibo Independiente de Pago';
    folioPrefix = 'REC';
  } else if (isNextMonth) {
    docTypeBadge = lang === 'en' ? 'Advance Rent Notice' : 'Aviso Anticipado de Renta';
    docTypeTitle = lang === 'en' ? 'Rent Invoice / Advance Payment Notice' : 'Factura de Renta / Aviso de Cobro Anticipado';
    folioPrefix = lang === 'en' ? 'NOTICE' : 'AVISO';
  } else if (isCurrentPaid) {
    docTypeBadge = lang === 'en' ? 'Paid Rent Voucher' : 'Comprobante de Pago Liquidado';
    docTypeTitle = lang === 'en' ? 'Paid Rent Voucher / Receipt' : 'Comprobante / Recibo de Pago de Renta';
    folioPrefix = 'REC';
  } else if (!isRentDueReached) {
    docTypeBadge = status.totalPendingBalance > 0
      ? (lang === 'en' ? 'Utilities Invoice' : 'Factura de Utilidades')
      : (lang === 'en' ? 'Account Up to Date' : 'Estado de Cuenta al Día');
    docTypeTitle = status.totalPendingBalance > 0
      ? (lang === 'en' ? 'Utilities Invoice / Pending Balance' : 'Factura de Utilidades / Balance Pendiente')
      : (lang === 'en' ? 'Current Statement of Account' : 'Estado de Cuenta Corriente');
    folioPrefix = status.totalPendingBalance > 0 ? 'UTI' : 'EDC';
  }

  const propCode = property.propertyIdentifier.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const monthSuffix = isNextMonth ? new Date().getMonth() + 2 : new Date().getMonth() + 1;
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const invoiceNumber = isPaymentReceipt && activePayment
    ? `REC-${activePayment.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`
    : `${folioPrefix}-${propCode}-${monthSuffix}${yearSuffix}`;

  // Determine recipient details
  let recipientName = property.tenant1.name;
  let recipientPhone = property.tenant1.phone;
  let recipientEmail = property.tenant1.email || '';
  let recipientId = property.tenant1.idNumber || '';

  if (isPaymentReceipt && activePayment?.payerName) {
    recipientName = activePayment.payerName;
  } else if (recipientChoice === 'tenant2' && property.tenant2) {
    recipientName = property.tenant2.name;
    recipientPhone = property.tenant2.phone;
    recipientEmail = property.tenant2.email || '';
    recipientId = property.tenant2.idNumber || '';
  } else if (recipientChoice === 'both' && property.tenant2) {
    recipientName = `${property.tenant1.name} & ${property.tenant2.name}`;
    recipientPhone = `${property.tenant1.phone} / ${property.tenant2.phone}`;
    recipientEmail = [property.tenant1.email, property.tenant2.email].filter(Boolean).join(', ');
    recipientId = [property.tenant1.idNumber, property.tenant2.idNumber].filter(Boolean).join(' / ');
  }

  // Financial breakdown depending on invoice mode
  const rent = property.rentAmount;
  const isUtilityActive = Boolean(property.utilitiesWaterActive || property.utilitiesElectricActive || property.utilitiesMaintenanceActive);
  const lastMonthWater = property.utilitiesWaterActive ? Math.max(0, Number(property.utilitiesWaterAmount) || 0) : 0;
  const lastMonthElectric = property.utilitiesElectricActive ? Math.max(0, Number(property.utilitiesElectricAmount) || 0) : 0;
  const lastMonthMaintenance = property.utilitiesMaintenanceActive ? Math.max(0, Number(property.utilitiesMaintenanceAmount) || 0) : 0;
  const lastMonthUtilitiesTotal = lastMonthWater + lastMonthElectric + lastMonthMaintenance;

  // Active rent charge for this invoice:
  // - If isNextMonth (advance notice): rent IS included because it informs the upcoming due date
  // - If current invoice and isRentDueReached: rent IS included as active charge
  // - If current invoice and !isRentDueReached: rent has NOT arrived yet, so active charge on this invoice is 0!
  const currentRentBilled = isNextMonth ? rent : isRentDueReached ? rent : 0;

  // In advance notices: while payment of current month utilities has not been registered,
  // include unpaid utilities in the breakdown and total.
  const waterAmount = isNextMonth
    ? (nextPeriodInfo?.unpaidWaterCurrent || 0)
    : status.waterAmount;
  const electricAmount = isNextMonth
    ? (nextPeriodInfo?.unpaidElectricCurrent || 0)
    : status.electricAmount;
  const maintenanceAmount = isNextMonth
    ? (nextPeriodInfo?.unpaidMaintenanceCurrent || 0)
    : status.maintenanceAmount;

  const prevBalance = isNextMonth
    ? nextPeriodInfo?.accumulatedPreviousBalance || 0
    : status.previousBalance;
  const baseLateFee = isNextMonth || isPaymentReceipt || !isRentDueReached ? 0 : status.calculatedLateFeeBase;
  const dailyLateFee = isNextMonth || isPaymentReceipt || !isRentDueReached ? 0 : status.calculatedLateFeeDaily;
  const daysOverdue = isNextMonth || isPaymentReceipt || !isRentDueReached ? 0 : status.daysOverdue;
  const paidAmount = isNextMonth
    ? nextPeriodInfo?.advancePayments || 0
    : isPaymentReceipt
    ? activePayment?.amount || 0
    : status.totalPaidThisMonth;
  const totalDue = isNextMonth
    ? nextPeriodInfo?.totalDueNextMonth || property.rentAmount
    : status.totalPendingBalance;

  // Grace date computation string for active period
  const graceDays = Math.max(0, Number(property.graceDays) ?? 3);
  const [dYear, dMonth, dDay] = activeDueDate.split('-').map(Number);
  const graceDateObj = new Date(dYear || new Date().getFullYear(), (dMonth || 1) - 1, (dDay || property.rentDueDay || 1) + graceDays);
  const graceDateStr = `${graceDateObj.getFullYear()}-${String(graceDateObj.getMonth() + 1).padStart(2, '0')}-${String(graceDateObj.getDate()).padStart(2, '0')}`;

  // Handler to switch mode
  const handleModeSwitch = (mode: 'current' | 'next_month' | 'payment_receipt') => {
    setInvoiceMode(mode);
    if (mode === 'next_month' && nextPeriodInfo) {
      setCustomPeriod(nextPeriodInfo.nextPeriodName);
    } else {
      setCustomPeriod(status.currentPeriod);
    }
  };

  // Handler for quick utility updates
  const handleSaveQuickUtilities = () => {
    if (!onUpdatePropertyUtilities) return;
    const w = parseFloat(quickWater) || 0;
    const e = parseFloat(quickElectric) || 0;
    onUpdatePropertyUtilities(property.id, w, e);
    setQuickEditSaved(true);
    setTimeout(() => {
      setQuickEditSaved(false);
      setShowQuickUtilitiesEdit(false);
    }, 1500);
  };

  // Clean phone number for WhatsApp link
  const cleanPhone = (phoneStr: string) => {
    return phoneStr.replace(/[^0-9]/g, '');
  };

  const targetWhatsAppPhone =
    recipientChoice === 'tenant2' && property.tenant2 ? property.tenant2.phone : property.tenant1.phone;

  const conceptLabel = activePayment?.concept === 'agua'
    ? 'Utilidad de Agua'
    : activePayment?.concept === 'electricidad'
    ? 'Utilidad de Electricidad (LUMA / AEE)'
    : activePayment?.concept === 'deposito'
    ? 'Depósito de Garantía en Contrato'
    : activePayment?.concept === 'general'
    ? 'Pago General / Mixto'
    : 'Renta Convenida';

  // 1. High-fidelity WhatsApp Message
  let whatsAppFormattedMessage = '';

  if (isPaymentReceipt && activePayment) {
    whatsAppFormattedMessage = `✅ *RECIBO INDEPENDIENTE DE PAGO*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${recipientName}*, confirmamos el registro del siguiente pago recibido:

🧾 *Folio Recibo:* ${invoiceNumber}
📅 *Fecha de pago:* ${formatDate(activePayment.date)}
🗓️ *Periodo:* ${activePayment.period}
🏠 *Propiedad:* ${property.propertyIdentifier}

💰 *IMPORTE RECIBIDO: ${formatCurrency(activePayment.amount, admin.currencySymbol)}*
🏷️ *Concepto declarado:* ${conceptLabel}
💳 *Método:* ${activePayment.paymentMethod}${activePayment.reference ? ` (Ref: ${activePayment.reference})` : ''}

⚖️ *APLICACIÓN DE FONDOS (PRELACIÓN CONTRACTUAL):*
${(activePayment.appliedToLateFees || 0) > 0 ? `▪️ Recargos por demora (mora): ${formatCurrency(activePayment.appliedToLateFees || 0, admin.currencySymbol)}\n` : ''}${(activePayment.appliedToRent || 0) > 0 ? `▪️ Renta convenida: ${formatCurrency(activePayment.appliedToRent || 0, admin.currencySymbol)}\n` : ''}${(activePayment.appliedToDeposit || 0) > 0 ? `▪️ Depósito requerido en contrato: ${formatCurrency(activePayment.appliedToDeposit || 0, admin.currencySymbol)}\n` : ''}${(activePayment.appliedToWater || 0) > 0 ? `▪️ Utilidad de Agua: ${formatCurrency(activePayment.appliedToWater || 0, admin.currencySymbol)}\n` : ''}${(activePayment.appliedToElectric || 0) > 0 ? `▪️ Utilidad Electricidad (LUMA / AEE): ${formatCurrency(activePayment.appliedToElectric || 0, admin.currencySymbol)}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *ESTADO DE BALANCES PENDIENTES:*
▪️ Renta pendiente: ${formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
${property.utilitiesWaterActive ? `▪️ Agua pendiente: ${formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive ? `▪️ Electricidad LUMA/AEE pendiente: ${formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}\n` : ''}${status.totalLateFees > 0 ? `▪️ Moras pendientes: ${formatCurrency(status.pendingLateFeesBalance, admin.currencySymbol)}\n` : ''}💵 *TOTAL SALDO RESTANTE: ${formatCurrency(status.totalPendingBalance, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

${activePayment.applicationFootnote ? `📌 *${activePayment.applicationFootnote}*\n\n` : ''}${admin.invoiceNote ? `Nota: ${admin.invoiceNote}\n\n` : ''}🙏 Muchas gracias por su pago.`;
  } else if (isNextMonth) {
    whatsAppFormattedMessage = `📋 *AVISO DE COBRO / FACTURA DEL PRÓXIMO MES*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${recipientName}*, le enviamos con anticipación los datos correspondientes a su renta del periodo *${activePeriod}* para su debida programación:

🧾 *Folio:* ${invoiceNumber}
📅 *Fecha de emisión:* ${formatDate(todayStr)}
🗓️ *Periodo a pagar:* ${activePeriod}
🏠 *Propiedad:* ${property.propertyIdentifier}
⏰ *Fecha límite de pago:* ${formatDate(activeDueDate)} (Día ${property.rentDueDay} de cada mes)

💰 *DESGLOSE DE CARGOS:*
▪️ Renta convenida en contrato: ${formatCurrency(rent, admin.currencySymbol)}
${property.utilitiesWaterActive && waterAmount > 0 ? `💧 Utilidad de Agua (Pendiente mes corriente): ${formatCurrency(waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && electricAmount > 0 ? `⚡ Utilidad de Electricidad (Pendiente mes corriente): ${formatCurrency(electricAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesMaintenanceActive && maintenanceAmount > 0 ? `🛠️ Cuota de Mantenimiento (Pendiente mes corriente): ${formatCurrency(maintenanceAmount, admin.currencySymbol)}\n` : ''}${prevBalance > 0 ? `▪️ Saldo pendiente anterior acumulado: ${formatCurrency(prevBalance, admin.currencySymbol)}\n` : ''}${paidAmount > 0 ? `▪️ Abonos anticipados registrados: -${formatCurrency(paidAmount, admin.currencySymbol)}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL PRELIMINAR A PAGAR: ${formatCurrency(totalDue, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

${isUtilityActive ? nextPeriodInfo?.hasUnpaidUtilities ? `💡 *NOTA SOBRE UTILIDADES:*
Se incluyen en el total a pagar las utilidades pendientes de liquidar del mes corriente (Agua: ${formatCurrency(waterAmount, admin.currencySymbol)}, Luz: ${formatCurrency(electricAmount, admin.currencySymbol)}). El consumo nuevo de este próximo ciclo variará según el consumo real y se notificará cuando los proveedores emitan la próxima factura.\n\n` : `💡 *NOTA SOBRE UTILIDADES (Consumo Variable):*
En la última factura recibida el costo de utilidades fue de ${formatCurrency(lastMonthUtilitiesTotal, admin.currencySymbol)}${property.utilitiesWaterActive && property.utilitiesElectricActive ? ` (Agua: ${formatCurrency(lastMonthWater, admin.currencySymbol)}, Luz: ${formatCurrency(lastMonthElectric, admin.currencySymbol)})` : ''}.
El costo para este próximo periodo es variable según el consumo real y no se suma a este total preliminar; cuando llegue la próxima factura de los proveedores se le indicará y agregará la cantidad a pagar por dicho concepto.\n\n` : ''}ℹ️ *Recordatorio de vencimiento:*
Su fecha límite de pago es el *${formatDate(activeDueDate)}*. Cuenta con ${property.graceDays} días de gracia para efectuar su pago sin recargos por mora.

🏦 *DATOS BANCARIOS PARA PAGO / TRANSFERENCIA:*
${admin.bankDetails}

${admin.invoiceNote ? `Nota: ${admin.invoiceNote}\n\n` : ''}🙏 Agradecemos su preferencia y realizar su pago oportunamente. Favor de compartir su comprobante por este medio al realizar el pago.`;
  } else if (isCurrentPaid) {
    whatsAppFormattedMessage = `✅ *COMPROBANTE / RECIBO DE PAGO DE RENTA*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado/a *${recipientName}*, confirmamos la recepción y registro de su pago de renta y utilidades:

🧾 *Folio Recibo:* ${invoiceNumber}
📅 *Fecha de emisión:* ${formatDate(todayStr)}
🗓️ *Periodo cubierto:* ${activePeriod}
🏠 *Propiedad:* ${property.propertyIdentifier}
💰 *Renta mensual:* ${formatCurrency(rent, admin.currencySymbol)}
${property.utilitiesWaterActive && status.waterAmount > 0 ? `💧 *Utilidad de Agua (Consumo factura anterior):* ${formatCurrency(status.waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && status.electricAmount > 0 ? `⚡ *Utilidad Electricidad (LUMA / AEE) (Consumo factura anterior):* ${formatCurrency(status.electricAmount, admin.currencySymbol)}\n` : ''}💵 *Importe liquidado:* ${formatCurrency(paidAmount, admin.currencySymbol)}
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *ESTATUS: CUENTA AL DÍA - PAGADA EN SU TOTALIDAD*
━━━━━━━━━━━━━━━━━━━━━━━━━

${admin.invoiceNote ? `Nota: ${admin.invoiceNote}\n\n` : ''}🙏 Muchas gracias por su puntualidad y cumplimiento.`;
  } else if (!isRentDueReached) {
    // Current period BEFORE the agreed due day (e.g. today is Oct 4, due day is Oct 15):
    // Rent has NOT matured yet, so active rent charge on this invoice is $0.00.
    // Only utilities (if manually added) and genuine prior debts are owed!
    whatsAppFormattedMessage = `🏢 *ESTADO DE CUENTA / FACTURA ACTUAL*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 *Folio:* ${invoiceNumber}
📅 *Fecha de emisión:* ${formatDate(todayStr)}
🗓️ *Periodo:* ${activePeriod}
🏠 *Propiedad:* ${property.propertyIdentifier}
👤 *Inquilino:* ${recipientName}
⏰ *Fecha convenida de cobro de renta:* ${formatDate(activeDueDate)} (Día ${property.rentDueDay} de cada mes)

💰 *DESGLOSE DE CARGOS AL DÍA DE HOY:*
▪️ Renta mensual pactada: ${formatCurrency(rent, admin.currencySymbol)} (Aún no exigible - Su ciclo inicia el ${formatDate(activeDueDate)})
▪️ Cargo de renta exigible hoy: ${formatCurrency(0, admin.currencySymbol)}
${property.utilitiesWaterActive && waterAmount > 0 ? `💧 Utilidad de Agua (Consumo factura proveedor): ${formatCurrency(waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && electricAmount > 0 ? `⚡ Utilidad de Electricidad (Consumo factura proveedor): ${formatCurrency(electricAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesMaintenanceActive && maintenanceAmount > 0 ? `🛠️ Cuota de Mantenimiento: ${formatCurrency(maintenanceAmount, admin.currencySymbol)}\n` : ''}${prevBalance > 0 ? `▪️ Balances atrasados no pagados de meses anteriores: ${formatCurrency(prevBalance, admin.currencySymbol)}\n` : ''}${paidAmount > 0 ? `▪️ Abonos registrados: -${formatCurrency(paidAmount, admin.currencySymbol)}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL ACTUAL A PAGAR: ${formatCurrency(totalDue, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️ *Términos de su Renta:*
Su renta correspondiente a este ciclo tiene como fecha convenida de vencimiento el *${formatDate(activeDueDate)}*. Cuenta con *${property.graceDays} días de gracia* para realizar su pago sin cargos por demora hasta el *${formatDate(graceDateStr)}*.
${totalDue > 0 ? `El importe actual a pagar de ${formatCurrency(totalDue, admin.currencySymbol)} corresponde a los conceptos de utilidades según factura recibida del proveedor.\n\n` : 'Al día de hoy no presenta cargos exigibles pendientes por liquidar.\n\n'}🏦 *DATOS BANCARIOS PARA PAGO / TRANSFERENCIA:*
${admin.bankDetails}

${admin.invoiceNote ? `Nota: ${admin.invoiceNote}\n\n` : ''}🙏 Agradecemos su puntualidad y cumplimiento.`;
  } else {
    // Current period ON OR AFTER the agreed rent due day (e.g. Oct 15+)
    whatsAppFormattedMessage = `🏢 *ESTADO DE CUENTA / FACTURA CORRIENTE DE RENTA & UTILIDADES*
*${admin.companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 *Folio:* ${invoiceNumber}
📅 *Fecha de emisión:* ${formatDate(todayStr)}
🗓️ *Periodo:* ${activePeriod}
🏠 *Propiedad:* ${property.propertyIdentifier}
👤 *Inquilino:* ${recipientName}
⏰ *Fecha límite de pago:* ${formatDate(activeDueDate)}

💰 *DESGLOSE DE CARGOS:*
▪️ Renta del periodo: ${formatCurrency(rent, admin.currencySymbol)}
${property.utilitiesWaterActive && waterAmount > 0 ? `▪️ Utilidad de Agua (Consumo factura anterior): ${formatCurrency(waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && electricAmount > 0 ? `▪️ Utilidad de Electricidad (LUMA / AEE) (Consumo factura anterior): ${formatCurrency(electricAmount, admin.currencySymbol)}\n` : ''}${prevBalance > 0 ? `▪️ Balances atrasados no pagados: ${formatCurrency(prevBalance, admin.currencySymbol)}\n` : ''}${baseLateFee > 0 ? `▪️ Cargo base por atraso: ${formatCurrency(baseLateFee, admin.currencySymbol)}\n` : ''}${dailyLateFee > 0 ? `▪️ Demora diaria (${status.effectiveDailyDays ?? daysOverdue} días tras gracia${status.lateFeeCapNotice ? ` - ${status.lateFeeCapNotice}` : ''}): ${formatCurrency(dailyLateFee, admin.currencySymbol)}\n` : ''}${paidAmount > 0 ? `▪️ Abonos registrados en el mes: -${formatCurrency(paidAmount, admin.currencySymbol)}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL A PAGAR: ${formatCurrency(totalDue, admin.currencySymbol)}*
━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *BALANCES PENDIENTES SEGREGADOS:*
▪️ Saldo Renta pendiente: ${formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
${property.utilitiesWaterActive ? `▪️ Saldo Agua pendiente: ${formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive ? `▪️ Saldo Electricidad (LUMA / AEE) pendiente: ${formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}\n` : ''}${status.totalLateFees > 0 ? `▪️ Saldo Moras pendiente: ${formatCurrency(status.pendingLateFeesBalance, admin.currencySymbol)}\n` : ''}
🏦 *DATOS BANCARIOS PARA PAGO / TRANSFERENCIA:*
${admin.bankDetails}

${admin.invoiceNote ? `ℹ️ *Nota:* ${admin.invoiceNote}\n\n` : ''}🙏 Agradecemos enviar su comprobante de pago por este medio.`;
  }

  // 2. High-fidelity Email Subject and Body
  const emailFormattedSubject = isPaymentReceipt
    ? `Recibo de Pago (${conceptLabel}) - ${property.propertyIdentifier} - Folio ${invoiceNumber}`
    : isNextMonth
    ? `Aviso Anticipado / Factura de Renta - ${property.propertyIdentifier} (${activePeriod})`
    : isCurrentPaid
    ? `Comprobante de Pago de Renta - ${property.propertyIdentifier} (${activePeriod})`
    : !isRentDueReached
    ? `Estado de Cuenta / Factura Actual - ${property.propertyIdentifier} (${activePeriod})`
    : `Factura de Renta & Utilidades - ${property.propertyIdentifier} (${activePeriod})`;

  const emailFormattedBody = `======================================================
${docTypeTitle.toUpperCase()}
======================================================
EMPRESA:     ${admin.companyName}
ADMIN:       ${admin.landlordName || 'Administración'}
FOLIO:       ${invoiceNumber}
FECHA:       ${formatDate(isPaymentReceipt && activePayment ? activePayment.date : todayStr)}
PERIODO:     ${activePeriod}
${!isPaymentReceipt ? `VENCE:       ${formatDate(activeDueDate)}\n` : ''}
------------------------------------------------------
DATOS DEL ARRENDAMIENTO
------------------------------------------------------
INMUEBLE:    ${property.propertyIdentifier}
DIRECCION:   ${property.address}
INQUILINO:   ${recipientName}

------------------------------------------------------
${isPaymentReceipt ? 'DETALLE DEL PAGO RECIBIDO & PRELACIÓN DE FONDOS' : 'DESGLOSE DE CONCEPTOS Y CARGOS'}
------------------------------------------------------
${isPaymentReceipt && activePayment ? `• Importe Recibido:                       ${formatCurrency(activePayment.amount, admin.currencySymbol)}
• Concepto declarado por inquilino:        ${conceptLabel}
• Método de pago:                         ${activePayment.paymentMethod}${activePayment.reference ? ` (Ref: ${activePayment.reference})` : ''}

APLICACIÓN DE FONDOS CONFORME A PRELACIÓN LEGAL:
- Cubierto a Cargos por Mora / Demora:    ${formatCurrency(activePayment.appliedToLateFees || 0, admin.currencySymbol)}
- Cubierto a Renta Convenida:             ${formatCurrency(activePayment.appliedToRent || 0, admin.currencySymbol)}
${(activePayment.appliedToDeposit || 0) > 0 ? `- Cubierto a Depósito en Garantía:        ${formatCurrency(activePayment.appliedToDeposit || 0, admin.currencySymbol)}\n` : ''}- Cubierto a Utilidad de Agua:            ${formatCurrency(activePayment.appliedToWater || 0, admin.currencySymbol)}
- Cubierto a Utilidad de Electricidad (LUMA / AEE): ${formatCurrency(activePayment.appliedToElectric || 0, admin.currencySymbol)}

BALANCES PENDIENTES TRAS ESTE PAGO:
- Saldo Renta pendiente:                  ${formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
- Saldo Agua pendiente:                   ${formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}
- Saldo Electricidad (LUMA / AEE) pendiente:  ${formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}
- Saldo Moras pendiente:                  ${formatCurrency(status.pendingLateFeesBalance, admin.currencySymbol)}
TOTAL ADEUDADO:                           ${formatCurrency(status.totalPendingBalance, admin.currencySymbol)}

${activePayment.applicationFootnote ? `NOTA AL CALCE:\n${activePayment.applicationFootnote}\n` : ''}` : !isRentDueReached && !isNextMonth ? `• Renta mensual convenida:                  ${formatCurrency(rent, admin.currencySymbol)} (Inicia el ${formatDate(activeDueDate)} - Aún no exigible)
• Cargo activo de renta hoy:                ${formatCurrency(0, admin.currencySymbol)}
${property.utilitiesWaterActive && waterAmount > 0 ? `• Utilidad de Agua (Consumo proveedor):      ${formatCurrency(waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && electricAmount > 0 ? `• Utilidad de Electricidad (LUMA / AEE):     ${formatCurrency(electricAmount, admin.currencySymbol)}\n` : ''}${prevBalance > 0 ? `• Balances atrasados no pagados:            ${formatCurrency(prevBalance, admin.currencySymbol)}\n` : ''}${paidAmount > 0 ? `• Abonos registrados:                     -${formatCurrency(paidAmount, admin.currencySymbol)}\n` : ''}------------------------------------------------------
TOTAL A PAGAR AL DÍA DE HOY:                  ${formatCurrency(totalDue, admin.currencySymbol)}
------------------------------------------------------
TÉRMINOS DE PAGO DE RENTA:
- Fecha convenida de vencimiento: ${formatDate(activeDueDate)} (Día ${property.rentDueDay} de cada mes).
- Días de gracia para pago sin recargos: ${property.graceDays} días (hasta el ${formatDate(graceDateStr)}).` : `• Renta mensual convenida (${activePeriod}): ${formatCurrency(rent, admin.currencySymbol)}
${property.utilitiesWaterActive && waterAmount > 0 ? `• Utilidad de Agua (${isNextMonth ? 'Pendiente mes corriente' : 'Consumo factura anterior'}):   ${formatCurrency(waterAmount, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive && electricAmount > 0 ? `• Utilidad de Electricidad (LUMA / AEE) (${isNextMonth ? 'Pendiente mes corriente' : 'Consumo anterior'}): ${formatCurrency(electricAmount, admin.currencySymbol)}\n` : ''}${prevBalance > 0 ? `• Balances atrasados no pagados:            ${formatCurrency(prevBalance, admin.currencySymbol)}\n` : ''}${baseLateFee > 0 ? `• Cargo base por mora (tras ${property.graceDays} días de gracia): ${formatCurrency(baseLateFee, admin.currencySymbol)}\n` : ''}${dailyLateFee > 0 ? `• Demora diaria (${status.effectiveDailyDays ?? daysOverdue} días tras gracia${status.lateFeeCapNotice ? ` - ${status.lateFeeCapNotice}` : ''}): ${formatCurrency(dailyLateFee, admin.currencySymbol)}\n` : ''}${paidAmount > 0 ? `• Pagos / Abonos aplicados:               -${formatCurrency(paidAmount, admin.currencySymbol)}\n` : ''}------------------------------------------------------
${isCurrentPaid ? 'TOTAL LIQUIDADO:' : 'TOTAL A PAGAR:'}                             ${formatCurrency(isCurrentPaid ? paidAmount : totalDue, admin.currencySymbol)}
------------------------------------------------------
BALANCES PENDIENTES SEGREGADOS:
- Renta pendiente:                        ${formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
${property.utilitiesWaterActive ? `- Agua pendiente:                         ${formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}\n` : ''}${property.utilitiesElectricActive ? `- Electricidad (LUMA / AEE) pendiente:    ${formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}\n` : ''}`}
${isNextMonth && isUtilityActive ? nextPeriodInfo?.hasUnpaidUtilities ? `\nNOTA SOBRE UTILIDADES:\nSe incluyen en el total a pagar las utilidades pendientes de liquidar del mes corriente (Agua: ${formatCurrency(waterAmount, admin.currencySymbol)}, Luz: ${formatCurrency(electricAmount, admin.currencySymbol)}). El consumo nuevo de este próximo ciclo variará según el consumo real y se notificará cuando los proveedores emitan la próxima factura.\n` : `\nNOTA SOBRE UTILIDADES:\nEn la última factura recibida el costo de utilidades fue de ${formatCurrency(lastMonthUtilitiesTotal, admin.currencySymbol)}${property.utilitiesWaterActive && property.utilitiesElectricActive ? ` (Agua: ${formatCurrency(lastMonthWater, admin.currencySymbol)}, Luz: ${formatCurrency(lastMonthElectric, admin.currencySymbol)})` : ''}. El costo para este próximo ciclo variará según el consumo real y se agregará una vez recibida la factura del proveedor.\n` : ''}${isNextMonth ? `\nRECORDATORIO IMPORTANTE:\nLe recordamos que el pago de su renta vence el ${formatDate(activeDueDate)}. Cuenta con ${property.graceDays} días de gracia para no generar recargos.\n` : ''}
DATOS BANCARIOS PARA PAGO O TRANSFERENCIA:
${admin.bankDetails}

${admin.invoiceNote ? `Nota: ${admin.invoiceNote}\n\n` : ''}Agradecemos enviar su comprobante de pago a este correo o vía WhatsApp.

Atentamente,
${admin.companyName}
Tel: ${admin.phone} | ${admin.email}`;

  // Download PDF directly
  const handleDownloadPdf = async () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      return;
    }
    if (activeShareTab !== 'preview') {
      setActiveShareTab('preview');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    // Allow any pending layout/style recalculations to settle
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
    setIsGeneratingPdf(true);
    const docPrefix = isPaymentReceipt ? 'Recibo' : isCurrentPaid ? 'Comprobante' : isNextMonth ? 'Aviso' : 'Factura';
    await downloadElementAsPdf('printable-invoice', `${docPrefix}-${invoiceNumber}`);
    setIsGeneratingPdf(false);
  };

  // Safe Print
  const handlePrint = () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      return;
    }
    if (activeShareTab !== 'preview') {
      setActiveShareTab('preview');
    }
    const docPrefix = isPaymentReceipt ? 'Recibo' : isCurrentPaid ? 'Comprobante' : isNextMonth ? 'Aviso' : 'Factura';
    printElementSafely('printable-invoice', `${docPrefix}-${invoiceNumber}`);
  };

  // WhatsApp send
  const handleSendWhatsApp = () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      return;
    }
    const phoneDigits = cleanPhone(customPhone || targetWhatsAppPhone);
    const encodedText = encodeURIComponent(whatsAppFormattedMessage);
    openExternalUrl(`https://wa.me/${phoneDigits}?text=${encodedText}`);
  };

  // Email send
  const handleSendEmail = () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      return;
    }
    const targetMail = customEmail.trim() || property.tenant1.email || '';
    const subject = encodeURIComponent(emailFormattedSubject);
    const crlfBody = emailFormattedBody.replace(/\r?\n/g, '\r\n');
    const body = encodeURIComponent(crlfBody);
    window.location.href = `mailto:${targetMail}?subject=${subject}&body=${body}`;
  };

  const handleCopyWhatsApp = () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      return;
    }
    navigator.clipboard.writeText(whatsAppFormattedMessage);
    setCopiedType('whatsapp');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyEmail = () => {
    if (subscriptionState && !subscriptionState.canUseFullFeatures) {
      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
      return;
    }
    navigator.clipboard.writeText(emailFormattedBody);
    setCopiedType('email');
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[96vh] flex flex-col">
        {/* Top Control Bar - SIEMPRE VISIBLE Y ANCLADO ARRIBA (Enviar, Crear PDF, Imprimir y Cerrar) */}
        <div className="no-print sticky top-0 z-30 shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${
              isPaymentReceipt || isCurrentPaid
                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                : isNextMonth
                ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
                : 'bg-sky-600/30 text-sky-400 border border-sky-500/30'
            }`}>
              {isPaymentReceipt || isCurrentPaid ? (
                <Receipt className="w-5 h-5" />
              ) : isNextMonth ? (
                <Calendar className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold truncate">
                  {isPaymentReceipt
                    ? t.paymentReceiptTitle
                    : isNextMonth
                    ? t.nextMonthTitle
                    : isCurrentPaid
                    ? t.currentReceiptTitle
                    : t.currentInvoiceTitle}
                </h2>
                <span className={`hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                  isPaymentReceipt || isCurrentPaid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : isNextMonth
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                }`}>
                  {docTypeBadge}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Folio: <span className="font-semibold text-slate-200">{invoiceNumber}</span> • {property.propertyIdentifier}
              </p>
            </div>
          </div>

          {/* Action Bar: Enviar, Crear PDF, Imprimir, Cerrar */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Opciones directas de Envío en la franja superior */}
            <div className="inline-flex rounded-xl bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveShareTab('preview')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  activeShareTab === 'preview'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={lang === 'en' ? 'View printable document' : 'Ver hoja imprimible del documento'}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">
                  {isPaymentReceipt ? t.sheetReceipt : isCurrentPaid ? t.sheetStatement : t.sheetInvoice}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (subscriptionState && !subscriptionState.canUseFullFeatures) {
                    if (onOpenSubscriptionModal) onOpenSubscriptionModal();
                  } else {
                    setActiveShareTab('whatsapp');
                  }
                }}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  activeShareTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={lang === 'en' ? 'Prepare message for WhatsApp' : 'Preparar y enviar por WhatsApp'}
              >
                {subscriptionState && !subscriptionState.canUseFullFeatures ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (subscriptionState && !subscriptionState.canUseFullFeatures) {
                    if (onOpenSubscriptionModal) onOpenSubscriptionModal();
                  } else {
                    setActiveShareTab('email');
                  }
                }}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                  activeShareTab === 'email'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={lang === 'en' ? 'Prepare message for Email' : 'Preparar y enviar por Correo Electrónico'}
              >
                {subscriptionState && !subscriptionState.canUseFullFeatures ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
                <span>Email</span>
              </button>
            </div>

            {/* Crear / Descargar PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`px-2.5 sm:px-3 py-1.5 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 cursor-pointer ${
                subscriptionState && !subscriptionState.canUseFullFeatures
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
              title={lang === 'en' ? 'Download PDF file to your device' : 'Descargar archivo PDF directamente a tu dispositivo'}
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : subscriptionState && !subscriptionState.canUseFullFeatures ? (
                <Lock className="w-4 h-4 text-amber-200 shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              <span>{isGeneratingPdf ? t.generatingPdf : t.createPdf}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition border border-slate-700 cursor-pointer"
              title={lang === 'en' ? 'Print document' : 'Imprimir documento'}
            >
              {subscriptionState && !subscriptionState.canUseFullFeatures ? (
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Printer className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">{t.printDoc}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title={t.closeDoc}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUBSCRIPTION EXPIRED WARNING BANNER */}
        {subscriptionState && !subscriptionState.canUseFullFeatures && (
          <div className="no-print px-4 py-2 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border-b border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {lang === 'en'
                  ? 'Trial ended: WhatsApp & Email dispatches, PDF generation and printing require an active plan ($17.85/mo or $187.20/yr). Internal viewing & payment recording remain free.'
                  : 'Periodo de prueba de 6 semanas concluido: El envío por WhatsApp y Correo, creación de PDF e impresión requieren un plan ($17.85/mes o $187.20/año). La consulta en pantalla y registro de pagos siguen libres.'}
              </span>
            </div>
            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={onOpenSubscriptionModal}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[11px] shrink-0 transition shadow-xs cursor-pointer"
              >
                {lang === 'en' ? 'Choose Plan ($17.85/mo or $187.20/yr)' : 'Ver Planes ($17.85/mes o $187.20/año)'}
              </button>
            )}
          </div>
        )}

        {/* PROMINENT CYCLE SELECTOR BAR (Mes Corriente vs Próximo Mes Anticipado vs Recibo de Pago) */}
        <div className="no-print shrink-0 px-3 sm:px-6 py-2.5 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-800/90 border-b border-slate-200 dark:border-slate-700 w-full overflow-hidden text-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Header prompt & dynamic explanation */}
            <div className="space-y-0.5 min-w-0 max-w-full">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="truncate">{t.docQuestion}</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate sm:whitespace-normal">
                {isPaymentReceipt
                  ? `${t.docQuestionSubtitleReceipt} (${propertyPayments.length})`
                  : isNextMonth
                  ? `${t.docQuestionSubtitleNextMonth} (${nextPeriodInfo?.nextPeriodName || (lang === 'en' ? 'Next Month' : 'Próximo Mes')})`
                  : isCurrentPaid
                  ? `${t.docQuestionSubtitlePaid} (${status.currentPeriod})`
                  : `${t.docQuestionSubtitleInvoice} (${status.currentPeriod})`}
              </p>
            </div>

            {/* Delimited and responsive options ribbon */}
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              {/* 3 Document Options Group */}
              <div className="grid grid-cols-3 sm:flex items-center rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-300 dark:border-slate-700 shadow-xs max-w-full gap-1 w-full sm:w-auto">
                {/* Button Option 1: Current Month / Receipt */}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('current')}
                  title={`${isCurrentPaid ? t.btnCurrentReceipt : !status.isRentDueReached ? (status.pendingUtilitiesBalance > 0 ? 'Factura Utilidades' : 'Estado al Día') : t.btnCurrentInvoice} (${status.currentPeriod})`}
                  className={`min-w-0 flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 rounded-lg font-bold flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 transition cursor-pointer text-xs ${
                    invoiceMode === 'current'
                      ? isCurrentPaid || (!status.isRentDueReached && status.totalPendingBalance <= 0)
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isCurrentPaid || (!status.isRentDueReached && status.totalPendingBalance <= 0) ? (
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {isCurrentPaid
                      ? t.btnCurrentReceipt
                      : !status.isRentDueReached
                      ? status.pendingUtilitiesBalance > 0
                        ? lang === 'en'
                          ? 'Utilities Invoice'
                          : 'Factura Utilidades'
                        : lang === 'en'
                        ? 'Account Up to Date'
                        : 'Estado al Día'
                      : t.btnCurrentInvoice}
                  </span>
                  <span className="hidden xl:inline text-[10px] font-normal opacity-75 truncate max-w-[85px]">
                    ({status.currentPeriod})
                  </span>
                </button>

                {/* Button Option 2: Next Month / Advance Reminder */}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('next_month')}
                  title={`${!status.isRentDueReached ? (lang === 'en' ? 'Upcoming Notice' : 'Aviso Anticipado') : t.btnNextMonthInvoice} (${nextPeriodInfo?.nextPeriodName || (lang === 'en' ? 'Next Period' : 'Próximo Ciclo')})`}
                  className={`min-w-0 flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 rounded-lg font-bold flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 transition cursor-pointer text-xs ${
                    invoiceMode === 'next_month'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {!status.isRentDueReached
                      ? lang === 'en'
                        ? 'Upcoming Notice'
                        : 'Aviso Anticipado'
                      : t.btnNextMonthInvoice}
                  </span>
                  <span className="px-1.5 py-0.2 bg-amber-400 text-slate-900 text-[9px] sm:text-[10px] rounded font-extrabold uppercase shrink-0">
                    {t.btnNextMonthBadge}
                  </span>
                </button>

                {/* Button Option 3: Specific Payment Receipt */}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('payment_receipt')}
                  title={`${t.btnPaymentReceipt} (${propertyPayments.length})`}
                  className={`min-w-0 flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 rounded-lg font-bold flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 transition cursor-pointer text-xs ${
                    invoiceMode === 'payment_receipt'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.btnPaymentReceipt}</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded font-bold shrink-0 ${
                    invoiceMode === 'payment_receipt'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    {propertyPayments.length}
                  </span>
                </button>
              </div>

              {/* Quick Utilities Editor Toggle Button */}
              {(property.utilitiesWaterActive || property.utilitiesElectricActive) && onUpdatePropertyUtilities && (
                <button
                  type="button"
                  onClick={() => setShowQuickUtilitiesEdit(!showQuickUtilitiesEdit)}
                  className={`w-full sm:w-auto px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs shrink-0 cursor-pointer ${
                    showQuickUtilitiesEdit
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-400'
                  }`}
                  title={t.btnAdjustUtilitiesFull}
                >
                  <Settings2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{t.btnAdjustUtilities}</span>
                  <span className="text-[10px] font-normal opacity-85 hidden md:inline">
                    ({t.btnAdjustUtilitiesShort})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Utilities Editor Bar */}
        {showQuickUtilitiesEdit && (
          <div className="no-print shrink-0 px-3 sm:px-6 py-2.5 bg-amber-50/80 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <strong className="text-amber-950 dark:text-amber-200 block truncate">
                  {t.quickUtilitiesTitle}
                </strong>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 line-clamp-1 sm:line-clamp-none">
                  {t.quickUtilitiesSubtitle}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {property.utilitiesWaterActive && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{t.waterCost}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quickWater}
                    onChange={(e) => setQuickWater(e.target.value)}
                    className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-sky-700 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {property.utilitiesElectricActive && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{t.electricCost}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quickElectric}
                    onChange={(e) => setQuickElectric(e.target.value)}
                    className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-700 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveQuickUtilities}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>{quickEditSaved ? t.costsSaved : t.saveCosts}</span>
              </button>
            </div>
          </div>
        )}

        {/* Payment Selector Bar when in payment_receipt mode */}
        {isPaymentReceipt && (
          <div className="no-print shrink-0 px-3 sm:px-6 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {propertyPayments.length > 0 ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
                    {t.selectPaymentPrompt}
                  </span>
                </div>

                <select
                  value={selectedPaymentId}
                  onChange={(e) => setSelectedPaymentId(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-900 dark:text-emerald-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto max-w-full sm:max-w-md truncate cursor-pointer"
                >
                  {propertyPayments.map((p) => {
                    const conceptLabel = p.concept === 'agua'
                      ? (lang === 'en' ? 'Water' : 'Agua')
                      : p.concept === 'electricidad'
                      ? (lang === 'en' ? 'Power' : 'Luz')
                      : p.concept === 'general'
                      ? 'General'
                      : (lang === 'en' ? 'Rent' : 'Renta');
                    const payerLabel = lang === 'en' ? 'Paid by' : 'Pagó';
                    return (
                      <option key={p.id} value={p.id}>
                        {formatDate(p.date)} — {formatCurrency(p.amount, admin.currencySymbol)} ({conceptLabel}) — {payerLabel}: {p.payerName}
                      </option>
                    );
                  })}
                </select>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold text-xs">
                  <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t.noPaymentsRegistered}</span>
                </div>
                {isCurrentPaid && (
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('current')}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer"
                  >
                    {t.viewClearedReceipt}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* View Mode Tabs & Recipient Selector Bar */}
        <div className="no-print shrink-0 px-3 sm:px-6 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold max-w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveShareTab('preview')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeShareTab === 'preview'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isPaymentReceipt
                  ? t.sheetReceipt
                  : isCurrentPaid
                  ? t.sheetStatement
                  : t.sheetInvoice}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (subscriptionState && !subscriptionState.canUseFullFeatures) {
                  if (onOpenSubscriptionModal) onOpenSubscriptionModal();
                } else {
                  setActiveShareTab('whatsapp');
                }
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeShareTab === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {subscriptionState && !subscriptionState.canUseFullFeatures ? (
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Send className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{t.sendWhatsapp}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (subscriptionState && !subscriptionState.canUseFullFeatures) {
                  if (onOpenSubscriptionModal) onOpenSubscriptionModal();
                } else {
                  setActiveShareTab('email');
                }
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeShareTab === 'email'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {subscriptionState && !subscriptionState.canUseFullFeatures ? (
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Mail className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{t.emailTemplate}</span>
            </button>
          </div>

          {/* Recipient Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{t.recipientLabel}</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setRecipientChoice('tenant1')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  recipientChoice === 'tenant1'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                1: {property.tenant1.name.split(' ')[0]}
              </button>

              {property.tenant2 && (
                <button
                  type="button"
                  onClick={() => setRecipientChoice('tenant2')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    recipientChoice === 'tenant2'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  2: {property.tenant2.name.split(' ')[0]}
                </button>
              )}

              {property.tenant2 && (
                <button
                  type="button"
                  onClick={() => setRecipientChoice('both')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    recipientChoice === 'both'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.bothTenants}
                </button>
              )}
            </div>

            {/* Quick Period Name Editor Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedPeriodEdit(!showAdvancedPeriodEdit)}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold ml-1 cursor-pointer"
              title={lang === 'en' ? 'Manually edit period name if desired' : 'Modificar nombre del periodo manualmente si lo deseas'}
            >
              {showAdvancedPeriodEdit
                ? (lang === 'en' ? 'Hide edit' : 'Ocultar ajuste')
                : (lang === 'en' ? 'Edit period' : 'Editar periodo')}
            </button>
          </div>
        </div>

        {/* Advanced Period Manual Edit Box (Optional) */}
        {showAdvancedPeriodEdit && (
          <div className="no-print px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs flex items-center gap-3">
            <span className="font-semibold text-amber-900 dark:text-amber-200">Texto del Periodo:</span>
            <input
              type="text"
              value={customPeriod}
              onChange={(e) => setCustomPeriod(e.target.value)}
              placeholder="Ej: Octubre 2026"
              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-medium"
            />
            <span className="text-[11px] text-amber-700 dark:text-amber-300">
              Puedes cambiar el nombre del periodo si deseas emitir para una fecha o mes específico.
            </span>
          </div>
        )}

        {/* TAB 1: WHATSAPP FORMATTED DISPATCH VIEW */}
        {activeShareTab === 'whatsapp' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-5 bg-slate-50 dark:bg-slate-950 space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 mb-1">
                  <Send className="w-4 h-4 text-emerald-600" />
                  {isNextMonth
                    ? 'Envío de Factura / Recordatorio Anticipado por WhatsApp'
                    : isCurrentPaid
                    ? 'Envío de Recibo de Renta por WhatsApp'
                    : 'Envío de Factura del Mes por WhatsApp'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  {isNextMonth
                    ? `Notifica al inquilino con anticipación el valor a pagar para ${activePeriod} y la fecha límite de vencimiento (${formatDate(activeDueDate)}).`
                    : 'Mensaje con saltos de línea claros, viñetas visuales y negritas que se renderizan perfectamente en WhatsApp.'}
                </p>
              </div>

              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${isNextMonth ? 'bg-indigo-100 text-indigo-800' : isCurrentPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                {docTypeBadge}
              </span>
            </div>

            {/* Target Phone Input */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Número de WhatsApp del Inquilino:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="Ej: +52 55 1234 5678"
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    onClick={handleSendWhatsApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Send className="w-4 h-4" /> Abrir WhatsApp
                  </button>
                  <button
                    onClick={handleCopyWhatsApp}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedType === 'whatsapp' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'whatsapp' ? 'Copiado' : 'Copiar Texto'}</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Tip: Si abres WhatsApp Web o la App móvil, el mensaje aparecerá pre-llenado listo para enviar.
                </span>
              </div>

              {/* Visual WhatsApp Bubble Preview */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Vista Previa del Mensaje en WhatsApp:
                </span>
                <div className="bg-[#e5ddd5] dark:bg-slate-800 p-4 rounded-2xl shadow-inner font-sans">
                  <div className="max-w-md bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs text-slate-900 dark:text-slate-100 whitespace-pre-line text-xs border border-emerald-100 dark:border-slate-700">
                    {whatsAppFormattedMessage}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMAIL FORMATTED DISPATCH VIEW */}
        {activeShareTab === 'email' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-5 bg-slate-50 dark:bg-slate-950 space-y-4 text-xs">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
              <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-indigo-600" />
                {isNextMonth
                  ? 'Envío de Factura / Recordatorio Anticipado por Correo'
                  : 'Envío de Factura / Recibo por Correo Electrónico'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Plantilla formal con formato estructurado compatible con Gmail, Outlook y cualquier cliente de correo.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico del Inquilino:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="inquilino@correo.com"
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <button
                    onClick={handleSendEmail}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Mail className="w-4 h-4" /> Abrir en Mi Correo
                  </button>
                  <button
                    onClick={handleCopyEmail}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedType === 'email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'email' ? 'Copiado' : 'Copiar Texto'}</span>
                  </button>
                </div>
              </div>

              {/* Instructions on Attaching PDF */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                <div>
                  <strong>💡 Consejo de entrega:</strong> Descarga la factura en PDF haciendo clic en el botón superior y adjúntala en tu correo para un envío 100% formal.
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold shrink-0 ml-3"
                >
                  Descargar PDF
                </button>
              </div>

              {/* Email Content Preview */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Asunto del Correo:
                </span>
                <p className="font-semibold text-slate-900 dark:text-white p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mb-3">
                  {emailFormattedSubject}
                </p>

                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Cuerpo del Correo:
                </span>
                <pre className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
                  {emailFormattedBody}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRINTABLE INVOICE SHEET (DOCUMENT PREVIEW) */}
        <div
          id="printable-invoice"
          className={`flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 text-slate-900 bg-white print:overflow-visible print:p-0 print:m-0 ${
            activeShareTab !== 'preview' ? 'hidden' : ''
          }`}
        >
            {/* Header with Timbre & Company Logo */}
            <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start border-b-2 border-slate-800 pb-4 print:pb-2.5 gap-4 print:gap-2">
              <div className="flex items-start gap-4">
                {admin.logoUrl || profile.logoUrl ? (
                  <img
                    src={admin.logoUrl || profile.logoUrl}
                    alt="Logo Empresa"
                    className="w-20 h-20 object-contain rounded-lg border border-slate-200 p-1 print:w-16 print:h-16"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center p-3 shadow-md shrink-0 print:w-14 print:h-14">
                    <Building2 className="w-9 h-9 text-sky-400 print:w-7 print:h-7" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl print:text-xl font-black tracking-tight text-slate-900 uppercase">
                    {admin.companyName || profile.companyName}
                  </h1>
                  {admin.landlordName && <p className="text-xs font-semibold text-slate-700">{admin.landlordName}</p>}
                  {admin.taxId && <p className="text-xs text-slate-500">RFC/ID: {admin.taxId}</p>}
                  {admin.address && <p className="text-xs text-slate-500">{admin.address}</p>}
                  <p className="text-xs text-slate-500">
                    Tel: {admin.phone || profile.phone} {admin.email || profile.email ? `• ${admin.email || profile.email}` : ''}
                  </p>
                </div>
              </div>

              <div className="sm:text-right bg-slate-50 p-3 print:p-2 rounded-xl border border-slate-200 w-full sm:w-auto">
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider mb-1 ${
                  isNextMonth
                    ? 'bg-indigo-700 text-white'
                    : isCurrentPaid
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-900 text-white'
                }`}>
                  {docTypeBadge}
                </span>
                <p className="text-sm font-bold text-slate-800">Folio: {invoiceNumber}</p>
                <p className="text-xs text-slate-600">Fecha de Emisión: {formatDate(todayStr)}</p>
                <p className="text-xs font-bold text-sky-700">Periodo a Pagar: {activePeriod}</p>
                <p className="text-xs font-semibold text-slate-800">Fecha Límite: {formatDate(activeDueDate)}</p>
              </div>
            </div>

            {/* Advance Notice Banner or Paid Receipt Banner */}
            {isNextMonth && (
              <div className="my-3 print:my-2 p-3 print:p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 text-xs flex items-center gap-3">
                <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold block text-indigo-900">
                    Recordatorio de Factura Anticipada ({activePeriod}):
                  </span>
                  <span className="text-[11px] text-indigo-800">
                    Se emite con anticipación para facilitar su programación de pago oportuno. Su renta vence el <strong>{formatDate(activeDueDate)}</strong> (cuenta con <strong>{property.graceDays} días de gracia</strong> hasta el {formatDate(nextPeriodInfo?.graceDateStr)} para evitar recargos).
                  </span>
                </div>
              </div>
            )}

            {isCurrentPaid && (
              <div className="my-3 print:my-2 p-3 print:p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block text-emerald-900">
                    Comprobante de Pago Liquidado:
                  </span>
                  <span className="text-[11px] text-emerald-800">
                    Se hace constar que el inquilino ha cubierto a satisfacción el importe total correspondiente al periodo <strong>{activePeriod}</strong>. Cuenta al corriente.
                  </span>
                </div>
              </div>
            )}

            {/* Recipient and Property Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-3 py-3.5 print:py-2 border-b border-slate-200 text-xs">
              <div className="bg-slate-50/80 p-3.5 print:p-2.5 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-1.5 text-[11px] text-sky-800">
                  <User className="w-3.5 h-3.5" /> Dirigido a (Inquilino):
                </h3>
                <p className="text-sm font-bold text-slate-900">{recipientName}</p>
                {recipientId && <p className="text-slate-600">Identificación: {recipientId}</p>}
                <p className="text-slate-600">Teléfono: {recipientPhone}</p>
                {recipientEmail && <p className="text-slate-600">Correo: {recipientEmail}</p>}
              </div>

              <div className="bg-slate-50/80 p-3.5 print:p-2.5 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-1.5 text-[11px] text-sky-800">
                  <Building2 className="w-3.5 h-3.5" /> Inmueble en Arrendamiento:
                </h3>
                <p className="text-sm font-bold text-slate-900">{property.propertyIdentifier}</p>
                <p className="text-slate-600">{property.address}</p>
                <p className="text-slate-600">Día de pago estipulado: {property.rentDueDay} de cada mes</p>
                <p className="text-slate-600">Vencimiento de contrato: {formatDate(property.contractEndDate)}</p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="py-4">
              {isPaymentReceipt && activePayment ? (
                /* SPECIFIC PAYMENT RECEIPT TABLE */
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 text-sm">
                        Comprobante de Recepción de Pago
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px]">
                        {activePayment.paymentMethod.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-emerald-800 text-[11px]">
                      Se certifica la recepción de <strong>{formatCurrency(activePayment.amount, admin.currencySymbol)}</strong> de parte de <strong>{activePayment.payerName}</strong> en fecha <strong>{formatDate(activePayment.date)}</strong> por concepto de <strong>{conceptLabel}</strong>.
                      {activePayment.reference && <span> (Referencia / Folio bancario: {activePayment.reference})</span>}
                    </p>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-y border-slate-300">
                        <th className="py-2.5 px-3">Concepto Liquidado (Detallado por Administrador)</th>
                        <th className="py-2.5 px-3 text-center">Estatus</th>
                        <th className="py-2.5 px-3 text-right">Importe Liquidado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(activePayment.appliedToLateFees || 0) > 0 && (
                        <tr className="bg-rose-50/50">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-rose-900">Lo pagado en Cargos por Mora / Demora</p>
                            <p className="text-[11px] text-rose-700">Satisfacción prioritaria de recargos por atraso</p>
                          </td>
                          <td className="py-2.5 px-3 text-center text-rose-800 font-medium">Cubierto</td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-900">
                            {formatCurrency(activePayment.appliedToLateFees || 0, admin.currencySymbol)}
                          </td>
                        </tr>
                      )}

                      {(activePayment.appliedToRent || 0) > 0 && (
                        <tr className="bg-emerald-50/40">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-emerald-900">Lo pagado en Renta Mensual Convenida</p>
                            <p className="text-[11px] text-emerald-700">Abono o liquidación a renta contractual del periodo</p>
                          </td>
                          <td className="py-2.5 px-3 text-center text-emerald-800 font-medium">Cubierto</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-900">
                            {formatCurrency(activePayment.appliedToRent || 0, admin.currencySymbol)}
                          </td>
                        </tr>
                      )}

                      {(activePayment.appliedToDeposit || 0) > 0 && (
                        <tr className="bg-indigo-50/50">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-indigo-900">Lo pagado en Depósito Requerido en Contrato</p>
                            <p className="text-[11px] text-indigo-700">Depósito de garantía estipulado en el contrato de arrendamiento</p>
                          </td>
                          <td className="py-2.5 px-3 text-center text-indigo-800 font-medium">Cubierto</td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-900">
                            {formatCurrency(activePayment.appliedToDeposit || 0, admin.currencySymbol)}
                          </td>
                        </tr>
                      )}

                      {(activePayment.appliedToWater || 0) > 0 && (
                        <tr className="bg-sky-50/50">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-sky-900">Lo pagado en Utilidad de Agua Potable</p>
                            <p className="text-[11px] text-sky-700">Abono o liquidación a la factura de consumo de agua</p>
                          </td>
                          <td className="py-2.5 px-3 text-center text-sky-800 font-medium">Cubierto</td>
                          <td className="py-2.5 px-3 text-right font-bold text-sky-900">
                            {formatCurrency(activePayment.appliedToWater || 0, admin.currencySymbol)}
                          </td>
                        </tr>
                      )}

                      {(activePayment.appliedToElectric || 0) > 0 && (
                        <tr className="bg-amber-50/50">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-amber-900">Lo pagado en Utilidad de Electricidad (LUMA / AEE)</p>
                            <p className="text-[11px] text-amber-700">Abono o liquidación a la factura de consumo de electricidad</p>
                          </td>
                          <td className="py-2.5 px-3 text-center text-amber-800 font-medium">Cubierto</td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-900">
                            {formatCurrency(activePayment.appliedToElectric || 0, admin.currencySymbol)}
                          </td>
                        </tr>
                      )}

                      {/* If no breakdown exists, show general line */}
                      {!(activePayment.appliedToLateFees || activePayment.appliedToRent || activePayment.appliedToDeposit || activePayment.appliedToWater || activePayment.appliedToElectric) && (
                        <tr>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-800">{conceptLabel}</p>
                            <p className="text-[11px] text-slate-500">Pago acreditado a la cuenta del arrendamiento</p>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">Acreditado</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(activePayment.amount, admin.currencySymbol)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Mandatory Nota al Calce banner */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 text-xs italic text-slate-800">
                    <strong>Nota al Calce:</strong> {activePayment.applicationFootnote || 'Pago acreditado según los términos y prelación estipulados en contrato.'}
                  </div>
                </div>
              ) : isPaymentReceipt && !activePayment ? (
                <div className="p-6 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center mx-auto">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    No hay entradas de pago registradas para esta propiedad
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Para emitir un recibo individual con su desglose de cargos por mora, renta y utilidades, primero debe registrar una entrada de pago desde la tarjeta de la propiedad.
                  </p>
                  {isCurrentPaid && (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('current')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Ver Recibo de Pago Liquidado del Mes Actual
                    </button>
                  )}
                </div>
              ) : (
                /* MONTHLY INVOICE / STATEMENT TABLE WITH SEGREGATED UTILITIES */
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-y border-slate-300">
                      <th className="py-2.5 px-3">Concepto / Descripción</th>
                      <th className="py-2.5 px-3 text-center">Periodo / Detalle</th>
                      <th className="py-2.5 px-3 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* 1. Monthly Rent */}
                    <tr>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>
                            {isNextMonth
                              ? `Renta Mensual (${activePeriod}) - Próximo Ciclo`
                              : `Renta Mensual de Arrendamiento (${activePeriod})`}
                          </span>
                          {!isNextMonth && !isRentDueReached && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              Inicia día {property.rentDueDay} (Aún no exigible)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {isNextMonth
                            ? `Facturación anticipada. Fecha de vencimiento: ${formatDate(activeDueDate)} (Cuenta con ${property.graceDays} días de gracia)`
                            : !isRentDueReached
                            ? `Renta mensual convenida: ${formatCurrency(rent, admin.currencySymbol)}. Fecha de cobro: ${formatDate(activeDueDate)}. Cuenta con ${property.graceDays} días de gracia (hasta el ${formatDate(graceDateStr)}) sin recargos.`
                            : `Uso y goce del inmueble según contrato suscrito. Vencimiento: ${formatDate(activeDueDate)}.`}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {isNextMonth ? activePeriod : !isRentDueReached ? `Día ${property.rentDueDay} de cada mes` : activePeriod}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                        {formatCurrency(currentRentBilled, admin.currencySymbol)}
                      </td>
                    </tr>

                    {/* 2. Water Utility */}
                    {property.utilitiesWaterActive && waterAmount > 0 && (
                      <tr className="bg-sky-50/30">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-semibold text-sky-950">
                            <Droplets className="w-3.5 h-3.5 text-sky-600" />
                            <span>
                              {isNextMonth
                                ? 'Utilidad de Agua Potable (Pendiente de Liquidación Mes Corriente)'
                                : 'Utilidad de Agua Potable (Consumo Mes Anterior)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-sky-800">
                            {isNextMonth
                              ? 'Cargo de agua pendiente de pago del mes corriente incorporado al balance a pagar'
                              : 'Cargo por consumo según factura recibida del proveedor'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-sky-800">
                          {isNextMonth ? 'Mes corriente' : 'Factura anterior'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-sky-900">
                          {formatCurrency(waterAmount, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}

                    {/* 3. Electric Utility */}
                    {property.utilitiesElectricActive && electricAmount > 0 && (
                      <tr className="bg-amber-50/30">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              {isNextMonth
                                ? 'Utilidad de Electricidad (LUMA / AEE) (Pendiente de Liquidación Mes Corriente)'
                                : 'Utilidad de Electricidad (LUMA / AEE) (Consumo Mes Anterior)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            {isNextMonth
                              ? 'Cargo de electricidad pendiente de pago del mes corriente incorporado al balance a pagar'
                              : 'Cargo por consumo según factura recibida del proveedor'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-800">
                          {isNextMonth ? 'Mes corriente' : 'Factura anterior'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-900">
                          {formatCurrency(electricAmount, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}

                    {/* 3.1 Maintenance / Cuota (if active) */}
                    {property.utilitiesMaintenanceActive && maintenanceAmount > 0 && (
                      <tr className="bg-purple-50/40">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-purple-900">
                              {isNextMonth
                                ? 'Cuota de Mantenimiento / Residentes (Pendiente Mes Corriente)'
                                : 'Mantenimiento / Cuota de Residentes'}
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-800">
                            {isNextMonth
                              ? 'Cuota de mantenimiento pendiente del mes corriente'
                              : 'Cuota contractual de mantenimiento de áreas comunes y residentes'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-purple-800">
                          {isNextMonth ? 'Mes corriente' : 'Cuota mensual'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-purple-900">
                          {formatCurrency(maintenanceAmount, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}

                    {/* 4. Previous Balances (if any) */}
                    {prevBalance > 0 && (
                      <tr className="bg-amber-50/40">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-amber-900">
                            {isNextMonth ? 'Saldo Pendiente Anterior Acumulado' : 'Balances Atrasados No Pagados'}
                          </p>
                          <p className="text-[11px] text-amber-700">
                            {isNextMonth
                              ? 'Saldo no liquidado arrastrado de meses previos a la emisión'
                              : 'Saldos atrasados no liquidados de rentas, moras o utilidades previas'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-800">Saldo impago</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-900">
                          {formatCurrency(prevBalance, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}

                    {/* 5. Base Late Fee (if overdue in current month) */}
                    {!isNextMonth && baseLateFee > 0 && (
                      <tr className="bg-rose-50/40">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-rose-900">Cargo Base por Demora en Pago</p>
                          <p className="text-[11px] text-rose-700">Recargo por exceder los {property.graceDays} días de gracia</p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-800">Cargo fijo</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-rose-900">
                          {formatCurrency(baseLateFee, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}

                    {/* 6. Daily Late Fee (if overdue in current month) */}
                    {!isNextMonth && dailyLateFee > 0 && (
                      <tr className="bg-rose-50/40">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-rose-900">Cargo por Demora Diaria</p>
                          <p className="text-[11px] text-rose-700">
                            {status.effectiveDailyDays !== undefined && status.effectiveDailyDays < daysOverdue
                              ? `${status.effectiveDailyDays} días de demora computados tras los ${property.graceDays} días de gracia (${daysOverdue} transcurridos, tope máx. aplicado) × ${formatCurrency(property.lateFeeDaily, admin.currencySymbol)}/día`
                              : `${daysOverdue} días de demora tras los ${property.graceDays} días de gracia × ${formatCurrency(property.lateFeeDaily, admin.currencySymbol)}/día`}
                            {status.lateFeeCapNotice ? ` • ${status.lateFeeCapNotice}` : ''}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-800">
                          {status.effectiveDailyDays ?? daysOverdue} días
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-rose-900">
                          {formatCurrency(dailyLateFee, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}

                    {/* 7. Payments applied */}
                    {paidAmount > 0 && (
                      <tr className="bg-emerald-50/40">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-emerald-900">
                            {isNextMonth ? 'Abonos Anticipados Registrados' : 'Abonos / Pagos Registrados'}
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            {isCurrentPaid
                              ? 'Pago total recibido a entera satisfacción'
                              : 'Crédito aplicado a la cuenta en el periodo'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-800">
                          {isCurrentPaid ? 'Liquidado total' : 'Abono'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-900">
                          -{formatCurrency(paidAmount, admin.currencySymbol)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Subtotal & Total Box */}
            <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 print:gap-3 pt-2 border-t-2 border-slate-800">
              <div className="w-full sm:w-1/2 print:w-1/2 text-xs space-y-2 print:space-y-1">
                <div className="p-3 print:p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-1">Información para Transferencia Bancaria:</h4>
                  <p className="text-slate-700 font-mono text-[11px] whitespace-pre-line">
                    {admin.bankDetails || profile.bankDetails}
                  </p>
                </div>
                {(admin.invoiceNote || profile.invoiceNote) && (
                  <p className="text-[11px] text-slate-500 italic">
                    * {admin.invoiceNote || profile.invoiceNote}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-5/12 print:w-5/12 text-xs space-y-1.5 print:space-y-1">
                <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                  <span>
                    {isNextMonth
                      ? 'Renta próximo mes:'
                      : isPaymentReceipt
                      ? 'Renta convenida mensual:'
                      : !isRentDueReached
                      ? `Renta base del mes (Exigible día ${property.rentDueDay}):`
                      : 'Renta base del mes:'}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(currentRentBilled, admin.currencySymbol)}
                  </span>
                </div>

                {/* Segregated utility lines in invoice summary */}
                {property.utilitiesWaterActive && waterAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-sky-800">
                    <span>
                      {isNextMonth
                        ? 'Utilidad de Agua (Pendiente mes corriente):'
                        : 'Utilidad de Agua (Consumo anterior):'}
                    </span>
                    <span className="font-medium">{formatCurrency(waterAmount, admin.currencySymbol)}</span>
                  </div>
                )}
                {property.utilitiesElectricActive && electricAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-amber-800">
                    <span>
                      {isNextMonth
                        ? 'Utilidad de Electricidad (LUMA / AEE) (Pendiente mes corriente):'
                        : 'Utilidad de Electricidad (LUMA / AEE) (Consumo anterior):'}
                    </span>
                    <span className="font-medium">{formatCurrency(electricAmount, admin.currencySymbol)}</span>
                  </div>
                )}

                {prevBalance > 0 && !isPaymentReceipt && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-amber-800">
                    <span>{isNextMonth ? 'Saldo acumulado previo:' : 'Balances atrasados no pagados:'}</span>
                    <span className="font-medium">{formatCurrency(prevBalance, admin.currencySymbol)}</span>
                  </div>
                )}
                {!isNextMonth && !isPaymentReceipt && (baseLateFee > 0 || dailyLateFee > 0) && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-rose-700">
                    <span>Recargos por mora:</span>
                    <span className="font-medium">{formatCurrency(baseLateFee + dailyLateFee, admin.currencySymbol)}</span>
                  </div>
                )}
                {paidAmount > 0 && !isPaymentReceipt && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700">
                    <span>{isNextMonth ? 'Abonos anticipados:' : 'Abonos realizados:'}</span>
                    <span className="font-medium">-{formatCurrency(paidAmount, admin.currencySymbol)}</span>
                  </div>
                )}

                {/* Total Box */}
                {isPaymentReceipt && activePayment ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between py-2 px-3 bg-emerald-700 text-white rounded-xl text-sm font-black">
                      <span>TOTAL PAGADO:</span>
                      <span className="text-base text-white">
                        {formatCurrency(activePayment.amount, admin.currencySymbol)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-300 space-y-1 text-[11px]">
                      <span className="font-bold text-slate-700 block">Saldos Restantes Tras Este Pago:</span>
                      <div className="flex justify-between text-slate-600">
                        <span>Renta pendiente:</span>
                        <span className="font-semibold">{formatCurrency(status.pendingRentBalance, admin.currencySymbol)}</span>
                      </div>
                      {property.utilitiesWaterActive && (
                        <div className="flex justify-between text-sky-800">
                          <span>Agua pendiente:</span>
                          <span className="font-semibold">{formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}</span>
                        </div>
                      )}
                      {property.utilitiesElectricActive && (
                        <div className="flex justify-between text-amber-800">
                          <span>Electricidad (LUMA / AEE):</span>
                          <span className="font-semibold">{formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                        <span>Total Adeudado:</span>
                        <span className="text-rose-600">{formatCurrency(status.totalPendingBalance, admin.currencySymbol)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-2 px-3 bg-slate-900 text-white rounded-xl text-sm font-black mt-2">
                      <span>{isCurrentPaid ? 'TOTAL LIQUIDADO:' : 'TOTAL A PAGAR:'}</span>
                      <span className="text-base text-emerald-400">
                        {formatCurrency(isCurrentPaid ? paidAmount : totalDue, admin.currencySymbol)}
                      </span>
                    </div>

                    {/* Segregated Pending Balances Breakdown when balance remains */}
                    {!isCurrentPaid && !isNextMonth && totalDue > 0 && (
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] space-y-0.5 text-slate-600">
                        <span className="font-bold block text-slate-700 uppercase">Partidas del Saldo Pendiente:</span>
                        <div className="flex justify-between">
                          <span>Renta: {formatCurrency(status.pendingRentBalance, admin.currencySymbol)}</span>
                          {property.utilitiesWaterActive && <span>Agua: {formatCurrency(status.pendingWaterBalance, admin.currencySymbol)}</span>}
                          {property.utilitiesElectricActive && <span>Electricidad (LUMA / AEE): {formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}</span>}
                          {status.totalLateFees > 0 && <span>Mora: {formatCurrency(status.pendingLateFeesBalance, admin.currencySymbol)}</span>}
                        </div>
                      </div>
                    )}

                    {isCurrentPaid && (
                      <div className="p-2 bg-emerald-100 text-emerald-800 font-bold text-center rounded-lg text-xs mt-1">
                        ✓ CUENTA AL DÍA - PAGADA EN SU TOTALIDAD
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Informational Utilities Notice for Next Month */}
            {isNextMonth && isUtilityActive && (
              <div className="mt-3 print:mt-2 p-3 print:p-2 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>
                    {nextPeriodInfo?.hasUnpaidUtilities
                      ? 'Nota de Utilidades Pendientes del Mes Corriente e Importe Variable'
                      : 'Nota Informativa sobre Cargos de Utilidades (Consumo Variable)'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {nextPeriodInfo?.hasUnpaidUtilities ? (
                    <>
                      Al no haberse registrado aún el pago de utilidades del mes corriente (
                      {nextPeriodInfo.unpaidWaterCurrent > 0 && <span>Agua: <strong>{formatCurrency(nextPeriodInfo.unpaidWaterCurrent, admin.currencySymbol)}</strong></span>}
                      {nextPeriodInfo.unpaidWaterCurrent > 0 && nextPeriodInfo.unpaidElectricCurrent > 0 && <span>, </span>}
                      {nextPeriodInfo.unpaidElectricCurrent > 0 && <span>Electricidad (LUMA / AEE): <strong>{formatCurrency(nextPeriodInfo.unpaidElectricCurrent, admin.currencySymbol)}</strong></span>}
                      ), dicho importe se incluye en el desglose y se suma al balance total a pagar. Para el próximo ciclo de renta, el consumo nuevo se añadirá una vez se emita la respectiva factura del proveedor.
                    </>
                  ) : (
                    <>
                      En la última factura recibida el consumo de utilidades fue de <strong>{formatCurrency(lastMonthUtilitiesTotal, admin.currencySymbol)}</strong>
                      {property.utilitiesWaterActive && property.utilitiesElectricActive && (
                        <span> (Agua: {formatCurrency(lastMonthWater, admin.currencySymbol)}, Electricidad (LUMA / AEE): {formatCurrency(lastMonthElectric, admin.currencySymbol)})</span>
                      )}.
                      El costo para este próximo periodo es variable según el consumo real y <strong>no se suma a este total preliminar</strong>. Tan pronto los proveedores emitan la próxima factura se le indicará y agregará la cantidad exacta a pagar por dicho concepto.
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Physical Delivery Receipt Cutoff (Talón de Entrega) */}
            <div className="mt-6 print:mt-3 pt-3 print:pt-2 border-t-2 border-dashed border-slate-300 text-[11px] print:text-[10px]">
              <div className="flex items-center justify-between text-slate-400 mb-2 print:mb-1">
                <span>✄ Recortar comprobante de entrega física</span>
                <span>Folio: {invoiceNumber}</span>
              </div>
              <div className="grid grid-cols-2 gap-8 print:gap-6 text-center pt-4 print:pt-2">
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-800">{admin.landlordName || profile.landlordName}</p>
                  <p className="text-[10px] text-slate-500">Firma del Arrendador / Administrador</p>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-800">{recipientName}</p>
                  <p className="text-[10px] text-slate-500">Firma de Recibido del Inquilino</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};
