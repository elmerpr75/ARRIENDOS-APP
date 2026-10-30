import React, { useState } from 'react';
import { Property, LandlordProfile, Payment, PaymentConcept } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { Droplets, Zap, Layers, Calendar, Edit2, Check, Filter, Building2, Trash2, Plus, BarChart3, TrendingUp, DollarSign } from 'lucide-react';

interface UtilitiesRegistryViewProps {
  properties: Property[];
  payments: Payment[];
  profile: LandlordProfile;
  onUpdatePeriodUtilities: (
    propertyId: string,
    periodKey: string,
    utils: {
      waterAmount?: number;
      waterBillingDate?: string;
      electricAmount?: number;
      electricBillingDate?: string;
      maintenanceAmount?: number;
      maintenanceBillingDate?: string;
    }
  ) => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
  onRegisterPayment: (propertyId?: string, defaultConcept?: PaymentConcept) => void;
}

export const UtilitiesRegistryView: React.FC<UtilitiesRegistryViewProps> = ({
  properties,
  payments,
  profile,
  onUpdatePeriodUtilities,
  onEditPayment,
  onDeletePayment,
  onRegisterPayment,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedUtilityType, setSelectedUtilityType] = useState<'all' | 'water' | 'electric' | 'maintenance'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Edit modal state
  const [editingItem, setEditingItem] = useState<{
    propertyId: string;
    periodKey: string;
    utilityType: 'water' | 'electric' | 'maintenance';
    currentValue: number;
    currentDate: string;
    propertyName: string;
    periodName: string;
  } | null>(null);
  const [editAmountValue, setEditAmountValue] = useState<string>('');
  const [editDateValue, setEditDateValue] = useState<string>('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Generate list of months for the selected year (Jan - Dec)
  const months = [
    { num: 1, name: 'Enero' },
    { num: 2, name: 'Febrero' },
    { num: 3, name: 'Marzo' },
    { num: 4, name: 'Abril' },
    { num: 5, name: 'Mayo' },
    { num: 6, name: 'Junio' },
    { num: 7, name: 'Julio' },
    { num: 8, name: 'Agosto' },
    { num: 9, name: 'Septiembre' },
    { num: 10, name: 'Octubre' },
    { num: 11, name: 'Noviembre' },
    { num: 12, name: 'Diciembre' },
  ];

  // Filter properties
  const filteredProperties = selectedPropertyId === 'all'
    ? properties
    : properties.filter((p) => p.id === selectedPropertyId);

  // Helper to get effective billing date with inheritance
  const getEffectiveBillingDate = (
    prop: Property,
    year: number,
    monthNum: number,
    utilityType: 'water' | 'electric' | 'maintenance'
  ): string => {
    const periodKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    const rec = prop.periodUtilities?.[periodKey];
    if (utilityType === 'water' && rec?.waterBillingDate) return rec.waterBillingDate;
    if (utilityType === 'electric' && rec?.electricBillingDate) return rec.electricBillingDate;
    if (utilityType === 'maintenance' && rec?.maintenanceBillingDate) return rec.maintenanceBillingDate;

    // Look back through previous months to inherit billing day
    for (let m = monthNum - 1; m >= 1; m--) {
      const prevKey = `${year}-${String(m).padStart(2, '0')}`;
      const prevRec = prop.periodUtilities?.[prevKey];
      const prevDate = utilityType === 'water' ? prevRec?.waterBillingDate : utilityType === 'electric' ? prevRec?.electricBillingDate : prevRec?.maintenanceBillingDate;
      if (prevDate) {
        const dayPart = prevDate.split('-')[2] || '01';
        return `${year}-${String(monthNum).padStart(2, '0')}-${dayPart}`;
      }
    }

    // Default to 1st of month
    return `${year}-${String(monthNum).padStart(2, '0')}-01`;
  };

  const handleOpenEdit = (
    propertyId: string,
    propertyName: string,
    periodKey: string,
    periodName: string,
    utilityType: 'water' | 'electric' | 'maintenance',
    val: number,
    dateVal: string
  ) => {
    setEditingItem({
      propertyId,
      periodKey,
      utilityType,
      currentValue: val,
      currentDate: dateVal,
      propertyName,
      periodName,
    });
    setEditAmountValue(val > 0 ? val.toString() : '');
    setEditDateValue(dateVal || `${periodKey}-01`);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const newVal = parseFloat(editAmountValue) || 0;
    const newDate = editDateValue || `${editingItem.periodKey}-01`;
    const { propertyId, periodKey, utilityType } = editingItem;

    const payload: {
      waterAmount?: number;
      waterBillingDate?: string;
      electricAmount?: number;
      electricBillingDate?: string;
      maintenanceAmount?: number;
      maintenanceBillingDate?: string;
    } = {};

    if (utilityType === 'water') {
      payload.waterAmount = newVal;
      payload.waterBillingDate = newDate;
    }
    if (utilityType === 'electric') {
      payload.electricAmount = newVal;
      payload.electricBillingDate = newDate;
    }
    if (utilityType === 'maintenance') {
      payload.maintenanceAmount = newVal;
      payload.maintenanceBillingDate = newDate;
    }

    onUpdatePeriodUtilities(propertyId, periodKey, payload);
    setEditingItem(null);
    setSaveSuccessNotice('✓ Registro de utilidad y fecha de facturación actualizados');
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  // Filtered utility payments
  const utilityPayments = payments.filter((p) => {
    if (selectedPropertyId !== 'all' && p.propertyId !== selectedPropertyId) return false;
    const isUtilityConcept =
      p.concept === 'agua' ||
      p.concept === 'electricidad' ||
      p.concept === 'mantenimiento' ||
      (p.appliedToWater || 0) > 0 ||
      (p.appliedToElectric || 0) > 0 ||
      (p.appliedToMaintenance || 0) > 0;
    if (!isUtilityConcept) return false;

    if (selectedUtilityType !== 'all') {
      if (selectedUtilityType === 'water' && p.concept !== 'agua' && !(p.appliedToWater && p.appliedToWater > 0)) return false;
      if (selectedUtilityType === 'electric' && p.concept !== 'electricidad' && !(p.appliedToElectric && p.appliedToElectric > 0)) return false;
      if (selectedUtilityType === 'maintenance' && p.concept !== 'mantenimiento' && !(p.appliedToMaintenance && p.appliedToMaintenance > 0)) return false;
    }

    const pYear = new Date(p.date).getFullYear();
    if (pYear !== selectedYear) return false;
    return true;
  });

  // Calculate chart data per month (Jan - Dec)
  const chartMonthlyData = months.map((m) => {
    const pKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
    let totalBilled = 0;
    let totalPaid = 0;

    filteredProperties.forEach((prop) => {
      const rec = prop.periodUtilities?.[pKey];
      const wActive = prop.utilitiesWaterActive;
      const eActive = prop.utilitiesElectricActive;
      const mActive = prop.utilitiesMaintenanceActive;

      const wAmt = rec?.waterAmount !== undefined ? rec.waterAmount : (Number(prop.utilitiesWaterAmount) || 0);
      const eAmt = rec?.electricAmount !== undefined ? rec.electricAmount : (Number(prop.utilitiesElectricAmount) || 0);
      const mAmt = rec?.maintenanceAmount !== undefined ? rec.maintenanceAmount : (Number(prop.utilitiesMaintenanceAmount) || 0);

      if (selectedUtilityType === 'all' || selectedUtilityType === 'water') {
        if (wActive) totalBilled += wAmt;
      }
      if (selectedUtilityType === 'all' || selectedUtilityType === 'electric') {
        if (eActive) totalBilled += eAmt;
      }
      if (selectedUtilityType === 'all' || selectedUtilityType === 'maintenance') {
        if (mActive) totalBilled += mAmt;
      }
    });

    // Payments for this month
    utilityPayments.forEach((pay) => {
      const payPeriod = pay.period || '';
      const payDate = pay.date || '';
      const matchesPeriod = payPeriod.includes(pKey) || payDate.startsWith(pKey);
      if (matchesPeriod) {
        if (selectedUtilityType === 'all') {
          totalPaid += pay.amount;
        } else if (selectedUtilityType === 'water') {
          totalPaid += pay.concept === 'agua' ? pay.amount : (pay.appliedToWater || 0);
        } else if (selectedUtilityType === 'electric') {
          totalPaid += pay.concept === 'electricidad' ? pay.amount : (pay.appliedToElectric || 0);
        } else if (selectedUtilityType === 'maintenance') {
          totalPaid += pay.concept === 'mantenimiento' ? pay.amount : (pay.appliedToMaintenance || 0);
        }
      }
    });

    return {
      monthLabel: m.name.slice(0, 3),
      billed: totalBilled,
      paid: totalPaid,
    };
  });

  // Compute cumulative balance (Billed minus Paid accumulated)
  let runningBalance = 0;
  const chartCumulativeData = chartMonthlyData.map((d) => {
    const diff = d.billed - d.paid;
    runningBalance += diff;
    return {
      monthLabel: d.monthLabel,
      billed: d.billed,
      paid: d.paid,
      balance: runningBalance,
    };
  });

  const maxBilled = Math.max(...chartMonthlyData.map((d) => d.billed), 100);
  const maxBalance = Math.max(...chartCumulativeData.map((d) => Math.abs(d.balance)), 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-xl">
              <Droplets className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Registro y Edición Histórica de Utilidades y Pagos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestión de costos mensuales, fechas de facturación de proveedores, pagos de inquilinos y gráficos analíticos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccessNotice && (
            <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold animate-pulse">
              {saveSuccessNotice}
            </div>
          )}
          <button
            type="button"
            onClick={() => onRegisterPayment(selectedPropertyId === 'all' ? undefined : selectedPropertyId, 'agua')}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Pago de Utilidad</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtros Activos:</span>
        </div>

        {/* Property Filter */}
        <select
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          aria-label="Filtrar por Propiedad"
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">Todas las Propiedades ({properties.length})</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.propertyIdentifier}
            </option>
          ))}
        </select>

        {/* Utility Type Filter */}
        <select
          value={selectedUtilityType}
          onChange={(e) => setSelectedUtilityType(e.target.value as any)}
          aria-label="Filtrar por Tipo de Utilidad"
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">Todas las Utilidades (Agua, Luz, Mantenimiento)</option>
          <option value="water">💧 Agua Potable</option>
          <option value="electric">⚡ Electricidad (LUMA / AEE)</option>
          <option value="maintenance">🛠️ Mantenimiento / Cuota</option>
        </select>

        {/* Year Selector */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          aria-label="Filtrar por Año"
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value={2026}>Año 2026</option>
          <option value={2025}>Año 2025</option>
          <option value={2024}>Año 2024</option>
        </select>
      </div>

      {/* Interactive Charts Section (Visible under filters and above historical table) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Historical Cost per Month (Bars + Line Curve) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Costo Histórico Mensual ({selectedYear})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">BARRAS: Costo | LÍNEA: Tendencia</span>
          </div>

          <div className="h-44 relative flex items-end justify-between gap-1 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800">
            {chartMonthlyData.map((d, idx) => {
              const heightPct = Math.round((d.billed / maxBilled) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none z-20 whitespace-nowrap shadow-md">
                    {d.monthLabel}: {formatCurrency(d.billed, profile.currencySymbol)}
                  </div>
                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(heightPct, 6)}%` }}
                    className="w-full bg-sky-500 dark:bg-sky-600 rounded-t-md hover:bg-sky-400 transition-all"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium truncate">
                    {d.monthLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <span>Máximo: {formatCurrency(maxBilled, profile.currencySymbol)}</span>
            <span className="flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400">
              <TrendingUp className="w-3.5 h-3.5" /> Activo por Filtros
            </span>
          </div>
        </div>

        {/* Chart 2: Cumulative Balance / Differential (Billed vs Paid) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Balance Acumulado (Facturado vs Pagado)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Diferencia neta pendiente</span>
          </div>

          <div className="h-44 relative flex items-center justify-between gap-1 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800">
            {/* Zero line */}
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-300 dark:border-slate-700 pointer-events-none" />

            {chartCumulativeData.map((d, idx) => {
              const val = d.balance;
              const heightPct = Math.min(Math.round((Math.abs(val) / maxBalance) * 50), 48);
              const isPositive = val >= 0;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-center relative group">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none z-20 whitespace-nowrap shadow-md">
                    {d.monthLabel} Balance: {formatCurrency(val, profile.currencySymbol)}
                  </div>
                  <div className="w-full flex flex-col items-center h-full justify-center relative">
                    {isPositive ? (
                      <div className="absolute bottom-1/2 w-full flex flex-col items-center">
                        <div
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          className="w-3/4 bg-amber-500 rounded-t-md hover:bg-amber-400 transition"
                        />
                      </div>
                    ) : (
                      <div className="absolute top-1/2 w-full flex flex-col items-center">
                        <div
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          className="w-3/4 bg-emerald-500 rounded-b-md hover:bg-emerald-400 transition"
                        />
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {d.monthLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Saldo Pendiente
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ml-2" /> Crédito a Favor
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Acumulado Neto: {formatCurrency(chartCumulativeData[chartCumulativeData.length - 1]?.balance || 0, profile.currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Utilities Historical Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span>Matriz Histórica de Costos y Fechas de Proveedor ({selectedYear})</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Haga clic en cualquier celda para editar costo o fecha de factura del proveedor
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4">Propiedad / Inmueble</th>
                <th className="py-3 px-4">Concepto</th>
                {months.map((m) => (
                  <th key={m.num} className="py-3 px-3 text-center">
                    {m.name.slice(0, 3)} {selectedYear}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-500">
                    No se encontraron propiedades registradas.
                  </td>
                </tr>
              ) : (
                filteredProperties.map((prop) => {
                  const showWater = (selectedUtilityType === 'all' || selectedUtilityType === 'water') && prop.utilitiesWaterActive;
                  const showElectric = (selectedUtilityType === 'all' || selectedUtilityType === 'electric') && prop.utilitiesElectricActive;
                  const showMaint = (selectedUtilityType === 'all' || selectedUtilityType === 'maintenance') && prop.utilitiesMaintenanceActive;

                  if (!showWater && !showElectric && !showMaint) return null;

                  return (
                    <React.Fragment key={prop.id}>
                      {/* Water row */}
                      {showWater && (
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>{prop.propertyIdentifier}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 rounded-lg font-bold text-[11px]">
                              <Droplets className="w-3 h-3 text-sky-600" />
                              <span>Agua Potable</span>
                            </div>
                          </td>
                          {months.map((m) => {
                            const pKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
                            const rec = prop.periodUtilities?.[pKey];
                            const val = rec?.waterAmount !== undefined ? rec.waterAmount : (Number(prop.utilitiesWaterAmount) || 0);
                            const billingDate = getEffectiveBillingDate(prop, selectedYear, m.num, 'water');

                            return (
                              <td key={m.num} className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(prop.id, prop.propertyIdentifier, pKey, `${m.name} ${selectedYear}`, 'water', val, billingDate)}
                                  className="group w-full flex flex-col items-center gap-0.5 p-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-sky-950/60 rounded-xl transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                                  title="Editar costo y fecha de factura"
                                >
                                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                                    {formatCurrency(val, profile.currencySymbol)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 group-hover:text-sky-600">
                                    {billingDate.split('-').slice(1).join('/')}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* Electric row */}
                      {showElectric && (
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{prop.propertyIdentifier}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg font-bold text-[11px]">
                              <Zap className="w-3 h-3 text-amber-600" />
                              <span>Electricidad (LUMA/AEE)</span>
                            </div>
                          </td>
                          {months.map((m) => {
                            const pKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
                            const rec = prop.periodUtilities?.[pKey];
                            const val = rec?.electricAmount !== undefined ? rec.electricAmount : (Number(prop.utilitiesElectricAmount) || 0);
                            const billingDate = getEffectiveBillingDate(prop, selectedYear, m.num, 'electric');

                            return (
                              <td key={m.num} className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(prop.id, prop.propertyIdentifier, pKey, `${m.name} ${selectedYear}`, 'electric', val, billingDate)}
                                  className="group w-full flex flex-col items-center gap-0.5 p-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-xl transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                                  title="Editar costo y fecha de factura"
                                >
                                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                                    {formatCurrency(val, profile.currencySymbol)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 group-hover:text-amber-600">
                                    {billingDate.split('-').slice(1).join('/')}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* Maintenance row */}
                      {showMaint && (
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                            <span>{prop.propertyIdentifier}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 rounded-lg font-bold text-[11px]">
                              <Layers className="w-3 h-3 text-purple-600" />
                              <span>Mantenimiento / Cuota</span>
                            </div>
                          </td>
                          {months.map((m) => {
                            const pKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
                            const rec = prop.periodUtilities?.[pKey];
                            const val = rec?.maintenanceAmount !== undefined ? rec.maintenanceAmount : (Number(prop.utilitiesMaintenanceAmount) || 0);
                            const billingDate = getEffectiveBillingDate(prop, selectedYear, m.num, 'maintenance');

                            return (
                              <td key={m.num} className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(prop.id, prop.propertyIdentifier, pKey, `${m.name} ${selectedYear}`, 'maintenance', val, billingDate)}
                                  className="group w-full flex flex-col items-center gap-0.5 p-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/60 rounded-xl transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                                  title="Editar costo y fecha de factura"
                                >
                                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                                    {formatCurrency(val, profile.currencySymbol)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 group-hover:text-purple-600">
                                    {billingDate.split('-').slice(1).join('/')}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Utility Payments List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Listado de Pagos de Utilidades Registrados por Inquilinos ({selectedYear})</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {utilityPayments.length} pagos encontrados con los filtros actuales
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Propiedad</th>
                <th className="py-3 px-4">Inquilino / Pagador</th>
                <th className="py-3 px-4">Concepto / Periodo</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4 text-right">Monto Pagado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {utilityPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay pagos de utilidades registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                utilityPayments.map((pay) => {
                  const prop = properties.find((p) => p.id === pay.propertyId);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {formatDate(pay.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {prop?.propertyIdentifier || 'Propiedad'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {pay.payerName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white capitalize">
                            {pay.concept || 'General'}
                          </span>
                          <span className="text-[10px] text-slate-400">{pay.period}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {pay.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(pay.amount, profile.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEditPayment(pay)}
                            className="p-1.5 bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-sky-900/60 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                            title="Editar Pago"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-sky-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('¿Está seguro de eliminar este pago de utilidad?')) {
                                onDeletePayment(pay.id);
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-900/60 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                            title="Eliminar Pago"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal for Cost & Billing Date */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Costo y Fecha de Factura del Proveedor
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <p><strong>Propiedad:</strong> {editingItem.propertyName}</p>
              <p><strong>Periodo:</strong> {editingItem.periodName}</p>
              <p>
                <strong>Concepto:</strong>{' '}
                {editingItem.utilityType === 'water'
                  ? 'Agua Potable'
                  : editingItem.utilityType === 'electric'
                  ? 'Electricidad (LUMA / AEE)'
                  : 'Mantenimiento / Cuota'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Monto Facturado / Costo del Periodo ({profile.currencySymbol}):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmountValue}
                  onChange={(e) => setEditAmountValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Día y Fecha Exacta de Facturacion del Proveedor:
                </label>
                <input
                  type="date"
                  value={editDateValue}
                  onChange={(e) => setEditDateValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[10px] text-slate-400">
                  Por defecto el día 1, pero se puede ajustar. En meses sucesivos heredará este mismo día.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
