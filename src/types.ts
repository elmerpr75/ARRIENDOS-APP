export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  region?: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  // Primary currencies requested by user:
  { code: 'USD', name: 'US Dólar', symbol: '$', region: 'Estados Unidos / Internacional' },
  { code: 'EUR', name: 'Euro', symbol: '€', region: 'Unión Europea' },
  { code: 'GBP', name: 'Libra Esterlina (Gran Bretaña)', symbol: '£', region: 'Gran Bretaña / Reino Unido' },
  { code: 'CAD', name: 'Dólar Canadiense', symbol: 'C$', region: 'Canadá' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$', region: 'México' },
  // Latin American currencies:
  { code: 'COP', name: 'Peso Colombiano', symbol: '$', region: 'Colombia' },
  { code: 'CLP', name: 'Peso Chileno', symbol: '$', region: 'Chile' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$', region: 'Argentina' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', region: 'Perú' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$', region: 'Brasil' },
  { code: 'GTQ', name: 'Quetzal Guatemalteco', symbol: 'Q', region: 'Guatemala' },
  { code: 'HNL', name: 'Lempira Hondureño', symbol: 'L', region: 'Honduras' },
  { code: 'NIO', name: 'Córdoba Nicaragüense', symbol: 'C$', region: 'Nicaragua' },
  { code: 'CRC', name: 'Colón Costarricense', symbol: '₡', region: 'Costa Rica' },
  { code: 'PAB', name: 'Balboa Panameño', symbol: 'B/.', region: 'Panamá' },
  { code: 'DOP', name: 'Peso Dominicano', symbol: 'RD$', region: 'República Dominicana' },
  { code: 'PYG', name: 'Guaraní Paraguayo', symbol: 'Gs.', region: 'Paraguay' },
  { code: 'UYU', name: 'Peso Uruguayo', symbol: '$U', region: 'Uruguay' },
  { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs.', region: 'Venezuela' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs.', region: 'Bolivia' },
];

export interface Administrator {
  id: string; // e.g. "admin-1", "admin-2"
  companyName: string;
  landlordName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string;
  bankDetails: string;
  invoiceNote: string;
  currencyCode: string; // e.g. "USD", "EUR"
  currencySymbol: string; // e.g. "$", "€", "C$"
  isDefault?: boolean;
}

export interface Tenant {
  name: string;
  phone: string;
  email?: string;
  idNumber?: string; // DNI, Cédula, RFC, etc.
}

export interface Property {
  id: string;
  administratorId?: string; // ID of the assigned Administrator/Company
  propertyIdentifier: string; // Ej: "Apto 302 - Residencial Palmeras"
  address: string;
  rentAmount: number; // Monto mensual de renta
  rentDueDay: number; // Día del mes en que vence la renta (1-31)
  graceDays: number; // Días de gracia antes de aplicar mora (default: 3)
  lateFeeBase: number; // Cargo base fijo por atraso
  lateFeeDaily: number; // Cargo por demora por cada día de atraso
  contractStartDate: string; // YYYY-MM-DD
  contractEndDate: string; // YYYY-MM-DD - Fecha de vencimiento o renovación
  tenant1: Tenant;
  tenant2?: Tenant;
  depositAmount?: number;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;

  // Cargos variables adicionales por utilidades (Agua, Electricidad LUMA / AEE, y Mantenimiento / Cuota de Residentes)
  utilitiesWaterActive?: boolean; // Aplica o no cargo por Agua
  utilitiesWaterAmount?: number; // Costo variable según consumo/factura proveedor Agua
  utilitiesElectricActive?: boolean; // Aplica o no cargo por Electricidad (LUMA / AEE)
  utilitiesElectricAmount?: number; // Costo variable según consumo/factura proveedor Electricidad
  utilitiesMaintenanceActive?: boolean; // Aplica o no cargo por Mantenimiento o Cuota de Residentes
  utilitiesMaintenanceAmount?: number; // Monto por Mantenimiento / Cuota de Residentes

  // Políticas de morosidad y topes máximos por ciclo mensual
  lateFeeCapEnabled?: boolean; // Aplica o no tope máximo a la penalidad por morosidad en el mes
  lateFeeCapType?: 'amount' | 'days'; // Tipo de tope: 'amount' (monto monetario máximo) o 'days' (cantidad máxima de días a computar tras gracia)
  lateFeeMaxAmount?: number; // Monto máximo de penalidad por morosidad por mes (ej: $75)
  lateFeeMaxDays?: number; // Cantidad máxima de días de retraso imputables en el mes tras gracia (ej: 10 días)
}

export type PaymentMethod = 'transferencia' | 'ath_movil' | 'efectivo' | 'deposito' | 'cheque' | 'tarjeta' | 'otro';

export type PaymentConcept = 'renta' | 'deposito' | 'agua' | 'electricidad' | 'mantenimiento' | 'mora' | 'general';

export interface Payment {
  id: string;
  propertyId: string;
  date: string; // YYYY-MM-DD fecha en que pagó
  amount: number; // Cuánto pagó
  payerName: string; // Quién pagó (Inquilino 1, Inquilino 2, etc.)
  paymentMethod: PaymentMethod;
  reference?: string; // Referencia de banco / recibo #
  period: string; // Ej: "Septiembre 2026"
  notes?: string;
  createdAt: string;

  // Motivo del pago y aplicación contable según prelación legal/contractual
  concept?: PaymentConcept;
  appliedToLateFees?: number; // Cubre mora primero
  appliedToRent?: number; // Cubre renta después
  appliedToDeposit?: number; // Cubre depósito de garantía requerido en contrato
  appliedToWater?: number; // Remanente a Agua si fue seleccionada
  appliedToElectric?: number; // Remanente a Electricidad si fue seleccionada
  appliedToMaintenance?: number; // Remanente a Mantenimiento/Cuota si fue seleccionada
  applicationFootnote?: string; // Nota al calce obligatoria de aplicación de fondos
}

export interface NotificationSettings {
  enabled: boolean;
  daysBeforeRentDue: number; // Cantidad de días antes del 1er día de renta/mes para recordar enviar factura (default: 5)
  notifyOnDueDay: boolean; // Notificar también el día de cobro
  notifyOnOverdue: boolean; // Notificar cuando esté atrasado
  notifyContractExpiry: boolean; // Notificar vencimiento de contrato
  contractExpiryDays: number; // Días antes de vencer contrato (default: 30)
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface LandlordProfile {
  companyName: string;
  landlordName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string; // Data URL or external URL
  bankDetails: string; // Datos para depósito / transferencia
  invoiceNote: string; // Términos o nota al pie
  currencyCode?: string;
  currencySymbol?: string;
  themeMode?: ThemeMode; // 'light' | 'dark' | 'system'
  googleDriveFolderId?: string; // ID or link of Google Drive Folder for backups
  googleDriveAccountEmail?: string; // Connected Google Account email
  securityPin?: string; // PIN opcional para bloqueo/desbloqueo de sesión local
  notificationSettings?: NotificationSettings;
  administrators?: Administrator[]; // Up to 7 administrators/companies
}

export interface PropertyFinancialStatus {
  property: Property;
  currentPeriod: string;
  rentAmount: number;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  calculatedLateFeeBase: number;
  calculatedLateFeeDaily: number;
  totalLateFees: number;
  effectiveDailyDays?: number; // Cantidad de días de retraso efectivamente cobrados tras aplicar tope (si aplica)
  lateFeeCapNotice?: string; // Nota explicativa si se alcanzó o aplicó tope máximo en el mes
  previousBalance: number; // Balances previos pendientes
  currentMonthCharge: number;
  currentMonthRentCharge: number; // Monto exigible de renta del mes actual (0 si aún no llega el día de pago)
  isRentDueReached: boolean; // Indica si ya se alcanzó o superó el día convenido de pago en el mes
  totalPaidThisMonth: number;
  totalPendingBalance: number; // Cuentas por cobrar totales
  accountStatus: 'al_dia' | 'proximo_vencer' | 'atrasado' | 'con_saldo_favor';
  contractDaysLeft: number;
  contractStatus: 'vigente' | 'por_renovar' | 'vencido';
  lastPayment?: Payment;

  // Desglose segregado de cargos de utilidades
  waterAmount: number; // Cargo del mes por Agua (0 si no aplica)
  electricAmount: number; // Cargo del mes por Electricidad (LUMA / AEE) (0 si no aplica)
  maintenanceAmount: number; // Cargo del mes por Mantenimiento o Cuota de Residentes (0 si no aplica)
  totalUtilitiesAmount: number; // waterAmount + electricAmount + maintenanceAmount
  totalBilledThisMonth: number; // rentAmount + waterAmount + electricAmount + maintenanceAmount

  // Desglose de pagos realizados este mes
  paidRentThisMonth: number;
  paidLateFeesThisMonth: number;
  paidWaterThisMonth: number;
  paidElectricThisMonth: number;
  paidMaintenanceThisMonth: number;
  paidDepositThisMonth: number;

  // Depósito de garantía en contrato
  depositRequired: number; // Monto de depósito estipulado en contrato
  totalDepositPaid: number; // Total acumulado pagado para depósito
  pendingDepositBalance: number; // Saldo de depósito restante por cubrir

  // Balances pendientes segregados
  pendingRentBalance: number; // Saldo pendiente Renta
  pendingLateFeesBalance: number; // Saldo pendiente Moras
  pendingWaterBalance: number; // Saldo pendiente Agua
  pendingElectricBalance: number; // Saldo pendiente Electricidad LUMA / AEE
  pendingMaintenanceBalance: number; // Saldo pendiente Mantenimiento / Cuota de Residentes
  pendingUtilitiesBalance: number; // Agua + Electricidad + Cuota pendientes
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  propertyIdentifier: string;
  propertyAddress: string;
  period: string;
  rentAmount: number;
  previousBalance: number;
  lateFeeBase: number;
  lateFeeDaily: number;
  daysLate: number;
  totalPaid: number;
  totalDue: number;
  isPaidInFull: boolean;
  notes?: string;
}
