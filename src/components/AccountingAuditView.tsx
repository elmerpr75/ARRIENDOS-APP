import React, { useState, useMemo, useEffect } from 'react';
import { Property, Payment, Administrator, LandlordProfile, Expense } from '../types';
import {
  calculatePropertyStatus,
  formatCurrency,
  formatDate,
  parseLocalDate,
  computeMonthlyLateFee,
  getPropertyRentForDate,
} from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import { downloadElementAsPdf, printElementSafely } from '../utils/pdfGenerator';
import { isLifetimeVip } from '../utils/subscription';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Filter,
  Building2,
  Calendar,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Zap,
  Wrench,
  DollarSign,
  ShieldCheck,
  Search,
  RefreshCw,
  Info,
  History,
  FolderArchive,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  CalendarRange,
  TrendingDown,
  Tag,
  Layers,
  ArrowDownLeft,
  Scale,
} from 'lucide-react';

interface AccountingAuditViewProps {
  properties: Property[];
  payments: Payment[];
  expenses?: Expense[];
  expenseCategories?: string[];
  administrators: Administrator[];
  profile?: LandlordProfile;
  onOpenInvoice?: (status: any, mode?: 'current' | 'next_month') => void;
  onRegisterPayment?: (propertyId: string, defaultPayer?: string, defaultAmount?: number) => void;
  canExportCode?: boolean;
}

export interface HistoricalLedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  conceptType: 'renta' | 'mora' | 'agua' | 'electricidad' | 'mantenimiento' | 'gasto';
  conceptName: string;
  transactionTitle: string;
  obligationAmount: number | null; // Cantidad obligación contractual o gasto incurrido
  contractualDueDate: string | null; // Fecha contractual a pagarla
  paymentAmount: number | null; // Cantidad registrada pagada
  paymentDate: string | null; // Fecha en que se pagó
  runningBalance: number; // Balance calculado a la fecha de cada línea
  notes: string; // Evidencia auditable / cálculo de mora / justificación
  isPayment: boolean;
  isLateFee: boolean;
  payerName?: string;
  method?: string;
  reference?: string;
  category?: string;
}

export interface CashflowLedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  concept: string; // Ej: Cobro Renta, Gasto Plomería, etc.
  category: string;
  payeeOrPayer?: string;
  receiptOrReference?: string;
  incomeAmount: number | null; // Ingreso cobrado (+)
  expenseAmount: number | null; // Gasto incurrido (-)
  runningBalance: number; // Balance progresivo (Ingresos Cobrados - Gastos)
  notes?: string;
}

export interface PropertyHistoricalData {
  rentEntries: HistoricalLedgerEntry[];
  rentTotalObligations: number;
  rentTotalPayments: number;
  rentFinalBalance: number;

  waterEntries: HistoricalLedgerEntry[];
  waterTotalObligations: number;
  waterTotalPayments: number;
  waterFinalBalance: number;

  electricEntries: HistoricalLedgerEntry[];
  electricTotalObligations: number;
  electricTotalPayments: number;
  electricFinalBalance: number;

  maintenanceEntries: HistoricalLedgerEntry[];
  maintenanceTotalObligations: number;
  maintenanceTotalPayments: number;
  maintenanceFinalBalance: number;

  // Gastos Operativos de la Propiedad
  expenseEntries: HistoricalLedgerEntry[];
  expenseTotalAmount: number;

  // Conciliación de Flujo: Ingresos Cobrados vs Gastos Incurridos (Computado Consecutivamente por Fechas)
  cashflowEntries: CashflowLedgerEntry[];
  totalCashIncome: number;
  totalCashExpenses: number;
  netCashflowBalance: number;

  grandTotalObligations: number;
  grandTotalPayments: number;
  grandFinalBalance: number;
}

/**
 * Filters a ledger by an optional start/end date range.
 * If a startDateStr is present, prior obligations and payments are consolidated
 * into an initial opening balance entry ("Saldo Anterior al Período"), and subsequent
 * entries are re-sequenced with running balances starting from that opening balance.
 * If no startDateStr is present (TODO mode), all entries from the beginning of time are returned.
 */
function applyHistoryDateFilter(
  entries: HistoricalLedgerEntry[],
  conceptName: string,
  conceptType: 'renta' | 'mora' | 'agua' | 'electricidad' | 'mantenimiento' | 'gasto',
  startDateStr?: string,
  endDateStr?: string
): {
  filteredEntries: HistoricalLedgerEntry[];
  totalObligations: number;
  totalPayments: number;
  finalBalance: number;
} {
  // Sort all entries chronologically: obligations first if same date
  entries.sort((a, b) => {
    const cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
    if (cmp !== 0) return cmp;
    if (!a.isPayment && b.isPayment) return -1;
    if (a.isPayment && !b.isPayment) return 1;
    return 0;
  });

  // Calculate full progressive running balance across all time
  let running = 0;
  for (const entry of entries) {
    if (entry.obligationAmount !== null) running += entry.obligationAmount;
    if (entry.paymentAmount !== null) running -= entry.paymentAmount;
    entry.runningBalance = Math.round(running * 100) / 100;
  }

  const startTime = startDateStr && startDateStr.trim() !== '' ? parseLocalDate(startDateStr).getTime() : null;
  const endTime = endDateStr && endDateStr.trim() !== '' ? parseLocalDate(endDateStr).getTime() + (24 * 60 * 60 * 1000 - 1) : null;

  if (!startTime && !endTime) {
    const totalObligations = entries.reduce((s, e) => s + (e.obligationAmount || 0), 0);
    const totalPayments = entries.reduce((s, e) => s + (e.paymentAmount || 0), 0);
    const finalBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;
    return { filteredEntries: entries, totalObligations, totalPayments, finalBalance };
  }

  let priorObligations = 0;
  let priorPayments = 0;
  const filtered: HistoricalLedgerEntry[] = [];

  for (const entry of entries) {
    const entryTime = parseLocalDate(entry.date).getTime();
    if (startTime !== null && entryTime < startTime) {
      if (entry.obligationAmount !== null) priorObligations += entry.obligationAmount;
      if (entry.paymentAmount !== null) priorPayments += entry.paymentAmount;
    } else if (endTime === null || entryTime <= endTime) {
      filtered.push(entry);
    }
  }

  const priorBalance = Math.round((priorObligations - priorPayments) * 100) / 100;

  // If there were prior transactions or a non-zero balance before startDate, add an opening carryover row
  if (startTime !== null && (priorObligations > 0 || priorPayments > 0 || priorBalance !== 0)) {
    const openingEntry: HistoricalLedgerEntry = {
      id: `opening-${conceptType}-${startDateStr}`,
      date: startDateStr!,
      conceptType,
      conceptName,
      transactionTitle: `Saldo Anterior al Período (${formatDate(startDateStr)})`,
      obligationAmount: priorBalance > 0 ? priorBalance : null,
      contractualDueDate: startDateStr!,
      paymentAmount: priorBalance < 0 ? Math.abs(priorBalance) : null,
      paymentDate: startDateStr!,
      runningBalance: priorBalance,
      notes: `Balance acumulado arrastrado previo a la fecha inicial (${formatDate(startDateStr)}).`,
      isPayment: false,
      isLateFee: false,
    };
    filtered.unshift(openingEntry);
  }

  // Recalculate progressive running balances for the displayed window
  let windowRunning = 0;
  for (const entry of filtered) {
    if (entry.id.startsWith('opening-')) {
      windowRunning = entry.runningBalance;
    } else {
      if (entry.obligationAmount !== null) windowRunning += entry.obligationAmount;
      if (entry.paymentAmount !== null) windowRunning -= entry.paymentAmount;
      entry.runningBalance = Math.round(windowRunning * 100) / 100;
    }
  }

  const totalObligations = filtered.reduce((s, e) => s + (e.obligationAmount || 0), 0);
  const totalPayments = filtered.reduce((s, e) => s + (e.paymentAmount || 0), 0);
  const finalBalance = filtered.length > 0 ? filtered[filtered.length - 1].runningBalance : priorBalance;

  return { filteredEntries: filtered, totalObligations, totalPayments, finalBalance };
}

