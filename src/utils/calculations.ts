import { Property, Payment, PropertyFinancialStatus, CURRENCY_OPTIONS, PaymentConcept } from '../types';
import { getSavedLanguage, SupportedLanguage } from './i18n';

/**
 * Parses a YYYY-MM-DD or ISO date string safely into local midnight Date
 * without negative timezone offset shifts (e.g. UTC shifting 1 day earlier).
 */
export function parseLocalDate(dateString?: string): Date {
  if (!dateString) return new Date();
  try {
    const clean = dateString.split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
  } catch {
    // fallback
  }
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function getPropertyRentForDate(property: Property, evaluationDate: Date | string = new Date()): number {
  const baseRent = Number(property.rentAmount) || 0;
  if (!property.rentPeriods || property.rentPeriods.length === 0) {
    return baseRent;
  }
  const evalTime = typeof evaluationDate === 'string' ? parseLocalDate(evaluationDate).getTime() : evaluationDate.getTime();
  const sorted = [...property.rentPeriods].sort((a, b) => {
    return parseLocalDate(a.effectiveDate).getTime() - parseLocalDate(b.effectiveDate).getTime();
  });

  let activeRent = baseRent;
  for (const period of sorted) {
    const periodTime = parseLocalDate(period.effectiveDate).getTime();
    if (evalTime >= periodTime) {
      activeRent = Number(period.amount) || baseRent;
    } else {
      break;
    }
  }
  return activeRent;
}

/**
 * Resolves the utility costs (water, electric LUMA/AEE, maintenance) for a specific period (YYYY-MM).
 * Looks up property.periodUtilities[periodKey] first; if not set, looks up immediate previous month as baseline/prefill;
 * otherwise falls back to the property default settings.
 */
export function getPropertyUtilitiesForPeriod(
  property: Property,
  periodKeyOrDate?: string | Date | null
): {
  waterAmount: number;
  electricAmount: number;
  maintenanceAmount: number;
  isCustomPeriod: boolean;
  periodKey: string;
} {
  let periodKey: string;
  let targetYear: number;
  let targetMonth: number;

  const now = new Date();

  if (!periodKeyOrDate) {
    targetYear = now.getFullYear();
    targetMonth = now.getMonth();
    periodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  } else if (typeof periodKeyOrDate === 'string') {
    const trimmed = periodKeyOrDate.trim();
    if (trimmed.match(/^\d{4}-\d{2}$/)) {
      periodKey = trimmed;
      const [y, m] = periodKey.split('-').map(Number);
      targetYear = y;
      targetMonth = m - 1;
    } else {
      const parsed = parseLocalDate(trimmed);
      if (isNaN(parsed.getTime())) {
        targetYear = now.getFullYear();
        targetMonth = now.getMonth();
      } else {
        targetYear = parsed.getFullYear();
        targetMonth = parsed.getMonth();
      }
      periodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    }
  } else if (periodKeyOrDate instanceof Date && !isNaN(periodKeyOrDate.getTime())) {
    targetYear = periodKeyOrDate.getFullYear();
    targetMonth = periodKeyOrDate.getMonth();
    periodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  } else {
    targetYear = now.getFullYear();
    targetMonth = now.getMonth();
    periodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  }

  const defaultWater = property.utilitiesWaterActive ? Math.max(0, Number(property.utilitiesWaterAmount) || 0) : 0;
  const defaultElectric = property.utilitiesElectricActive ? Math.max(0, Number(property.utilitiesElectricAmount) || 0) : 0;
  const defaultMaint = property.utilitiesMaintenanceActive ? Math.max(0, Number(property.utilitiesMaintenanceAmount) || 0) : 0;

  if (property.periodUtilities && property.periodUtilities[periodKey]) {
    const rec = property.periodUtilities[periodKey];
    return {
      waterAmount: property.utilitiesWaterActive ? (rec.waterAmount !== undefined ? Math.max(0, Number(rec.waterAmount)) : defaultWater) : 0,
      electricAmount: property.utilitiesElectricActive ? (rec.electricAmount !== undefined ? Math.max(0, Number(rec.electricAmount)) : defaultElectric) : 0,
      maintenanceAmount: property.utilitiesMaintenanceActive ? (rec.maintenanceAmount !== undefined ? Math.max(0, Number(rec.maintenanceAmount)) : defaultMaint) : 0,
      isCustomPeriod: true,
      periodKey,
    };
  }

  // Check historical months in descending order to resolve the most recent utility amounts
  if (property.periodUtilities) {
    const historicalKeys = Object.keys(property.periodUtilities)
      .filter((k) => k <= periodKey)
      .sort((a, b) => b.localeCompare(a));

    let latestWater: number | null = null;
    let latestElectric: number | null = null;
    let latestMaint: number | null = null;

    for (const k of historicalKeys) {
      const rec = property.periodUtilities[k];
      if (property.utilitiesWaterActive && latestWater === null && rec.waterAmount !== undefined && Number(rec.waterAmount) > 0) {
        latestWater = Math.max(0, Number(rec.waterAmount));
      }
      if (property.utilitiesElectricActive && latestElectric === null && rec.electricAmount !== undefined && Number(rec.electricAmount) > 0) {
        latestElectric = Math.max(0, Number(rec.electricAmount));
      }
      if (property.utilitiesMaintenanceActive && latestMaint === null && rec.maintenanceAmount !== undefined && Number(rec.maintenanceAmount) > 0) {
        latestMaint = Math.max(0, Number(rec.maintenanceAmount));
      }
    }

    if (latestWater !== null || latestElectric !== null || latestMaint !== null) {
      return {
        waterAmount: latestWater !== null ? latestWater : defaultWater,
        electricAmount: latestElectric !== null ? latestElectric : defaultElectric,
        maintenanceAmount: latestMaint !== null ? latestMaint : defaultMaint,
        isCustomPeriod: false,
        periodKey,
      };
    }
  }

  return {
    waterAmount: defaultWater,
    electricAmount: defaultElectric,
    maintenanceAmount: defaultMaint,
    isCustomPeriod: false,
    periodKey,
  };
}

export function getCurrencySymbol(codeOrSymbol?: string): string {
  if (!codeOrSymbol) return '$'; // US Dollar default
  const found = CURRENCY_OPTIONS.find(
    (c) => c.code.toLowerCase() === codeOrSymbol.toLowerCase() || c.symbol === codeOrSymbol
  );
  if (found) return found.symbol;
  return codeOrSymbol;
}

export function formatCurrency(
  amount: number,
  currencySymbolOrCode?: string,
  lang?: SupportedLanguage
): string {
  const symbol = getCurrencySymbol(currencySymbolOrCode);
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount || 0);

  const formattedNumber = absAmount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}${symbol} ${formattedNumber}`;
}

export function formatDate(dateString?: string, lang?: SupportedLanguage): string {
  if (!dateString) return '-';
  const currentLang = lang || getSavedLanguage();
  try {
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return new Intl.DateTimeFormat(currentLang === 'en' ? 'en-US' : 'es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    }
    return dateString;
  } catch {
    return dateString;
  }
}

export function getCurrentPeriodName(date: Date = new Date(), lang?: SupportedLanguage): string {
  const currentLang = lang || getSavedLanguage();
  if (currentLang === 'en') {
    const monthsEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthsEn[date.getMonth()]} ${date.getFullYear()}`;
  }
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Matches a payment to a target evaluation cycle (targetYear, targetMonth 0-indexed)
 * Checks both explicit period string (e.g. "Octubre 2026", "2026-10") and payment date.
 */
