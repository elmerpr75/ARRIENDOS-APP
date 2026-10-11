import { Property, Payment, PropertyFinancialStatus, CURRENCY_OPTIONS, PaymentConcept } from '../types';
import { getSavedLanguage, SupportedLanguage } from './i18n';

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
 * - Grace period counts payment due day as day 1. E.g. Due day 10, grace 5 days:
 *   Day 15 is within grace (0 penalty). Day 16 is 1 day of delay ($20 base + $5*1 = $25).
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

  // Due date for the specific cycle
  const lastDayOfCycleMonth = new Date(year, month + 1, 0).getDate();
  const clampedDueDay = Math.min(dueDay, lastDayOfCycleMonth);
  const dueDate = new Date(year, month, clampedDueDay);

  // Grace date (inclusive):
  // "contando el día de pago como el primer día del período de gracia"
  // Due date + graceDays = end of grace period. E.g. day 10 + 5 days = day 15.
  const graceDays = Math.max(0, Number(property.graceDays) ?? 3);
  const graceDate = new Date(dueDate);
  graceDate.setDate(graceDate.getDate() + graceDays);

  const evalMidnight = new Date(evaluationDate.getFullYear(), evaluationDate.getMonth(), evaluationDate.getDate()).getTime();
  const graceMidnight = new Date(graceDate.getFullYear(), graceDate.getMonth(), graceDate.getDate()).getDate();
  const graceMidnightMs = new Date(graceDate.getFullYear(), graceDate.getMonth(), graceDate.getDate()).getTime();

  // If on or before grace date, not overdue
  if (evalMidnight <= graceMidnightMs) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      effectiveDailyDays: 0,
      lateFeeBase: 0,
      lateFeeDaily: 0,
      totalLateFee: 0,
    };
  }

  // Days overdue beyond the grace period
  const diffDays = Math.max(1, Math.round((evalMidnight - graceMidnightMs) / (1000 * 60 * 60 * 24)));
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
 * segregating rent, late fees, water and electricity charges and payments.
 */