export function generatePropertyHistoricalData(
  property: Property,
  propPayments: Payment[],
  referenceDate: Date,
  includeRent: boolean,
  includeWater: boolean,
  includeElectric: boolean,
  includeMaintenance: boolean,
  includeExpenses: boolean,
  propExpenses: Expense[],
  companyAdmin: Administrator,
  historyStartDate?: string,
  historyEndDate?: string
): PropertyHistoricalData {
  const paymentTimes = propPayments
    .map((p) => parseLocalDate(p.date).getTime())
    .filter((t) => !isNaN(t));
  const earliestPaymentTime = paymentTimes.length > 0 ? Math.min(...paymentTimes) : null;
  const latestPaymentTime = paymentTimes.length > 0 ? Math.max(...paymentTimes) : null;

  let targetEnd: Date;
  if (historyEndDate && historyEndDate.trim() !== '') {
    targetEnd = parseLocalDate(historyEndDate);
  } else {
    // If no end date filter, evaluate strictly up to referenceDate (current date/period)
    // Never extend contractual obligations to future cycles that have not matured yet!
    targetEnd = referenceDate;
  }

  const refTime = targetEnd.getTime();
  const refYear = targetEnd.getFullYear();
  const refMonth = targetEnd.getMonth();

  // Find true earliest date among contract start date and all recorded payments
  // Find contract start date as strict baseline for tenant contractual obligations
  const contractStart = parseLocalDate(property.contractStartDate);
  const hasContractStart = !isNaN(contractStart.getTime());

  let earliestTime: number;
  if (hasContractStart) {
    earliestTime = contractStart.getTime();
  } else if (earliestPaymentTime !== null) {
    earliestTime = earliestPaymentTime;
  } else {
    // Default fallback: 1 year prior to refDate
    earliestTime = new Date(refYear - 1, refMonth, 1).getTime();
  }

  // Filter payments for current tenant (on or after contract start date)
  const tenantPropPayments = hasContractStart
    ? propPayments.filter((p) => parseLocalDate(p.date).getTime() >= contractStart.getTime())
    : propPayments;

  const earliestDate = new Date(earliestTime);
  let startYear = earliestDate.getFullYear();
  let startMonth = earliestDate.getMonth();

  if (startYear > refYear || (startYear === refYear && startMonth > refMonth)) {
    startYear = refYear;
    startMonth = refMonth;
  }

  const totalMonths = (refYear - startYear) * 12 + (refMonth - startMonth);
  const totalCycles = Math.max(1, totalMonths + 1);

  // 1. Renta & Moras
  const rentEntries: HistoricalLedgerEntry[] = [];
  let rentRunning = 0;

  if (includeRent) {
    // Collect all rent and late fee payments for current tenant
    const rentPaymentsList: Array<{
      id: string;
      date: string;
      rentAmt: number;
      lateAmt: number;
      pay: Payment;
    }> = [];

    for (const pay of tenantPropPayments) {
      const rAmt = Number(pay.appliedToRent) || (pay.concept === 'renta' ? Number(pay.amount) : 0);
      const lateAmt = Number(pay.appliedToLateFees) || (pay.concept === 'mora' ? Number(pay.amount) : 0);
      const isGeneric = (!pay.concept || pay.concept === 'general') &&
        !pay.appliedToRent && !pay.appliedToLateFees && !pay.appliedToWater && !pay.appliedToElectric && !pay.appliedToMaintenance && !pay.appliedToDeposit;
      const effectiveRentAmt = rAmt > 0 ? rAmt : (isGeneric ? Number(pay.amount) : 0);

      if (effectiveRentAmt > 0 || lateAmt > 0) {
        rentPaymentsList.push({
          id: pay.id,
          date: pay.date,
          rentAmt: effectiveRentAmt,
          lateAmt,
          pay,
        });

        if (effectiveRentAmt > 0) {
          rentEntries.push({
            id: `rent-pay-${pay.id}`,
            date: pay.date,
            conceptType: 'renta',
            conceptName: 'Renta Contractual',
            transactionTitle: `Pago Registrado: Renta (${pay.period || 'Abono de Renta'})`,
            obligationAmount: null,
            contractualDueDate: null,
            paymentAmount: effectiveRentAmt,
            paymentDate: pay.date,
            runningBalance: 0,
            notes: `Pagado por ${pay.payerName || property.tenant1.name} vía ${(pay.paymentMethod || 'transferencia').toUpperCase()}${pay.reference ? ` (Ref: ${pay.reference})` : ''}. ${pay.applicationFootnote || 'Acreditado a cuenta de renta.'}`,
            isPayment: true,
            isLateFee: false,
            payerName: pay.payerName,
            method: pay.paymentMethod,
            reference: pay.reference,
          });
        }

        if (lateAmt > 0) {
          rentEntries.push({
            id: `mora-pay-${pay.id}`,
            date: pay.date,
            conceptType: 'mora',
            conceptName: 'Recargos por Demora',
            transactionTitle: `Pago Registrado: Recargos por Demora (${pay.period || 'Abono Moras'})`,
            obligationAmount: null,
            contractualDueDate: null,
            paymentAmount: lateAmt,
            paymentDate: pay.date,
            runningBalance: 0,
            notes: `Abono de ${formatCurrency(lateAmt, companyAdmin.currencySymbol)} acreditado a liquidar penalidades por demora.`,
            isPayment: true,
            isLateFee: true,
            payerName: pay.payerName,
            method: pay.paymentMethod,
            reference: pay.reference,
          });
        }
      }
    }

    let accumulatedObligationsSoFar = 0;

    for (let c = 0; c < totalCycles; c++) {
      const monthIdx = startMonth + c;
      const cYear = startYear + Math.floor(monthIdx / 12);
      const cMonth = monthIdx % 12;
      const lastDay = new Date(cYear, cMonth + 1, 0).getDate();
      const dueDay = Math.min(property.rentDueDay || 1, lastDay);
      const dueDate = new Date(cYear, cMonth, dueDay, 0, 0, 0, 0);
      const dueDateStr = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      const periodName = `${new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(dueDate)} ${cYear}`;
      const periodNameCap = periodName.charAt(0).toUpperCase() + periodName.slice(1);

      const graceDays = Math.max(0, property.graceDays ?? 3);
      const graceDate = new Date(cYear, cMonth, dueDay + graceDays, 23, 59, 59, 999);
      const graceDateStr = `${graceDate.getFullYear()}-${String(graceDate.getMonth() + 1).padStart(2, '0')}-${String(graceDate.getDate()).padStart(2, '0')}`;

      if (dueDate.getTime() <= refTime) {
        const histPropStatus = property.status || 'rentado';
        const histIsAccruing = histPropStatus === 'rentado' || histPropStatus === 'en_proceso_legal';
        const cycleRent = histIsAccruing ? getPropertyRentForDate(property, dueDate) : 0;

        if (cycleRent > 0) {
          accumulatedObligationsSoFar += cycleRent;

          rentEntries.push({
            id: `rent-obl-${cYear}-${cMonth}`,
            date: dueDateStr,
            conceptType: 'renta',
            conceptName: 'Renta Contractual',
            transactionTitle: `Obligación contractual de Renta (${periodNameCap})`,
            obligationAmount: cycleRent,
            contractualDueDate: dueDateStr,
            paymentAmount: null,
            paymentDate: null,
            runningBalance: 0,
            notes: `Vencimiento contractual: ${formatDate(dueDateStr)}. Período de gracia: ${graceDays} días sin recargos (hasta ${formatDate(graceDateStr)}).`,
            isPayment: false,
            isLateFee: false,
          });

          // Evaluate whether late fee applies for this cycle:
          // We verify the tenant's cumulative rent balance at the grace deadline (graceDate).
          // Total rent paid by tenant on or before grace date (includes all prior advance payments + payments during grace):
          const rentPaidOnOrBeforeGrace = rentPaymentsList
            .filter((item) => parseLocalDate(item.date).getTime() <= graceDate.getTime())
            .reduce((sum, item) => sum + item.rentAmt, 0);

          const netBalanceAtGrace = accumulatedObligationsSoFar - rentPaidOnOrBeforeGrace;

          // CRITICAL: If the tenant maintains credit or zero balance (netBalanceAtGrace <= 0),
          // NO LATE FEES CAN BE COMPUTED OR CHARGED!
          if (netBalanceAtGrace > 0 && refTime > graceDate.getTime()) {
            const unpaidRent = Math.min(cycleRent, netBalanceAtGrace);
            const lateResult = computeMonthlyLateFee(
              property,
              dueDay,
              cYear,
              cMonth,
              targetEnd,
              unpaidRent
            );

            if (lateResult.totalLateFee > 0) {
              const dayAfterGrace = new Date(cYear, cMonth, dueDay + graceDays + 1, 0, 0, 0, 0);
              const dayAfterGraceStr = `${dayAfterGrace.getFullYear()}-${String(dayAfterGrace.getMonth() + 1).padStart(2, '0')}-${String(dayAfterGrace.getDate()).padStart(2, '0')}`;

              rentEntries.push({
                id: `mora-charge-${cYear}-${cMonth}`,
                date: dayAfterGraceStr,
                conceptType: 'mora',
                conceptName: 'Recargos por Demora',
                transactionTitle: `Cargo por Demora en Pago de Renta (${periodNameCap})`,
                obligationAmount: lateResult.totalLateFee,
                contractualDueDate: graceDateStr,
                paymentAmount: null,
                paymentDate: null,
                runningBalance: 0,
                notes: `Excedida ventana de gracia de ${graceDays} días sin liquidar saldo pendiente (${formatCurrency(unpaidRent, companyAdmin.currencySymbol)}). Cargo base: ${formatCurrency(lateResult.lateFeeBase, companyAdmin.currencySymbol)} + Demora diaria: ${lateResult.effectiveDailyDays}d × ${formatCurrency(property.lateFeeDaily, companyAdmin.currencySymbol)}/día = ${formatCurrency(lateResult.lateFeeDaily, companyAdmin.currencySymbol)}.${lateResult.cappedNotice ? ` ${lateResult.cappedNotice}` : ''}`,
                isPayment: false,
                isLateFee: true,
              });
            }
          }
        }
      }
    }

    // Sort rent entries chronologically: obligations first if same date
    rentEntries.sort((a, b) => {
      const cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      if (cmp !== 0) return cmp;
      if (!a.isPayment && b.isPayment) return -1;
      if (a.isPayment && !b.isPayment) return 1;
      return 0;
    });

    for (const entry of rentEntries) {
      if (entry.obligationAmount !== null) rentRunning += entry.obligationAmount;
      if (entry.paymentAmount !== null) rentRunning -= entry.paymentAmount;
      entry.runningBalance = Math.round(rentRunning * 100) / 100;
    }
  }

  // 2. Agua Potable
  const waterEntries: HistoricalLedgerEntry[] = [];
  let waterRunning = 0;
  const matchedWaterPaymentIds = new Set<string>();

  if (includeWater && property.utilitiesWaterActive) {
    for (let c = 0; c < totalCycles; c++) {
      const monthIdx = startMonth + c;
      const cYear = startYear + Math.floor(monthIdx / 12);
      const cMonth = monthIdx % 12;
      const lastDay = new Date(cYear, cMonth + 1, 0).getDate();
      const dueDay = Math.min(property.rentDueDay || 1, lastDay);
      const dueDate = new Date(cYear, cMonth, dueDay, 0, 0, 0, 0);
      const dueDateStr = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      const periodName = `${new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(dueDate)} ${cYear}`;
      const periodNameCap = periodName.charAt(0).toUpperCase() + periodName.slice(1);

      if (refTime >= dueDate.getTime()) {
        const waterCost = Number(property.utilitiesWaterAmount) || 0;
        if (waterCost > 0) {
          waterEntries.push({
            id: `water-obl-${cYear}-${cMonth}`,
            date: dueDateStr,
            conceptType: 'agua',
            conceptName: 'Utilidad de Agua Potable',
            transactionTitle: `Factura de Consumo: Agua Potable (${periodNameCap})`,
            obligationAmount: waterCost,
            contractualDueDate: dueDateStr,
            paymentAmount: null,
            paymentDate: null,
            runningBalance: 0,
            notes: `Consumo según factura del proveedor de agua. Partida en cuenta segregada de la renta.`,
            isPayment: false,
            isLateFee: false,
          });
        }

        const matchingWaterPays = propPayments.filter((p) => {
          if (matchedWaterPaymentIds.has(p.id)) return false;
          if (p.period && p.period.toLowerCase().trim() === periodNameCap.toLowerCase().trim()) return true;
          const pDate = parseLocalDate(p.date);
          return pDate.getFullYear() === cYear && pDate.getMonth() === cMonth;
        });

        for (const pay of matchingWaterPays) {
          const wPaid = Number(pay.appliedToWater) || (pay.concept === 'agua' ? Number(pay.amount) : 0);
          if (wPaid > 0) {
            matchedWaterPaymentIds.add(pay.id);
            waterEntries.push({
              id: `water-pay-${pay.id}`,
              date: pay.date,
              conceptType: 'agua',
              conceptName: 'Utilidad de Agua Potable',
              transactionTitle: `Pago Registrado: Agua Potable (${periodNameCap})`,
              obligationAmount: null,
              contractualDueDate: dueDateStr,
              paymentAmount: wPaid,
              paymentDate: pay.date,
              runningBalance: 0,
              notes: `Pagado por ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de agua.'}`,
              isPayment: true,
              isLateFee: false,
            });
          }
        }
      }
    }

    // Capture any remaining water payments
    for (const pay of propPayments) {
      if (matchedWaterPaymentIds.has(pay.id)) continue;
      const wPaid = Number(pay.appliedToWater) || (pay.concept === 'agua' ? Number(pay.amount) : 0);
      if (wPaid > 0) {
        matchedWaterPaymentIds.add(pay.id);
        waterEntries.push({
          id: `water-extra-${pay.id}`,
          date: pay.date,
          conceptType: 'agua',
          conceptName: 'Utilidad de Agua Potable',
          transactionTitle: `Pago Registrado: Agua Potable (${pay.period || 'General'})`,
          obligationAmount: null,
          contractualDueDate: null,
          paymentAmount: wPaid,
          paymentDate: pay.date,
          runningBalance: 0,
          notes: `Abono recibido de ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de agua.'}`,
          isPayment: true,
          isLateFee: false,
        });
      }
    }

    waterEntries.sort((a, b) => {
      const cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      if (cmp !== 0) return cmp;
      if (!a.isPayment && b.isPayment) return -1;
      if (a.isPayment && !b.isPayment) return 1;
      return 0;
    });

    for (const entry of waterEntries) {
      if (entry.obligationAmount !== null) waterRunning += entry.obligationAmount;
      if (entry.paymentAmount !== null) waterRunning -= entry.paymentAmount;
      entry.runningBalance = Math.round(waterRunning * 100) / 100;
    }
  }

  // 3. Electricidad
  const electricEntries: HistoricalLedgerEntry[] = [];
  let electricRunning = 0;
  const matchedElectricPaymentIds = new Set<string>();

  if (includeElectric && property.utilitiesElectricActive) {
    for (let c = 0; c < totalCycles; c++) {
      const monthIdx = startMonth + c;
      const cYear = startYear + Math.floor(monthIdx / 12);
      const cMonth = monthIdx % 12;
      const lastDay = new Date(cYear, cMonth + 1, 0).getDate();
      const dueDay = Math.min(property.rentDueDay || 1, lastDay);
      const dueDate = new Date(cYear, cMonth, dueDay, 0, 0, 0, 0);
      const dueDateStr = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      const periodName = `${new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(dueDate)} ${cYear}`;
      const periodNameCap = periodName.charAt(0).toUpperCase() + periodName.slice(1);

      if (refTime >= dueDate.getTime()) {
        const eCost = Number(property.utilitiesElectricAmount) || 0;
        if (eCost > 0) {
          electricEntries.push({
            id: `electric-obl-${cYear}-${cMonth}`,
            date: dueDateStr,
            conceptType: 'electricidad',
            conceptName: 'Utilidad de Electricidad',
            transactionTitle: `Factura de Consumo: Electricidad (${periodNameCap})`,
            obligationAmount: eCost,
            contractualDueDate: dueDateStr,
            paymentAmount: null,
            paymentDate: null,
            runningBalance: 0,
            notes: `Consumo según factura de proveedor eléctrico. Partida en cuenta segregada de la renta.`,
            isPayment: false,
            isLateFee: false,
          });
        }

        const matchingElectricPays = propPayments.filter((p) => {
          if (matchedElectricPaymentIds.has(p.id)) return false;
          if (p.period && p.period.toLowerCase().trim() === periodNameCap.toLowerCase().trim()) return true;
          const pDate = parseLocalDate(p.date);
          return pDate.getFullYear() === cYear && pDate.getMonth() === cMonth;
        });

        for (const pay of matchingElectricPays) {
          const ePaid = Number(pay.appliedToElectric) || (pay.concept === 'electricidad' ? Number(pay.amount) : 0);
          if (ePaid > 0) {
            matchedElectricPaymentIds.add(pay.id);
            electricEntries.push({
              id: `electric-pay-${pay.id}`,
              date: pay.date,
              conceptType: 'electricidad',
              conceptName: 'Utilidad de Electricidad',
              transactionTitle: `Pago Registrado: Electricidad (${periodNameCap})`,
              obligationAmount: null,
              contractualDueDate: dueDateStr,
              paymentAmount: ePaid,
              paymentDate: pay.date,
              runningBalance: 0,
              notes: `Pagado por ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de electricidad.'}`,
              isPayment: true,
              isLateFee: false,
            });
          }
        }
      }
    }

    // Capture any remaining electric payments
    for (const pay of propPayments) {
      if (matchedElectricPaymentIds.has(pay.id)) continue;
      const ePaid = Number(pay.appliedToElectric) || (pay.concept === 'electricidad' ? Number(pay.amount) : 0);
      if (ePaid > 0) {
        matchedElectricPaymentIds.add(pay.id);
        electricEntries.push({
          id: `electric-extra-${pay.id}`,
          date: pay.date,
          conceptType: 'electricidad',
          conceptName: 'Utilidad de Electricidad',
          transactionTitle: `Pago Registrado: Electricidad (${pay.period || 'General'})`,
          obligationAmount: null,
          contractualDueDate: null,
          paymentAmount: ePaid,
          paymentDate: pay.date,
          runningBalance: 0,
          notes: `Abono recibido de ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de electricidad.'}`,
          isPayment: true,
          isLateFee: false,
        });
      }
    }

    electricEntries.sort((a, b) => {
      const cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      if (cmp !== 0) return cmp;
      if (!a.isPayment && b.isPayment) return -1;
      if (a.isPayment && !b.isPayment) return 1;
      return 0;
    });

    for (const entry of electricEntries) {
      if (entry.obligationAmount !== null) electricRunning += entry.obligationAmount;
      if (entry.paymentAmount !== null) electricRunning -= entry.paymentAmount;
      entry.runningBalance = Math.round(electricRunning * 100) / 100;
    }
  }

  // 4. Mantenimiento / Cuota
  const maintenanceEntries: HistoricalLedgerEntry[] = [];
  let maintRunning = 0;
  const matchedMaintenancePaymentIds = new Set<string>();

  if (includeMaintenance && property.utilitiesMaintenanceActive) {
    for (let c = 0; c < totalCycles; c++) {
      const monthIdx = startMonth + c;
      const cYear = startYear + Math.floor(monthIdx / 12);
      const cMonth = monthIdx % 12;
      const lastDay = new Date(cYear, cMonth + 1, 0).getDate();
      const dueDay = Math.min(property.rentDueDay || 1, lastDay);
      const dueDate = new Date(cYear, cMonth, dueDay, 0, 0, 0, 0);
      const dueDateStr = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      const periodName = `${new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(dueDate)} ${cYear}`;
      const periodNameCap = periodName.charAt(0).toUpperCase() + periodName.slice(1);

      if (refTime >= dueDate.getTime()) {
        const mCost = Number(property.utilitiesMaintenanceAmount) || 0;
        if (mCost > 0) {
          maintenanceEntries.push({
            id: `maint-obl-${cYear}-${cMonth}`,
            date: dueDateStr,
            conceptType: 'mantenimiento',
            conceptName: 'Mantenimiento / Cuota',
            transactionTitle: `Cuota de Mantenimiento / Residentes (${periodNameCap})`,
            obligationAmount: mCost,
            contractualDueDate: dueDateStr,
            paymentAmount: null,
            paymentDate: null,
            runningBalance: 0,
            notes: `Cuota mensual de condominio y áreas comunes. Partida en cuenta segregada.`,
            isPayment: false,
            isLateFee: false,
          });
        }

        const matchingMaintPays = propPayments.filter((p) => {
          if (matchedMaintenancePaymentIds.has(p.id)) return false;
          if (p.period && p.period.toLowerCase().trim() === periodNameCap.toLowerCase().trim()) return true;
          const pDate = parseLocalDate(p.date);
          return pDate.getFullYear() === cYear && pDate.getMonth() === cMonth;
        });

        for (const pay of matchingMaintPays) {
          const mPaid = Number(pay.appliedToMaintenance) || (pay.concept === 'mantenimiento' ? Number(pay.amount) : 0);
          if (mPaid > 0) {
            matchedMaintenancePaymentIds.add(pay.id);
            maintenanceEntries.push({
              id: `maint-pay-${pay.id}`,
              date: pay.date,
              conceptType: 'mantenimiento',
              conceptName: 'Mantenimiento / Cuota',
              transactionTitle: `Pago Registrado: Cuota Mantenimiento (${periodNameCap})`,
              obligationAmount: null,
              contractualDueDate: dueDateStr,
              paymentAmount: mPaid,
              paymentDate: pay.date,
              runningBalance: 0,
              notes: `Pagado por ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de mantenimiento.'}`,
              isPayment: true,
              isLateFee: false,
            });
          }
        }
      }
    }

    // Capture any remaining maintenance payments
    for (const pay of propPayments) {
      if (matchedMaintenancePaymentIds.has(pay.id)) continue;
      const mPaid = Number(pay.appliedToMaintenance) || (pay.concept === 'mantenimiento' ? Number(pay.amount) : 0);
      if (mPaid > 0) {
        matchedMaintenancePaymentIds.add(pay.id);
        maintenanceEntries.push({
          id: `maint-extra-${pay.id}`,
          date: pay.date,
          conceptType: 'mantenimiento',
          conceptName: 'Mantenimiento / Cuota',
          transactionTitle: `Pago Registrado: Cuota Mantenimiento (${pay.period || 'General'})`,
          obligationAmount: null,
          contractualDueDate: null,
          paymentAmount: mPaid,
          paymentDate: pay.date,
          runningBalance: 0,
          notes: `Abono recibido de ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de mantenimiento.'}`,
          isPayment: true,
          isLateFee: false,
        });
      }
    }

    maintenanceEntries.sort((a, b) => {
      const cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
      if (cmp !== 0) return cmp;
      if (!a.isPayment && b.isPayment) return -1;
      if (a.isPayment && !b.isPayment) return 1;
      return 0;
    });

    for (const entry of maintenanceEntries) {
      if (entry.obligationAmount !== null) maintRunning += entry.obligationAmount;
      if (entry.paymentAmount !== null) maintRunning -= entry.paymentAmount;
      entry.runningBalance = Math.round(maintRunning * 100) / 100;
    }
  }

  const rentResult = applyHistoryDateFilter(
    rentEntries,
    'Renta Contractual',
    'renta',
    historyStartDate,
    historyEndDate
  );

  const waterResult = applyHistoryDateFilter(
    waterEntries,
    'Utilidad de Agua Potable',
    'agua',
    historyStartDate,
    historyEndDate
  );

  const electricResult = applyHistoryDateFilter(
    electricEntries,
    'Utilidad de Electricidad',
    'electricidad',
    historyStartDate,
    historyEndDate
  );

  const maintenanceResult = applyHistoryDateFilter(
    maintenanceEntries,
    'Mantenimiento / Cuota',
    'mantenimiento',
    historyStartDate,
    historyEndDate
  );

  // 5. Gastos Operativos Incurridos (Cuenta Segregada de Egresos)
  const expenseEntries: HistoricalLedgerEntry[] = [];
  if (includeExpenses && propExpenses.length > 0) {
    for (const exp of propExpenses) {
      expenseEntries.push({
        id: `exp-${exp.id}`,
        date: exp.date,
        conceptType: 'gasto',
        conceptName: `Gasto: ${exp.category}`,
        transactionTitle: `${exp.category}: ${exp.description}`,
        obligationAmount: Number(exp.amount) || 0,
        contractualDueDate: exp.date,
        paymentAmount: null,
        paymentDate: null,
        runningBalance: 0,
        notes: `${exp.vendorOrPayee ? `Proveedor: ${exp.vendorOrPayee}. ` : ''}${exp.receiptNumber ? `Factura/Recibo: #${exp.receiptNumber}. ` : ''}${exp.description}`,
        isPayment: false,
        isLateFee: false,
        payerName: exp.vendorOrPayee,
        reference: exp.receiptNumber,
        category: exp.category,
      });
    }
  }

  const expenseResult = applyHistoryDateFilter(
    expenseEntries,
    'Gastos Operativos',
    'gasto',
    historyStartDate,
    historyEndDate
  );

  // 6. Conciliación Consecutiva por Fechas: Ingresos Cobrados vs Gastos Incurridos
  const cashflowRaw: Array<{
    id: string;
    date: string;
    type: 'income' | 'expense';
    concept: string;
    category: string;
    payeeOrPayer?: string;
    receiptOrReference?: string;
    incomeAmount: number | null;
    expenseAmount: number | null;
    notes?: string;
  }> = [];

  // A. Ingresos Cobrados de las partidas seleccionadas
  for (const p of propPayments) {
    const isRentMatch = includeRent && ((p.appliedToRent || (p.concept === 'renta' ? p.amount : 0)) > 0 || (p.concept === 'mora' || p.concept === 'deposito'));
    const isWaterMatch = includeWater && (p.appliedToWater || (p.concept === 'agua' ? p.amount : 0)) > 0;
    const isElectricMatch = includeElectric && (p.appliedToElectric || (p.concept === 'electricidad' ? p.amount : 0)) > 0;
    const isMaintMatch = includeMaintenance && (p.appliedToMaintenance || (p.concept === 'mantenimiento' ? p.amount : 0)) > 0;
    const isGeneralMatch = (includeRent || includeWater || includeElectric || includeMaintenance) && (!p.concept || p.concept === 'general');

    if (isRentMatch || isWaterMatch || isElectricMatch || isMaintMatch || isGeneralMatch) {
      cashflowRaw.push({
        id: `cf-pay-${p.id}`,
        date: p.date,
        type: 'income',
        concept: `Cobro Recibido: ${p.period || 'General'} (${p.concept || 'Pago'})`,
        category: p.concept || 'Cobro',
        payeeOrPayer: p.payerName,
        receiptOrReference: p.reference,
        incomeAmount: Number(p.amount) || 0,
        expenseAmount: null,
        notes: p.notes || (p.paymentMethod ? `Método: ${p.paymentMethod}` : undefined),
      });
    }
  }

  // B. Gastos Incurridos (si includeExpenses está activo)
  if (includeExpenses) {
    for (const exp of propExpenses) {
      cashflowRaw.push({
        id: `cf-exp-${exp.id}`,
        date: exp.date,
        type: 'expense',
        concept: `Gasto: ${exp.category} - ${exp.description}`,
        category: exp.category,
        payeeOrPayer: exp.vendorOrPayee,
        receiptOrReference: exp.receiptNumber,
        incomeAmount: null,
        expenseAmount: Number(exp.amount) || 0,
        notes: `${exp.vendorOrPayee ? `Proveedor: ${exp.vendorOrPayee}. ` : ''}${exp.receiptNumber ? `Factura/Recibo: #${exp.receiptNumber}` : ''}`,
      });
    }
  }

  // Ordenar cronológicamente por fecha
  cashflowRaw.sort((a, b) => {
    const cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
    if (cmp !== 0) return cmp;
    if (a.type === 'income' && b.type === 'expense') return -1;
    if (a.type === 'expense' && b.type === 'income') return 1;
    return 0;
  });

  // Filtrar por rango de fechas si se definió
  const startTime = historyStartDate && historyStartDate.trim() !== '' ? parseLocalDate(historyStartDate).getTime() : null;
  const endTime = historyEndDate && historyEndDate.trim() !== '' ? parseLocalDate(historyEndDate).getTime() + (24 * 60 * 60 * 1000 - 1) : null;

  let priorIncome = 0;
  let priorExpenses = 0;
  const cashflowEntries: CashflowLedgerEntry[] = [];

  for (const item of cashflowRaw) {
    const itemTime = parseLocalDate(item.date).getTime();
    if (startTime !== null && itemTime < startTime) {
      if (item.incomeAmount !== null) priorIncome += item.incomeAmount;
      if (item.expenseAmount !== null) priorExpenses += item.expenseAmount;
    } else if (endTime === null || itemTime <= endTime) {
      cashflowEntries.push({
        ...item,
        runningBalance: 0,
      });
    }
  }

  // Si hay saldo previo antes de startTime, añadir renglón de apertura de flujo
  const priorCashBalance = Math.round((priorIncome - priorExpenses) * 100) / 100;
  if (startTime !== null && (priorIncome > 0 || priorExpenses > 0 || priorCashBalance !== 0)) {
    cashflowEntries.unshift({
      id: `cf-opening-${historyStartDate}`,
      date: historyStartDate!,
      type: priorCashBalance >= 0 ? 'income' : 'expense',
      concept: `Flujo Neto Anterior al Período (${formatDate(historyStartDate)})`,
      category: 'Saldo Inicial Flujo',
      payeeOrPayer: 'Arrastre previo',
      incomeAmount: priorCashBalance >= 0 ? priorCashBalance : null,
      expenseAmount: priorCashBalance < 0 ? Math.abs(priorCashBalance) : null,
      runningBalance: priorCashBalance,
      notes: `Balance neto de ingresos vs gastos acumulado previo a la fecha inicial (${formatDate(historyStartDate)}).`,
    });
  }

  // Calcular balance progresivo consecutivo
  let progressiveCash = 0;
  for (const cf of cashflowEntries) {
    if (cf.id.startsWith('cf-opening-')) {
      progressiveCash = cf.runningBalance;
    } else {
      if (cf.incomeAmount !== null) progressiveCash += cf.incomeAmount;
      if (cf.expenseAmount !== null) progressiveCash -= cf.expenseAmount;
      cf.runningBalance = Math.round(progressiveCash * 100) / 100;
    }
  }

  const totalCashIncome = cashflowEntries.reduce((s, c) => s + (c.id.startsWith('cf-opening-') ? 0 : (c.incomeAmount || 0)), 0);
  const totalCashExpenses = cashflowEntries.reduce((s, c) => s + (c.id.startsWith('cf-opening-') ? 0 : (c.expenseAmount || 0)), 0);
  const netCashflowBalance = Math.round((totalCashIncome - totalCashExpenses) * 100) / 100;

  // Cuentas por cobrar al inquilino (exclusivamente lo debido por el inquilino)
  const grandTotalObligations =
    rentResult.totalObligations +
    waterResult.totalObligations +
    electricResult.totalObligations +
    maintenanceResult.totalObligations;

  const grandTotalPayments =
    rentResult.totalPayments +
    waterResult.totalPayments +
    electricResult.totalPayments +
    maintenanceResult.totalPayments;

  const grandFinalBalance =
    rentResult.finalBalance +
    waterResult.finalBalance +
    electricResult.finalBalance +
    maintenanceResult.finalBalance;

  return {
    rentEntries: rentResult.filteredEntries,
    rentTotalObligations: rentResult.totalObligations,
    rentTotalPayments: rentResult.totalPayments,
    rentFinalBalance: rentResult.finalBalance,

    waterEntries: waterResult.filteredEntries,
    waterTotalObligations: waterResult.totalObligations,
    waterTotalPayments: waterResult.totalPayments,
    waterFinalBalance: waterResult.finalBalance,

    electricEntries: electricResult.filteredEntries,
    electricTotalObligations: electricResult.totalObligations,
    electricTotalPayments: electricResult.totalPayments,
    electricFinalBalance: electricResult.finalBalance,

    maintenanceEntries: maintenanceResult.filteredEntries,
    maintenanceTotalObligations: maintenanceResult.totalObligations,
    maintenanceTotalPayments: maintenanceResult.totalPayments,
    maintenanceFinalBalance: maintenanceResult.finalBalance,

    // Gastos Operativos de la Propiedad
    expenseEntries: expenseResult.filteredEntries,
    expenseTotalAmount: expenseResult.totalObligations,

    // Conciliación de Flujo: Ingresos Cobrados vs Gastos Incurridos (Computado Consecutivamente por Fechas)
    cashflowEntries,
    totalCashIncome,
    totalCashExpenses,
    netCashflowBalance,

    grandTotalObligations,
    grandTotalPayments,
    grandFinalBalance,
  };
}