export function matchPaymentToPeriod(
  payment: Payment,
  targetYear: number,
  targetMonth: number
): boolean {
  const monthsEs = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthsEn = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  if (payment.period) {
    const pTrim = payment.period.toLowerCase().trim();
    const yyyyMm = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    if (pTrim.includes(yyyyMm)) return true;

    const targetMonthEs = monthsEs[targetMonth];
    const targetMonthEn = monthsEn[targetMonth];
    const targetYearStr = String(targetYear);

    const hasTargetMonth = pTrim.includes(targetMonthEs) || pTrim.includes(targetMonthEn);
    const hasTargetYear = pTrim.includes(targetYearStr);

    if (hasTargetMonth && hasTargetYear) return true;
    if (hasTargetMonth && !pTrim.match(/\d{4}/)) return true;

    // If period explicitly refers to another known month, do not match this target month
    for (let m = 0; m < 12; m++) {
      if (m !== targetMonth && (pTrim.includes(monthsEs[m]) || pTrim.includes(monthsEn[m]))) {
        return false;
      }
    }
  }

  // Fallback to payment date:
  const pDate = parseLocalDate(payment.date);
  if (pDate.getFullYear() === targetYear && pDate.getMonth() === targetMonth) {
    return true;
  }

  // Early payment support: payment made up to 15 days before the start of the target month
  // (e.g. paying on Oct 25-31 for November's cycle)
  const cycleStart = new Date(targetYear, targetMonth, 1);
  const earlyWindow = new Date(targetYear, targetMonth, 1);
  earlyWindow.setDate(earlyWindow.getDate() - 15);
  if (pDate.getTime() >= earlyWindow.getTime() && pDate.getTime() < cycleStart.getTime()) {
    // If period doesn't explicitly name another month:
    const prevMonth = (targetMonth + 11) % 12;
    const pTrim = (payment.period || '').toLowerCase();
    const explicitlyPrev = pTrim.includes(monthsEs[prevMonth]) || pTrim.includes(monthsEn[prevMonth]);
    if (!explicitlyPrev) {
      return true;
    }
  }

  return false;
}

export function getDaysDifference(dateFuture: Date, datePast: Date): number {
  const diffTime = dateFuture.getTime() - datePast.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export interface LateFeeCalculationResult {
  isOverdue: boolean;
  daysOverdue: number; // Días de retraso transcurridos tras período de gracia
  effectiveDailyDays: number; // Días computados tras aplicar tope de días (si aplica)
  lateFeeBase: number;
  lateFeeDaily: number;
  totalLateFee: number;
  cappedNotice?: string;
}

/**
 * Computes monthly late fee according to lease contract terms:
 * - Payment day: rentDueDay of month (e.g. Day 15).
 * - Grace period: graceDays without penalty (e.g. 5 days: days 15..20 are penalty-free).
 * - Delinquency only starts AFTER grace period ends (e.g. Day 21 is Day 1 of delay).
 * - Optional cap (tope) per month:
 *   a) By maximum monetary amount (e.g. up to $75/month)
 *   b) By maximum computable delay days (e.g. up to 10 days beyond grace)
 * - Monthly cap resets to zero for each billing cycle.
 */
export function computeMonthlyLateFee(
  property: Property,
  dueDay: number,
  year: number,
  month: number, // 0-11
  evaluationDate: Date,
  unpaidRent: number
): LateFeeCalculationResult {
  const baseFee = Number(property.lateFeeBase) || 0;
  const dailyFee = Number(property.lateFeeDaily) || 0;

  if (unpaidRent <= 0 || (baseFee === 0 && dailyFee === 0)) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      effectiveDailyDays: 0,
      lateFeeBase: 0,
      lateFeeDaily: 0,
      totalLateFee: 0,
    };
  }

  // Check if evaluationDate or cycle is before contractStartDate
  if (property.contractStartDate) {
    const contractStart = parseLocalDate(property.contractStartDate);
    if (!isNaN(contractStart.getTime())) {
      const contractStartMidnight = new Date(contractStart.getFullYear(), contractStart.getMonth(), contractStart.getDate(), 0, 0, 0, 0);
      const evalMidnight = new Date(evaluationDate.getFullYear(), evaluationDate.getMonth(), evaluationDate.getDate(), 0, 0, 0, 0);
      if (evalMidnight.getTime() < contractStartMidnight.getTime()) {
        return {
          isOverdue: false,
          daysOverdue: 0,
          effectiveDailyDays: 0,
          lateFeeBase: 0,
          lateFeeDaily: 0,
          totalLateFee: 0,
        };
      }
    }
  }

  // Due date for the specific cycle
  const lastDayOfCycleMonth = new Date(year, month + 1, 0).getDate();
  const clampedDueDay = Math.min(dueDay, lastDayOfCycleMonth);

  // Grace date: Due day counts as Day 1 of grace.
  // E.g. Due day 5 + 3 grace days -> Days 5, 6, 7 are penalty-free. Penalty starts on Day 8 (5 + 3 = 8th 00:00:00).
  const graceDays = Math.max(0, Number(property.graceDays) ?? 3);
  const graceEndMidnightMs = new Date(year, month, clampedDueDay + Math.max(1, graceDays), 0, 0, 0, 0).getTime();
  const evalMidnight = new Date(evaluationDate.getFullYear(), evaluationDate.getMonth(), evaluationDate.getDate(), 0, 0, 0, 0).getTime();

  // If on or before grace date, NOT overdue
  if (evalMidnight < graceEndMidnightMs) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      effectiveDailyDays: 0,
      lateFeeBase: 0,
      lateFeeDaily: 0,
      totalLateFee: 0,
    };
  }

  // Days overdue strictly beyond the grace period
  const diffDays = Math.max(1, Math.round((evalMidnight - graceEndMidnightMs) / (1000 * 60 * 60 * 24)) + 1);
  const daysOverdue = diffDays;

  let effectiveDailyDays = daysOverdue;
  let calculatedBase = baseFee;
  let calculatedDaily = 0;
  let totalLateFee = 0;
  let cappedNotice: string | undefined = undefined;

  const capEnabled = Boolean(property.lateFeeCapEnabled);
  const capType = property.lateFeeCapType || 'amount';

  if (capEnabled && capType === 'days') {
    const maxDays = Math.max(0, Number(property.lateFeeMaxDays) || 0);
    if (maxDays > 0) {
      effectiveDailyDays = Math.min(daysOverdue, maxDays);
      if (daysOverdue > maxDays) {
        cappedNotice = `Tope de ${maxDays} días de recargo alcanzado (${daysOverdue} días transcurridos tras gracia)`;
      }
    }
    calculatedDaily = effectiveDailyDays * dailyFee;
    totalLateFee = calculatedBase + calculatedDaily;
  } else if (capEnabled && capType === 'amount') {
    const maxAmount = Math.max(0, Number(property.lateFeeMaxAmount) || 0);
    const rawDaily = daysOverdue * dailyFee;
    const rawTotal = calculatedBase + rawDaily;
    if (maxAmount > 0 && rawTotal > maxAmount) {
      totalLateFee = maxAmount;
      calculatedBase = Math.min(baseFee, maxAmount);
      calculatedDaily = Math.max(0, maxAmount - calculatedBase);
      cappedNotice = `Tope mensual de penalidad alcanzado ($${maxAmount.toFixed(2)})`;
    } else {
      calculatedDaily = rawDaily;
      totalLateFee = rawTotal;
    }
  } else {
    // Sin topes
    calculatedDaily = daysOverdue * dailyFee;
    totalLateFee = calculatedBase + calculatedDaily;
  }

  return {
    isOverdue: true,
    daysOverdue,
    effectiveDailyDays,
    lateFeeBase: calculatedBase,
    lateFeeDaily: calculatedDaily,
    totalLateFee,
    cappedNotice,
  };
}