export function calculatePropertyStatus(
  property: Property,
  payments: Payment[],
  referenceDate: Date = new Date()
): PropertyFinancialStatus {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-11
  
  // Due date for current month
  // If rentDueDay exceeds month days, clamp to last day of month
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dueDay = Math.min(property.rentDueDay || 1, lastDayOfMonth);
  const currentDueDate = new Date(currentYear, currentMonth, dueDay);
  
  // Format due date YYYY-MM-DD
  const dueDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

  // Grace date (inclusive)
  const graceDays = property.graceDays ?? 3;
  const graceDate = new Date(currentDueDate);
  graceDate.setDate(graceDate.getDate() + graceDays);

  // Contract calculation
  const contractEnd = new Date(property.contractEndDate);
  const contractDaysLeft = getDaysDifference(contractEnd, referenceDate);
  
  let contractStatus: 'vigente' | 'por_renovar' | 'vencido' = 'vigente';
  if (contractDaysLeft < 0) {
    contractStatus = 'vencido';
  } else if (contractDaysLeft <= 45) {
    contractStatus = 'por_renovar';
  }

  // Filter payments for this property
  const propPayments = payments.filter((p) => p.propertyId === property.id);
  const totalAllPayments = propPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  // Sort payments by date descending
  const sortedPayments = [...propPayments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastPayment = sortedPayments[0];

  // Current period payments (matching year and month or period name)
  const currentPeriod = getCurrentPeriodName(referenceDate);
  const paymentsThisMonth = propPayments.filter((p) => {
    if (p.period === currentPeriod) return true;
    const pDate = new Date(p.date);
    return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
  });
  const totalPaidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Check if reference date has reached or passed the agreed monthly rent due day:
  // e.g. If due day is the 15th, before the 15th (days 1-14) the current month's rent has NOT yet matured/exigible.
  const evalMidnight = new Date(currentYear, currentMonth, referenceDate.getDate()).getTime();
  const dueMidnight = new Date(currentYear, currentMonth, dueDay).getTime();
  const isRentDueReached = evalMidnight >= dueMidnight;

  // Current month rent charge:
  // ONLY billed/charged as active debt once the due day is reached or exceeded.
  const currentMonthRentCharge = isRentDueReached ? property.rentAmount : 0;

  // Utility charges for this property (variable according to monthly bill)
  const waterAmount = property.utilitiesWaterActive ? Math.max(0, Number(property.utilitiesWaterAmount) || 0) : 0;
  const electricAmount = property.utilitiesElectricActive ? Math.max(0, Number(property.utilitiesElectricAmount) || 0) : 0;
  const totalUtilitiesAmount = waterAmount + electricAmount;
  const totalBilledThisMonth = currentMonthRentCharge + totalUtilitiesAmount;

  // Determine months elapsed since contract start (capped to reference date)
  const contractStart = new Date(property.contractStartDate || referenceDate);
  let monthsElapsed = 1;
  if (!isNaN(contractStart.getTime())) {
    const diffMonths = (currentYear - contractStart.getFullYear()) * 12 + (currentMonth - contractStart.getMonth());
    // If no payments have been registered in the system yet for this property, don't generate retroactive debt
    monthsElapsed = propPayments.length > 0 ? Math.max(1, diffMonths + 1) : 1;
  }

  // Segregated breakdown of all-time payments for deposit and rent tracking:
  let totalDepositPaid = 0;
  let totalRentPaidAllTime = 0;
  for (const pay of propPayments) {
    const amt = Number(pay.amount) || 0;
    if (pay.appliedToRent !== undefined || pay.appliedToLateFees !== undefined ||
        pay.appliedToWater !== undefined || pay.appliedToElectric !== undefined ||
        pay.appliedToDeposit !== undefined) {
      totalRentPaidAllTime += Number(pay.appliedToRent) || 0;
      totalDepositPaid += Number(pay.appliedToDeposit) || 0;
    } else {
      if (pay.concept === 'deposito') {
        totalDepositPaid += amt;
      } else if (pay.concept !== 'agua' && pay.concept !== 'electricidad') {
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
  let paidDepositThisMonth = 0;

  for (const pay of paymentsThisMonth) {
    const amt = Number(pay.amount) || 0;
    if (pay.appliedToRent !== undefined || pay.appliedToLateFees !== undefined ||
        pay.appliedToWater !== undefined || pay.appliedToElectric !== undefined ||
        pay.appliedToDeposit !== undefined) {
      paidRentThisMonth += Number(pay.appliedToRent) || 0;
      paidLateFeesThisMonth += Number(pay.appliedToLateFees) || 0;
      paidWaterThisMonth += Number(pay.appliedToWater) || 0;
      paidElectricThisMonth += Number(pay.appliedToElectric) || 0;
      paidDepositThisMonth += Number(pay.appliedToDeposit) || 0;
    } else {
      // Legacy or unpartitioned payment: attribute according to pay.concept
      if (pay.concept === 'agua') {
        paidWaterThisMonth += amt;
      } else if (pay.concept === 'electricidad') {
        paidElectricThisMonth += amt;
      } else if (pay.concept === 'deposito') {
        paidDepositThisMonth += amt;
      } else {
        // Default to rent
        paidRentThisMonth += amt;
      }
    }
  }

  // Determine late fee for current month (evaluated ONLY if rent due day has arrived)
  const pendingRentUnadjusted = isRentDueReached ? Math.max(0, property.rentAmount - paidRentThisMonth) : 0;
  const currentLateFeeResult = isRentDueReached
    ? computeMonthlyLateFee(
        property,
        dueDay,
        currentYear,
        currentMonth,
        referenceDate,
        pendingRentUnadjusted
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

  // Previous rent balance calculation:
  // Each past month that remained unpaid accumulates its monthly rent plus that month's
  // late fee (up to the monthly cap). The cap resets to zero each new month.
  // We exclude deposit payments so deposit funds are not miscalculated as rent.
  const rentAndFeesPriorPayments = Math.max(0, (totalAllPayments - totalDepositPaid) - (totalPaidThisMonth - paidDepositThisMonth));
  const paymentsPrior = rentAndFeesPriorPayments;
  let remainingPriorPayments = paymentsPrior;
  let accumulatedPriorBilled = 0;

  if (monthsElapsed > 1) {
    const startYear = contractStart.getFullYear();
    const startMonth = contractStart.getMonth();

    for (let m = 0; m < monthsElapsed - 1; m++) {
      const totalMonthIndex = startMonth + m;
      const pastYear = startYear + Math.floor(totalMonthIndex / 12);
      const pastMonth = totalMonthIndex % 12;
      const monthlyRent = property.rentAmount;

      if (remainingPriorPayments >= monthlyRent) {
        remainingPriorPayments -= monthlyRent;
        accumulatedPriorBilled += monthlyRent;
      } else {
        const unpaidPastRent = monthlyRent - remainingPriorPayments;
        remainingPriorPayments = 0;
        const pastMonthEnd = new Date(pastYear, pastMonth + 1, 0);
        const pastLateResult = computeMonthlyLateFee(
          property,
          dueDay,
          pastYear,
          pastMonth,
          pastMonthEnd,
          unpaidPastRent
        );
        accumulatedPriorBilled += monthlyRent + pastLateResult.totalLateFee;
      }
    }
  }

  const previousBalance = Math.max(0, accumulatedPriorBilled - paymentsPrior);

  // Segregated pending balances:
  // Notice: If due day has not arrived (e.g. today is Oct 4, due day is Oct 15), current month rent is not added yet!
  const pendingLateFeesBalance = Math.max(0, totalLateFees - paidLateFeesThisMonth);
  const pendingRentBalance = Math.max(0, previousBalance + currentMonthRentCharge - paidRentThisMonth);
  const pendingWaterBalance = Math.max(0, waterAmount - paidWaterThisMonth);
  const pendingElectricBalance = Math.max(0, electricAmount - paidElectricThisMonth);
  const pendingUtilitiesBalance = pendingWaterBalance + pendingElectricBalance;

  // Total pending balance = late fees + rent + utilities
  const totalPendingBalance = pendingLateFeesBalance + pendingRentBalance + pendingUtilitiesBalance;

  let accountStatus: 'al_dia' | 'proximo_vencer' | 'atrasado' | 'con_saldo_favor' = 'al_dia';
  if (totalPendingBalance <= 0) {
    if (totalAllPayments > accumulatedPriorBilled + currentMonthRentCharge + totalLateFees + totalUtilitiesAmount) {
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
    totalUtilitiesAmount,
    totalBilledThisMonth,

    // Segregated payments
    paidRentThisMonth,
    paidLateFeesThisMonth,
    paidWaterThisMonth,
    paidElectricThisMonth,
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
    pendingUtilitiesBalance,
  };
}

export interface PaymentAllocationResult {
  appliedToLateFees: number;
  appliedToRent: number;
  appliedToDeposit: number;
  appliedToWater: number;
  appliedToElectric: number;
  applicationFootnote: string;
}

/**
 * Evaluates payment allocation according to contract/legal priority:
 * 1. Satisfies pending late fees (moras) first.
 * 2. Satisfies pending/current rent second.
 * 3. Applies remainder to the selected utility concept (Water / Electricity).
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

  let remaining = numericAmount;
  let appliedToLateFees = 0;
  let appliedToRent = 0;
  let appliedToDeposit = 0;
  let appliedToWater = 0;
  let appliedToElectric = 0;

  if (chosenConcept === 'deposito') {
    // If designated explicitly for security deposit in contract, it covers deposit
    appliedToDeposit = numericAmount;
    remaining = 0;
  } else {
    // Rule: Evaluates if late fees or rent are owed; satisfies those first!
    if (pendingLateFees > 0) {
      appliedToLateFees = Math.min(remaining, pendingLateFees);
      remaining = Math.round((remaining - appliedToLateFees) * 100) / 100;
    }

    if (pendingRent > 0 && remaining > 0) {
      appliedToRent = Math.min(remaining, pendingRent);
      remaining = Math.round((remaining - appliedToRent) * 100) / 100;
    }

    // Remainder allocation according to chosen concept
    if (chosenConcept === 'agua') {
      appliedToWater = remaining;
    } else if (chosenConcept === 'electricidad') {
      appliedToElectric = remaining;
    } else if (chosenConcept === 'renta') {
      appliedToRent += remaining;
    } else {
      // General: distribute to water then electricity then rent
      if (pendingWater > 0 && remaining > 0) {
        appliedToWater = Math.min(remaining, pendingWater);
        remaining = Math.round((remaining - appliedToWater) * 100) / 100;
      }
      if (pendingElectric > 0 && remaining > 0) {
        appliedToElectric = Math.min(remaining, pendingElectric);
        remaining = Math.round((remaining - appliedToElectric) * 100) / 100;
      }
      if (remaining > 0) {
        appliedToRent += remaining;
      }
    }
  }

  // Generate official footnote (Nota al calce)
  let applicationFootnote = '';
  const totalFormatted = formatCurrency(numericAmount, currencySymbol);

  if (chosenConcept === 'deposito') {
    applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Depósito de Garantía estipulado en contrato.`;
  } else if (chosenConcept === 'agua') {
    if (appliedToLateFees > 0 || appliedToRent > 0) {
      const parts: string[] = [];
      if (appliedToLateFees > 0) parts.push(`${formatCurrency(appliedToLateFees, currencySymbol)} a recargos por demora (mora)`);
      if (appliedToRent > 0) parts.push(`${formatCurrency(appliedToRent, currencySymbol)} a balance pendiente de renta`);
      const remainderFormatted = formatCurrency(appliedToWater, currencySymbol);
      applicationFootnote = `⚠️ NOTA AL CALCE (Prelación de Fondos): De los ${totalFormatted} recibidos (declarados para Utilidad de Agua), se aplicaron prioritariamente ${parts.join(' y ')}. El remanente de ${remainderFormatted} fue acreditado a Utilidad de Agua.`;
    } else {
      applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Utilidad de Agua según concepto seleccionado.`;
    }
  } else if (chosenConcept === 'electricidad') {
    if (appliedToLateFees > 0 || appliedToRent > 0) {
      const parts: string[] = [];
      if (appliedToLateFees > 0) parts.push(`${formatCurrency(appliedToLateFees, currencySymbol)} a recargos por demora (mora)`);
      if (appliedToRent > 0) parts.push(`${formatCurrency(appliedToRent, currencySymbol)} a balance pendiente de renta`);
      const remainderFormatted = formatCurrency(appliedToElectric, currencySymbol);
      applicationFootnote = `⚠️ NOTA AL CALCE (Prelación de Fondos): De los ${totalFormatted} recibidos (declarados para Utilidad de Electricidad LUMA / AEE), se aplicaron prioritariamente ${parts.join(' y ')}. El remanente de ${remainderFormatted} fue acreditado a Utilidad de Electricidad.`;
    } else {
      applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Utilidad de Electricidad (LUMA / AEE) según concepto seleccionado.`;
    }
  } else if (chosenConcept === 'renta') {
    if (appliedToLateFees > 0) {
      applicationFootnote = `⚠️ NOTA AL CALCE (Prelación de Fondos): De los ${totalFormatted} recibidos, se aplicaron primero ${formatCurrency(appliedToLateFees, currencySymbol)} a cubrir cargos por demora pendientes, y el restante de ${formatCurrency(appliedToRent, currencySymbol)} se acreditó a la renta convenida.`;
    } else {
      applicationFootnote = `NOTA AL CALCE: Pago de ${totalFormatted} acreditado íntegramente a Renta convenida en contrato.`;
    }
  } else {
    applicationFootnote = `NOTA AL CALCE: Pago general de ${totalFormatted} distribuido prioritariamente a moras, renta y utilidades según saldos adeudados.`;
  }

  return {
    appliedToLateFees,
    appliedToRent,
    appliedToDeposit,
    appliedToWater,
    appliedToElectric,
    applicationFootnote,
  };
}

export interface NextPeriodInvoiceInfo {
  nextPeriodName: string;
  nextDueDate: string;
  nextDueDay: number;
  rentAmount: number;
  waterAmount: number;
  electricAmount: number;
  totalUtilitiesAmount: number;
  lastMonthWaterAmount: number;
  lastMonthElectricAmount: number;
  lastMonthTotalUtilitiesAmount: number;
  utilitiesNote: string;
  accumulatedPreviousBalance: number;
  advancePayments: number;
  totalDueNextMonth: number;
  daysUntilDue: number;
  graceDateStr: string;
  unpaidWaterCurrent: number;
  unpaidElectricCurrent: number;
  hasUnpaidUtilities: boolean;
}

/**
 * Calculates financial amounts and due dates for upcoming advance invoice / next billing cycle.
 * NOTE: As utility charges vary each month according to real consumption, the previous month's
 * utilities cost is NOT added to the upcoming period's total. An informative note is provided instead.
 */
export function calculateNextPeriodInvoiceInfo(
  property: Property,
  payments: Payment[],
  referenceDate: Date = new Date(),
  currencySymbol: string = '$'
): NextPeriodInvoiceInfo {
  const currentStatus = calculatePropertyStatus(property, payments, referenceDate);
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-11
  const todayDay = referenceDate.getDate();

  // If today is BEFORE the agreed rent due day of the current month (e.g. today is Oct 4, due day is Oct 15):
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
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    targetYear = nextDate.getFullYear();
    targetMonth = nextDate.getMonth();
  }

  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDueDay = Math.min(property.rentDueDay || 1, lastDayOfTargetMonth);
  const nextDueDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDueDay).padStart(2, '0')}`;
  const targetDateObj = new Date(targetYear, targetMonth, targetDueDay);
  const nextPeriodName = getCurrentPeriodName(targetDateObj);

  const graceDays = property.graceDays ?? 3;
  const graceDate = new Date(targetYear, targetMonth, targetDueDay + graceDays);
  const graceDateStr = `${graceDate.getFullYear()}-${String(graceDate.getMonth() + 1).padStart(2, '0')}-${String(graceDate.getDate()).padStart(2, '0')}`;

  const todayClean = new Date(currentYear, currentMonth, todayDay);
  const daysUntilDue = Math.max(0, Math.ceil((targetDateObj.getTime() - todayClean.getTime()) / (1000 * 60 * 60 * 24)));

  // Carryover any remaining unpaid balance from prior/current months:
  // If upcoming is the current month's rent (before due day), previous balance is prior months' debt.
  // If upcoming is next month's rent, previous balance is the full current pending balance (minus unpaid utilities of the current month which are segregated).
  const unpaidWaterCurrent = property.utilitiesWaterActive ? Math.max(0, currentStatus.pendingWaterBalance) : 0;
  const unpaidElectricCurrent = property.utilitiesElectricActive ? Math.max(0, currentStatus.pendingElectricBalance) : 0;
  const unpaidUtilitiesTotal = unpaidWaterCurrent + unpaidElectricCurrent;
  const hasUnpaidUtilities = unpaidUtilitiesTotal > 0;

  // Previous balance excluding the segregated current utilities to prevent double-counting
  const accumulatedPreviousBalance = isUpcomingCurrentMonth
    ? currentStatus.previousBalance
    : Math.max(0, currentStatus.totalPendingBalance - unpaidUtilitiesTotal);

  // Previous month utility reference costs (from property settings/last bill)
  const lastMonthWaterAmount = property.utilitiesWaterActive ? Math.max(0, Number(property.utilitiesWaterAmount) || 0) : 0;
  const lastMonthElectricAmount = property.utilitiesElectricActive ? Math.max(0, Number(property.utilitiesElectricAmount) || 0) : 0;
  const lastMonthTotalUtilitiesAmount = lastMonthWaterAmount + lastMonthElectricAmount;

  // Check if tenant made any advance payments for the target period
  const propPayments = payments.filter((p) => p.propertyId === property.id);
  const advancePayments = propPayments
    .filter((p) => p.period.toLowerCase().trim() === nextPeriodName.toLowerCase().trim())
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // TOTAL PROYECTADO: Renta + Saldos pendientes acumulados + Utilidades no pagadas del mes corriente - Abonos anticipados
  const totalDueNextMonth = Math.max(
    0,
    property.rentAmount + accumulatedPreviousBalance + unpaidUtilitiesTotal - advancePayments
  );

  let utilitiesNote = '';
  if (hasUnpaidUtilities) {
    const unpaidParts: string[] = [];
    if (unpaidWaterCurrent > 0) unpaidParts.push(`Agua: ${formatCurrency(unpaidWaterCurrent, currencySymbol)}`);
    if (unpaidElectricCurrent > 0) unpaidParts.push(`LUMA / AEE: ${formatCurrency(unpaidElectricCurrent, currencySymbol)}`);
    utilitiesNote = `Utilidades pendientes del mes corriente (${unpaidParts.join(', ')}): Se incluyen en el desglose y balance a pagar al no registrarse su liquidación.`;
  } else if (property.utilitiesWaterActive || property.utilitiesElectricActive) {
    const parts: string[] = [];
    if (property.utilitiesWaterActive && lastMonthWaterAmount > 0) {
      parts.push(`Agua: ${formatCurrency(lastMonthWaterAmount, currencySymbol)}`);
    }
    if (property.utilitiesElectricActive && lastMonthElectricAmount > 0) {
      parts.push(`LUMA / AEE: ${formatCurrency(lastMonthElectricAmount, currencySymbol)}`);
    }
    const details = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    utilitiesNote = `Nota informativa de utilidades: En la última factura recibida el costo de utilidades fue de ${formatCurrency(lastMonthTotalUtilitiesAmount, currencySymbol)}${details}. El costo para este nuevo ciclo variará según el consumo real; cuando los proveedores emitan la próxima factura se le indicará y agregará la cantidad correspondiente a pagar por dicho concepto.`;
  }

  return {
    nextPeriodName,
    nextDueDate,
    nextDueDay: targetDueDay,
    rentAmount: property.rentAmount,
    waterAmount: unpaidWaterCurrent, // Added when unpaid in current month
    electricAmount: unpaidElectricCurrent, // Added when unpaid in current month
    totalUtilitiesAmount: unpaidUtilitiesTotal, // Added when unpaid in current month
    lastMonthWaterAmount,
    lastMonthElectricAmount,
    lastMonthTotalUtilitiesAmount,
    utilitiesNote,
    accumulatedPreviousBalance,
    advancePayments,
    totalDueNextMonth,
    daysUntilDue,
    graceDateStr,
    unpaidWaterCurrent,
    unpaidElectricCurrent,
    hasUnpaidUtilities,
  };
}
