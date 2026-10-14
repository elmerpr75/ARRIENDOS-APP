import React, { useState, useMemo } from 'react';
import { Property, Payment, Administrator, LandlordProfile } from '../types';
import {
  calculatePropertyStatus,
  formatCurrency,
  formatDate,
  parseLocalDate,
  computeMonthlyLateFee,
} from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import { downloadElementAsPdf, printElementSafely } from '../utils/pdfGenerator';
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
} from 'lucide-react';

interface AccountingAuditViewProps {
  properties: Property[];
  payments: Payment[];
  administrators: Administrator[];
  profile?: LandlordProfile;
  onOpenInvoice?: (status: any, mode?: 'current' | 'next_month') => void;
  onRegisterPayment?: (propertyId: string, defaultPayer?: string, defaultAmount?: number) => void;
}

export interface HistoricalLedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  conceptType: 'renta' | 'mora' | 'agua' | 'electricidad' | 'mantenimiento';
  conceptName: string;
  transactionTitle: string;
  obligationAmount: number | null; // Cantidad obligación contractual
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

  grandTotalObligations: number;
  grandTotalPayments: number;
  grandFinalBalance: number;
}

export function generatePropertyHistoricalData(
  property: Property,
  propPayments: Payment[],
  referenceDate: Date,
  includeRent: boolean,
  includeWater: boolean,
  includeElectric: boolean,
  includeMaintenance: boolean,
  companyAdmin: Administrator
): PropertyHistoricalData {
  const refTime = referenceDate.getTime();
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  const contractStart = parseLocalDate(property.contractStartDate);
  let startYear = !isNaN(contractStart.getTime()) ? contractStart.getFullYear() : refYear;
  let startMonth = !isNaN(contractStart.getTime()) ? contractStart.getMonth() : Math.max(0, refMonth - 2);

  if (startYear > refYear || (startYear === refYear && startMonth > refMonth)) {
    startYear = refYear;
    startMonth = refMonth;
  }

  let totalMonths = (refYear - startYear) * 12 + (refMonth - startMonth);
  if (totalMonths > 24) {
    totalMonths = 24;
    startYear = refYear - 2;
    startMonth = refMonth;
  }
  const totalCycles = Math.max(1, totalMonths + 1);

  // Track matched payments to avoid double-counting or omitting any
  const matchedPaymentIds = new Set<string>();

  // 1. Renta & Moras
  const rentEntries: HistoricalLedgerEntry[] = [];
  let rentRunning = 0;

  if (includeRent) {
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
      const graceDate = new Date(cYear, cMonth, dueDay + graceDays, 0, 0, 0, 0);
      const graceDateStr = `${graceDate.getFullYear()}-${String(graceDate.getMonth() + 1).padStart(2, '0')}-${String(graceDate.getDate()).padStart(2, '0')}`;

      if (refTime >= dueDate.getTime()) {
        // Contractual rent obligation
        rentEntries.push({
          id: `rent-obl-${cYear}-${cMonth}`,
          date: dueDateStr,
          conceptType: 'renta',
          conceptName: 'Renta Contractual',
          transactionTitle: `Obligación contractual de Renta (${periodNameCap})`,
          obligationAmount: property.rentAmount,
          contractualDueDate: dueDateStr,
          paymentAmount: null,
          paymentDate: null,
          runningBalance: 0,
          notes: `Vencimiento contractual: ${formatDate(dueDateStr)}. Período de gracia: ${graceDays} días sin recargos (hasta ${formatDate(graceDateStr)}).`,
          isPayment: false,
          isLateFee: false,
        });

        // Rent payments for this cycle
        const matchingRentPays = propPayments.filter((p) => {
          if (matchedPaymentIds.has(p.id)) return false;
          if (p.period && p.period.toLowerCase().trim() === periodNameCap.toLowerCase().trim()) return true;
          const pDate = parseLocalDate(p.date);
          return pDate.getFullYear() === cYear && pDate.getMonth() === cMonth;
        });

        let paidRentInCycle = 0;
        for (const pay of matchingRentPays) {
          const rentAmt = Number(pay.appliedToRent) || (pay.concept === 'renta' ? Number(pay.amount) : 0);
          if (rentAmt > 0) {
            paidRentInCycle += rentAmt;
            matchedPaymentIds.add(pay.id);
            rentEntries.push({
              id: `rent-pay-${pay.id}`,
              date: pay.date,
              conceptType: 'renta',
              conceptName: 'Renta Contractual',
              transactionTitle: `Pago Registrado: Renta (${periodNameCap})`,
              obligationAmount: null,
              contractualDueDate: dueDateStr,
              paymentAmount: rentAmt,
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

          const lateAmt = Number(pay.appliedToLateFees) || (pay.concept === 'mora' ? Number(pay.amount) : 0);
          if (lateAmt > 0) {
            matchedPaymentIds.add(pay.id);
            rentEntries.push({
              id: `mora-pay-${pay.id}`,
              date: pay.date,
              conceptType: 'mora',
              conceptName: 'Recargos por Demora',
              transactionTitle: `Pago Registrado: Recargos por Demora (${periodNameCap})`,
              obligationAmount: null,
              contractualDueDate: graceDateStr,
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

        // Late fee calculation if past grace period
        const unpaidRent = Math.max(0, property.rentAmount - paidRentInCycle);
        if (refTime > graceDate.getTime() && unpaidRent > 0) {
          const lateResult = computeMonthlyLateFee(
            property,
            dueDay,
            cYear,
            cMonth,
            referenceDate,
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
              notes: `Excedida ventana de gracia de ${graceDays} días (límite: ${formatDate(graceDateStr)}). Cargo base: ${formatCurrency(lateResult.lateFeeBase, companyAdmin.currencySymbol)} + Demora diaria: ${lateResult.effectiveDailyDays}d × ${formatCurrency(property.lateFeeDaily, companyAdmin.currencySymbol)}/día = ${formatCurrency(lateResult.lateFeeDaily, companyAdmin.currencySymbol)}.${lateResult.cappedNotice ? ` ${lateResult.cappedNotice}` : ''}`,
              isPayment: false,
              isLateFee: true,
            });
          }
        }
      }
    }

    // Capture any remaining unmatched rent payments
    for (const pay of propPayments) {
      if (matchedPaymentIds.has(pay.id)) continue;
      const rAmt = Number(pay.appliedToRent) || (pay.concept === 'renta' ? Number(pay.amount) : 0);
      if (rAmt > 0) {
        matchedPaymentIds.add(pay.id);
        rentEntries.push({
          id: `rent-extra-${pay.id}`,
          date: pay.date,
          conceptType: 'renta',
          conceptName: 'Renta Contractual',
          transactionTitle: `Abono de Renta Registrado (${pay.period || 'General'})`,
          obligationAmount: null,
          contractualDueDate: null,
          paymentAmount: rAmt,
          paymentDate: pay.date,
          runningBalance: 0,
          notes: `Abono recibido de ${pay.payerName || property.tenant1.name}. ${pay.applicationFootnote || 'Acreditado a cuenta de renta.'}`,
          isPayment: true,
          isLateFee: false,
        });
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

  const rentTotalObligations = rentEntries.reduce((s, e) => s + (e.obligationAmount || 0), 0);
  const rentTotalPayments = rentEntries.reduce((s, e) => s + (e.paymentAmount || 0), 0);
  const rentFinalBalance = Math.round(rentRunning * 100) / 100;

  const waterTotalObligations = waterEntries.reduce((s, e) => s + (e.obligationAmount || 0), 0);
  const waterTotalPayments = waterEntries.reduce((s, e) => s + (e.paymentAmount || 0), 0);
  const waterFinalBalance = Math.round(waterRunning * 100) / 100;

  const electricTotalObligations = electricEntries.reduce((s, e) => s + (e.obligationAmount || 0), 0);
  const electricTotalPayments = electricEntries.reduce((s, e) => s + (e.paymentAmount || 0), 0);
  const electricFinalBalance = Math.round(electricRunning * 100) / 100;

  const maintenanceTotalObligations = maintenanceEntries.reduce((s, e) => s + (e.obligationAmount || 0), 0);
  const maintenanceTotalPayments = maintenanceEntries.reduce((s, e) => s + (e.paymentAmount || 0), 0);
  const maintenanceFinalBalance = Math.round(maintRunning * 100) / 100;

  const grandTotalObligations = rentTotalObligations + waterTotalObligations + electricTotalObligations + maintenanceTotalObligations;
  const grandTotalPayments = rentTotalPayments + waterTotalPayments + electricTotalPayments + maintenanceTotalPayments;
  const grandFinalBalance = rentFinalBalance + waterFinalBalance + electricFinalBalance + maintenanceFinalBalance;

  return {
    rentEntries,
    rentTotalObligations,
    rentTotalPayments,
    rentFinalBalance,

    waterEntries,
    waterTotalObligations,
    waterTotalPayments,
    waterFinalBalance,

    electricEntries,
    electricTotalObligations,
    electricTotalPayments,
    electricFinalBalance,

    maintenanceEntries,
    maintenanceTotalObligations,
    maintenanceTotalPayments,
    maintenanceFinalBalance,

    grandTotalObligations,
    grandTotalPayments,
    grandFinalBalance,
  };
}

export const AccountingAuditView: React.FC<AccountingAuditViewProps> = ({
  properties,
  payments,
  administrators,
  profile,
  onOpenInvoice,
  onRegisterPayment,
}) => {
  // Pre-report filters & selection
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
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

  // Historial Transaccional (Estado de Cuenta con Balances Progresivos)
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Property selection (by ID)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(() =>
    properties.map((p) => p.id)
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Reference Date for calculation
  const referenceDate = useMemo(() => {
    return parseLocalDate(computationDate);
  }, [computationDate]);

  // Filter properties by company and search query
  const eligibleProperties = useMemo(() => {
    return properties.filter((p) => {
      if (selectedAdminId !== 'all' && (p.administratorId || 'admin-1') !== selectedAdminId) {
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
  }, [properties, selectedAdminId, searchQuery]);

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

        // Generate itemized historical audit data (transaction ledger with progressive balances)
        const historyData = generatePropertyHistoricalData(
          property,
          propPayments,
          referenceDate,
          includeRent,
          includeWater,
          includeElectric,
          includeMaintenance,
          admin
        );

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
          totalPropertyPending,
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
    referenceDate,
    administrators,
    onlyWithDebt,
    includeRent,
    includeWater,
    includeElectric,
    includeMaintenance,
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

    for (const item of auditedProperties) {
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
    }

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
      grandTotalPending,
    };
  }, [auditedProperties, includeRent, includeWater, includeElectric, includeMaintenance]);

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
      return administrators.find((a) => a.id === selectedAdminId) || administrators[0];
    }
    return administrators[0];
  }, [administrators, selectedAdminId]);

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
            <a
              href="/app-codigo-actualizado.zip"
              download="app-codigo-actualizado.zip"
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer no-underline"
              title="Descargar código fuente actualizado completo en formato comprimido (.ZIP)"
            >
              <FolderArchive className="w-4 h-4" />
              <span>Descargar Código (.ZIP)</span>
            </a>
            <button
              onClick={handlePrintLedger}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimir formato de libro contable idéntico a pantalla"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Libro</span>
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
                  <span>Descargar PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters and Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          {/* Filter 1: Empresa / Administrador */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-sky-500" />
              <span>Empresa Administradora:</span>
            </label>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            >
              <option value="all">Todas las Empresas ({administrators.length})</option>
              {administrators.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.companyName} ({admin.landlordName})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Fecha de Cómputo del Informe */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Fecha de Cómputo / Auditoría:</span>
            </label>
            <input
              type="date"
              value={computationDate}
              onChange={(e) => setComputationDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Filter 3: Búsqueda rápida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Buscar en Propiedades:</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Inquilino, depto, dirección..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Filter 4: Toggle Solo con Adeudo */}
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
              <span>{onlyWithDebt ? 'Mostrando Solo con Saldo Pendiente' : 'Mostrar Todas las Cuentas'}</span>
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
      </div>

      {/* 2. Resumen KPI Cards */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-md border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-sky-300 block">Gran Total Pendiente</span>
          <p className="text-base font-black text-white mt-0.5">
            {formatCurrency(summaryMetrics.grandTotalPending, primaryAdmin.currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block">Total fiscalizado</span>
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
            {primaryAdmin.logoUrl ? (
              <img
                src={primaryAdmin.logoUrl}
                alt={primaryAdmin.companyName}
                className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1 bg-white"
              />
            ) : (
              <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-sm">
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
              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded mt-1">
                HISTORIAL ACTIVO: Balances Progresivos Transacción por Transacción
              </span>
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

          return (
            <div key={adminId} className="space-y-6 pt-2">
              {administrators.length > 1 && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-300">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-700" />
                    <h3 className="font-black text-sm text-slate-900 uppercase">
                      Empresa: {companyAdmin.companyName} ({items.length} propiedades)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">RFC/ID: {companyAdmin.taxId}</span>
                </div>
              )}

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
                      </>
                    )}

                    {/* Resumen de Totales Acumulados por Concepto Separado */}
                    <div className="bg-slate-900 text-white p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Renta + Moras Acumuladas:</span>
                          <strong className="text-white font-bold">
                            {formatCurrency(item.totalAccumulatedRentAndFees, companyAdmin.currencySymbol)}
                          </strong>
                        </div>
                        <div className="h-6 w-px bg-slate-700 hidden sm:block" />
                        <div>
                          <span className="text-sky-300 block text-[10px]">Total Utilidades Acumuladas:</span>
                          <strong className="text-sky-200 font-bold">
                            {formatCurrency(item.totalAccumulatedUtilities, companyAdmin.currencySymbol)}
                          </strong>
                          <span className="text-[9px] text-slate-400 block">
                            (Agua: {formatCurrency(status.pendingWaterBalance, companyAdmin.currencySymbol)} • Luz: {formatCurrency(status.pendingElectricBalance, companyAdmin.currencySymbol)} • Cuota: {formatCurrency(status.pendingMaintenanceBalance, companyAdmin.currencySymbol)})
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 bg-slate-800 px-3.5 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Saldo Total Propiedad</span>
                        <span className="text-base font-black text-emerald-400">
                          {formatCurrency(item.totalPropertyPending, companyAdmin.currencySymbol)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Gran Total Consolidado al pie del informe */}
        <div className="pt-4 border-t-2 border-slate-800 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Gran Total Fiscalizado Consolidado
              </h4>
              <p className="text-xs text-slate-500">
                Suma consolidada de todas las propiedades y empresas incluidas en este informe.
              </p>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Renta y Moras</span>
                <span className="font-black text-sm text-slate-900">
                  {formatCurrency(summaryMetrics.totalRentPending + summaryMetrics.totalLateFees, primaryAdmin.currencySymbol)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Total Utilidades</span>
                <span className="font-black text-sm text-sky-800">
                  {formatCurrency(summaryMetrics.totalWaterPending + summaryMetrics.totalElectricPending + summaryMetrics.totalMaintenancePending, primaryAdmin.currencySymbol)}
                </span>
              </div>
              <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-md">
                <span className="block text-[10px] uppercase font-bold text-sky-300">Total a Cobrar</span>
                <span className="font-black text-lg text-emerald-400">
                  {formatCurrency(summaryMetrics.grandTotalPending, primaryAdmin.currencySymbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Sello y Firmas */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
            <div>
              <div className="w-48 border-b border-slate-400 mx-auto mb-1" />
              <p className="font-bold text-slate-800">{primaryAdmin.landlordName}</p>
              <p className="text-[10px] text-slate-500">Administrador Responsable • {primaryAdmin.companyName}</p>
            </div>
            <div>
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
