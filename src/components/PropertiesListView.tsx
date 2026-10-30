import React, { useState, useMemo } from 'react';
import { Property, Payment, PropertyFinancialStatus, Administrator, Expense } from '../types';
import { calculatePropertyStatus, formatCurrency, formatDate } from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import {
  Building2,
  Plus,
  Search,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  Edit2,
  Trash2,
  Send,
  AlertCircle,
  X,
  Check,
  Layers,
  Droplets,
  Zap,
  Sliders,
  Receipt,
  Save,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';

interface PropertiesListViewProps {
  properties: Property[];
  payments: Payment[];
  expenses?: Expense[];
  administrators?: Administrator[];
  onAddProperty: () => void;
  onEditProperty: (property: Property) => void;
  onDeleteProperty: (propertyId: string) => void;
  onOpenInvoice: (status: PropertyFinancialStatus, mode?: 'current' | 'next_month') => void;
  onRegisterPayment: (propertyId: string, payerName: string, amount: number) => void;
  onOpenExpenses?: (property: Property) => void;
  onEditPayment?: (payment: Payment) => void;
  onUpdatePropertyAdministrator?: (propertyId: string, administratorId: string) => void;
  onUpdatePropertyUtilities?: (
    propertyId: string,
    waterAmount: number,
    electricAmount: number,
    waterActive?: boolean,
    electricActive?: boolean
  ) => void;
  onOpenReceipt?: (payment: Payment) => void;
}

export const PropertiesListView: React.FC<PropertiesListViewProps> = ({
  properties,
  payments,
  expenses = [],
  administrators = [],
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  onOpenInvoice,
  onRegisterPayment,
  onOpenExpenses,
  onEditPayment,
  onUpdatePropertyAdministrator,
  onUpdatePropertyUtilities,
  onOpenReceipt,
}) => {
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState<boolean>(false);
  const [selectedPropertyIdentifiers, setSelectedPropertyIdentifiers] = useState<string[]>([]);
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState<boolean>(false);
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<string>('all');
  const [propertySearch, setPropertySearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending_balance' | 'renewing' | 'paid'>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [selectingAdminForProp, setSelectingAdminForProp] = useState<Property | null>(null);
  const [viewingPaymentsProp, setViewingPaymentsProp] = useState<Property | null>(null);

  // Quick Utilities editing state
  const [editingUtilitiesProp, setEditingUtilitiesProp] = useState<Property | null>(null);
  const [quickWaterActive, setQuickWaterActive] = useState<boolean>(false);
  const [quickWaterAmount, setQuickWaterAmount] = useState<string>('');
  const [quickElectricActive, setQuickElectricActive] = useState<boolean>(false);
  const [quickElectricAmount, setQuickElectricAmount] = useState<string>('');

  const propertyStatuses = properties.map((p) => calculatePropertyStatus(p, payments));

  // Extract unique tenant names for multi-select dropdown, ordered A to Z
  const allTenants: string[] = Array.from<string>(
    new Set(
      properties
        .flatMap((p) => [p.tenant1.name, p.tenant2?.name || ''])
        .filter((n): n is string => Boolean(n && n.trim()))
    )
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  // Compute available property identifiers matching all OTHER active filters, ordered A to Z (ascending alphabetical order)
  const availablePropertyIdentifiers: string[] = useMemo(() => {
    const pTerm = propertySearch.trim().toLowerCase();
    const uniqueIdentifiers = new Set<string>();

    propertyStatuses.forEach((s) => {
      const prop = s.property;

      const matchesTenant =
        selectedTenants.length === 0 ||
        selectedTenants.some(
          (tName) =>
            prop.tenant1.name.toLowerCase() === tName.toLowerCase() ||
            (prop.tenant2?.name || '').toLowerCase() === tName.toLowerCase()
        );

      const matchesPropertyStatus =
        propertyStatusFilter === 'all' ||
        (prop.status || 'rentado') === propertyStatusFilter;

      const matchesPropertySearch =
        !pTerm ||
        prop.propertyIdentifier.toLowerCase().includes(pTerm) ||
        prop.address.toLowerCase().includes(pTerm) ||
        prop.tenant1.name.toLowerCase().includes(pTerm) ||
        (prop.tenant2?.name || '').toLowerCase().includes(pTerm);

      let matchesFilter = true;
      if (filter === 'overdue') {
        matchesFilter = s.isOverdue;
      } else if (filter === 'pending_balance') {
        matchesFilter = s.totalPendingBalance > 0;
      } else if (filter === 'renewing') {
        matchesFilter = s.contractDaysLeft <= 60;
      } else if (filter === 'paid') {
        matchesFilter = s.totalPendingBalance <= 0;
      }

      let matchesAdmin = true;
      if (adminFilter !== 'all') {
        const defaultId = administrators[0]?.id || 'admin-1';
        matchesAdmin = (prop.administratorId || defaultId) === adminFilter;
      }

      if (matchesTenant && matchesPropertyStatus && matchesPropertySearch && matchesFilter && matchesAdmin) {
        if (prop.propertyIdentifier && prop.propertyIdentifier.trim() !== '') {
          uniqueIdentifiers.add(prop.propertyIdentifier);
        }
      }
    });

    // Ordenados de la A a la Z (ascendente)
    return Array.from(uniqueIdentifiers).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [
    propertyStatuses,
    selectedTenants,
    propertyStatusFilter,
    propertySearch,
    filter,
    adminFilter,
    administrators,
  ]);

  const handleOpenQuickUtilities = (prop: Property) => {
    setEditingUtilitiesProp(prop);
    setQuickWaterActive(prop.utilitiesWaterActive ?? false);
    setQuickWaterAmount(prop.utilitiesWaterAmount !== undefined ? String(prop.utilitiesWaterAmount) : '');
    setQuickElectricActive(prop.utilitiesElectricActive ?? false);
    setQuickElectricAmount(prop.utilitiesElectricAmount !== undefined ? String(prop.utilitiesElectricAmount) : '');
  };

  const handleSaveQuickUtilities = () => {
    if (!editingUtilitiesProp || !onUpdatePropertyUtilities) return;
    const wAmount = parseFloat(quickWaterAmount) || 0;
    const eAmount = parseFloat(quickElectricAmount) || 0;
    onUpdatePropertyUtilities(
      editingUtilitiesProp.id,
      wAmount,
      eAmount,
      quickWaterActive,
      quickElectricActive
    );
    setEditingUtilitiesProp(null);
  };

  const filtered = propertyStatuses.filter((s) => {
    const prop = s.property;
    const pTerm = propertySearch.trim().toLowerCase();

    const matchesPropertyIdentifier =
      selectedPropertyIdentifiers.length === 0 ||
      selectedPropertyIdentifiers.includes(prop.propertyIdentifier);

    const matchesTenant =
      selectedTenants.length === 0 ||
      selectedTenants.some(
        (tName) =>
          prop.tenant1.name.toLowerCase() === tName.toLowerCase() ||
          (prop.tenant2?.name || '').toLowerCase() === tName.toLowerCase()
      );

    const matchesPropertyStatus =
      propertyStatusFilter === 'all' ||
      (prop.status || 'rentado') === propertyStatusFilter;

    const matchesProperty =
      !pTerm ||
      prop.propertyIdentifier.toLowerCase().includes(pTerm) ||
      prop.address.toLowerCase().includes(pTerm) ||
      prop.tenant1.name.toLowerCase().includes(pTerm) ||
      (prop.tenant2?.name || '').toLowerCase().includes(pTerm);

    let matchesFilter = true;
    if (filter === 'overdue') {
      matchesFilter = s.isOverdue;
    } else if (filter === 'pending_balance') {
      matchesFilter = s.totalPendingBalance > 0;
    } else if (filter === 'renewing') {
      matchesFilter = s.contractDaysLeft <= 60;
    } else if (filter === 'paid') {
      matchesFilter = s.totalPendingBalance <= 0;
    }

    let matchesAdmin = true;
    if (adminFilter !== 'all') {
      const defaultId = administrators[0]?.id || 'admin-1';
      matchesAdmin = (prop.administratorId || defaultId) === adminFilter;
    }

    return matchesPropertyIdentifier && matchesTenant && matchesPropertyStatus && matchesProperty && matchesFilter && matchesAdmin;
  });

  const cleanPhone = (phoneStr: string) => phoneStr.replace(/[^0-9]/g, '');

  const handleConfirmDelete = () => {
    if (propertyToDelete) {
      onDeleteProperty(propertyToDelete.id);
      setPropertyToDelete(null);
    }
  };

  const handleAssignAdmin = (newAdminId: string) => {
    if (selectingAdminForProp && onUpdatePropertyAdministrator) {
      onUpdatePropertyAdministrator(selectingAdminForProp.id, newAdminId);
      setSelectingAdminForProp(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Controls & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Search Input & New Property Button Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Property, Address or Tenant Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              id="property-search-input"
              type="text"
              placeholder="Buscar por propiedad, dirección o inquilino..."
              value={propertySearch}
              onChange={(e) => setPropertySearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            {propertySearch && (
              <button
                type="button"
                onClick={() => setPropertySearch('')}
                className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition"
                title="Borrar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* New Property Button */}
          <button
            onClick={onAddProperty}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Registrar Propiedad
          </button>
        </div>

        {/* Administrator Filter Tabs */}
        {administrators.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-[11px] text-slate-400 font-semibold shrink-0 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-sky-500" /> Empresa:
            </span>
            <button
              type="button"
              onClick={() => setAdminFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition shrink-0 cursor-pointer ${
                adminFilter === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todas ({properties.length})
            </button>
            {administrators.map((admin) => {
              const defaultId = administrators[0]?.id || 'admin-1';
              const count = properties.filter((p) => (p.administratorId || defaultId) === admin.id).length;
              return (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => setAdminFilter(admin.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    adminFilter === admin.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {admin.logoUrl ? (
                    <img src={admin.logoUrl} alt="" className="w-3.5 h-3.5 object-contain rounded-full bg-white" />
                  ) : (
                    <Building2 className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{admin.companyName}</span>
                  <span className="px-1 py-0.2 bg-white/20 rounded text-[9px] font-black">
                    {admin.currencySymbol}
                  </span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Property & Tenant Checkbox Dropdown & Property Status Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-Select Property Dropdown (Nombres de Propiedad - Z a A) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsPropertyDropdownOpen(!isPropertyDropdownOpen);
                  if (isTenantDropdownOpen) setIsTenantDropdownOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
                  selectedPropertyIdentifiers.length > 0
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-slate-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {selectedPropertyIdentifiers.length === 0
                    ? 'Filtrar por Propiedad (Todas) ▾'
                    : `${selectedPropertyIdentifiers.length} propiedad(es) ▾`}
                </span>
              </button>

              {isPropertyDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-30 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Propiedades ({availablePropertyIdentifiers.length})
                    </span>
                    <div className="flex items-center gap-2">
                      {availablePropertyIdentifiers.length > 0 && selectedPropertyIdentifiers.length < availablePropertyIdentifiers.length && (
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyIdentifiers([...availablePropertyIdentifiers])}
                          className="text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                        >
                          Todas
                        </button>
                      )}
                      {selectedPropertyIdentifiers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyIdentifiers([])}
                          className="text-rose-500 hover:underline font-semibold"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {availablePropertyIdentifiers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 p-2 text-center italic">
                        No hay propiedades que cumplan los demás filtros activos.
                      </p>
                    ) : (
                      availablePropertyIdentifiers.map((propIdentifier) => {
                        const isChecked = selectedPropertyIdentifiers.includes(propIdentifier);
                        return (
                          <label
                            key={propIdentifier}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPropertyIdentifiers([...selectedPropertyIdentifiers, propIdentifier]);
                                } else {
                                  setSelectedPropertyIdentifiers(
                                    selectedPropertyIdentifiers.filter((p) => p !== propIdentifier)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-slate-700"
                            />
                            <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                              {propIdentifier}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tenant Multi-Select Dropdown with Checkboxes */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsTenantDropdownOpen(!isTenantDropdownOpen);
                  if (isPropertyDropdownOpen) setIsPropertyDropdownOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
                  selectedTenants.length > 0
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {selectedTenants.length === 0
                    ? 'Filtrar por Inquilinos (Todos) ▾'
                    : `${selectedTenants.length} inquilino(s) ▾`}
                </span>
              </button>

              {isTenantDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-30 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Seleccionar Inquilinos</span>
                    {selectedTenants.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTenants([])}
                        className="text-sky-600 hover:underline font-semibold"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {allTenants.map((tenant) => {
                      const isChecked = selectedTenants.includes(tenant);
                      return (
                        <label
                          key={tenant}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTenants([...selectedTenants, tenant]);
                              } else {
                                setSelectedTenants(selectedTenants.filter((t) => t !== tenant));
                              }
                            }}
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                          />
                          <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                            {tenant}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Property Status Filter Dropdown */}
            <div className="relative">
              <select
                value={propertyStatusFilter}
                onChange={(e) => setPropertyStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <option value="all">🏷️ Estatus Propiedad: Todos</option>
                <option value="rentado">🟢 Rentado</option>
                <option value="vacante">⚪ Vacante</option>
                <option value="en_mantenimiento">🟡 En Mantenimiento</option>
                <option value="en_proceso_legal">🔴 En Proceso Legal</option>
                <option value="multifamiliar">🟣 Multi-familiar (Sombrilla Adm)</option>
              </select>
            </div>
          </div>

          {/* Quick Status Filter Pills */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Todas ({properties.length})
            </button>
            <button
              onClick={() => setFilter('overdue')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                filter === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Con Mora ({propertyStatuses.filter((s) => s.isOverdue).length})
            </button>
            <button
              onClick={() => setFilter('pending_balance')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                filter === 'pending_balance'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Con Balance Pendiente ({propertyStatuses.filter((s) => s.totalPendingBalance > 0).length})
            </button>
            <button
              onClick={() => setFilter('renewing')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                filter === 'renewing'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Por Renovar ({propertyStatuses.filter((s) => s.contractDaysLeft <= 60).length})
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                filter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Al Día ({propertyStatuses.filter((s) => s.totalPendingBalance <= 0).length})
            </button>
          </div>
        </div>

        {/* Active Filter Chips / Badges */}
        {(selectedPropertyIdentifiers.length > 0 || selectedTenants.length > 0 || propertyStatusFilter !== 'all' || adminFilter !== 'all' || filter !== 'all' || propertySearch.trim() !== '') && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              Filtros activos:
            </span>
            {selectedPropertyIdentifiers.map((pName) => (
              <span
                key={`chip-prop-${pName}`}
                className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800 font-medium flex items-center gap-1"
              >
                <span>🏢 {pName}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPropertyIdentifiers(selectedPropertyIdentifiers.filter((n) => n !== pName))}
                  className="hover:text-rose-600 transition"
                  title="Quitar este filtro"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedTenants.map((tName) => (
              <span
                key={`chip-tenant-${tName}`}
                className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 font-medium flex items-center gap-1"
              >
                <span>👤 {tName}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTenants(selectedTenants.filter((n) => n !== tName))}
                  className="hover:text-rose-600 transition"
                  title="Quitar este filtro"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setSelectedPropertyIdentifiers([]);
                setSelectedTenants([]);
                setPropertyStatusFilter('all');
                setAdminFilter('all');
                setFilter('all');
                setPropertySearch('');
              }}
              className="text-rose-500 hover:underline font-semibold ml-1 cursor-pointer"
            >
              Borrar todos los filtros
            </button>
          </div>
        )}
      </div>

      {/* Properties Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No se encontraron propiedades
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {selectedTenants.length > 0 || propertySearch || filter !== 'all' || adminFilter !== 'all' || propertyStatusFilter !== 'all'
              ? 'Prueba modificando tus términos de búsqueda o filtros aplicados.'
              : 'Empieza registrando tu primera propiedad en alquiler para emitir contratos y facturas.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {(selectedTenants.length > 0 || propertySearch || filter !== 'all' || adminFilter !== 'all' || propertyStatusFilter !== 'all') && (
              <button
                onClick={() => {
                  setFilter('all');
                  setAdminFilter('all');
                  setPropertyStatusFilter('all');
                  setSelectedTenants([]);
                  setPropertySearch('');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Limpiar Filtros
              </button>
            )}
            <button
              onClick={onAddProperty}
              className="px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Registrar Propiedad Ahora
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((status) => {
            const { property } = status;
            const isPaid = status.totalPendingBalance <= 0;
            const isOverdue = status.isOverdue;
            const isContractExpiring = status.contractDaysLeft <= 45;

            // Assigned administrator and currency
            const admin = getAdministratorForProperty(property, administrators);

            return (
              <div
                key={property.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3.5">
                  {/* Property Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                          }`}
                        >
                          {isPaid
                            ? 'Cuenta al Día'
                            : isOverdue
                            ? `Atrasado (${status.daysOverdue} días)`
                            : 'Pendiente del Mes'}
                        </span>

                        {isContractExpiring && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {status.contractDaysLeft < 0
                              ? 'Contrato Vencido'
                              : `Renovación: ${status.contractDaysLeft}d`}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {property.propertyIdentifier}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {property.address}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-400 block">Renta Mensual</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {formatCurrency(property.rentAmount, admin.currencySymbol)}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        Día {property.rentDueDay} de cada mes
                      </span>
                    </div>
                  </div>

                  {/* Empresa Administradora Assignment Button / Badge */}
                  <div className="flex items-center justify-between p-2.5 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200/80 dark:border-sky-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      {admin.logoUrl ? (
                        <img
                          src={admin.logoUrl}
                          alt="Logo"
                          className="w-6 h-6 object-contain rounded-lg bg-white border border-sky-300 p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                          Empresa Administradora
                        </span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {admin.companyName}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectingAdminForProp(property)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer shrink-0"
                      title="Asignar o cambiar la empresa administradora de esta propiedad"
                    >
                      <Layers className="w-3 h-3 text-sky-500" />
                      <span>Cambiar Empresa</span>
                      <span className="px-1 py-0.2 bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 rounded font-black text-[10px]">
                        {admin.currencySymbol}
                      </span>
                    </button>
                  </div>

                  {/* 1. Tenants Section (Up to 2 tenants) */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    {/* Tenant 1 */}
                    {(() => {
                      const isT1Match = selectedTenants.includes(property.tenant1.name);
                      return (
                        <div
                          className={`flex items-start justify-between gap-2 p-1.5 rounded-lg transition ${
                            isT1Match
                              ? 'bg-sky-100/70 dark:bg-sky-950/60 ring-1 ring-sky-300 dark:ring-sky-800'
                              : ''
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                                Inquilino 1 (Principal):
                              </span>
                              {isT1Match && (
                                <span className="text-[9px] font-bold bg-sky-600 text-white px-1.5 py-0.2 rounded">
                                  Coincidencia
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {property.tenant1.name}
                            </p>
                            {property.tenant1.idNumber && (
                              <p className="text-[10px] text-slate-500">
                                {property.tenant1.idNumber}
                              </p>
                            )}
                            {property.tenant1.email && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Email: {property.tenant1.email}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`https://wa.me/${cleanPhone(property.tenant1.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md font-medium text-[11px] flex items-center gap-1 hover:bg-emerald-200 transition"
                              title="Contactar por WhatsApp"
                            >
                              <Send className="w-3 h-3" /> {property.tenant1.phone}
                            </a>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tenant 2 if present */}
                    {property.tenant2 &&
                      (() => {
                        const isT2Match = property.tenant2 ? selectedTenants.includes(property.tenant2.name) : false;
                        return (
                          <div
                            className={`pt-2 border-t border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2 p-1.5 rounded-lg transition ${
                              isT2Match
                                ? 'bg-sky-100/70 dark:bg-sky-950/60 ring-1 ring-sky-300 dark:ring-sky-800'
                                : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                  Inquilino 2 (Co-arrendatario):
                                </span>
                                {isT2Match && (
                                  <span className="text-[9px] font-bold bg-sky-600 text-white px-1.5 py-0.2 rounded">
                                    Coincidencia
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {property.tenant2.name}
                              </p>
                              {property.tenant2.idNumber && (
                                <p className="text-[10px] text-slate-500">
                                  {property.tenant2.idNumber}
                                </p>
                              )}
                              {property.tenant2.email && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Email: {property.tenant2.email}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={`https://wa.me/${cleanPhone(property.tenant2.phone)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md font-medium text-[11px] flex items-center gap-1 hover:bg-emerald-200 transition"
                                title="Contactar por WhatsApp"
                              >
                                <Send className="w-3 h-3" /> {property.tenant2.phone}
                              </a>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Día acordado de pago */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300">
                      <span className="font-bold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>Día de pago acordado:</span>
                      </span>
                      <span className="font-black text-slate-900 dark:text-white bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 rounded-md">
                        Día {property.rentDueDay} de cada mes
                      </span>
                    </div>

                    {/* Cláusula de Demora y Tope Máximo por Contrato */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Demora:</span>
                        {property.lateFeeBase > 0 || property.lateFeeDaily > 0 ? (
                          <span className="text-slate-700 dark:text-slate-200">
                            Base: {formatCurrency(property.lateFeeBase, admin.currencySymbol)} + {formatCurrency(property.lateFeeDaily, admin.currencySymbol)}/d tras {property.graceDays}d gracia
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin penalidad acordada</span>
                        )}
                      </div>

                      <div>
                        {property.lateFeeCapEnabled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            🛡️ Tope: {property.lateFeeCapType === 'days'
                              ? `Máx ${property.lateFeeMaxDays || 10} días/mes`
                              : `Máx ${formatCurrency(property.lateFeeMaxAmount || 75, admin.currencySymbol)}/mes`}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                            Sin tope
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Factura de Utilidades (Consumo Mes Anterior) - Edición Manual */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-sky-500" />
                          Factura de Utilidades (Consumo mas reciente)
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Costo según factura recibida del proveedor
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenQuickUtilities(property)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-bold text-[10px] flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Modificar manualmente el costo de la factura de utilidades según consumo del mes anterior"
                      >
                        <Edit2 className="w-2.5 h-2.5" /> Ajustar Utilidades
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Water */}
                      <div
                        className={`p-2 rounded-lg border ${
                          property.utilitiesWaterActive
                            ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold flex items-center gap-1 text-[11px] text-sky-900 dark:text-sky-200">
                            <Droplets className="w-3 h-3 text-sky-500" /> Agua (Consumo)
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              property.utilitiesWaterActive
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {property.utilitiesWaterActive ? 'Aplica' : 'No Aplica'}
                          </span>
                        </div>
                        <p className="font-black text-xs text-sky-950 dark:text-sky-100">
                          {property.utilitiesWaterActive
                            ? formatCurrency(property.utilitiesWaterAmount || 0, admin.currencySymbol)
                            : '-'}
                        </p>
                      </div>

                      {/* Electricity */}
                      <div
                        className={`p-2 rounded-lg border ${
                          property.utilitiesElectricActive
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold flex items-center gap-1 text-[11px] text-amber-900 dark:text-amber-200">
                            <Zap className="w-3 h-3 text-amber-500" /> Electricidad
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              property.utilitiesElectricActive
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {property.utilitiesElectricActive ? 'Aplica' : 'No Aplica'}
                          </span>
                        </div>
                        <p className="font-black text-xs text-amber-950 dark:text-amber-100">
                          {property.utilitiesElectricActive
                            ? formatCurrency(property.utilitiesElectricAmount || 0, admin.currencySymbol)
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Financial Status Summary with Segregated Balances */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 text-xs border border-slate-200 dark:border-slate-700/60">
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Vencimiento Contrato:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatDate(property.contractEndDate)}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {status.contractDaysLeft < 0
                            ? 'Vencido'
                            : `${status.contractDaysLeft} días restantes`}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px]">Saldo Total por Pagar:</span>
                        <span
                          className={`text-sm font-black ${
                            status.totalPendingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatCurrency(status.totalPendingBalance, admin.currencySymbol)}
                        </span>
                        {status.totalLateFees > 0 && (
                          <div className="space-y-0.5">
                            <span className="block text-[10px] text-rose-500 font-semibold">
                              Incluye {formatCurrency(status.totalLateFees, admin.currencySymbol)} mora ({status.effectiveDailyDays ?? status.daysOverdue}d tras gracia)
                            </span>
                            {status.lateFeeCapNotice && (
                              <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                                🛡️ {status.lateFeeCapNotice}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Segregated Balances Breakdown: Renta vs Utilidades */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Renta Convenida:</span>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-300">Pendiente:</span>
                          <span className={`font-bold ${status.pendingRentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatCurrency(status.pendingRentBalance, admin.currencySymbol)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          {!status.isRentDueReached
                            ? `Inicia el día ${property.rentDueDay} de cada mes`
                            : `Pagado mes: ${formatCurrency(status.paidRentThisMonth, admin.currencySymbol)}`}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Factura Utilidades:</span>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-300">Pendiente:</span>
                          <span className={`font-bold ${status.pendingUtilitiesBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {formatCurrency(status.pendingUtilitiesBalance, admin.currencySymbol)}
                          </span>
                        </div>
                        <span
                          className="text-[10px] text-slate-400 block truncate"
                          title={`Agua: ${formatCurrency(status.pendingWaterBalance, admin.currencySymbol)} | Electricidad: ${formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}`}
                        >
                          💧 {formatCurrency(status.pendingWaterBalance, admin.currencySymbol)} • ⚡ {formatCurrency(status.pendingElectricBalance, admin.currencySymbol)}
                        </span>
                      </div>
                    </div>

                    {/* Operational Expenses summary if recorded */}
                    {(() => {
                      const propExps = expenses.filter((e) => e.propertyId === property.id);
                      if (propExps.length === 0) return null;
                      const sumExp = propExps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                      return (
                        <div className="bg-rose-50/80 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-[11px] pt-1">
                          <span className="text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>Gastos Operativos Registrados ({propExps.length}):</span>
                          </span>
                          <span className="font-black text-rose-700 dark:text-rose-300">
                            {formatCurrency(sumExp, admin.currencySymbol)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Card Action Buttons Bar */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => onOpenInvoice(status, 'current')}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
                      title="Generar Factura Actual"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Factura Actual</span>
                    </button>
                    <button
                      onClick={() => onOpenInvoice(status, 'next_month')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
                      title="Generar Factura / Recordatorio anticipado del próximo mes"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Factura Próx. Mes</span>
                    </button>
                    <button
                      onClick={() =>
                        onRegisterPayment(property.id, property.tenant1.name, status.totalPendingBalance)
                      }
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
                      title="Registrar pago realizado por el inquilino"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> + Pago
                    </button>

                    {/* Botón de Gastos de la Propiedad */}
                    {onOpenExpenses && (
                      <button
                        type="button"
                        onClick={() => onOpenExpenses(property)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer text-xs"
                        title="Registrar y consultar gastos de mantenimiento, reparaciones u operación para esta propiedad"
                      >
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>Gastos</span>
                        {expenses.filter((e) => e.propertyId === property.id).length > 0 && (
                          <span className="ml-0.5 px-1.5 py-0.2 bg-white/25 text-white rounded-full text-[10px] font-black">
                            {expenses.filter((e) => e.propertyId === property.id).length}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Button to view independent payment receipts */}
                    {payments.some((p) => p.propertyId === property.id) && (
                      <button
                        onClick={() => {
                          const propPays = payments
                            .filter((p) => p.propertyId === property.id)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                          if (onOpenReceipt && propPays.length > 0) {
                            onOpenReceipt(propPays[0]);
                          } else {
                            onOpenInvoice(status, 'current');
                          }
                        }}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl font-semibold flex items-center gap-1 transition text-xs cursor-pointer"
                        title="Ver Recibo independiente del último pago recibido con su prelación contable"
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Recibo Pago</span>
                      </button>
                    )}

                    {/* Botón para ver y editar pagos registrados en ventana emergente */}
                    <button
                      type="button"
                      onClick={() => setViewingPaymentsProp(property)}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold flex items-center gap-1 transition text-xs cursor-pointer"
                      title="Ver ventana emergente con el listado de todos los pagos registrados para consultar información y editar cualquiera"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>
                        Editar Pagos Registrados
                        {payments.filter((p) => p.propertyId === property.id).length > 0
                          ? ` (${payments.filter((p) => p.propertyId === property.id).length})`
                          : ''}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditProperty(property)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      title="Editar datos de propiedad y contrato"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPropertyToDelete(property)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Eliminar propiedad"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Modal to Assign Administrator to Property */}
      {selectingAdminForProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-600" />
                  Asignar Empresa Administradora
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Propiedad: <strong className="text-slate-800 dark:text-slate-200">{selectingAdminForProp.propertyIdentifier}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectingAdminForProp(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Selecciona la empresa encargada del cobro y facturación para esta propiedad:
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {administrators.map((admin) => {
                const isCurrent = (selectingAdminForProp.administratorId || administrators[0]?.id) === admin.id;
                return (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => handleAssignAdmin(admin.id)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition cursor-pointer ${
                      isCurrent
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 ring-1 ring-sky-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {admin.logoUrl ? (
                        <img
                          src={admin.logoUrl}
                          alt="Logo"
                          className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                          <Building2 className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {admin.companyName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {admin.landlordName || 'Representante'} • Moneda: {admin.currencySymbol} ({admin.currencyCode})
                        </p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="px-2 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> Asignada
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-md shrink-0">
                        Seleccionar
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectingAdminForProp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Modal to Modify Utilities for a Property */}
      {editingUtilitiesProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-sky-600" />
                  Ajuste Manual de Factura de Utilidades (Consumo mas reciente)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Propiedad: <strong className="text-slate-800 dark:text-slate-200">{editingUtilitiesProp.propertyIdentifier}</strong> ({editingUtilitiesProp.address})
                </p>
              </div>
              <button
                onClick={() => setEditingUtilitiesProp(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Modifique manualmente los costos de las facturas de utilidad según el consumo del mes anterior recibido del proveedor. Estos montos se actualizarán en los balances pendientes y se reflejarán en la factura corriente del inquilino:
            </p>

            <div className="space-y-4">
              {/* Utility 1: Water */}
              <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                      Utilidad de Agua Potable
                    </span>
                  </div>
                  {/* Aplica / No Aplica Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setQuickWaterActive(!quickWaterActive)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      quickWaterActive
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {quickWaterActive ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{quickWaterActive ? 'Aplica' : 'No Aplica'}</span>
                  </button>
                </div>

                {quickWaterActive && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Costo de factura de agua según consumo del mes anterior ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={quickWaterAmount}
                      onChange={(e) => setQuickWaterAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Utility 2: Electricity LUMA / AEE */}
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                      Electricidad
                    </span>
                  </div>
                  {/* Aplica / No Aplica Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setQuickElectricActive(!quickElectricActive)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      quickElectricActive
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {quickElectricActive ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{quickElectricActive ? 'Aplica' : 'No Aplica'}</span>
                  </button>
                </div>

                {quickElectricActive && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Costo de factura de Electricidad según consumo del mes anterior ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={quickElectricAmount}
                      onChange={(e) => setQuickElectricAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUtilitiesProp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickUtilities}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Property Confirmation Modal */}
      {propertyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Eliminar propiedad del registro?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estás a punto de eliminar la propiedad{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {propertyToDelete.propertyIdentifier}
                  </strong>{' '}
                  ({propertyToDelete.address}) con inquilino{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {propertyToDelete.tenant1.name}
                  </strong>
                  .
                </p>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] mt-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Esta acción borrará la propiedad y su historial asociado de la lista.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPropertyToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs transition cursor-pointer"
              >
                Sí, Eliminar Propiedad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal with List of Registered Payments for a Property */}
      {viewingPaymentsProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Pagos Registrados — {viewingPaymentsProp.propertyIdentifier}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inquilino: <strong className="text-slate-800 dark:text-slate-200">{viewingPaymentsProp.tenant1.name}</strong> • {viewingPaymentsProp.address}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPaymentsProp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            {(() => {
              const propPays = payments
                .filter((p) => p.propertyId === viewingPaymentsProp.id)
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              const admin = getAdministratorForProperty(viewingPaymentsProp, administrators);
              const totalAmountPaid = propPays.reduce((sum, p) => sum + (p.amount || 0), 0);

              return (
                <>
                  <div className="px-5 py-3 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Total Registros: <strong className="text-slate-900 dark:text-white">{propPays.length}</strong>
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Total Pagado: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalAmountPaid, admin.currencySymbol)}</strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setViewingPaymentsProp(null);
                        onRegisterPayment(viewingPaymentsProp.id, viewingPaymentsProp.tenant1.name, 0);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center gap-1 transition shadow-xs text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Registrar Nuevo Pago
                    </button>
                  </div>

                  {/* Payments List Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                    {propPays.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 space-y-3">
                        <AlertCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="text-sm">No hay pagos registrados para esta propiedad todavía.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setViewingPaymentsProp(null);
                            onRegisterPayment(viewingPaymentsProp.id, viewingPaymentsProp.tenant1.name, 0);
                          }}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Registrar Primer Pago
                        </button>
                      </div>
                    ) : (
                      propPays.map((p) => {
                        return (
                          <div
                            key={p.id}
                            className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {formatDate(p.date)}
                                </span>
                                {p.period && (
                                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-[11px] font-medium">
                                    Periodo: {p.period}
                                  </span>
                                )}
                                <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(p.amount, admin.currencySymbol)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  Pagador: {p.payerName}
                                </span>
                                <span>•</span>
                                <span className="capitalize">{p.paymentMethod}</span>
                                {p.reference && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300">Ref: {p.reference}</span>
                                  </>
                                )}
                              </div>

                              {/* Breakdown badges if present */}
                              {p.breakdown && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                                  {(p.breakdown.rent || 0) > 0 && (
                                    <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded font-semibold">
                                      Renta: {formatCurrency(p.breakdown.rent || 0, admin.currencySymbol)}
                                    </span>
                                  )}
                                  {(p.breakdown.electricity || 0) > 0 && (
                                    <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded font-semibold">
                                      ⚡ Elec: {formatCurrency(p.breakdown.electricity || 0, admin.currencySymbol)}
                                    </span>
                                  )}
                                  {(p.breakdown.water || 0) > 0 && (
                                    <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded font-semibold">
                                      💧 Agua: {formatCurrency(p.breakdown.water || 0, admin.currencySymbol)}
                                    </span>
                                  )}
                                  {(p.breakdown.maintenance || 0) > 0 && (
                                    <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded font-semibold">
                                      🛠 Mant: {formatCurrency(p.breakdown.maintenance || 0, admin.currencySymbol)}
                                    </span>
                                  )}
                                  {(p.breakdown.lateFee || 0) > 0 && (
                                    <span className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded font-semibold">
                                      Mora: {formatCurrency(p.breakdown.lateFee || 0, admin.currencySymbol)}
                                    </span>
                                  )}
                                </div>
                              )}

                              {p.notes && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5">
                                  "{p.notes}"
                                </p>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {onOpenReceipt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingPaymentsProp(null);
                                    onOpenReceipt(p);
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl font-semibold flex items-center gap-1 transition text-xs cursor-pointer"
                                  title="Ver recibo de este pago"
                                >
                                  <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Recibo</span>
                                </button>
                              )}

                              {onEditPayment && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingPaymentsProp(null);
                                    onEditPayment(p);
                                  }}
                                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold flex items-center gap-1 transition shadow-xs text-xs cursor-pointer"
                                  title="Editar o ajustar toda la información de este pago y guardar cambios"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Editar Pago</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/40">
                    <button
                      type="button"
                      onClick={() => setViewingPaymentsProp(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