/**
 * Calculates complete financial and contract status for a property,
 * segregating rent, late fees, water, electricity, and maintenance charges and payments.
 */
export function calculatePropertyStatus(
  property: Property,
  payments: Payment[],
  referenceDate: Date = new Date()
): PropertyFinancialStatus {
  const refDateLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0, 0, 0, 0
  );
  const currentYear = refDateLocal.getFullYear();
  const currentMonth = refDateLocal.getMonth(); // 0-11
  
  // Parse contract start date as tenant baseline
  const contractStart = parseLocalDate(property.contractStartDate);
  const hasContractStart = Boolean(property.contractStartDate && !isNaN(contractStart.getTime()));
  const contractStartMidnight = hasContractStart
    ? new Date(contractStart.getFullYear(), contractStart.getMonth(), contractStart.getDate(), 0, 0, 0, 0)
    : null;

  // All payments belonging to this property (including early/advance payments)
  const propPayments = payments.filter((p) => p.propertyId === property.id);
  const tenantPayments = propPayments;

  // Check if reference date is BEFORE contract start date
  const isBeforeContractStart = contractStartMidnight ? refDateLocal.getTime() < contractStartMidnight.getTime() : false;

  // Due date for current month
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const rawDueDay = Math.min(property.rentDueDay || 1, lastDayOfMonth);

  // If current month is contract start month, due day cannot be before contract start day
  let dueDay = rawDueDay;
  if (hasContractStart && contractStartMidnight && contractStartMidnight.getFullYear() === currentYear && contractStartMidnight.getMonth() === currentMonth) {
    dueDay = Math.max(contractStartMidnight.getDate(), rawDueDay);
  }

  const currentDueDate = new Date(currentYear, currentMonth, dueDay, 0, 0, 0, 0);
  const dueDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

  // Grace date (inclusive): Due day counts as Day 1 of grace.
  const graceDays = Math.max(0, property.graceDays ?? 3);
  const graceEndMidnightMs = new Date(currentYear, currentMonth, dueDay + Math.max(1, graceDays), 0, 0, 0, 0).getTime();

  // Contract days left calculation
  const contractEnd = parseLocalDate(property.contractEndDate);
  const contractDaysLeft = getDaysDifference(contractEnd, refDateLocal);
  
  let contractStatus: 'vigente' | 'por_renovar' | 'vencido' = 'vigente';
  if (contractDaysLeft < 0) {
    contractStatus = 'vencido';
  } else if (contractDaysLeft <= 45) {
    contractStatus = 'por_renovar';
  }

  const totalAllPayments = tenantPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  // Sort payments by date descending
  const sortedPayments = [...tenantPayments].sort(
    (a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
  );
  const lastPayment = sortedPayments[0];

  // Current period payments (strictly matching target period name or cycle date)
  const currentPeriod = getCurrentPeriodName(refDateLocal);
  const paymentsThisMonth = tenantPayments.filter((p) => matchPaymentToPeriod(p, currentYear, currentMonth));
  const totalPaidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Check if reference date has reached or passed the agreed monthly rent due day and contract start:
  const evalMidnight = refDateLocal.getTime();
  const dueMidnight = currentDueDate.getTime();
  const isRentDueReached = !isBeforeContractStart && evalMidnight >= dueMidnight;

  // Is within contractual grace period (penalty-free)?
  const isWithinGrace = isRentDueReached && evalMidnight < graceEndMidnightMs;

  const propStatus = property.status || 'rentado';
  const periodKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const periodStatus = property.periodStatuses?.[periodKey] || propStatus;
  const isAccruingRentAndLateFees = !isBeforeContractStart && (periodStatus === 'rentado');
  const currentActiveRent = isAccruingRentAndLateFees ? getPropertyRentForDate(property, refDateLocal) : 0;
  const currentMonthRentCharge = isRentDueReached ? currentActiveRent : 0;

  // Utility charges for this property (resolves variable history per period YYYY-MM)
  const currentPeriodKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const periodUtils = getPropertyUtilitiesForPeriod(property, currentPeriodKey);
  const waterAmount = periodUtils.waterAmount;
  const electricAmount = periodUtils.electricAmount;
  const maintenanceAmount = periodUtils.maintenanceAmount;
  const totalUtilitiesAmount = waterAmount + electricAmount + maintenanceAmount;
  const totalBilledThisMonth = currentMonthRentCharge + totalUtilitiesAmount;

  // Segregated breakdown of all-time payments for deposit and rent tracking for current tenant:
  let totalDepositPaid = 0;
  let totalRentPaidAllTime = 0;
  for (const pay of tenantPayments) {
    const amt = Number(pay.amount) || 0;
    const isDeposit = pay.concept === 'deposito' ||
      (pay.period && (pay.period.toLowerCase().includes('deposito') || pay.period.toLowerCase().includes('depósito') || pay.period.toLowerCase().includes('fianza') || pay.period.toLowerCase().includes('garant'))) ||
      (pay.notes && (pay.notes.toLowerCase().includes('deposito') || pay.notes.toLowerCase().includes('depósito') || pay.notes.toLowerCase().includes('fianza') || pay.notes.toLowerCase().includes('garant')));

    if (pay.appliedToRent !== undefined || pay.appliedToLateFees !== undefined ||
        pay.appliedToWater !== undefined || pay.appliedToElectric !== undefined ||
        pay.appliedToMaintenance !== undefined || pay.appliedToDeposit !== undefined) {
      totalRentPaidAllTime += Number(pay.appliedToRent) || 0;
      totalDepositPaid += Number(pay.appliedToDeposit) || (isDeposit && !pay.appliedToRent ? amt : 0);
    } else {
      if (isDeposit) {
        totalDepositPaid += amt;
      } else if (pay.concept !== 'agua' && pay.concept !== 'electricidad' && pay.concept !== 'mantenimiento') {
        totalRentPaidAllTime += amt;
      }
    }
  }

  const depositRequired = Math.max(0, Number(property.depositAmount) || 0);
  const pendingDepositBalance = Math.max(0, depositRequired - totalDepositPaid);

  // Segregated breakdown of current month payments:
  let paidRentThisMonth = 0;
  let paidLateFeesThisMonth = 0;
  let paidWaterThisMonth = 0;
  let paidElectricThisMonth = 0;
  let paidMaintenanceThisMonth = 0;
  let paidDepositThisMonth = 0;

  for (const pay of paymentsThisMonth) {
    const amt = Number(pay.amount) || 0;
    if (pay.appliedToRent !== undefined || pay.appliedToLateFees !== undefined ||
        pay.appliedToWater !== undefined || pay.appliedToElectric !== undefined ||
        pay.appliedToMaintenance !== undefined || pay.appliedToDeposit !== undefined) {
      paidRentThisMonth += Number(pay.appliedToRent) || 0;
      paidLateFeesThisMonth += Number(pay.appliedToLateFees) || 0;
      paidWaterThisMonth += Number(pay.appliedToWater) || 0;
      paidElectricThisMonth += Number(pay.appliedToElectric) || 0;
      paidMaintenanceThisMonth += Number(pay.appliedToMaintenance) || 0;
      paidDepositThisMonth += Number(pay.appliedToDeposit) || 0;
    } else {
      if (pay.concept === 'agua') {
        paidWaterThisMonth += amt;
      } else if (pay.concept === 'electricidad') {
        paidElectricThisMonth += amt;
      } else if (pay.concept === 'mantenimiento') {
        paidMaintenanceThisMonth += amt;
      } else if (pay.concept === 'deposito') {
        paidDepositThisMonth += amt;
      } else if (pay.concept === 'mora') {
        paidLateFeesThisMonth += amt;
      } else {
        paidRentThisMonth += amt;
      }
    }
  }

  // Calculate contractual rent obligations up to the current evaluation point:
  // Strictly only accrue rent for periods where the property status was 'rentado'
  let accumulatedPriorObligations = 0;

  if (hasContractStart && contractStartMidnight && !isBeforeContractStart) {
    const startYear = contractStartMidnight.getFullYear();
    const startMonth = contractStartMidnight.getMonth();

    const diffMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth);
    if (diffMonths > 0) {
      for (let m = 0; m < diffMonths; m++) {
        const totalMonthIndex = startMonth + m;
        const pastYear = startYear + Math.floor(totalMonthIndex / 12);
        const pastMonth = totalMonthIndex % 12;

        const pastLastDay = new Date(pastYear, pastMonth + 1, 0).getDate();
        const pastDueDay = (m === 0 && contractStartMidnight.getDate() > property.rentDueDay)
          ? Math.min(contractStartMidnight.getDate(), pastLastDay)
          : Math.min(property.rentDueDay || 1, pastLastDay);

        const cycleDateForPast = new Date(pastYear, pastMonth, pastDueDay);
        const pastPeriodKey = `${pastYear}-${String(pastMonth + 1).padStart(2, '0')}`;
        const pastPeriodStatus = property.periodStatuses?.[pastPeriodKey] || propStatus;
        const pastIsAccruing = pastPeriodStatus === 'rentado';
        const monthlyRent = pastIsAccruing ? getPropertyRentForDate(property, cycleDateForPast) : 0;

        if (pastIsAccruing && monthlyRent > 0) {
          accumulatedPriorObligations += monthlyRent;
        }
      }
    }
  }

  // Total contractual rent accrued to date:
  const currentAccruedRent = isRentDueReached && isAccruingRentAndLateFees ? currentActiveRent : 0;
  const totalRentObligationsAccrued = accumulatedPriorObligations + currentAccruedRent;

  let previousBalance = 0;
  let priorRentCredit = 0;
  let currentMonthRentUnpaid = 0;
  let isPaidOnTime = false;

  if (totalRentPaidAllTime >= totalRentObligationsAccrued) {
    // Tenant has paid all rent due to date in full (or has surplus credit in advance):
    previousBalance = 0;
    currentMonthRentUnpaid = 0;
    priorRentCredit = totalRentPaidAllTime - accumulatedPriorObligations;
    paidRentThisMonth = Math.min(currentActiveRent, Math.max(paidRentThisMonth, priorRentCredit));
    isPaidOnTime = true;
  } else if (totalRentPaidAllTime >= accumulatedPriorObligations) {
    // Prior months are 100% paid, partial or zero payment made on current month:
    previousBalance = 0;
    const creditForCurrent = totalRentPaidAllTime - accumulatedPriorObligations;
    priorRentCredit = creditForCurrent;
    paidRentThisMonth = Math.max(paidRentThisMonth, creditForCurrent);
    currentMonthRentUnpaid = Math.max(0, currentActiveRent - paidRentThisMonth);

    // Paid on or before grace deadline check:
    const paidBeforeOrDuringGrace = paymentsThisMonth
      .filter((p) => parseLocalDate(p.date).getTime() <= graceEndMidnightMs)
      .reduce((sum, p) => sum + (Number(p.appliedToRent) || (p.concept === 'renta' ? Number(p.amount) : 0)), 0);
    isPaidOnTime = (creditForCurrent + paidBeforeOrDuringGrace) >= currentActiveRent;
  } else {
    // Prior months have an outstanding balance:
    previousBalance = accumulatedPriorObligations - totalRentPaidAllTime;
    priorRentCredit = 0;
    currentMonthRentUnpaid = currentAccruedRent;
    isPaidOnTime = false;
  }

  const pendingRentUnadjusted = isRentDueReached
    ? (currentMonthRentUnpaid + previousBalance)
    : previousBalance;

  const hasZeroOrCreditBalance = isRentDueReached
    ? currentMonthRentUnpaid === 0 && previousBalance === 0
    : previousBalance === 0;

  // CRITICAL RULE:
  // If payment was made on time or in advance, or if rent is fully covered,
  // NO LATE FEES CAN BE COMPUTED OR CHARGED!
  const shouldComputeLateFees =
    isAccruingRentAndLateFees &&
    isRentDueReached &&
    !isWithinGrace &&
    !isPaidOnTime &&
    !hasZeroOrCreditBalance &&
    currentMonthRentUnpaid > 0;

  const currentLateFeeResult = shouldComputeLateFees
    ? computeMonthlyLateFee(
        property,
        dueDay,
        currentYear,
        currentMonth,
        refDateLocal,
        Math.min(currentActiveRent, currentMonthRentUnpaid)
      )
    : {
        isOverdue: false,
        daysOverdue: 0,
        effectiveDailyDays: 0,
        lateFeeBase: 0,
        lateFeeDaily: 0,
        totalLateFee: 0,
      };

  const isOverdue = currentLateFeeResult.isOverdue;
  const daysOverdue = currentLateFeeResult.daysOverdue;
  const effectiveDailyDays = currentLateFeeResult.effectiveDailyDays;
  const calculatedLateFeeBase = currentLateFeeResult.lateFeeBase;
  const calculatedLateFeeDaily = currentLateFeeResult.lateFeeDaily;
  const totalLateFees = currentLateFeeResult.totalLateFee;
  const lateFeeCapNotice = currentLateFeeResult.cappedNotice;

  // Segregated pending balances (Separate accounts - Renta, Agua, Electricidad, Mantenimiento, Mora):
  const pendingLateFeesBalance = Math.max(0, totalLateFees - paidLateFeesThisMonth);
  const pendingRentBalance = hasZeroOrCreditBalance ? 0 : pendingRentUnadjusted;
  const waterHist = calculateHistoricalUtilityBalance(property, tenantPayments, 'water', refDateLocal);
  const electricHist = calculateHistoricalUtilityBalance(property, tenantPayments, 'electric', refDateLocal);
  const maintenanceHist = calculateHistoricalUtilityBalance(property, tenantPayments, 'maintenance', refDateLocal);

  const pendingWaterBalance = waterHist.pendingBalance;
  const pendingElectricBalance = electricHist.pendingBalance;
  const pendingMaintenanceBalance = maintenanceHist.pendingBalance;
  const pendingUtilitiesBalance = pendingWaterBalance + pendingElectricBalance + pendingMaintenanceBalance;

  // Total pending balance = late fees + rent + utilities
  const totalPendingBalance = pendingLateFeesBalance + pendingRentBalance + pendingUtilitiesBalance;

  let accountStatus: 'al_dia' | 'proximo_vencer' | 'atrasado' | 'con_saldo_favor' = 'al_dia';
  if (totalPendingBalance <= 0) {
    if (totalAllPayments > previousBalance + currentMonthRentCharge + totalLateFees + totalUtilitiesAmount || priorRentCredit > currentMonthRentCharge) {
      accountStatus = 'con_saldo_favor';
    } else {
      accountStatus = 'al_dia';
    }
  } else if (isOverdue || previousBalance > 0) {
    accountStatus = 'atrasado';
  } else {
    accountStatus = 'proximo_vencer';
  }

  return {
    property,
    currentPeriod,
    rentAmount: property.rentAmount,
    dueDate: dueDateStr,
    isOverdue,
    daysOverdue,
    calculatedLateFeeBase,
    calculatedLateFeeDaily,
    totalLateFees,
    effectiveDailyDays,
    lateFeeCapNotice,
    previousBalance,
    currentMonthCharge: totalBilledThisMonth,
    currentMonthRentCharge,
    isRentDueReached,
    totalPaidThisMonth,
    totalPendingBalance,
    accountStatus,
    contractDaysLeft,
    contractStatus,
    lastPayment,

    // Segregated utilities
    waterAmount,
    electricAmount,
    maintenanceAmount,
    totalUtilitiesAmount,
    totalBilledThisMonth,

    // Segregated payments
    paidRentThisMonth,
    paidLateFeesThisMonth,
    paidWaterThisMonth,
    paidElectricThisMonth,
    paidMaintenanceThisMonth,
    paidDepositThisMonth,

    // Depósito de garantía en contrato
    depositRequired,
    totalDepositPaid,
    pendingDepositBalance,

    // Segregated pending balances
    pendingRentBalance,
    pendingLateFeesBalance,
    pendingWaterBalance,
    pendingElectricBalance,
    pendingMaintenanceBalance,
    pendingUtilitiesBalance,
    priorRentCredit,
  };
}

