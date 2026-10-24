import React, { useState } from 'react';
import { Property, Payment, LandlordProfile, PropertyFinancialStatus, Administrator } from '../types';
import { calculatePropertyStatus, formatCurrency, formatDate } from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import { downloadElementAsPdf, printElementSafely } from '../utils/pdfGenerator';
import {
  Printer,
  Download,
  Search,
  Building2,
  FileSpreadsheet,
  Loader2,
  Check,
  Filter,
  Layers,
  FileText,
  PieChart,
  DollarSign,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

interface StatusReportViewProps {
  properties: Property[];
  payments: Payment[];
  profile: LandlordProfile;
  administrators?: Administrator[];
  onOpenInvoice: (status: PropertyFinancialStatus, mode?: 'current' | 'next_month') => void;
}

export const StatusReportView: React.FC<StatusReportViewProps> = ({
  properties,
  payments,
  profile,
  administrators = [],
  onOpenInvoice,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'ok' | 'contract_renewal'>('all');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('all');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('all');
  const [selectedAdminFilter, setSelectedAdminFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const statuses = properties.map((p) => calculatePropertyStatus(p, payments));

  const effectiveAdmins = administrators.length > 0 ? administrators : [
    {
      id: 'admin-1',
      companyName: profile.companyName || 'Inmobiliaria Premier',
      landlordName: profile.landlordName || 'Administración',
      taxId: profile.taxId || '',
      phone: profile.phone || '',
      email: profile.email || '',
      address: profile.address || '',
      bankDetails: profile.bankDetails || '',
      invoiceNote: profile.invoiceNote || '',
      currencyCode: 'USD',
      currencySymbol: '$',
      isDefault: true,
    },
  ];

  // Active single admin if filtered
  const activeAdmin =
    selectedAdminFilter === 'all'
      ? null
      : effectiveAdmins.find((a) => a.id === selectedAdminFilter) || null;

  // Filtered properties
  const filteredStatuses = statuses.filter((s) => {
    const prop = s.property;
    const defaultId = effectiveAdmins[0]?.id || 'admin-1';
    const propAdminId = prop.administratorId || defaultId;

    if (selectedAdminFilter !== 'all' && propAdminId !== selectedAdminFilter) {
      return false;
    }

    if (propertyStatusFilter !== 'all') {
      const propStatus = prop.status || 'rentado';
      if (propStatus !== propertyStatusFilter) return false;
    }

    if (selectedPropertyFilter !== 'all') {
      if (prop.id !== selectedPropertyFilter) return false;
    }

    const matchesSearch =
      prop.propertyIdentifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.tenant1.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prop.tenant2?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.address.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filterStatus === 'pending') {
      matchesFilter = s.totalPendingBalance > 0;
    } else if (filterStatus === 'ok') {
      matchesFilter = s.totalPendingBalance <= 0;
    } else if (filterStatus === 'contract_renewal') {
      matchesFilter = s.contractDaysLeft <= 60;
    }

    return matchesSearch && matchesFilter;
  });

  // Groups of properties per administrator
  const adminGroups = effectiveAdmins
    .filter((admin) => selectedAdminFilter === 'all' || admin.id === selectedAdminFilter)
    .map((admin) => {
      const adminItems = filteredStatuses.filter((s) => {
        const defaultId = effectiveAdmins[0]?.id || 'admin-1';
        return (s.property.administratorId || defaultId) === admin.id;
      });

      const totalRent = adminItems.reduce((sum, s) => sum + s.currentMonthRentCharge, 0);
      const totalUtilities = adminItems.reduce((sum, s) => sum + s.totalUtilitiesAmount, 0);
      const totalBilled = adminItems.reduce((sum, s) => sum + s.totalBilledThisMonth, 0);
      const totalPaid = adminItems.reduce((sum, s) => sum + s.totalPaidThisMonth, 0);
      const totalReceivables = adminItems.reduce((sum, s) => sum + s.totalPendingBalance, 0);
      const totalReceivablesRent = adminItems.reduce((sum, s) => sum + s.pendingRentBalance, 0);
      const totalReceivablesUtilities = adminItems.reduce((sum, s) => sum + s.pendingUtilitiesBalance, 0);
      const totalLateFees = adminItems.reduce((sum, s) => sum + s.pendingLateFeesBalance, 0);
      const collectionRate =
        totalBilled > 0 ? Math.min(100, Math.round((totalPaid / totalBilled) * 100)) : 0;

      return {
        admin,
        items: adminItems,
        totalRent,
        totalUtilities,
        totalBilled,
        totalPaid,
        totalReceivables,
        totalReceivablesRent,
        totalReceivablesUtilities,
        totalLateFees,
        collectionRate,
      };
    })
    .filter((g) => g.items.length > 0 || selectedAdminFilter !== 'all');

  // Executive Financial Recount Metrics
  // Exclude administrative umbrella properties ('multifamiliar') from occupancy rate & potential rent
  const rentEligibleProps = properties.filter(
    (p) => (p.status || 'rentado') !== 'multifamiliar'
  );
  const occupiedProps = rentEligibleProps.filter(
    (p) => (p.status || 'rentado') === 'rentado'
  );
  const occupancyRate =
    rentEligibleProps.length > 0
      ? Math.round((occupiedProps.length / rentEligibleProps.length) * 100)
      : 0;
  const multifamiliarCount = properties.length - rentEligibleProps.length;

  // Potential Monthly Base Rent (sum of rentAmount for rent-eligible properties)
  const potentialMonthlyIncome = rentEligibleProps.reduce(
    (sum, p) => sum + (Number(p.rentAmount) || 0),
    0
  );

  // Total Overdue Payments
  const totalOverdueAmount = statuses
    .filter((s) => s.isOverdue)
    .reduce((sum, s) => sum + s.totalPendingBalance, 0);

  // Overall Collection Effectiveness (%)
  const totalGlobalBilled = statuses.reduce((sum, s) => sum + s.totalBilledThisMonth, 0);
  const totalGlobalCollected = statuses.reduce((sum, s) => sum + s.totalPaidThisMonth, 0);
  const historicalCollectionEffectiveness =
    totalGlobalBilled > 0
      ? Math.min(100, Math.round((totalGlobalCollected / totalGlobalBilled) * 100))
      : 100;

  const activeCurrencySymbol =
    selectedAdminFilter !== 'all' && activeAdmin
      ? activeAdmin.currencySymbol
      : effectiveAdmins[0]?.currencySymbol || '$';

  const reportFilename = `Reporte-Arrendamientos-${selectedAdminFilter !== 'all' && activeAdmin ? activeAdmin.companyName.replace(/\s+/g, '_') : 'General'}-${new Date().toISOString().split('T')[0]}`;

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfSuccess(false);
    const success = await downloadElementAsPdf('printable-report', reportFilename);
    setIsGeneratingPdf(false);
    if (success) {
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    }
  };

  const handlePrint = () => {
    printElementSafely('printable-report', reportFilename);
  };

  const reportDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="no-print bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-sky-600" />
            Estados de Cuenta & Reporte Ejecutivo de Arrendamientos
          </h2>
          <p className="text-xs text-slate-500">
            Segregado por Empresa Administradora con subtotales y monedas independientes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Direct PDF Download Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Descargar reporte en formato PDF"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : pdfSuccess ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isGeneratingPdf ? 'Generando PDF...' : pdfSuccess ? '¡PDF Descargado!' : 'Descargar PDF'}
            </span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            title="Imprimir documento"
          >
            <Printer className="w-4 h-4" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Administrator Filter Tabs */}
      {effectiveAdmins.length > 1 && (
        <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-500" />
              Segregar Reporte por Empresa Administradora
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">
              {effectiveAdmins.length} empresas disponibles
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

            {effectiveAdmins.map((admin) => {
              const defaultId = effectiveAdmins[0]?.id || 'admin-1';
              const pCount = properties.filter((p) => (p.administratorId || defaultId) === admin.id).length;
              return (
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
                  <span className="text-[10px] opacity-75">({pCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters (Hidden on print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative min-w-[180px] sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar por inquilino, propiedad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Dropdown Estatus Propiedad */}
          <select
            value={propertyStatusFilter}
            onChange={(e) => setPropertyStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="all">🏷️ Estatus: Todos</option>
            <option value="rentado">🟢 Rentado</option>
            <option value="vacante">⚪ Vacante</option>
            <option value="en_mantenimiento">🟡 En Mantenimiento</option>
            <option value="en_proceso_legal">🔴 En Proceso Legal</option>
            <option value="multifamiliar">🟣 Multi-familiar</option>
          </select>

          {/* Dropdown Propiedad Definida */}
          <select
            value={selectedPropertyFilter}
            onChange={(e) => setSelectedPropertyFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer max-w-[220px] truncate"
          >
            <option value="all">🏠 Propiedad: Todas ({properties.length})</option>
            {properties
              .filter((p) => selectedAdminFilter === 'all' || (p.administratorId || 'admin-1') === selectedAdminFilter)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyIdentifier} - {p.tenant1?.name || 'Sin inquilino'}
                </option>
              ))}
          </select>

          {(propertyStatusFilter !== 'all' || selectedPropertyFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setPropertyStatusFilter('all');
                setSelectedPropertyFilter('all');
              }}
              className="px-2 py-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-600 dark:text-slate-400">Ver:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Todas ({filteredStatuses.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterStatus === 'pending'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Con Deuda ({filteredStatuses.filter((s) => s.totalPendingBalance > 0).length})
            </button>
            <button
              onClick={() => setFilterStatus('ok')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterStatus === 'ok'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Al Día ({filteredStatuses.filter((s) => s.totalPendingBalance <= 0).length})
            </button>
            <button
              onClick={() => setFilterStatus('contract_renewal')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                filterStatus === 'contract_renewal'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Por Renovar ({filteredStatuses.filter((s) => s.contractDaysLeft <= 60).length})
            </button>
          </div>
        </div>
      </div>

      {/* REPORT CONTENT AREA (Optimized for Screen & Print & PDF) */}
      <div
        id="printable-report"
        className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs print:border-none print:p-0 print:shadow-none space-y-6"
      >
        {/* Main Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-4 gap-4">
          <div className="flex items-center gap-4">
            {activeAdmin?.logoUrl || profile.logoUrl ? (
              <img
                src={activeAdmin?.logoUrl || profile.logoUrl}
                alt="Logo Empresa"
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center p-2.5 shadow-md shrink-0">
                <Building2 className="w-8 h-8 text-sky-400" />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase text-slate-900 tracking-tight">
                {activeAdmin ? activeAdmin.companyName : profile.companyName}
              </h1>
              <p className="text-xs text-slate-600">
                {activeAdmin ? activeAdmin.landlordName : profile.landlordName} • Tel:{' '}
                {activeAdmin ? activeAdmin.phone : profile.phone} • RFC:{' '}
                {activeAdmin ? activeAdmin.taxId : profile.taxId}
              </p>
              <p className="text-xs text-slate-500">
                {activeAdmin ? activeAdmin.address : profile.address}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider mb-1">
              {activeAdmin
                ? `Estado de Cuenta - ${activeAdmin.companyName}`
                : 'Reporte General de Cartera por Empresa'}
            </span>
            <p className="text-xs text-slate-600">
              Fecha: <strong className="capitalize">{reportDate}</strong>
            </p>
            <p className="text-xs text-slate-500">
              Total Inmuebles Evaluados: {filteredStatuses.length}
            </p>
          </div>
        </div>

        {/* Recuento Financiero Ejecutivo Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          {/* Card 1: Tasa de Ocupación */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-sky-600" />
                Tasa de Ocupación
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded font-extrabold">
                {occupancyRate}%
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {occupancyRate}%
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              {occupiedProps.length} de {rentEligibleProps.length} unidades rentables
              {multifamiliarCount > 0 ? ` (${multifamiliarCount} sombrilla${multifamiliarCount > 1 ? 's' : ''} excl.)` : ''}
            </p>
          </div>

          {/* Card 2: Ingreso Potencial Mensual */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Ingreso Potencial Mensual
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatCurrency(potentialMonthlyIncome, activeCurrencySymbol)}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              Renta base al 100% de ocupación
            </p>
          </div>

          {/* Card 3: Total Pagos Vencidos */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Total Pagos Vencidos
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-600">
              {formatCurrency(totalOverdueAmount, activeCurrencySymbol)}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              Suma de saldos con mora y retraso
            </p>
          </div>

          {/* Card 4: Efectividad Histórica de Cobranza */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                Efectividad de Cobranza
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-extrabold">
                {historicalCollectionEffectiveness}%
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-indigo-900">
              {historicalCollectionEffectiveness}%
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              Cobrado vs facturado en período
            </p>
          </div>
        </div>

        {/* SEGREGATED SECTIONS: ONE BLOCK PER ADMINISTRATOR */}
        {adminGroups.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No se encontraron propiedades bajo los filtros actuales.
          </div>
        ) : (
          adminGroups.map((group) => {
            const { admin, items, totalBilled, totalPaid, totalReceivables, totalLateFees, collectionRate } =
              group;

            return (
              <div
                key={`admin-report-group-${admin.id}`}
                className="space-y-4 pt-2 border-b-2 border-dashed border-slate-200 pb-6 last:border-b-0"
              >
                {/* Administrator Group Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    {admin.logoUrl ? (
                      <img
                        src={admin.logoUrl}
                        alt=""
                        className="w-10 h-10 object-contain rounded-lg bg-white border border-slate-200 p-0.5 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-sky-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase">
                        {admin.companyName}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {admin.landlordName || 'Representante'} • Tel: {admin.phone || 'S/N'} • RFC:{' '}
                        {admin.taxId || 'S/N'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-black rounded-lg border border-sky-200">
                      Moneda: {admin.currencySymbol} ({admin.currencyCode})
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      ({items.length} propiedades)
                    </span>
                  </div>
                </div>

                {/* Subtotals for this Administrator */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Facturación Mensual
                    </span>
                    <span className="text-base font-black text-slate-900 block truncate">
                      {formatCurrency(totalBilled, admin.currencySymbol)}
                    </span>
                    <span className="block text-[9px] text-slate-400">Renta programada</span>
                  </div>

                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                      Cobranza Realizada
                    </span>
                    <span className="text-base font-black text-emerald-600 block truncate">
                      {formatCurrency(totalPaid, admin.currencySymbol)}
                    </span>
                    <span className="block text-[9px] text-emerald-700">
                      Tasa de cobro: {collectionRate}%
                    </span>
                  </div>

                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-800 uppercase block">
                      Cuentas por Cobrar
                    </span>
                    <span className="text-base font-black text-rose-600 block truncate">
                      {formatCurrency(totalReceivables, admin.currencySymbol)}
                    </span>
                    <span className="block text-[9px] text-rose-700">Pendiente + moras</span>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">
                      Moras Acumuladas
                    </span>
                    <span className="text-base font-black text-amber-700 block truncate">
                      {formatCurrency(totalLateFees, admin.currencySymbol)}
                    </span>
                    <span className="block text-[9px] text-amber-700">Por días de atraso</span>
                  </div>
                </div>

                {/* Properties Table for this Administrator */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2 px-3">Propiedad</th>
                        <th className="py-2 px-3">Inquilino(s) & Contacto</th>
                        <th className="py-2 px-3 text-center">Vence Contrato</th>
                        <th className="py-2 px-3 text-right">Renta</th>
                        <th className="py-2 px-3 text-right">Utilidades</th>
                        <th className="py-2 px-3 text-right">Pagado Mes</th>
                        <th className="py-2 px-3 text-right">Saldo Renta</th>
                        <th className="py-2 px-3 text-right">Saldo Util.</th>
                        <th className="py-2 px-3 text-right">Mora</th>
                        <th className="py-2 px-3 text-right">Saldo Total</th>
                        <th className="py-2 px-3 text-center">Estatus</th>
                        <th className="py-2 px-3 text-center no-print">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((s) => {
                        const { property } = s;
                        const isPaid = s.totalPendingBalance <= 0;

                        return (
                          <tr key={`report-row-${property.id}`} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-900">{property.propertyIdentifier}</p>
                              <p className="text-[10px] text-slate-500">{property.address}</p>
                            </td>

                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-800">{property.tenant1.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {property.tenant1.phone}
                                {property.tenant2 ? ` • Co: ${property.tenant2.name}` : ''}
                              </p>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span className="font-medium">{formatDate(property.contractEndDate)}</span>
                              <span className="block text-[9px] text-slate-400">
                                {s.contractDaysLeft < 0 ? 'Vencido' : `${s.contractDaysLeft}d`}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                              {formatCurrency(property.rentAmount, admin.currencySymbol)}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              {s.totalUtilitiesAmount > 0 ? (
                                <div>
                                  <span className="font-semibold text-sky-800">
                                    {formatCurrency(s.totalUtilitiesAmount, admin.currencySymbol)}
                                  </span>
                                  <span className="block text-[9px] text-slate-400">
                                    💧{formatCurrency(s.waterAmount, admin.currencySymbol)} • ⚡{formatCurrency(s.electricAmount, admin.currencySymbol)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">No aplica</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                              {formatCurrency(s.totalPaidThisMonth, admin.currencySymbol)}
                            </td>

                            <td className="py-2.5 px-3 text-right font-semibold">
                              <span className={s.pendingRentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                {formatCurrency(s.pendingRentBalance, admin.currencySymbol)}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-semibold">
                              <span className={s.pendingUtilitiesBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                                {formatCurrency(s.pendingUtilitiesBalance, admin.currencySymbol)}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-medium text-amber-700">
                              {s.totalLateFees > 0
                                ? formatCurrency(s.pendingLateFeesBalance, admin.currencySymbol)
                                : '-'}
                            </td>

                            <td className="py-2.5 px-3 text-right font-black">
                              <span className={s.totalPendingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                {formatCurrency(s.totalPendingBalance, admin.currencySymbol)}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : s.isOverdue
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {isPaid ? 'Al Día' : s.isOverdue ? `${s.daysOverdue}d mora` : 'Pendiente'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center no-print">
                              <button
                                onClick={() => onOpenInvoice(s, 'current')}
                                className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 mx-auto"
                                title="Generar factura o recibo"
                              >
                                <FileText className="w-3 h-3" /> Doc
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Official Administrator Signature Block for this company */}
                {(admin.signatureUrl || profile.signatureUrl) && (
                  <div className="pt-3 pb-1 flex justify-end">
                    <div className="text-center w-56 border-t border-slate-300 pt-1.5">
                      <img
                        src={admin.signatureUrl || profile.signatureUrl}
                        alt="Firma Digital"
                        className="h-11 max-w-[180px] object-contain mx-auto mb-0.5"
                      />
                      <p className="font-bold text-xs text-slate-800">{admin.landlordName || admin.companyName}</p>
                      <p className="text-[10px] text-slate-500">
                        Firma Digital del Administrador • {admin.companyName}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Footer on print */}
        <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
          ARRIENDOS - Rent Manager • Documento informativo generado el {reportDate}
        </div>
      </div>
    </div>
  );
};