export const AccountingAuditView: React.FC<AccountingAuditViewProps> = ({
  properties,
  payments,
  expenses = [],
  expenseCategories = [],
  administrators,
  profile,
  onOpenInvoice,
  onRegisterPayment,
  canExportCode = false,
}) => {
  // Permiso exclusivo de desarrollador / cuentas VIP autorizadas para ver y descargar el código fuente (.ZIP)
  const isDevStudio = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('googleusercontent.com')
  );

  const isDeveloperUser = Boolean(
    canExportCode ||
    isLifetimeVip([
      profile?.email,
      profile?.googleDriveAccountEmail,
      ...(administrators || []).map((a) => a.email),
    ]) ||
    isDevStudio
  );

  // Pre-report filters & selection
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<string>('all');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('all');
  const [computationDate, setComputationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyWithDebt, setOnlyWithDebt] = useState<boolean>(false);

  // Concept filters
  const [includeRent, setIncludeRent] = useState<boolean>(true);
  const [includeWater, setIncludeWater] = useState<boolean>(true);
  const [includeElectric, setIncludeElectric] = useState<boolean>(true);
  const [includeMaintenance, setIncludeMaintenance] = useState<boolean>(true);
  const [includeExpenses, setIncludeExpenses] = useState<boolean>(true);

  // Categorías de gastos disponibles (definidas por el usuario y registradas en gastos)
  const allAvailableExpenseCategories = useMemo(() => {
    const set = new Set<string>(expenseCategories || []);
    for (const exp of (expenses || [])) {
      if (exp.category && exp.category.trim()) set.add(exp.category.trim());
    }
    if (set.size === 0) {
      set.add('Mantenimiento & Reparación');
      set.add('Plomería & Fontanería');
      set.add('Electricidad & Luminarias');
      set.add('Pintura & Acabados');
      set.add('Impuestos & Seguros');
      set.add('Otros Gastos Operativos');
    }
    return Array.from(set);
  }, [expenseCategories, expenses]);

  // Conceptos/categorías de gastos seleccionadas activas en el filtro
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);

  useEffect(() => {
    if (allAvailableExpenseCategories.length > 0) {
      setSelectedExpenseCategories((prev) => {
        if (prev.length === 0) return allAvailableExpenseCategories;
        const valid = prev.filter((c) => allAvailableExpenseCategories.includes(c));
        return valid.length > 0 ? valid : allAvailableExpenseCategories;
      });
    }
  }, [allAvailableExpenseCategories]);

  const handleToggleExpenseCategory = (cat: string) => {
    setSelectedExpenseCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAllExpenseCategories = () => {
    setSelectedExpenseCategories([...allAvailableExpenseCategories]);
  };

  const handleDeselectAllExpenseCategories = () => {
    setSelectedExpenseCategories([]);
  };

  // Historial Transaccional (Estado de Cuenta con Balances Progresivos)
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Filtro de Rango de Fechas para HISTORIAL (Todo, 6 meses, 12 meses, 24 meses o fechas libres)
  const [historyPreset, setHistoryPreset] = useState<'all' | '6m' | '12m' | '24m' | 'custom'>('all');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');

  const handleSetPreset = (preset: 'all' | '6m' | '12m' | '24m') => {
    setHistoryPreset(preset);
    const endStr = computationDate || new Date().toISOString().split('T')[0];

    if (preset === 'all') {
      setHistoryStartDate('');
      setHistoryEndDate('');
    } else if (preset === '6m') {
      const d = parseLocalDate(endStr);
      d.setMonth(d.getMonth() - 6);
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setHistoryStartDate(startStr);
      setHistoryEndDate(endStr);
    } else if (preset === '12m') {
      const d = parseLocalDate(endStr);
      d.setFullYear(d.getFullYear() - 1);
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setHistoryStartDate(startStr);
      setHistoryEndDate(endStr);
    } else if (preset === '24m') {
      const d = parseLocalDate(endStr);
      d.setFullYear(d.getFullYear() - 2);
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setHistoryStartDate(startStr);
      setHistoryEndDate(endStr);
    }
  };

  const handleStartDateChange = (val: string) => {
    setHistoryStartDate(val);
    setHistoryPreset('custom');
  };

  const handleEndDateChange = (val: string) => {
    setHistoryEndDate(val);
    setHistoryPreset('custom');
  };

  // Property selection (by ID)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(() =>
    properties.map((p) => p.id)
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Reference Date for calculation
  const referenceDate = useMemo(() => {
    return parseLocalDate(computationDate);
  }, [computationDate]);

  // Filter properties by company, status, specific property, and search query
  const eligibleProperties = useMemo(() => {
    return properties.filter((p) => {
      if (selectedAdminId !== 'all' && (p.administratorId || 'admin-1') !== selectedAdminId) {
        return false;
      }
      if (propertyStatusFilter !== 'all' && (p.status || 'rentado') !== propertyStatusFilter) {
        return false;
      }
      if (selectedPropertyFilter !== 'all' && p.id !== selectedPropertyFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.propertyIdentifier.toLowerCase().includes(q);
        const matchesAddr = p.address.toLowerCase().includes(q);
        const matchesTenant1 = p.tenant1.name.toLowerCase().includes(q);
        const matchesTenant2 = p.tenant2?.name?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesAddr && !matchesTenant1 && !matchesTenant2) {
          return false;
        }
      }
      return true;
    });
  }, [properties, selectedAdminId, propertyStatusFilter, selectedPropertyFilter, searchQuery]);

  // Toggle selection for all visible eligible properties
  const handleSelectAllVisible = () => {
    const visibleIds = eligibleProperties.map((p) => p.id);
    setSelectedPropertyIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleDeselectAllVisible = () => {
    const visibleIds = new Set(eligibleProperties.map((p) => p.id));
    setSelectedPropertyIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const handleToggleProperty = (propId: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
    );
  };

  // Build itemized accounting ledger rows for each property
  const auditedProperties = useMemo(() => {
    return eligibleProperties
      .filter((p) => selectedPropertyIds.includes(p.id))
      .map((property) => {
        const admin = getAdministratorForProperty(property, administrators);
        const status = calculatePropertyStatus(property, payments, referenceDate);

        // Target billing cycle due date and grace deadline
        const currentYear = referenceDate.getFullYear();
        const currentMonth = referenceDate.getMonth();
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dueDay = Math.min(property.rentDueDay || 1, lastDayOfMonth);
        const dueDate = new Date(currentYear, currentMonth, dueDay, 0, 0, 0, 0);
        const dueDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

        const graceDays = Math.max(0, property.graceDays ?? 3);
        const graceDeadline = new Date(currentYear, currentMonth, dueDay + graceDays, 0, 0, 0, 0);
        const graceDeadlineStr = `${graceDeadline.getFullYear()}-${String(graceDeadline.getMonth() + 1).padStart(2, '0')}-${String(graceDeadline.getDate()).padStart(2, '0')}`;

        const evalTime = referenceDate.getTime();
        const dueTime = dueDate.getTime();
        const graceTime = graceDeadline.getTime();

        // Status flags for the evaluated computation date
        const isBeforeDue = evalTime < dueTime;
        const isInsideGrace = evalTime >= dueTime && evalTime <= graceTime;
        const isPastGrace = evalTime > graceTime;

        // Payments for this property specifically in the current cycle
        const propPayments = payments.filter((p) => p.propertyId === property.id);
        const cyclePayments = propPayments.filter((p) => {
          const pDate = parseLocalDate(p.date);
          return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
        });

        // Dates when payments were registered
        const rentPayDates = cyclePayments
          .filter((p) => (p.appliedToRent || (p.concept === 'renta' ? p.amount : 0)) > 0)
          .map((p) => formatDate(p.date));
        const waterPayDates = cyclePayments
          .filter((p) => (p.appliedToWater || (p.concept === 'agua' ? p.amount : 0)) > 0)
          .map((p) => formatDate(p.date));
        const electricPayDates = cyclePayments
          .filter((p) => (p.appliedToElectric || (p.concept === 'electricidad' ? p.amount : 0)) > 0)
          .map((p) => formatDate(p.date));
        const maintenancePayDates = cyclePayments
          .filter((p) => (p.appliedToMaintenance || (p.concept === 'mantenimiento' ? p.amount : 0)) > 0)
          .map((p) => formatDate(p.date));

        // Total accumulated rent and late fee debt
        const totalAccumulatedRentAndFees = status.pendingRentBalance + status.pendingLateFeesBalance;

        // Total accumulated utilities debt (strictly segregated from rent)
        const totalAccumulatedUtilities = status.pendingUtilitiesBalance;

        // Total property pending according to selected concept filters
        const totalPropertyPending =
          (includeRent ? totalAccumulatedRentAndFees : 0) +
          (includeWater && property.utilitiesWaterActive ? status.pendingWaterBalance : 0) +
          (includeElectric && property.utilitiesElectricActive ? status.pendingElectricBalance : 0) +
          (includeMaintenance && property.utilitiesMaintenanceActive ? status.pendingMaintenanceBalance : 0);

        // Filter expenses for this property
        const propExpenses = (expenses || []).filter((e) => {
          if (e.propertyId !== property.id) return false;
          if (!includeExpenses) return false;
          if (!selectedExpenseCategories.includes(e.category)) return false;

          if (showHistory) {
            const eTime = parseLocalDate(e.date).getTime();
            const startTime = historyStartDate.trim() ? parseLocalDate(historyStartDate).getTime() : null;
            const endTime = historyEndDate.trim() ? parseLocalDate(historyEndDate).getTime() + (24 * 60 * 60 * 1000 - 1) : null;
            if (startTime !== null && eTime < startTime) return false;
            if (endTime !== null && eTime > endTime) return false;
          } else {
            const eDate = parseLocalDate(e.date);
            if (eDate.getFullYear() !== currentYear || eDate.getMonth() !== currentMonth) {
              return false;
            }
          }
          return true;
        });

        const totalPropExpenses = propExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        const totalPropIncome = status.paidRentThisMonth + status.paidWaterThisMonth + status.paidElectricThisMonth + status.paidMaintenanceThisMonth;
        const propNetCashflow = totalPropIncome - totalPropExpenses;

        // Generate itemized historical audit data (transaction ledger with progressive balances)
        const historyData = generatePropertyHistoricalData(
          property,
          propPayments,
          referenceDate,
          includeRent,
          includeWater,
          includeElectric,
          includeMaintenance,
          includeExpenses,
          propExpenses,
          admin,
          showHistory ? (historyStartDate.trim() ? historyStartDate : undefined) : undefined,
          showHistory ? (historyEndDate.trim() ? historyEndDate : undefined) : undefined
        );

        const effectivePropertyPending = showHistory
          ? historyData.grandFinalBalance
          : totalPropertyPending;

        return {
          property,
          admin,
          status,
          dueDateStr,
          graceDeadlineStr,
          dueDay,
          graceDays,
          isBeforeDue,
          isInsideGrace,
          isPastGrace,
          rentPayDates: rentPayDates.length > 0 ? rentPayDates.join(', ') : '-',
          waterPayDates: waterPayDates.length > 0 ? waterPayDates.join(', ') : '-',
          electricPayDates: electricPayDates.length > 0 ? electricPayDates.join(', ') : '-',
          maintenancePayDates: maintenancePayDates.length > 0 ? maintenancePayDates.join(', ') : '-',
          totalAccumulatedRentAndFees,
          totalAccumulatedUtilities,
          totalPropertyPending: effectivePropertyPending,
          propExpenses,
          totalPropExpenses,
          totalPropIncome,
          propNetCashflow,
          historyData,
        };
      })
      .filter((item) => {
        if (onlyWithDebt) {
          return item.totalPropertyPending > 0;
        }
        return true;
      });
  }, [
    eligibleProperties,
    selectedPropertyIds,
    payments,
    expenses,
    referenceDate,
    administrators,
    onlyWithDebt,
    includeRent,
    includeWater,
    includeElectric,
    includeMaintenance,
    includeExpenses,
    selectedExpenseCategories,
    historyStartDate,
    historyEndDate,
    showHistory,
  ]);

  // Grand summary metrics
  const summaryMetrics = useMemo(() => {
    let totalRentBilled = 0;
    let totalRentPaid = 0;
    let totalRentPending = 0;
    let totalLateFees = 0;
    let totalWaterBilled = 0;
    let totalWaterPaid = 0;
    let totalWaterPending = 0;
    let totalElectricBilled = 0;
    let totalElectricPaid = 0;
    let totalElectricPending = 0;
    let totalMaintenanceBilled = 0;
    let totalMaintenancePaid = 0;
    let totalMaintenancePending = 0;

    let totalExpenses = 0;
    let totalIncomeReceived = 0;

    for (const item of auditedProperties) {
      if (showHistory) {
        const h = item.historyData;
        if (includeRent) {
          totalRentBilled += h.rentTotalObligations;
          totalRentPaid += h.rentTotalPayments;
          totalRentPending += h.rentFinalBalance;
        }
        if (includeWater && item.property.utilitiesWaterActive) {
          totalWaterBilled += h.waterTotalObligations;
          totalWaterPaid += h.waterTotalPayments;
          totalWaterPending += h.waterFinalBalance;
        }
        if (includeElectric && item.property.utilitiesElectricActive) {
          totalElectricBilled += h.electricTotalObligations;
          totalElectricPaid += h.electricTotalPayments;
          totalElectricPending += h.electricFinalBalance;
        }
        if (includeMaintenance && item.property.utilitiesMaintenanceActive) {
          totalMaintenanceBilled += h.maintenanceTotalObligations;
          totalMaintenancePaid += h.maintenanceTotalPayments;
          totalMaintenancePending += h.maintenanceFinalBalance;
        }
        if (includeExpenses) {
          totalExpenses += h.totalCashExpenses;
          totalIncomeReceived += h.totalCashIncome;
        }
      } else {
        const s = item.status;
        if (includeRent) {
          totalRentBilled += s.currentMonthRentCharge + s.previousBalance;
          totalRentPaid += s.paidRentThisMonth;
          totalRentPending += s.pendingRentBalance;
          totalLateFees += s.totalLateFees;
        }
        if (includeWater && item.property.utilitiesWaterActive) {
          totalWaterBilled += s.waterAmount;
          totalWaterPaid += s.paidWaterThisMonth;
          totalWaterPending += s.pendingWaterBalance;
        }
        if (includeElectric && item.property.utilitiesElectricActive) {
          totalElectricBilled += s.electricAmount;
          totalElectricPaid += s.paidElectricThisMonth;
          totalElectricPending += s.pendingElectricBalance;
        }
        if (includeMaintenance && item.property.utilitiesMaintenanceActive) {
          totalMaintenanceBilled += s.maintenanceAmount;
          totalMaintenancePaid += s.paidMaintenanceThisMonth;
          totalMaintenancePending += s.pendingMaintenanceBalance;
        }
        if (includeExpenses) {
          totalExpenses += item.totalPropExpenses;
          totalIncomeReceived += item.totalPropIncome;
        }
      }
    }

    if (!includeExpenses) {
      totalIncomeReceived = totalRentPaid + totalWaterPaid + totalElectricPaid + totalMaintenancePaid;
    }

    const netOperationalBalance = Math.round((totalIncomeReceived - totalExpenses) * 100) / 100;

    const grandTotalPending =
      totalRentPending +
      totalLateFees +
      totalWaterPending +
      totalElectricPending +
      totalMaintenancePending;

    return {
      totalRentBilled,
      totalRentPaid,
      totalRentPending,
      totalLateFees,
      totalWaterBilled,
      totalWaterPaid,
      totalWaterPending,
      totalElectricBilled,
      totalElectricPaid,
      totalElectricPending,
      totalMaintenanceBilled,
      totalMaintenancePaid,
      totalMaintenancePending,
      totalExpenses,
      totalIncomeReceived,
      netOperationalBalance,
      grandTotalPending,
    };
  }, [auditedProperties, includeRent, includeWater, includeElectric, includeMaintenance, includeExpenses, showHistory]);

  // Group audited properties by administrator/company
  const propertiesByAdmin = useMemo(() => {
    const map = new Map<string, typeof auditedProperties>();
    for (const item of auditedProperties) {
      const adminId = item.admin.id;
      if (!map.has(adminId)) {
        map.set(adminId, []);
      }
      map.get(adminId)!.push(item);
    }
    return map;
  }, [auditedProperties]);

  // Primary administrator for report header
  const primaryAdmin = useMemo(() => {
    if (selectedAdminId !== 'all') {
      const found = administrators.find((a) => a.id === selectedAdminId);
      if (found) return found;
    }
    const def = administrators.find((a) => a.isDefault);
    return def || administrators[0] || {
      id: 'admin-1',
      companyName: profile?.companyName || 'Inmobiliaria Premier',
      landlordName: profile?.landlordName || 'Administrador',
      taxId: profile?.taxId || '',
      phone: profile?.phone || '',
      email: profile?.email || '',
      address: profile?.address || '',
      logoUrl: profile?.logoUrl,
      bankDetails: profile?.bankDetails || '',
      invoiceNote: profile?.invoiceNote || '',
      currencyCode: profile?.currencyCode || 'USD',
      currencySymbol: profile?.currencySymbol || '$',
      isDefault: true,
    };
  }, [administrators, selectedAdminId, profile]);

  const currentHeaderLogo = useMemo(() => {
    if (selectedAdminId !== 'all') {
      const selected = administrators.find((a) => a.id === selectedAdminId);
      return selected?.logoUrl || (selected?.isDefault ? profile?.logoUrl : undefined) || profile?.logoUrl;
    }
    return (
      primaryAdmin?.logoUrl ||
      profile?.logoUrl ||
      administrators.find((a) => a.logoUrl)?.logoUrl
    );
  }, [selectedAdminId, administrators, primaryAdmin, profile?.logoUrl]);

  // Handlers for printing and downloading PDF
  const handlePrintLedger = () => {
    printElementSafely(
      'printable-accounting-ledger',
      `Libro_Contable_Fiscalizacion_${computationDate}`
    );
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadElementAsPdf(
        'printable-accounting-ledger',
        `Libro_Contable_Fiscalizacion_${computationDate}.pdf`,
        setIsGeneratingPdf
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Bar */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-sky-600 to-indigo-600 text-white rounded-xl shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Libro de Contabilidad y Fiscalización
                <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-xs font-bold rounded-md">
                  Cuentas Segregadas
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auditoría legal y fiscal: Renta, penalidades por demora, agua, electricidad y cuotas de mantenimiento en cuentas independientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handlePrintLedger}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimir formato de libro contable idéntico a pantalla"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Descargar libro contable en PDF oficial"
            >
              {isGeneratingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selector Visual de Empresas con Logo (Idéntico a Cobranza y Reportes) */}
        {administrators.length > 1 && (
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-500" />
                Segregar Libro por Empresa Administradora
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                {administrators.length} empresas registradas
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedAdminId('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                  selectedAdminId === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Todas las Empresas ({properties.length} prop.)</span>
              </button>

              {administrators.map((admin) => {
                const logo = admin.logoUrl || (admin.isDefault ? profile?.logoUrl : undefined);
                const pCount = properties.filter((p) => (p.administratorId || administrators[0]?.id) === admin.id).length;
                return (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => setSelectedAdminId(admin.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-2 border ${
                      selectedAdminId === admin.id
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt=""
                        className="w-4 h-4 rounded-full object-contain bg-white shrink-0"
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5" />
                    )}
                    <span>{admin.companyName}</span>
                    <span className="px-1.5 py-0.2 bg-white/20 dark:bg-slate-700 rounded text-[10px] font-black">
                      {admin.currencySymbol}
                    </span>
                    <span className="text-[10px] opacity-75">({pCount})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters and Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 pt-1">
          {/* Filter 1: Empresa / Administrador */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-sky-500" />
              <span>Empresa Administradora:</span>
            </label>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todas las Empresas ({administrators.length})</option>
              {administrators.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.companyName} ({admin.landlordName})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Estatus de Propiedad */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-emerald-500" />
              <span>Estatus de Propiedad:</span>
            </label>
            <select
              value={propertyStatusFilter}
              onChange={(e) => setPropertyStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">🏷️ Estatus: Todos</option>
              <option value="rentado">🟢 Rentado</option>
              <option value="vacante">⚪ Vacante</option>
              <option value="en_mantenimiento">🟡 En Mantenimiento</option>
              <option value="en_proceso_legal">🔴 En Proceso Legal</option>
              <option value="multifamiliar">🟣 Multi-familiar</option>
            </select>
          </div>

          {/* Filter 3: Propiedad Definida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Propiedad Específica:</span>
            </label>
            <select
              value={selectedPropertyFilter}
              onChange={(e) => setSelectedPropertyFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden cursor-pointer truncate"
            >
              <option value="all">🏠 Propiedad: Todas ({properties.length})</option>
              {properties
                .filter((p) => selectedAdminId === 'all' || (p.administratorId || 'admin-1') === selectedAdminId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.propertyIdentifier} - {p.tenant1?.name || 'Sin inquilino'}
                  </option>
                ))}
            </select>
          </div>

          {/* Filter 4: Fecha de Cómputo del Informe */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-violet-500" />
              <span>Fecha de Cómputo:</span>
            </label>
            <input
              type="date"
              value={computationDate}
              onChange={(e) => setComputationDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Filter 5: Búsqueda rápida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Buscar en Propiedades:</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Inquilino, depto, ref..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Filter 6: Toggle Solo con Adeudo */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => setOnlyWithDebt(!onlyWithDebt)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border ${
                onlyWithDebt
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="truncate">{onlyWithDebt ? 'Solo con Deuda' : 'Todas las Cuentas'}</span>
            </button>
          </div>
        </div>

        {/* Concept Checkboxes & Property Multi-Select */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Conceptos a Fiscalizar */}
          <div>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Conceptos a incluir en el Libro Contable:
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <input
                  type="checkbox"
                  checked={includeRent}
                  onChange={(e) => setIncludeRent(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-slate-800 dark:text-slate-200">Renta & Moras</span>
              </label>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 dark:bg-sky-950/60 rounded-lg text-xs font-bold cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/60 transition text-sky-800 dark:text-sky-300">
                <input
                  type="checkbox"
                  checked={includeWater}
                  onChange={(e) => setIncludeWater(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <Droplets className="w-3.5 h-3.5" />
                <span>Agua Potable</span>
              </label>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/60 rounded-lg text-xs font-bold cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60 transition text-amber-800 dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={includeElectric}
                  onChange={(e) => setIncludeElectric(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <Zap className="w-3.5 h-3.5" />
                <span>Electricidad</span>
              </label>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/60 rounded-lg text-xs font-bold cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/60 transition text-purple-800 dark:text-purple-300">
                <input
                  type="checkbox"
                  checked={includeMaintenance}
                  onChange={(e) => setIncludeMaintenance(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <Wrench className="w-3.5 h-3.5" />
                <span>Mantenimiento / Cuota</span>
              </label>

              {/* Checkbox de Gastos */}
              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                includeExpenses
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={includeExpenses}
                  onChange={(e) => setIncludeExpenses(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Gastos</span>
              </label>

              {/* Toggle de HISTORIAL Transaccional */}
              <label
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition border ${
                  showHistory
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                }`}
                title="Genera por cada partida el estado de cuenta transaccional histórico (obligaciones y abonos cronológicos con balances progresivos post-transacción)"
              >
                <input
                  type="checkbox"
                  checked={showHistory}
                  onChange={(e) => setShowHistory(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <History className="w-3.5 h-3.5" />
                <span>HISTORIAL (Estado de Cuenta Transaccional)</span>
              </label>
            </div>

            {/* Sub-filtros interactivos según conceptos creados en Gastos */}
            {includeExpenses && (
              <div className="mt-2.5 p-3 bg-rose-50/70 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-black text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-600" />
                    <span>Categorías de Gastos ({selectedExpenseCategories.length} de {allAvailableExpenseCategories.length} activas):</span>
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={handleSelectAllExpenseCategories}
                      className="text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                    >
                      Todas
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllExpenseCategories}
                      className="text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {allAvailableExpenseCategories.map((cat) => {
                    const isSelected = selectedExpenseCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleExpenseCategory(cat)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] text-rose-700 dark:text-rose-300 font-medium leading-tight">
                  📌 {showHistory
                    ? 'Historial activo: Los gastos se filtran según el rango de fechas elegido y se computan consecutivamente contra los ingresos cobrados.'
                    : 'Período corriente: Imputa los gastos registrados correspondientes al ciclo del mes evaluado.'}
                </p>
              </div>
            )}
          </div>

          {/* Selector de Propiedades */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Propiedades a Fiscalizar ({selectedPropertyIds.length} de {eligibleProperties.length} seleccionadas):
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="text-sky-600 hover:text-sky-500 font-bold cursor-pointer"
                >
                  Todas
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllVisible}
                  className="text-slate-500 hover:text-slate-400 font-bold cursor-pointer"
                >
                  Ninguna
                </button>
              </div>
            </div>

            <div className="max-h-28 overflow-y-auto bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5 text-xs">
              {eligibleProperties.map((p) => {
                const isSelected = selectedPropertyIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleToggleProperty(p.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-slate-400" />}
                    <span>{p.propertyIdentifier}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel de Período del Historial (Visible cuando HISTORIAL está activo) */}
        {showHistory && (
          <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wide">
                  Período de Fechas a Reportar en Historial:
                </span>
                <span className="px-2 py-0.5 bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-[10px] font-black rounded-md">
                  {historyPreset === 'all' || (!historyStartDate && !historyEndDate)
                    ? 'TODO EL HISTORIAL COMPLETO'
                    : historyPreset === '6m'
                    ? 'ÚLTIMOS 6 MESES'
                    : historyPreset === '12m'
                    ? 'ÚLTIMOS 12 MESES'
                    : historyPreset === '24m'
                    ? 'ÚLTIMOS 2 AÑOS'
                    : 'RANGO PERSONALIZADO'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Seleccione un período rápido o ingrese fechas en el calendario
              </span>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Opciones Preseleccionadas */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSetPreset('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                    historyPreset === 'all' || (!historyStartDate && !historyEndDate)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                  }`}
                  title="Incluye todos los pagos y obligaciones contractuales históricas sin límite de tiempo"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>TODO</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetPreset('6m')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    historyPreset === '6m'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                  }`}
                  title="Últimos 6 meses anteriores a la fecha de cómputo"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Últimos 6 meses</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetPreset('12m')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    historyPreset === '12m'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                  }`}
                  title="Últimos 12 meses (1 año) anteriores a la fecha de cómputo"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Últimos 12 meses</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetPreset('24m')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    historyPreset === '24m'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                  }`}
                  title="Últimos 2 años (24 meses) anteriores a la fecha de cómputo"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Últimos 2 años</span>
                </button>
              </div>

              {/* Cuadros de Calendario: Fecha Inicio y Fecha Final */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    Fecha Inicio:
                  </label>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    Fecha Final:
                  </label>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {(historyStartDate || historyEndDate) && (
                  <button
                    type="button"
                    onClick={() => handleSetPreset('all')}
                    className="px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white underline font-bold cursor-pointer shrink-0"
                    title="Restablecer para ver todo el historial sin límite de fechas"
                  >
                    Ver Todo
                  </button>
                )}
              </div>
            </div>

            {/* Nota explicativa de cálculo y auditoría */}
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {historyPreset === 'all' || (!historyStartDate && !historyEndDate)
                  ? 'Mostrando todos los pagos y obligaciones contractuales históricas de las propiedades seleccionadas, con balances calculados después de cada transacción.'
                  : `Reportando período del ${historyStartDate ? formatDate(historyStartDate) : 'inicio'} al ${historyEndDate ? formatDate(historyEndDate) : formatDate(computationDate)}. Los movimientos anteriores se arrastran automáticamente en el renglón de Saldo Anterior.`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Resumen KPI Cards */}
      <div className={`no-print grid grid-cols-2 sm:grid-cols-3 ${includeExpenses ? 'lg:grid-cols-4 xl:grid-cols-8' : 'lg:grid-cols-6'} gap-3`}>
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Renta Facturada</span>
          <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
            {formatCurrency(summaryMetrics.totalRentBilled, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold block">
            Cobrado: {formatCurrency(summaryMetrics.totalRentPaid, primaryAdmin.currencySymbol)}
          </span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Moras Computadas</span>
          <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrency(summaryMetrics.totalLateFees, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-rose-500 font-semibold block">Tras período de gracia</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/20 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 block">Agua Pendiente</span>
          <p className="text-base font-black text-sky-700 dark:text-sky-300 mt-0.5">
            {formatCurrency(summaryMetrics.totalWaterPending, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block">Cuenta independiente</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">Electricidad Pend.</span>
          <p className="text-base font-black text-amber-700 dark:text-amber-300 mt-0.5">
            {formatCurrency(summaryMetrics.totalElectricPending, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block">Cuenta segregada</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/20 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400 block">Cuota Mantenimiento</span>
          <p className="text-base font-black text-purple-700 dark:text-purple-300 mt-0.5">
            {formatCurrency(summaryMetrics.totalMaintenancePending, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block">Cuota de residentes</span>
        </div>

        {/* Card de Gastos Incurridos */}
        {includeExpenses && (
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Gastos Incurridos</span>
            <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
              -{formatCurrency(summaryMetrics.totalExpenses, primaryAdmin.currencySymbol)}
            </p>
            <span className="text-[10px] text-rose-500 font-semibold block">Egresos operativos</span>
          </div>
        )}

        {/* Card de Flujo / Margen Neto Operativo (Ingresos vs Gastos) */}
        {includeExpenses && (
          <div className={`p-3 rounded-xl border shadow-2xs ${
            summaryMetrics.netOperationalBalance >= 0
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
          }`}>
            <span className={`text-[10px] font-black uppercase block ${
              summaryMetrics.netOperationalBalance >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
            }`}>
              Balance Neto Flujo
            </span>
            <p className={`text-base font-black mt-0.5 ${
              summaryMetrics.netOperationalBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              {formatCurrency(summaryMetrics.netOperationalBalance, primaryAdmin.currencySymbol)}
            </p>
            <span className={`text-[10px] font-semibold block ${
              summaryMetrics.netOperationalBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {summaryMetrics.netOperationalBalance >= 0 ? 'Superávit / Margen' : 'Déficit del período'}
            </span>
          </div>
        )}

        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-md border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-amber-300 block">Pendiente Inquilinos</span>
          <p className="text-base font-black text-emerald-400 mt-0.5">
            {formatCurrency(summaryMetrics.grandTotalPending, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block">Por cobrar inquilino</span>
        </div>
      </div>

      {/* 3. The Official Printable Ledger Container */}
      <div
        id="printable-accounting-ledger"
        className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200 max-w-5xl mx-auto space-y-6"
      >
        {/* Letterhead & Timbre Fiscal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            {currentHeaderLogo ? (
              <img
                src={currentHeaderLogo}
                alt={primaryAdmin.companyName}
                className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1 bg-white shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
                {primaryAdmin.companyName.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {selectedAdminId === 'all' && administrators.length > 1
                  ? 'Consorcio de Administración Inmobiliaria'
                  : primaryAdmin.companyName}
              </h2>
              <p className="text-xs text-slate-600 font-semibold">
                Representante: {primaryAdmin.landlordName} • RFC / Tax ID: {primaryAdmin.taxId}
              </p>
              <p className="text-xs text-slate-500">
                {primaryAdmin.address} • Tel: {primaryAdmin.phone} • Email: {primaryAdmin.email}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Documento Oficial Contable
            </span>
            <span className="block text-sm font-black text-sky-900">
              {showHistory ? 'ESTADO DE CUENTA E HISTORIAL TRANSACCIONAL' : 'LIBRO DE FISCALIZACIÓN'}
            </span>
            <span className="block text-xs text-slate-600 font-bold mt-0.5">
              Fecha de Cómputo: {formatDate(computationDate)}
            </span>
            {showHistory && (
              <div className="mt-1 space-y-0.5">
                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded">
                  HISTORIAL: Balances Progresivos Transacción por Transacción
                </span>
                <span className="block text-[10px] text-emerald-900 font-bold">
                  Período: {historyPreset === 'all' || (!historyStartDate && !historyEndDate)
                    ? 'Todo el Historial Completo'
                    : `${historyStartDate ? formatDate(historyStartDate) : 'Inicio'} al ${historyEndDate ? formatDate(historyEndDate) : formatDate(computationDate)}`}
                </span>
              </div>
            )}
            <span className="block text-[10px] text-slate-400 mt-0.5">
              Emitido el {formatDate(new Date().toISOString().split('T')[0])}
            </span>
          </div>
        </div>

        {/* Subtitle & Legal Basis Notice */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>CERTIFICADO DE FISCALIZACIÓN Y CUENTAS SEGREGADAS</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Este informe certifica el estado contable de rentas, penalidades por demora y utilidades. De conformidad con las cláusulas contractuales, las cuentas de utilidades (agua, electricidad, cuotas) se registran en <strong>partidas estrictamente separadas de la renta</strong>. Los cargos por mora se computan única y exclusivamente a partir del vencimiento del período de gracia convenido en contrato.
          </p>
        </div>

        {/* Empty state if no properties matched */}
        {auditedProperties.length === 0 && (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="font-bold">No se encontraron propiedades que coincidan con los filtros seleccionados.</p>
            <p className="text-xs">Ajuste la empresa, fechas o desactive el filtro de 'Solo con saldo pendiente'.</p>
          </div>
        )}

        {/* Properties Ledger by Company */}
        {Array.from(propertiesByAdmin.entries()).map(([adminId, items]) => {
          const companyAdmin = administrators.find((a) => a.id === adminId) || items[0].admin;
          const companyLogo = companyAdmin.logoUrl || (companyAdmin.isDefault ? profile?.logoUrl : undefined);

          return (
            <div key={adminId} className="space-y-6 pt-2">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-300">
                <div className="flex items-center gap-3">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt={companyAdmin.companyName}
                      className="w-12 h-12 object-contain rounded-xl border border-slate-200 p-1 bg-white shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                      <Building2 className="w-6 h-6 text-sky-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                      Empresa: {companyAdmin.companyName} ({items.length} propiedades)
                    </h3>
                    <p className="text-xs text-slate-600">
                      Representante: {companyAdmin.landlordName} • RFC/ID: {companyAdmin.taxId || 'N/A'} • Tel: {companyAdmin.phone || 'N/A'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-700 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                  Moneda: {companyAdmin.currencySymbol || '$'} ({companyAdmin.currencyCode || 'USD'})
                </span>
              </div>

              {/* Individual Property Blocks */}
              {items.map((item) => {
                const { property, status } = item;

                return (
                  <div
                    key={property.id}
                    className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs break-inside-avoid space-y-3 p-4"
                  >
                    {/* Property Header Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 bg-slate-50 -mx-4 -mt-4 p-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-slate-900">
                            {property.propertyIdentifier}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              item.totalPropertyPending <= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status.isOverdue
                                ? 'bg-rose-100 text-rose-800'
                                : item.isInsideGrace
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {item.totalPropertyPending <= 0
                              ? 'Al Día'
                              : item.status.isOverdue
                              ? 'Moroso / Atrasado'
                              : item.isInsideGrace
                              ? 'En Período de Gracia'
                              : item.isBeforeDue
                              ? 'Aún no Exigible'
                              : 'Por Vencer'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {property.address} • Inquilino: <strong>{property.tenant1.name}</strong>
                          {property.tenant1.phone && ` (${property.tenant1.phone})`}
                          {property.tenant2?.name && ` • Segundo: ${property.tenant2.name}`}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0 text-xs">
                        <span className="block font-bold text-slate-800">
                          Cobro contractual: Día {property.rentDueDay} de cada mes
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          Período de gracia: {property.graceDays} días (límite sin cargos: día {property.rentDueDay + property.graceDays})
                        </span>
                      </div>
                    </div>

                    {/* Condicional: HISTORIAL vs Balances Acumulados Corrientes */}
                    {showHistory ? (
                      /* ================= MODO HISTORIAL TRANSACCIONAL ================= */
                      <div className="space-y-4 pt-1">
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-black text-emerald-900 dark:text-emerald-200">
                              Registro Histórico Transaccional y Balances Progresivos
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                            Cuentas y partidas segregadas de auditoría
                          </span>
                        </div>

                        {/* PARTIDA 01: RENTA & MORAS */}
                        {includeRent && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden space-y-2">
                            <div className="bg-slate-100 p-2.5 flex items-center justify-between border-b border-slate-200">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-800" />
                                <span className="font-black text-xs text-slate-900 uppercase">
                                  Partida 01: Renta Contractual & Penalidades por Demora
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                {item.historyData.rentEntries.length} transacciones registradas
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider">
                                    <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                    <th className="py-2 px-2.5 font-bold">Concepto / Transacción</th>
                                    <th className="py-2 px-2.5 font-bold text-right">Obligación a Pagar</th>
                                    <th className="py-2 px-2.5 font-bold text-right">Pago Registrado</th>
                                    <th className="py-2 px-2.5 font-bold text-right bg-slate-900">Balance Calculado</th>
                                    <th className="py-2 px-2.5 font-bold">Evidencia & Justificación Auditable</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {item.historyData.rentEntries.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                        No hay transacciones u obligaciones de renta registradas a la fecha de cómputo.
                                      </td>
                                    </tr>
                                  ) : (
                                    item.historyData.rentEntries.map((entry) => (
                                      <tr
                                        key={entry.id}
                                        className={`hover:bg-slate-50 transition ${
                                          entry.isLateFee && !entry.isPayment
                                            ? 'bg-rose-50/40'
                                            : entry.isPayment
                                            ? 'bg-emerald-50/20'
                                            : ''
                                        }`}
                                      >
                                        <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                          {formatDate(entry.date)}
                                        </td>
                                        <td className="py-2 px-2.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-slate-900">
                                              {entry.transactionTitle}
                                            </span>
                                            {entry.isLateFee && !entry.isPayment && (
                                              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[9px] font-black rounded">
                                                Penalidad por Mora
                                              </span>
                                            )}
                                            {entry.isPayment && (
                                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded">
                                                Pago Registrado
                                              </span>
                                            )}
                                            {!entry.isPayment && !entry.isLateFee && (
                                              <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[9px] font-bold rounded">
                                                Obligación Contractual
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                          {entry.obligationAmount !== null ? (
                                            <div>
                                              <span className={`font-black ${entry.isLateFee ? 'text-rose-700' : 'text-slate-900'}`}>
                                                {formatCurrency(entry.obligationAmount, companyAdmin.currencySymbol)}
                                              </span>
                                              {entry.contractualDueDate && (
                                                <span className="block text-[9px] text-slate-500 font-medium">
                                                  Vence: {formatDate(entry.contractualDueDate)}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-slate-300">-</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                          {entry.paymentAmount !== null ? (
                                            <div>
                                              <span className="font-black text-emerald-700">
                                                {formatCurrency(entry.paymentAmount, companyAdmin.currencySymbol)}
                                              </span>
                                              {entry.paymentDate && (
                                                <span className="block text-[9px] text-slate-500 font-medium">
                                                  Fecha pago: {formatDate(entry.paymentDate)}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-slate-300">-</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2.5 text-right bg-slate-50 font-black whitespace-nowrap">
                                          <span
                                            className={`${
                                              entry.runningBalance > 0
                                                ? 'text-rose-700'
                                                : entry.runningBalance === 0
                                                ? 'text-emerald-700'
                                                : 'text-sky-700'
                                            }`}
                                          >
                                            {formatCurrency(entry.runningBalance, companyAdmin.currencySymbol)}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-600 text-[11px] leading-snug">
                                          {entry.notes}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-100 font-black text-[11px] text-slate-800 border-t-2 border-slate-300">
                                    <td colSpan={2} className="py-2 px-2.5 uppercase">
                                      Totales Acumulados Partida Renta & Moras:
                                    </td>
                                    <td className="py-2 px-2.5 text-right text-slate-900">
                                      {formatCurrency(item.historyData.rentTotalObligations, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className="py-2 px-2.5 text-right text-emerald-800">
                                      {formatCurrency(item.historyData.rentTotalPayments, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className="py-2 px-2.5 text-right text-rose-800 bg-slate-200">
                                      {formatCurrency(item.historyData.rentFinalBalance, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className="py-2 px-2.5 text-slate-500 font-normal text-[10px]">
                                      Saldo al corte de cómputo
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* PARTIDA 02: AGUA POTABLE */}
                        {includeWater && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden space-y-2">
                            <div className="bg-sky-50 p-2.5 flex items-center justify-between border-b border-sky-200">
                              <div className="flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-sky-700" />
                                <span className="font-black text-xs text-sky-900 uppercase">
                                  Partida 02: Utilidad de Agua Potable (Cuenta Segregada)
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-sky-700 uppercase">
                                {property.utilitiesWaterActive
                                  ? `${item.historyData.waterEntries.length} transacciones registradas`
                                  : 'No estipulado en contrato (N/A)'}
                              </span>
                            </div>

                            {property.utilitiesWaterActive ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-sky-950 text-white text-[10px] uppercase tracking-wider">
                                      <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                      <th className="py-2 px-2.5 font-bold">Concepto / Factura</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Facturado a Pagar</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Pago Registrado</th>
                                      <th className="py-2 px-2.5 font-bold text-right bg-slate-900">Balance Calculado</th>
                                      <th className="py-2 px-2.5 font-bold">Evidencia & Soporte Auditable</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {item.historyData.waterEntries.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                          No hay transacciones registradas para agua potable.
                                        </td>
                                      </tr>
                                    ) : (
                                      item.historyData.waterEntries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50 transition">
                                          <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                            {formatDate(entry.date)}
                                          </td>
                                          <td className="py-2 px-2.5">
                                            <span className="font-bold text-slate-900">{entry.transactionTitle}</span>
                                          </td>
                                          <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-sky-900">
                                            {entry.obligationAmount !== null
                                              ? formatCurrency(entry.obligationAmount, companyAdmin.currencySymbol)
                                              : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-emerald-700">
                                            {entry.paymentAmount !== null ? (
                                              <div>
                                                <span>{formatCurrency(entry.paymentAmount, companyAdmin.currencySymbol)}</span>
                                                {entry.paymentDate && (
                                                  <span className="block text-[9px] text-slate-500 font-medium">
                                                    Fecha: {formatDate(entry.paymentDate)}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 text-right bg-slate-50 font-black whitespace-nowrap text-sky-900">
                                            {formatCurrency(entry.runningBalance, companyAdmin.currencySymbol)}
                                          </td>
                                          <td className="py-2 px-2.5 text-slate-600 text-[11px] leading-snug">
                                            {entry.notes}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-sky-50 font-black text-[11px] text-sky-900 border-t-2 border-sky-200">
                                      <td colSpan={2} className="py-2 px-2.5 uppercase">
                                        Totales Acumulados Partida Agua Potable:
                                      </td>
                                      <td className="py-2 px-2.5 text-right">
                                        {formatCurrency(item.historyData.waterTotalObligations, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right text-emerald-800">
                                        {formatCurrency(item.historyData.waterTotalPayments, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right bg-sky-100">
                                        {formatCurrency(item.historyData.waterFinalBalance, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-500 font-normal text-[10px]">
                                        Cuenta segregada de renta
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50">
                                Utilidad de Agua Potable: N/A (No aplica a esta propiedad según contrato de arrendamiento)
                              </div>
                            )}
                          </div>
                        )}

                        {/* PARTIDA 03: ELECTRICIDAD */}
                        {includeElectric && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden space-y-2">
                            <div className="bg-amber-50 p-2.5 flex items-center justify-between border-b border-amber-200">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-700" />
                                <span className="font-black text-xs text-amber-900 uppercase">
                                  Partida 03: Utilidad de Electricidad (Cuenta Segregada)
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-amber-700 uppercase">
                                {property.utilitiesElectricActive
                                  ? `${item.historyData.electricEntries.length} transacciones registradas`
                                  : 'No estipulado en contrato (N/A)'}
                              </span>
                            </div>

                            {property.utilitiesElectricActive ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-amber-950 text-white text-[10px] uppercase tracking-wider">
                                      <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                      <th className="py-2 px-2.5 font-bold">Concepto / Factura</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Facturado a Pagar</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Pago Registrado</th>
                                      <th className="py-2 px-2.5 font-bold text-right bg-slate-900">Balance Calculado</th>
                                      <th className="py-2 px-2.5 font-bold">Evidencia & Soporte Auditable</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {item.historyData.electricEntries.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                          No hay transacciones registradas para electricidad.
                                        </td>
                                      </tr>
                                    ) : (
                                      item.historyData.electricEntries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50 transition">
                                          <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                            {formatDate(entry.date)}
                                          </td>
                                          <td className="py-2 px-2.5">
                                            <span className="font-bold text-slate-900">{entry.transactionTitle}</span>
                                          </td>
                                          <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-amber-900">
                                            {entry.obligationAmount !== null
                                              ? formatCurrency(entry.obligationAmount, companyAdmin.currencySymbol)
                                              : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-emerald-700">
                                            {entry.paymentAmount !== null ? (
                                              <div>
                                                <span>{formatCurrency(entry.paymentAmount, companyAdmin.currencySymbol)}</span>
                                                {entry.paymentDate && (
                                                  <span className="block text-[9px] text-slate-500 font-medium">
                                                    Fecha: {formatDate(entry.paymentDate)}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 text-right bg-slate-50 font-black whitespace-nowrap text-amber-900">
                                            {formatCurrency(entry.runningBalance, companyAdmin.currencySymbol)}
                                          </td>
                                          <td className="py-2 px-2.5 text-slate-600 text-[11px] leading-snug">
                                            {entry.notes}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-amber-50 font-black text-[11px] text-amber-900 border-t-2 border-amber-200">
                                      <td colSpan={2} className="py-2 px-2.5 uppercase">
                                        Totales Acumulados Partida Electricidad:
                                      </td>
                                      <td className="py-2 px-2.5 text-right">
                                        {formatCurrency(item.historyData.electricTotalObligations, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right text-emerald-800">
                                        {formatCurrency(item.historyData.electricTotalPayments, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right bg-amber-100">
                                        {formatCurrency(item.historyData.electricFinalBalance, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-500 font-normal text-[10px]">
                                        Cuenta segregada de renta
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50">
                                Utilidad de Electricidad: N/A (No aplica a esta propiedad según contrato de arrendamiento)
                              </div>
                            )}
                          </div>
                        )}

                        {/* PARTIDA 04: MANTENIMIENTO / CUOTA */}
                        {includeMaintenance && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden space-y-2">
                            <div className="bg-purple-50 p-2.5 flex items-center justify-between border-b border-purple-200">
                              <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-purple-700" />
                                <span className="font-black text-xs text-purple-900 uppercase">
                                  Partida 04: Mantenimiento / Cuota de Residentes (Cuenta Segregada)
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-purple-700 uppercase">
                                {property.utilitiesMaintenanceActive
                                  ? `${item.historyData.maintenanceEntries.length} transacciones registradas`
                                  : 'No estipulado en contrato (N/A)'}
                              </span>
                            </div>

                            {property.utilitiesMaintenanceActive ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-purple-950 text-white text-[10px] uppercase tracking-wider">
                                      <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                      <th className="py-2 px-2.5 font-bold">Concepto / Cuota</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Cuota a Pagar</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Pago Registrado</th>
                                      <th className="py-2 px-2.5 font-bold text-right bg-slate-900">Balance Calculado</th>
                                      <th className="py-2 px-2.5 font-bold">Evidencia & Soporte Auditable</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {item.historyData.maintenanceEntries.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                          No hay transacciones registradas para cuota de mantenimiento.
                                        </td>
                                      </tr>
                                    ) : (
                                      item.historyData.maintenanceEntries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50 transition">
                                          <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                            {formatDate(entry.date)}
                                          </td>
                                          <td className="py-2 px-2.5">
                                            <span className="font-bold text-slate-900">{entry.transactionTitle}</span>
                                          </td>
                                          <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-purple-900">
                                            {entry.obligationAmount !== null
                                              ? formatCurrency(entry.obligationAmount, companyAdmin.currencySymbol)
                                              : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-emerald-700">
                                            {entry.paymentAmount !== null ? (
                                              <div>
                                                <span>{formatCurrency(entry.paymentAmount, companyAdmin.currencySymbol)}</span>
                                                {entry.paymentDate && (
                                                  <span className="block text-[9px] text-slate-500 font-medium">
                                                    Fecha: {formatDate(entry.paymentDate)}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              '-'
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 text-right bg-slate-50 font-black whitespace-nowrap text-purple-900">
                                            {formatCurrency(entry.runningBalance, companyAdmin.currencySymbol)}
                                          </td>
                                          <td className="py-2 px-2.5 text-slate-600 text-[11px] leading-snug">
                                            {entry.notes}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-purple-50 font-black text-[11px] text-purple-900 border-t-2 border-purple-200">
                                      <td colSpan={2} className="py-2 px-2.5 uppercase">
                                        Totales Acumulados Partida Cuota de Residentes:
                                      </td>
                                      <td className="py-2 px-2.5 text-right">
                                        {formatCurrency(item.historyData.maintenanceTotalObligations, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right text-emerald-800">
                                        {formatCurrency(item.historyData.maintenanceTotalPayments, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right bg-purple-100">
                                        {formatCurrency(item.historyData.maintenanceFinalBalance, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-500 font-normal text-[10px]">
                                        Cuenta segregada de renta
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50">
                                Mantenimiento / Cuota: N/A (No aplica a esta propiedad según contrato de arrendamiento)
                              </div>
                            )}
                          </div>
                        )}

                        {/* PARTIDA 05: GASTOS OPERATIVOS INCURRIDOS (CUENTA DE EGRESOS) */}
                        {includeExpenses && (
                          <div className="border border-rose-200 rounded-lg overflow-hidden space-y-2">
                            <div className="bg-rose-50 p-2.5 flex items-center justify-between border-b border-rose-200">
                              <div className="flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-rose-700" />
                                <span className="font-black text-xs text-rose-900 uppercase">
                                  Partida 05: Gastos Operativos Incurridos (Cuenta Segregada de Egresos)
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-rose-700 uppercase">
                                {item.historyData.expenseEntries.length} gastos registrados
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-rose-950 text-white text-[10px] uppercase tracking-wider">
                                    <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                    <th className="py-2 px-2.5 font-bold">Concepto / Categoría</th>
                                    <th className="py-2 px-2.5 font-bold">Detalle o Motivo</th>
                                    <th className="py-2 px-2.5 font-bold">Proveedor / Recibo</th>
                                    <th className="py-2 px-2.5 font-bold text-right">Monto Gasto</th>
                                    <th className="py-2 px-2.5 font-bold text-right bg-rose-900">Total Acumulado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-rose-100">
                                  {item.historyData.expenseEntries.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                        No hay gastos operativos registrados para esta propiedad en el período seleccionado.
                                      </td>
                                    </tr>
                                  ) : (
                                    item.historyData.expenseEntries.map((entry) => (
                                      <tr key={entry.id} className="hover:bg-rose-50/30 transition">
                                        <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                          {formatDate(entry.date)}
                                        </td>
                                        <td className="py-2 px-2.5">
                                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                                            {entry.conceptName.replace('Gasto: ', '')}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2.5 font-bold text-slate-900">
                                          {entry.transactionTitle}
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-600 text-[11px]">
                                          {entry.payerName || '-'}
                                          {entry.reference && ` (#${entry.reference})`}
                                        </td>
                                        <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-rose-600">
                                          -{formatCurrency(entry.obligationAmount || 0, companyAdmin.currencySymbol)}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-black whitespace-nowrap text-rose-900 bg-rose-50/50">
                                          {formatCurrency(entry.runningBalance, companyAdmin.currencySymbol)}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-rose-50 font-black text-[11px] text-rose-900 border-t-2 border-rose-200">
                                    <td colSpan={4} className="py-2 px-2.5 uppercase">
                                      Total Acumulado de Gastos Operativos Propiedad:
                                    </td>
                                    <td className="py-2 px-2.5 text-right text-rose-700 font-black whitespace-nowrap">
                                      {formatCurrency(item.historyData.expenseTotalAmount, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className="py-2 px-2.5 text-slate-500 font-normal text-[10px] text-right">
                                      Cuenta de egresos
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* CONCILIACIÓN CONSECUTIVA POR FECHAS: INGRESOS COBRADOS VS GASTOS INCURRIDOS */}
                        {includeExpenses && item.historyData.cashflowEntries.length > 0 && (
                          <div className="border-2 border-slate-700 rounded-xl overflow-hidden space-y-2 shadow-xs bg-white">
                            <div className="bg-slate-800 text-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Scale className="w-4 h-4 text-emerald-400" />
                                <span className="font-black text-xs uppercase tracking-wide">
                                  Conciliación Consecutiva por Fechas: Ingresos Cobrados vs Gastos Incurridos
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-300 font-medium">
                                Computado cronológicamente transacción por transacción para evaluar ingresos versus gastos
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                                    <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                    <th className="py-2 px-2.5 font-bold text-center w-28">Tipo</th>
                                    <th className="py-2 px-2.5 font-bold">Concepto / Detalle / Proveedor</th>
                                    <th className="py-2 px-2.5 font-bold text-right text-emerald-300">Ingreso Cobrado (+)</th>
                                    <th className="py-2 px-2.5 font-bold text-right text-rose-300">Gasto Incurrido (-)</th>
                                    <th className="py-2 px-2.5 font-bold text-right bg-slate-950 text-white">Balance Neto Consecutivo</th>
                                    <th className="py-2 px-2.5 font-bold">Comprobante / Notas</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {item.historyData.cashflowEntries.map((cf) => (
                                    <tr
                                      key={cf.id}
                                      className={`hover:bg-slate-50 transition ${
                                        cf.type === 'income' ? 'bg-emerald-50/20' : 'bg-rose-50/20'
                                      }`}
                                    >
                                      <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                        {formatDate(cf.date)}
                                      </td>
                                      <td className="py-2 px-2.5 text-center">
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                            cf.type === 'income'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-rose-100 text-rose-800'
                                          }`}
                                        >
                                          {cf.type === 'income' ? (
                                            <>
                                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                                              <span>Ingreso</span>
                                            </>
                                          ) : (
                                            <>
                                              <ArrowDownRight className="w-3 h-3 text-rose-600" />
                                              <span>Gasto</span>
                                            </>
                                          )}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2.5">
                                        <div className="font-bold text-slate-900">
                                          {cf.concept}
                                        </div>
                                        {cf.payeeOrPayer && (
                                          <div className="text-[10px] text-slate-500">
                                            {cf.type === 'income' ? 'Pagador:' : 'Proveedor:'} {cf.payeeOrPayer}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2 px-2.5 text-right font-black text-emerald-700 whitespace-nowrap">
                                        {cf.incomeAmount !== null ? `+${formatCurrency(cf.incomeAmount, companyAdmin.currencySymbol)}` : '-'}
                                      </td>
                                      <td className="py-2 px-2.5 text-right font-black text-rose-600 whitespace-nowrap">
                                        {cf.expenseAmount !== null ? `-${formatCurrency(cf.expenseAmount, companyAdmin.currencySymbol)}` : '-'}
                                      </td>
                                      <td className={`py-2 px-2.5 text-right font-black whitespace-nowrap ${
                                        cf.runningBalance >= 0 ? 'text-emerald-700 bg-emerald-50/40' : 'text-rose-700 bg-rose-50/40'
                                      }`}>
                                        {formatCurrency(cf.runningBalance, companyAdmin.currencySymbol)}
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-600 text-[11px]">
                                        {cf.receiptOrReference ? `Doc #${cf.receiptOrReference}. ` : ''}
                                        {cf.notes || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                    <td colSpan={3} className="py-2.5 px-3 uppercase text-right">
                                      Totales Consecutivos Propiedad:
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right text-emerald-400">
                                      +{formatCurrency(item.historyData.totalCashIncome, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right text-rose-400">
                                      -{formatCurrency(item.historyData.totalCashExpenses, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className={`py-2.5 px-2.5 text-right text-sm ${
                                      item.historyData.netCashflowBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                                    }`}>
                                      {formatCurrency(item.historyData.netCashflowBalance, companyAdmin.currencySymbol)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-[10px] text-slate-400 font-normal">
                                      {item.historyData.netCashflowBalance >= 0 ? 'Superávit neto' : 'Déficit del período'}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ================= MODO ESTÁNDAR: BALANCES AL CORTE ================= */
                      <>
                        {/* Tabla Desglosada tipo Libro de Contabilidad */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                                <th className="py-2 px-2.5 font-bold">Concepto / Partida</th>
                                <th className="py-2 px-2.5 font-bold text-right">Cantidad a Pagar</th>
                                <th className="py-2 px-2.5 font-bold text-center">Fecha a Pagarla</th>
                                <th className="py-2 px-2.5 font-bold text-right">Cantidad Pagada</th>
                                <th className="py-2 px-2.5 font-bold text-center">Fecha Pagada</th>
                                <th className="py-2 px-2.5 font-bold text-right">Balance Pendiente</th>
                                <th className="py-2 px-2.5 font-bold text-center">Fecha Límite Gracia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {/* Renglón 1: Renta Contractual */}
                              {includeRent && (
                                <tr className="hover:bg-slate-50 transition">
                                  <td className="py-2 px-2.5">
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                      <span>Renta Contractual</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {item.isBeforeDue
                                        ? `Ciclo inicia el ${formatDate(item.dueDateStr)} (Aún no exigible a la fecha de cómputo)`
                                        : `Vigente del ciclo`}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-slate-800">
                                    {formatCurrency(property.rentAmount, companyAdmin.currencySymbol)}
                                  </td>
                                  <td className="py-2 px-2.5 text-center font-medium text-slate-700">
                                    {formatDate(item.dueDateStr)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-700">
                                    {formatCurrency(status.paidRentThisMonth, companyAdmin.currencySymbol)}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {item.rentPayDates}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-black text-slate-900">
                                    {formatCurrency(status.pendingRentBalance, companyAdmin.currencySymbol)}
                                  </td>
                                  <td className="py-2 px-2.5 text-center">
                                    <span className="font-bold text-slate-800 block">{formatDate(item.graceDeadlineStr)}</span>
                                    <span
                                      className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        item.isBeforeDue
                                          ? 'bg-slate-100 text-slate-700'
                                          : item.isInsideGrace
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {item.isBeforeDue
                                        ? 'No exigible aún'
                                        : item.isInsideGrace
                                        ? 'En gracia sin mora'
                                        : 'Gracia vencida'}
                                    </span>
                                  </td>
                                </tr>
                              )}

                              {/* Renglón 2: Utilidad de Agua */}
                              {includeWater && (
                                <tr className="hover:bg-slate-50 transition">
                                  <td className="py-2 px-2.5">
                                    <div className="font-bold text-sky-900 flex items-center gap-1.5">
                                      <Droplets className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                      <span>Utilidad de Agua Potable</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {property.utilitiesWaterActive ? 'Consumo según factura proveedor' : 'No estipulado en contrato'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-sky-900">
                                    {property.utilitiesWaterActive
                                      ? formatCurrency(status.waterAmount, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-700">
                                    {property.utilitiesWaterActive ? formatDate(item.dueDateStr) : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-700">
                                    {property.utilitiesWaterActive
                                      ? formatCurrency(status.paidWaterThisMonth, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {property.utilitiesWaterActive ? item.waterPayDates : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-black text-sky-900">
                                    {property.utilitiesWaterActive
                                      ? formatCurrency(status.pendingWaterBalance, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {property.utilitiesWaterActive ? formatDate(item.graceDeadlineStr) : 'N/A'}
                                  </td>
                                </tr>
                              )}

                              {/* Renglón 3: Utilidad de Electricidad */}
                              {includeElectric && (
                                <tr className="hover:bg-slate-50 transition">
                                  <td className="py-2 px-2.5">
                                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                                      <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>Electricidad</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {property.utilitiesElectricActive ? 'Consumo según recibo de luz' : 'No estipulado en contrato'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-amber-900">
                                    {property.utilitiesElectricActive
                                      ? formatCurrency(status.electricAmount, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-700">
                                    {property.utilitiesElectricActive ? formatDate(item.dueDateStr) : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-700">
                                    {property.utilitiesElectricActive
                                      ? formatCurrency(status.paidElectricThisMonth, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {property.utilitiesElectricActive ? item.electricPayDates : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-black text-amber-900">
                                    {property.utilitiesElectricActive
                                      ? formatCurrency(status.pendingElectricBalance, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {property.utilitiesElectricActive ? formatDate(item.graceDeadlineStr) : 'N/A'}
                                  </td>
                                </tr>
                              )}

                              {/* Renglón 4: Mantenimiento o Cuota de Residentes */}
                              {includeMaintenance && (
                                <tr className="hover:bg-slate-50 transition">
                                  <td className="py-2 px-2.5">
                                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                                      <Wrench className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                      <span>Mantenimiento / Cuota de Residentes</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {property.utilitiesMaintenanceActive ? 'Cuota mensual de condominio/áreas comunes' : 'No estipulado en contrato'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-purple-900">
                                    {property.utilitiesMaintenanceActive
                                      ? formatCurrency(status.maintenanceAmount, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-700">
                                    {property.utilitiesMaintenanceActive ? formatDate(item.dueDateStr) : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-semibold text-emerald-700">
                                    {property.utilitiesMaintenanceActive
                                      ? formatCurrency(status.paidMaintenanceThisMonth, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {property.utilitiesMaintenanceActive ? item.maintenancePayDates : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-black text-purple-900">
                                    {property.utilitiesMaintenanceActive
                                      ? formatCurrency(status.pendingMaintenanceBalance, companyAdmin.currencySymbol)
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-slate-600">
                                    {property.utilitiesMaintenanceActive ? formatDate(item.graceDeadlineStr) : 'N/A'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Sub-sección: Fiscalización de Morosidad y Penalidades */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                            <span className="font-black text-slate-800 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cómputo Legal de Penalidades por Morosidad a la Fecha del Informe:</span>
                            </span>
                            <span className="text-slate-600 font-semibold text-[11px]">
                              Fecha evaluada: <strong>{formatDate(computationDate)}</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block">Días de retraso tras gracia:</span>
                              <span className="font-black text-slate-800 text-xs">
                                {status.daysOverdue} días
                              </span>
                              {item.isBeforeDue && (
                                <span className="block text-[10px] text-slate-400">Renta aún no exigible</span>
                              )}
                              {item.isInsideGrace && (
                                <span className="block text-[10px] text-emerald-600 font-bold">Dentro de los 5d de gracia</span>
                              )}
                            </div>

                            <div>
                              <span className="text-slate-500 block">Cargo Base por Demora:</span>
                              <span
                                className={`font-black text-xs ${
                                  status.calculatedLateFeeBase > 0 ? 'text-rose-600' : 'text-slate-700'
                                }`}
                              >
                                {formatCurrency(status.calculatedLateFeeBase, companyAdmin.currencySymbol)}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                Base contractual: {formatCurrency(property.lateFeeBase, companyAdmin.currencySymbol)}
                              </span>
                            </div>

                            <div>
                              <span className="text-slate-500 block">Demora Diaria Calculada:</span>
                              <span
                                className={`font-black text-xs ${
                                  status.calculatedLateFeeDaily > 0 ? 'text-rose-600' : 'text-slate-700'
                                }`}
                              >
                                {formatCurrency(status.calculatedLateFeeDaily, companyAdmin.currencySymbol)}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                {formatCurrency(property.lateFeeDaily, companyAdmin.currencySymbol)}/día (
                                {status.effectiveDailyDays ?? status.daysOverdue}d aplicados)
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block text-[10px]">Total Recargos por Mora:</span>
                              <span
                                className={`font-black text-sm block ${
                                  status.totalLateFees > 0 ? 'text-rose-600' : 'text-slate-800'
                                }`}
                              >
                                {formatCurrency(status.totalLateFees, companyAdmin.currencySymbol)}
                              </span>
                              {status.lateFeeCapNotice && (
                                <span className="text-[9px] text-amber-700 font-bold block">
                                  {status.lateFeeCapNotice}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tabla de Gastos Operativos Imputables de la Propiedad (Modo Estándar) */}
                        {includeExpenses && (
                          <div className="border border-rose-200 dark:border-rose-900/60 rounded-xl overflow-hidden bg-white dark:bg-slate-900 mt-2">
                            <div className="bg-rose-50 dark:bg-rose-950/60 p-2.5 flex items-center justify-between border-b border-rose-200 dark:border-rose-900/60">
                              <div className="flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-rose-600" />
                                <span className="font-black text-xs text-rose-950 dark:text-rose-200 uppercase">
                                  Gastos Operativos Imputables ({formatDate(computationDate)})
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                                {item.propExpenses.length} gastos • Total: {formatCurrency(item.totalPropExpenses, companyAdmin.currencySymbol)}
                              </span>
                            </div>

                            {item.propExpenses.length === 0 ? (
                              <div className="py-3 px-4 text-center text-xs text-slate-400 italic">
                                No se registran gastos operativos para esta propiedad en el ciclo evaluado.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-rose-950 text-white text-[10px] uppercase tracking-wider">
                                      <th className="py-2 px-2.5 font-bold w-24 text-center">Fecha</th>
                                      <th className="py-2 px-2.5 font-bold">Concepto / Categoría</th>
                                      <th className="py-2 px-2.5 font-bold">Detalle o Motivo</th>
                                      <th className="py-2 px-2.5 font-bold">Proveedor / Recibo</th>
                                      <th className="py-2 px-2.5 font-bold text-right">Monto Gasto</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-rose-100 dark:divide-rose-950">
                                    {item.propExpenses.map((exp) => (
                                      <tr key={exp.id} className="hover:bg-rose-50/30 transition">
                                        <td className="py-2 px-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">
                                          {formatDate(exp.date)}
                                        </td>
                                        <td className="py-2 px-2.5 font-bold text-rose-950 dark:text-rose-200">
                                          <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px]">
                                            {exp.category}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-800 dark:text-slate-200">
                                          {exp.description}
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 text-[11px]">
                                          {exp.vendorOrPayee || '-'}
                                          {exp.receiptNumber && ` (Doc #${exp.receiptNumber})`}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-black text-rose-600 whitespace-nowrap">
                                          -{formatCurrency(exp.amount, companyAdmin.currencySymbol)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-rose-50/80 dark:bg-rose-950/80 font-black text-xs text-rose-900 dark:text-rose-200 border-t-2 border-rose-200">
                                      <td colSpan={4} className="py-2 px-2.5 text-right uppercase">
                                        Total Gastos Operativos Propiedad:
                                      </td>
                                      <td className="py-2 px-2.5 text-right text-rose-700 font-black whitespace-nowrap">
                                        {formatCurrency(item.totalPropExpenses, companyAdmin.currencySymbol)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Resumen de Totales: Cuentas por Cobrar vs Flujo Ingresos vs Gastos */}
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col md:flex-row items-stretch justify-between gap-4 text-xs">
                      {/* Bloque 1: Cuentas por Cobrar al Inquilino */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                          Balances Pendientes del Inquilino (Cuentas por Cobrar)
                        </span>
                        <div className="flex flex-wrap items-center gap-3 text-[11px]">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Renta & Moras:</span>
                            <strong className="text-white">
                              {formatCurrency(item.totalAccumulatedRentAndFees, companyAdmin.currencySymbol)}
                            </strong>
                          </div>
                          <div className="h-5 w-px bg-slate-700" />
                          <div>
                            <span className="text-sky-300 block text-[10px]">Utilidades Pendientes:</span>
                            <strong className="text-sky-200">
                              {formatCurrency(item.totalAccumulatedUtilities, companyAdmin.currencySymbol)}
                            </strong>
                          </div>
                          <div className="h-5 w-px bg-slate-700" />
                          <div className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                            <span className="text-[10px] text-amber-300 block font-bold uppercase">Saldo Inquilino</span>
                            <strong className="text-amber-200 font-black text-xs">
                              {formatCurrency(item.totalPropertyPending, companyAdmin.currencySymbol)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Bloque 2: Flujo Financiero Real de la Propiedad (Ingresos Cobrados vs Gastos Incurridos) */}
                      {includeExpenses && (
                        <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700 flex flex-wrap items-center gap-4 text-right">
                          <div>
                            <span className="text-[10px] text-emerald-400 block font-bold uppercase">Ingresos Cobrados:</span>
                            <span className="font-black text-xs text-emerald-400">
                              +{formatCurrency(showHistory ? item.historyData.totalCashIncome : item.totalPropIncome, companyAdmin.currencySymbol)}
                            </span>
                          </div>
                          <div className="h-6 w-px bg-slate-700" />
                          <div>
                            <span className="text-[10px] text-rose-400 block font-bold uppercase">Gastos Incurridos:</span>
                            <span className="font-black text-xs text-rose-400">
                              -{formatCurrency(showHistory ? item.historyData.totalCashExpenses : item.totalPropExpenses, companyAdmin.currencySymbol)}
                            </span>
                          </div>
                          <div className="h-6 w-px bg-slate-700" />
                          <div className="bg-slate-900 px-3 py-1 rounded-md border border-slate-700">
                            <span className="text-[10px] text-slate-300 block font-black uppercase">Balance Neto (Ingresos vs Gastos)</span>
                            <span className={`font-black text-sm ${(showHistory ? item.historyData.netCashflowBalance : item.propNetCashflow) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatCurrency(showHistory ? item.historyData.netCashflowBalance : item.propNetCashflow, companyAdmin.currencySymbol)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Gran Total Consolidado al pie del informe */}
        <div className="pt-4 border-t-2 border-slate-800 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex flex-col xl:flex-row items-stretch justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Gran Total Fiscalizado Consolidado
              </h4>
              <p className="text-xs text-slate-500">
                Suma consolidada de todas las propiedades y empresas incluidas en este informe contable.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-right">
              {/* Balances pendientes del inquilino */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Renta y Moras Pendientes</span>
                <span className="font-black text-xs text-slate-900">
                  {formatCurrency(summaryMetrics.totalRentPending + summaryMetrics.totalLateFees, primaryAdmin.currencySymbol)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Utilidades Pendientes</span>
                <span className="font-black text-xs text-sky-800">
                  {formatCurrency(summaryMetrics.totalWaterPending + summaryMetrics.totalElectricPending + summaryMetrics.totalMaintenancePending, primaryAdmin.currencySymbol)}
                </span>
              </div>
              <div className="bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-xs">
                <span className="block text-[10px] uppercase font-bold text-amber-300">Total por Cobrar Inquilino</span>
                <span className="font-black text-sm text-emerald-400">
                  {formatCurrency(summaryMetrics.grandTotalPending, primaryAdmin.currencySymbol)}
                </span>
              </div>

              {/* Conciliación Financiera (Cobrado Realmente vs Gastado) */}
              {includeExpenses && (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-emerald-950 shadow-2xs">
                    <span className="block text-[10px] uppercase font-bold text-emerald-700">Ingresos Cobrados</span>
                    <span className="font-black text-xs text-emerald-700">
                      +{formatCurrency(summaryMetrics.totalIncomeReceived, primaryAdmin.currencySymbol)}
                    </span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-rose-950 shadow-2xs">
                    <span className="block text-[10px] uppercase font-bold text-rose-700">Gastos Incurridos</span>
                    <span className="font-black text-xs text-rose-700">
                      -{formatCurrency(summaryMetrics.totalExpenses, primaryAdmin.currencySymbol)}
                    </span>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-white shadow-md ${summaryMetrics.netOperationalBalance >= 0 ? 'bg-emerald-800' : 'bg-rose-800'}`}>
                    <span className="block text-[10px] uppercase font-black text-white/90">Balance Diferencial Neto</span>
                    <span className="font-black text-base text-white">
                      {formatCurrency(summaryMetrics.netOperationalBalance, primaryAdmin.currencySymbol)}
                    </span>
                    <span className="block text-[9px] text-white/80">
                      {summaryMetrics.netOperationalBalance >= 0 ? 'Superávit Operativo' : 'Déficit Operativo'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sello y Firmas */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
            <div className="flex flex-col items-center">
              {(primaryAdmin.signatureUrl || profile?.signatureUrl) && (
                <img
                  src={primaryAdmin.signatureUrl || profile?.signatureUrl}
                  alt="Firma Digital"
                  className="h-12 max-w-[180px] object-contain mb-1"
                />
              )}
              <div className="w-48 border-b border-slate-400 mx-auto mb-1" />
              <p className="font-bold text-slate-800">{primaryAdmin.landlordName}</p>
              <p className="text-[10px] text-slate-500">
                Administrador Responsable{(primaryAdmin.signatureUrl || profile?.signatureUrl) ? ' (Firma Digitalizada)' : ''} • {primaryAdmin.companyName}
              </p>
            </div>
            <div className="flex flex-col items-center justify-end">
              <div className="w-48 border-b border-slate-400 mx-auto mb-1" />
              <p className="font-bold text-slate-800">Sello de Auditoría Contable</p>
              <p className="text-[10px] text-slate-500">Certificación de Cuentas y Saldos Segregados</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