export interface PaymentAllocationResult {
  appliedToLateFees: number;
  appliedToRent: number;
  appliedToDeposit: number;
  appliedToWater: number;
  appliedToElectric: number;
  appliedToMaintenance: number;
  applicationFootnote: string;
}

/**
 * Evaluates payment allocation according to separate account rules:
 * - Specific utility payments (Agua, Electricidad, Mantenimiento) are credited directly
 *   to their own account and NEVER diverted to rent or rent late fees.
 * - Renta payments are credited to rent late fees (if any) and rent principal.
 * - Depósito payments are credited to Security Deposit.
 * Generates official footnote (nota al calce) detailing fund application.
 */
export function evaluatePaymentAllocation(
  property: Property,
  existingPayments: Payment[],
  amountToPay: number,
  chosenConcept: PaymentConcept = 'renta',
  currencySymbol: string = '$',
  referenceDate: Date = new Date(),
  editingPaymentId?: string
): PaymentAllocationResult {
  const numericAmount = Math.max(0, Number(amountToPay) || 0);

  // Filter out the payment being edited so we check debt prior to this payment
  const filteredPayments = editingPaymentId
    ? existingPayments.filter((p) => p.id !== editingPaymentId)
    : existingPayments;

  const currentStatus = calculatePropertyStatus(property, filteredPayments, referenceDate);

  const pendingLateFees = currentStatus.pendingLateFeesBalance;
  const pendingRent = currentStatus.pendingRentBalance;
  const pendingWater = currentStatus.pendingWaterBalance;
  const pendingElectric = currentStatus.pendingElectricBalance;
  const pendingMaintenance = currentStatus.pendingMaintenanceBalance;

  let remaining = numericAmount;
  let appliedToLateFees = 0;
  let appliedToRent = 0;
  let appliedToDeposit = 0;
  let appliedToWater = 0;
  let appliedToElectric = 0;
  let appliedToMaintenance = 0;

  if (chosenConcept === 'deposito') {
    appliedToDeposit = numericAmount;
    remaining = 0;
  } else if (chosenConcept === 'agua') {
    // Strict separate account: credited directly to water utility
    appliedToWater = numericAmount;
    remaining = 0;
  } else if (chosenConcept === 'electricidad') {
    // Strict separate account: credited directly to electricity utility
    appliedToElectric = numericAmount;
    remaining = 0;
  } else if (chosenConcept === 'mantenimiento') {
    // Strict separate account: credited directly to maintenance/resident fee
    appliedToMaintenance = numericAmount;
    remaining = 0;
  } else if (chosenConcept === 'mora') {
    // Dedicated late fee payment
    appliedToLateFees = Math.min(numericAmount, pendingLateFees > 0 ? pendingLateFees : numericAmount);
    remaining = Math.max(0, numericAmount - appliedToLateFees);
    if (remaining > 0) {
      appliedToRent = remaining;
    }
  } else if (chosenConcept === 'renta') {
    // Rent priority: cover late fees on rent first if overdue, then rent
    if (pendingLateFees > 0) {
      appliedToLateFees = Math.min(remaining, pendingLateFees);
      remaining = Math.round((remaining - appliedToLateFees) * 100) / 100;
    }
    appliedToRent = remaining;
  } else {
    // General payment: distribute in legal order
    if (pendingLateFees > 0) {
      appliedToLateFees = Math.min(remaining, pendingLateFees);
      remaining = Math.round((remaining - appliedToLateFees) * 100) / 100;
    }
    if (pendingRent > 0 && remaining > 0) {
      appliedToRent = Math.min(remaining, pendingRent);
      remaining = Math.round((remaining - appliedToRent) * 100) / 100;
    }
    if (pendingWater > 0 && remaining > 0) {
      appliedToWater = Math.min(remaining, pendingWater);
      remaining = Math.round((remaining - appliedToWater) * 100) / 100;
    }
    if (pendingElectric > 0 && remaining > 0) {
      appliedToElectric = Math.min(remaining, pendingElectric);
      remaining = Math.round((remaining - appliedToElectric) * 100) / 100;
    }
    if (pendingMaintenance > 0 && remaining > 0) {
      appliedToMaintenance = Math.min(remaining, pendingMaintenance);
      remaining = Math.round((remaining - appliedToMaintenance) * 100) / 100;
    }
    if (remaining > 0) {
      appliedToRent += remaining;
    }
  }

  // Generate official footnote (Nota al calce)
  let applicationFootnote = '';
  const totalFormatted = formatCurrency(numericAmount, currencySymbol);

  if (chosenConcept === 'deposito') {
    applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Depósito de Garantía estipulado en contrato.`;
  } else if (chosenConcept === 'agua') {
    applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Utilidad de Agua (cuenta separada de renta).`;
  } else if (chosenConcept === 'electricidad') {
    applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Utilidad de Electricidad (LUMA / AEE) (cuenta separada de renta).`;
  } else if (chosenConcept === 'mantenimiento') {
    applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Cuota de Mantenimiento / Residentes (cuenta separada).`;
  } else if (chosenConcept === 'renta') {
    if (appliedToLateFees > 0) {
      applicationFootnote = `⚠️ NOTA AL CALCE (Prelación de Fondos): De los ${totalFormatted} recibidos, se aplicaron primero ${formatCurrency(appliedToLateFees, currencySymbol)} a cubrir cargos por demora pendientes, y el restante de ${formatCurrency(appliedToRent, currencySymbol)} se acreditó a la renta convenida.`;
    } else {
      applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Renta convenida en contrato.`;
    }
  } else {
    applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} aplicado según conceptos detallados.`;
  }

  return {
    appliedToLateFees,
    appliedToRent,
    appliedToDeposit,
    appliedToWater,
    appliedToElectric,
    appliedToMaintenance,
    applicationFootnote,
  };
}

export interface NextPeriodInvoiceInfo {
  nextPeriodName: string;
  nextPeriodKey: string;
  nextDueDate: string;
  nextDueDay: number;
  rentAmount: number;
  waterAmount: number;
  electricAmount: number;
  maintenanceAmount: number;
  totalUtilitiesAmount: number;
  lastMonthWaterAmount: number;
  lastMonthElectricAmount: number;
  lastMonthMaintenanceAmount: number;
  lastMonthTotalUtilitiesAmount: number;
  utilitiesNote: string;
  accumulatedPreviousBalance: number;
  advancePayments: number;
  totalDueNextMonth: number;
  daysUntilDue: number;
  graceDateStr: string;
  unpaidWaterCurrent: number;
  unpaidElectricCurrent: number;
  unpaidMaintenanceCurrent: number;
  hasUnpaidUtilities: boolean;
}

/**
 * Calculates financial amounts and due dates for upcoming advance invoice / next billing cycle.
 * NOTE: As utility charges vary each month according to real consumption, the previous month's
 * utilities cost is NOT added to the upcoming period's total. An informative note is provided instead.
 * Advance payments for rent ONLY include payments with concept 'renta' or appliedToRent > 0;
 * utility payments (Water, Electricity, Maintenance) are NEVER credited as advance rent!
 */
export function calculateNextPeriodInvoiceInfo(
  property: Property,
  payments: Payment[],
  referenceDate: Date = new Date(),
  currencySymbol: string = '$'
): NextPeriodInvoiceInfo {
  const currentStatus = calculatePropertyStatus(property, payments, referenceDate);
  const refDateLocal = parseLocalDate(referenceDate.toISOString());
  const currentYear = refDateLocal.getFullYear();
  const currentMonth = refDateLocal.getMonth(); // 0-11
  const todayDay = refDateLocal.getDate();

  // If today is BEFORE the agreed rent due day of the current month (e.g. today is Oct 14, due day is Oct 15):
  // The upcoming rent cycle to be notified in advance is the rent due on Oct 15!
  // If today is ON OR AFTER the due day (e.g. Oct 15+):
  // The current month is already active/current, so the upcoming advance notice is for NEXT month (Nov 15).
  const isUpcomingCurrentMonth = !currentStatus.isRentDueReached;

  let targetYear: number;
  let targetMonth: number;

  if (isUpcomingCurrentMonth) {
    targetYear = currentYear;
    targetMonth = currentMonth;
  } else {
    const nextDate = new Date(currentYear, currentMonth + 1, 1, 0, 0, 0, 0);
    targetYear = nextDate.getFullYear();
    targetMonth = nextDate.getMonth();
  }

  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDueDay = Math.min(property.rentDueDay || 1, lastDayOfTargetMonth);
  const nextDueDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDueDay).padStart(2, '0')}`;
  const targetDateObj = new Date(targetYear, targetMonth, targetDueDay, 0, 0, 0, 0);
  const nextPeriodName = getCurrentPeriodName(targetDateObj);
  const targetPeriodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  const graceDays = property.graceDays ?? 3;
  const graceDate = new Date(targetYear, targetMonth, targetDueDay + graceDays, 0, 0, 0, 0);
  const graceDateStr = `${graceDate.getFullYear()}-${String(graceDate.getMonth() + 1).padStart(2, '0')}-${String(graceDate.getDate()).padStart(2, '0')}`;

  const todayClean = new Date(currentYear, currentMonth, todayDay, 0, 0, 0, 0);
  const daysUntilDue = Math.max(0, Math.ceil((targetDateObj.getTime() - todayClean.getTime()) / (1000 * 60 * 60 * 24)));

  // Get target period utility costs (variable history for target month, e.g. newly edited utility for this month)
  const targetPeriodUtils = getPropertyUtilitiesForPeriod(property, targetPeriodKey);
  const targetWaterAmount = property.utilitiesWaterActive ? targetPeriodUtils.waterAmount : 0;
  const targetElectricAmount = property.utilitiesElectricActive ? targetPeriodUtils.electricAmount : 0;
  const targetMaintenanceAmount = property.utilitiesMaintenanceActive ? targetPeriodUtils.maintenanceAmount : 0;
  const targetUtilitiesTotal = targetWaterAmount + targetElectricAmount + targetMaintenanceAmount;

  // Unpaid utilities from previous periods that were not yet settled:
  const unpaidWaterCurrent = property.utilitiesWaterActive ? Math.max(0, currentStatus.pendingWaterBalance) : 0;
  const unpaidElectricCurrent = property.utilitiesElectricActive ? Math.max(0, currentStatus.pendingElectricBalance) : 0;
  const unpaidMaintenanceCurrent = property.utilitiesMaintenanceActive ? Math.max(0, currentStatus.pendingMaintenanceBalance) : 0;
  const unpaidUtilitiesTotal = unpaidWaterCurrent + unpaidElectricCurrent + unpaidMaintenanceCurrent;
  const hasUnpaidUtilities = unpaidUtilitiesTotal > 0;

  // Previous balance excluding current utilities to avoid double-counting
  const basePrevBalance = isUpcomingCurrentMonth
    ? currentStatus.previousBalance
    : Math.max(0, currentStatus.pendingRentBalance + currentStatus.pendingLateFeesBalance);

  // If there are unpaid utilities from past cycles, add them to previous balance carryover;
  // the current target period utility is added as the fresh utility charge for this period.
  const accumulatedPreviousBalance = basePrevBalance + unpaidUtilitiesTotal;

  // Previous month utility reference costs (for information note)
  const prevCycleKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const prevUtils = getPropertyUtilitiesForPeriod(property, prevCycleKey);
  const lastMonthWaterAmount = prevUtils.waterAmount;
  const lastMonthElectricAmount = prevUtils.electricAmount;
  const lastMonthMaintenanceAmount = prevUtils.maintenanceAmount;
  const lastMonthTotalUtilitiesAmount = lastMonthWaterAmount + lastMonthElectricAmount + lastMonthMaintenanceAmount;

  // Check if tenant made any advance payments SPECIFICALLY FOR RENT for the target period OR has surplus credit:
  const propPayments = payments.filter((p) => p.propertyId === property.id);
  const explicitAdvance = propPayments
    .filter((p) => {
      const matchPeriod = matchPaymentToPeriod(p, targetYear, targetMonth);
      const rentPortion = Number(p.appliedToRent) || (p.concept === 'renta' ? Number(p.amount) : 0);
      return matchPeriod && rentPortion > 0;
    })
    .reduce((sum, p) => sum + (Number(p.appliedToRent) || (p.concept === 'renta' ? Number(p.amount) : 0)), 0);

  // Surplus credit from current month (if tenant paid more than required rent)
  const surplusFromCurrent = !isUpcomingCurrentMonth
    ? Math.max(0, currentStatus.paidRentThisMonth - currentStatus.rentAmount)
    : 0;

  const advancePayments = explicitAdvance + surplusFromCurrent;

  // Check if upcoming target period is rented:
  const targetPeriodStatus = property.periodStatuses?.[targetPeriodKey] || property.status || 'rentado';
  const targetRent = targetPeriodStatus === 'rentado' ? getPropertyRentForDate(property, targetDateObj) : 0;

  // TOTAL PROYECTADO: Renta próxima + Saldos pendientes acumulados (incluyendo utilidades atrasadas pasadas) + Nueva factura de utilidades del periodo - Abonos anticipados DE RENTA
  const totalDueNextMonth = Math.max(
    0,
    targetRent + basePrevBalance + unpaidUtilitiesTotal - advancePayments
  );

  let utilitiesNote = '';
  if (hasUnpaidUtilities) {
    const unpaidParts: string[] = [];
    if (unpaidWaterCurrent > 0) unpaidParts.push(`Agua: ${formatCurrency(unpaidWaterCurrent, currencySymbol)}`);
    if (unpaidElectricCurrent > 0) unpaidParts.push(`Electricidad: ${formatCurrency(unpaidElectricCurrent, currencySymbol)}`);
    if (unpaidMaintenanceCurrent > 0) unpaidParts.push(`Cuota: ${formatCurrency(unpaidMaintenanceCurrent, currencySymbol)}`);
    utilitiesNote = `Utilidades pendientes del mes corriente (${unpaidParts.join(', ')}): Se incluyen en el desglose y balance a pagar al no registrarse su liquidación.`;
  } else if (property.utilitiesWaterActive || property.utilitiesElectricActive || property.utilitiesMaintenanceActive) {
    const parts: string[] = [];
    if (property.utilitiesWaterActive && lastMonthWaterAmount > 0) {
      parts.push(`Agua: ${formatCurrency(lastMonthWaterAmount, currencySymbol)}`);
    }
    if (property.utilitiesElectricActive && lastMonthElectricAmount > 0) {
      parts.push(`Electricidad: ${formatCurrency(lastMonthElectricAmount, currencySymbol)}`);
    }
    if (property.utilitiesMaintenanceActive && lastMonthMaintenanceAmount > 0) {
      parts.push(`Cuota: ${formatCurrency(lastMonthMaintenanceAmount, currencySymbol)}`);
    }
    const details = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    utilitiesNote = `Nota informativa de utilidades: En la última factura el costo de utilidades fue de ${formatCurrency(lastMonthTotalUtilitiesAmount, currencySymbol)}${details}. El costo para este nuevo ciclo variará según el consumo real; cuando los proveedores emitan la próxima factura se le indicará y agregará la cantidad correspondiente a pagar por dicho concepto.`;
  }

  const nextPeriodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  return {
    nextPeriodName,
    nextPeriodKey,
    nextDueDate,
    nextDueDay: targetDueDay,
    rentAmount: property.rentAmount,
    waterAmount: targetWaterAmount,
    electricAmount: targetElectricAmount,
    maintenanceAmount: targetMaintenanceAmount,
    totalUtilitiesAmount: targetUtilitiesTotal,
    lastMonthWaterAmount,
    lastMonthElectricAmount,
    lastMonthMaintenanceAmount,
    lastMonthTotalUtilitiesAmount,
    utilitiesNote,
    accumulatedPreviousBalance,
    advancePayments,
    totalDueNextMonth,
    daysUntilDue,
    graceDateStr,
    unpaidWaterCurrent,
    unpaidElectricCurrent,
    unpaidMaintenanceCurrent,
    hasUnpaidUtilities,
  };
}

export function formatRentPeriodDateRange(targetYear: number, targetMonth: number, rentDueDay: number, lang: SupportedLanguage = 'es'): string {
  const lastDayStart = new Date(targetYear, targetMonth + 1, 0).getDate();
  const startDay = Math.min(rentDueDay, lastDayStart);
  const startDate = new Date(targetYear, targetMonth, startDay, 0, 0, 0, 0);

  const nextMonthDate = new Date(targetYear, targetMonth + 1, startDay, 0, 0, 0, 0);
  nextMonthDate.setDate(nextMonthDate.getDate() - 1);

  const startStr = formatDate(startDate.toISOString().split('T')[0], lang);
  const endStr = formatDate(nextMonthDate.toISOString().split('T')[0], lang);

  return `Del ${startStr} al ${endStr}`;
}

export function calculateHistoricalUtilityBalance(
  property: Property,
  payments: Payment[],
  utilityType: 'water' | 'electric' | 'maintenance',
  referenceDate: Date = new Date()
): {
  totalBilled: number;
  totalPaid: number;
  pendingBalance: number;
} {
  const refTime = referenceDate.getTime();
  let totalBilled = 0;
  let totalPaid = 0;

  const refPeriodKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;

  if (property.periodUtilities) {
    const periodKeys = Object.keys(property.periodUtilities).sort();
    for (const pKey of periodKeys) {
      if (pKey <= refPeriodKey) {
        const rec = property.periodUtilities[pKey];
        if (utilityType === 'water' && property.utilitiesWaterActive) {
          totalBilled += Number(rec.waterAmount !== undefined ? rec.waterAmount : property.utilitiesWaterAmount || 0);
        } else if (utilityType === 'electric' && property.utilitiesElectricActive) {
          totalBilled += Number(rec.electricAmount !== undefined ? rec.electricAmount : property.utilitiesElectricAmount || 0);
        } else if (utilityType === 'maintenance' && property.utilitiesMaintenanceActive) {
          totalBilled += Number(rec.maintenanceAmount !== undefined ? rec.maintenanceAmount : property.utilitiesMaintenanceAmount || 0);
        }
      }
    }
  } else {
    const defaultWater = property.utilitiesWaterActive ? Math.max(0, Number(property.utilitiesWaterAmount) || 0) : 0;
    const defaultElectric = property.utilitiesElectricActive ? Math.max(0, Number(property.utilitiesElectricAmount) || 0) : 0;
    const defaultMaint = property.utilitiesMaintenanceActive ? Math.max(0, Number(property.utilitiesMaintenanceAmount) || 0) : 0;
    if (utilityType === 'water') totalBilled = defaultWater;
    if (utilityType === 'electric') totalBilled = defaultElectric;
    if (utilityType === 'maintenance') totalBilled = defaultMaint;
  }

  const propPayments = payments.filter((p) => p.propertyId === property.id);
  for (const pay of propPayments) {
    const payTime = parseLocalDate(pay.date).getTime();
    if (payTime <= refTime) {
      if (utilityType === 'water') {
        totalPaid += Number(pay.appliedToWater) || (pay.concept === 'agua' ? Number(pay.amount) : 0);
      } else if (utilityType === 'electric') {
        totalPaid += Number(pay.appliedToElectric) || (pay.concept === 'electricidad' ? Number(pay.amount) : 0);
      } else if (utilityType === 'maintenance') {
        totalPaid += Number(pay.appliedToMaintenance) || (pay.concept === 'mantenimiento' ? Number(pay.amount) : 0);
      }
    }
  }

  const pendingBalance = Math.max(0, totalBilled - totalPaid);
  return { totalBilled, totalPaid, pendingBalance };
}

