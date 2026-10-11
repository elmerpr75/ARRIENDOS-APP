import React, { useState } from 'react';
import { Property, Payment, PropertyFinancialStatus, Administrator } from '../types';
import { calculatePropertyStatus, formatCurrency, formatDate } from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import {
  DollarSign,
  PlusCircle,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CreditCard,
  Building2,
  Layers,
  FileText,
  X,
  Droplets,
  Zap,
  Receipt,
} from 'lucide-react';

interface TrackingViewProps {
  properties: Property[];
  payments: Payment[];
  administrators?: Administrator[];
  onOpenPaymentModal: (propertyId?: string, payerName?: string, amount?: number) => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
  onOpenInvoice: (status: PropertyFinancialStatus, mode?: 'current' | 'next_month') => void;
}

export const TrackingView: React.FC<TrackingViewProps> = ({
  properties,
  payments,
  administrators = [],
  onOpenPaymentModal,
  onEditPayment,
  onDeletePayment,
  onOpenInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('all');
  const [selectedAdminFilter, setSelectedAdminFilter] = useState('all');
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  // Calculate statuses for all properties
  const propertyStatuses = properties.map((p) => calculatePropertyStatus(p, payments));

  // Compute segregated totals by administrator
  const effectiveAdmins = administrators.length > 0 ? administrators : [
    {
      id: 'admin-1',
      companyName: 'Inmobiliaria Premier',
      landlordName: 'Administración',
      taxId: '',
      phone: '',
      email: '',
      address: '',
      bankDetails: '',
      invoiceNote: '',
      currencyCode: 'USD',
      currencySymbol: '$',
      isDefault: true,
    },
  ];

  const adminStats = effectiveAdmins.map((admin) => {
    const adminProps = properties.filter(
      (p) => (p.administratorId || effectiveAdmins[0]?.id) === admin.id
    );
    const adminStatuses = propertyStatuses.filter((s) =>
      adminProps.some((p) => p.id === s.property.id)
    );

    const billedRent = adminStatuses.reduce((sum, s) => sum + s.currentMonthRentCharge, 0);
    const billedUtilities = adminStatuses.reduce((sum, s) => sum + s.totalUtilitiesAmount, 0);
    const billed = adminStatuses.reduce((sum, s) => sum + s.totalBilledThisMonth, 0);
    const collected = adminStatuses.reduce((sum, s) => sum + s.totalPaidThisMonth, 0);
    const receivables = adminStatuses.reduce((sum, s) => sum + s.totalPendingBalance, 0);
    const receivablesRent = adminStatuses.reduce((sum, s) => sum + s.pendingRentBalance, 0);
    const receivablesUtilities = adminStatuses.reduce((sum, s) => sum + s.pendingUtilitiesBalance, 0);
    const overdueCount = adminStatuses.filter((s) => s.isOverdue).length;

    return {
      admin,
      propsCount: adminProps.length,
      billedRent,
      billedUtilities,
      billed,
      collected,
      receivables,
      receivablesRent,
      receivablesUtilities,
      overdueCount,
      collectionRate: billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0,
    };
  });

  // Current active admin stats if filtered
  const activeAdminStat =
    selectedAdminFilter === 'all'
      ? null
      : adminStats.find((s) => s.admin.id === selectedAdminFilter);

  // Filter property statuses by admin
  const filteredStatuses = propertyStatuses.filter((s) => {
    if (selectedAdminFilter === 'all') return true;
    const defaultId = effectiveAdmins[0]?.id || 'admin-1';
    return (s.property.administratorId || defaultId) === selectedAdminFilter;
  });

  // Filter payments
  const filteredPayments = payments
    .filter((payment) => {
      const prop = properties.find((p) => p.id === payment.propertyId);
      const propName = prop?.propertyIdentifier || '';
      const defaultId = effectiveAdmins[0]?.id || 'admin-1';
      const propAdminId = prop?.administratorId || defaultId;

      const matchesSearch =
        payment.payerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        propName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (payment.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (payment.period || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProp =
        selectedPropertyFilter === 'all' || payment.propertyId === selectedPropertyFilter;
      const matchesAdmin =
        selectedAdminFilter === 'all' || propAdminId === selectedAdminFilter;

      return matchesSearch && matchesProp && matchesAdmin;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleConfirmDelete = () => {
    if (paymentToDelete) {
      onDeletePayment(paymentToDelete.id);
      setPaymentToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Administrator Filter Tabs */}
      {effectiveAdmins.length > 1 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-500" />
              Filtrar Control Financiero por Empresa Administradora
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">
              {effectiveAdmins.length} empresas registradas
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedAdminFilter('all')}
              className={`px-3 py-2 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-2 ${
                selectedAdminFilter === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Todas las Empresas ({properties.length} prop.)</span>
            </button>

            {adminStats.map(({ admin, propsCount }) => (
              <button
                key={admin.id}
                type="button"
                onClick={() => setSelectedAdminFilter(admin.id)}
                className={`px-3 py-2 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-2 border ${
                  selectedAdminFilter === admin.id
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {admin.logoUrl ? (
                  <img
                    src={admin.logoUrl}
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
                <span className="text-[10px] opacity-75">({propsCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TOP METRICS: Either Active Single Admin OR Segregated Breakdown by Administrator */}
      {selectedAdminFilter !== 'all' && activeAdminStat ? (
        /* Single Selected Administrator Metrics */
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
            <span>Empresa seleccionada:</span>
            <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950 rounded-md">
              {activeAdminStat.admin.companyName} (Símbolo: {activeAdminStat.admin.currencySymbol})
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Facturación del Mes</span>
                <div className="p-1.5 bg-sky-50 dark:bg-sky-950/50 rounded-lg text-sky-600">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(activeAdminStat.billed, activeAdminStat.admin.currencySymbol)}
              </p>
              <span className="text-[11px] text-slate-400">Renta programada</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Total Cobrado
                </span>
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(activeAdminStat.collected, activeAdminStat.admin.currencySymbol)}
              </p>
              <span className="text-[11px] text-slate-400">
                Tasa de cobro: {activeAdminStat.collectionRate}%
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Cuentas por Cobrar
                </span>
                <div className="p-1.5 bg-rose-50 dark:bg-rose-950/50 rounded-lg text-rose-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(activeAdminStat.receivables, activeAdminStat.admin.currencySymbol)}
              </p>
              <span className="text-[11px] text-slate-400">Saldo pendiente + moras</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Inmuebles en Mora
                </span>
                <div className="p-1.5 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {activeAdminStat.overdueCount}{' '}
                <span className="text-xs font-normal text-slate-500">
                  de {activeAdminStat.propsCount}
                </span>
              </p>
              <span className="text-[11px] text-slate-400">Propiedades con retraso</span>
            </div>
          </div>
        </div>
      ) : (
        /* All Administrators Breakdown Grid (Segregation by Administrator) */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-600" />
              Totales Financieros Segregados por Empresa Administradora
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {adminStats.map(({ admin, propsCount, billed, collected, receivables, overdueCount, collectionRate }) => (
              <div
                key={admin.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3"
              >
                {/* Admin Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {admin.logoUrl ? (
                      <img
                        src={admin.logoUrl}
                        alt=""
                        className="w-7 h-7 object-contain rounded-lg bg-white border border-slate-200 p-0.5 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {admin.companyName}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        {admin.landlordName || 'Administrador'} • {propsCount} propiedades
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-xs font-black rounded-lg border border-sky-200 dark:border-sky-800 shrink-0">
                    Moneda: {admin.currencySymbol}
                  </span>
                </div>

                {/* Subtotals Grid for this Company */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-medium">Facturación</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block truncate">
                      {formatCurrency(billed, admin.currencySymbol)}
                    </span>
                  </div>

                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                      Cobrado ({collectionRate}%)
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xs block truncate">
                      {formatCurrency(collected, admin.currencySymbol)}
                    </span>
                  </div>

                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-medium">
                      Por Cobrar
                    </span>
                    <span className="font-bold text-rose-700 dark:text-rose-300 text-xs block truncate">
                      {formatCurrency(receivables, admin.currencySymbol)}
                    </span>
                  </div>
                </div>

                {overdueCount > 0 && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1 font-semibold pt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{overdueCount} propiedad(es) con mora registrada</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Header & Summary Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Estado de Balances por Inquilino y Empresa Administradora
            </h3>
            <p className="text-xs text-slate-500">
              Control de saldos, pagos del mes y moras aplicadas bajo la moneda de cada empresa
            </p>
          </div>

          <button
            onClick={() => onOpenPaymentModal()}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Registrar Pago de Inquilino
          </button>
        </div>

        {/* Balances Quick Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-y border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3">Propiedad / Inquilino</th>
                <th className="py-2.5 px-3">Empresa Administradora</th>
                <th className="py-2.5 px-3 text-right">Renta Mes</th>
                <th className="py-2.5 px-3 text-right">Utilidades Mes</th>
                <th className="py-2.5 px-3 text-right">Total Facturado</th>
                <th className="py-2.5 px-3 text-right">Abonos Mes</th>
                <th className="py-2.5 px-3 text-right">Saldo Renta</th>
                <th className="py-2.5 px-3 text-right">Saldo Utilidades</th>
                <th className="py-2.5 px-3 text-right">Moras</th>
                <th className="py-2.5 px-3 text-right">Saldo Total</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStatuses.map((status) => {
                const { property } = status;
                const isPaid = status.totalPendingBalance <= 0;
                const admin = getAdministratorForProperty(property, administrators);

                return (
                  <tr
                    key={`status-row-${property.id}`}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {property.propertyIdentifier}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {property.tenant1.name}{' '}
                        {property.tenant2 ? `& ${property.tenant2.name}` : ''}
                      </p>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {admin.logoUrl ? (
                          <img
                            src={admin.logoUrl}
                            alt=""
                            className="w-4 h-4 rounded-full object-contain bg-white shrink-0"
                          />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-sky-600" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                          {admin.companyName}
                        </span>
                        <span className="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded text-[9px]">
                          {admin.currencySymbol}
                        </span>
                      </div>
                    </td>

                    {/* Renta Mes */}
                    <td className="py-3 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                      {formatCurrency(property.rentAmount, admin.currencySymbol)}
                    </td>

                    {/* Utilidades Mes */}
                    <td className="py-3 px-3 text-right">
                      {status.totalUtilitiesAmount > 0 ? (
                        <div>
                          <span className="font-semibold text-sky-800 dark:text-sky-300">
                            {formatCurrency(status.totalUtilitiesAmount, admin.currencySymbol)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            💧{formatCurrency(status.waterAmount, admin.currencySymbol)} • ⚡{formatCurrency(status.electricAmount, admin.currencySymbol)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No aplica</span>
                      )}
                    </td>

                    {/* Total Facturado */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(status.totalBilledThisMonth, admin.currencySymbol)}
                    </td>

                    {/* Abonos Mes */}
                    <td className="py-3 px-3 text-right font-medium">
                      {status.totalPaidThisMonth > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const propPays = payments.filter((p) => p.propertyId === property.id);
                            if (propPays.length > 0) {
                              onEditPayment(propPays[0]);
                            } else {
                              onOpenPaymentModal(property.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline group cursor-pointer"
                          title="Ver o editar pagos registrados de este mes"
                        >
                          <span>
                            {formatCurrency(status.totalPaidThisMonth, admin.currencySymbol)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded font-semibold group-hover:bg-emerald-200">
                            Ver
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-400">
                          {formatCurrency(0, admin.currencySymbol)}
                        </span>
                      )}
                    </td>

                    {/* Saldo Pendiente Renta */}
                    <td className="py-3 px-3 text-right font-semibold">
                      <span className={status.pendingRentBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
                      </span>
                    </td>

                    {/* Saldo Pendiente Utilidades */}
                    <td className="py-3 px-3 text-right font-semibold">
                      <span className={status.pendingUtilitiesBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {formatCurrency(status.pendingUtilitiesBalance, admin.currencySymbol)}
                      </span>
                    </td>

                    {/* Cargos Mora */}
                    <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400">
                      {status.totalLateFees > 0
                        ? formatCurrency(status.pendingLateFeesBalance, admin.currencySymbol)
                        : '-'}
                    </td>

                    {/* Saldo Pendiente Total */}
                    <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">
                      <span
                        className={
                          status.totalPendingBalance > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {formatCurrency(status.totalPendingBalance, admin.currencySymbol)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : status.isOverdue
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                        }`}
                      >
                        {isPaid
                          ? 'Al Día'
                          : status.isOverdue
                          ? `${status.daysOverdue}d mora`
                          : 'Pendiente'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenInvoice(status, 'current')}
                          className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                          title="Generar Factura / Recibo"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Doc</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Historial de Pagos Recibidos
            </h3>
            <p className="text-xs text-slate-500">
              Registros y comprobantes de abonos emitidos por inquilinos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por inquilino, ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Property Filter Dropdown */}
            <select
              value={selectedPropertyFilter}
              onChange={(e) => setSelectedPropertyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
            >
              <option value="all">Todas las propiedades</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyIdentifier}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto">
          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No se encontraron pagos con los filtros seleccionados.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-y border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Propiedad</th>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">Inquilino / Pagador</th>
                  <th className="py-2.5 px-3">Periodo</th>
                  <th className="py-2.5 px-3">Método / Ref</th>
                  <th className="py-2.5 px-3 text-right">Importe</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPayments.map((p) => {
                  const prop = properties.find((pr) => pr.id === p.propertyId);
                  const admin = getAdministratorForProperty(prop, administrators);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(p.date)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {prop?.propertyIdentifier || 'Propiedad'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-300 rounded font-bold text-[10px]">
                          {admin.companyName.slice(0, 16)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        {p.payerName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{p.period}</td>
                      <td className="py-2.5 px-3">
                        <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                          {p.paymentMethod}
                        </span>
                        {p.reference && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {p.reference}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.amount, admin.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditPayment(p)}
                            className="p-1 text-slate-500 hover:text-sky-600 rounded transition cursor-pointer"
                            title="Editar este pago"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPaymentToDelete(p)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Eliminar este pago"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Payment Modal */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Eliminar registro de pago?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estás a punto de eliminar el pago de{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatCurrency(paymentToDelete.amount)}
                  </strong>{' '}
                  realizado por{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {paymentToDelete.payerName}
                  </strong>{' '}
                  correspondiente al periodo{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {paymentToDelete.period}
                  </strong>
                  .
                </p>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] mt-2.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Esta acción recalculará los balances pendientes de la propiedad.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Sí, Eliminar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
