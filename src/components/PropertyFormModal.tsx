import React, { useState, useEffect } from 'react';
import { Property, Tenant, Administrator } from '../types';
import { loadAdministrators } from '../utils/storage';
import { X, Building2, User, Phone, Calendar, DollarSign, AlertCircle, FileText, Droplets, Zap, Wrench, Check, HelpCircle, ShieldAlert } from 'lucide-react';

interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: Property) => void;
  initialProperty?: Property | null;
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProperty,
}) => {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('admin-1');

  const [propertyIdentifier, setPropertyIdentifier] = useState('');
  const [address, setAddress] = useState('');
  const [rentAmount, setRentAmount] = useState<number | ''>('');
  const [rentDueDay, setRentDueDay] = useState<number>(5);
  const [graceDays, setGraceDays] = useState<number>(3);
  const [lateFeeBase, setLateFeeBase] = useState<number | ''>(300);
  const [lateFeeDaily, setLateFeeDaily] = useState<number | ''>(50);

  // Tope Máximo de Penalidad por Morosidad
  const [lateFeeCapEnabled, setLateFeeCapEnabled] = useState<boolean>(false);
  const [lateFeeCapType, setLateFeeCapType] = useState<'amount' | 'days'>('amount');
  const [lateFeeMaxAmount, setLateFeeMaxAmount] = useState<number | ''>(75);
  const [lateFeeMaxDays, setLateFeeMaxDays] = useState<number | ''>(10);

  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Utilidades Variables (Agua, Electricidad LUMA / AEE, y Mantenimiento / Cuota)
  const [utilitiesWaterActive, setUtilitiesWaterActive] = useState<boolean>(false);
  const [utilitiesWaterAmount, setUtilitiesWaterAmount] = useState<number | ''>('');
  const [utilitiesElectricActive, setUtilitiesElectricActive] = useState<boolean>(false);
  const [utilitiesElectricAmount, setUtilitiesElectricAmount] = useState<number | ''>('');
  const [utilitiesMaintenanceActive, setUtilitiesMaintenanceActive] = useState<boolean>(false);
  const [utilitiesMaintenanceAmount, setUtilitiesMaintenanceAmount] = useState<number | ''>('');

  // Tenant 1
  const [tenant1Name, setTenant1Name] = useState('');
  const [tenant1Phone, setTenant1Phone] = useState('');
  const [tenant1Email, setTenant1Email] = useState('');
  const [tenant1Id, setTenant1Id] = useState('');

  // Tenant 2
  const [hasTenant2, setHasTenant2] = useState(false);
  const [tenant2Name, setTenant2Name] = useState('');
  const [tenant2Phone, setTenant2Phone] = useState('');
  const [tenant2Email, setTenant2Email] = useState('');
  const [tenant2Id, setTenant2Id] = useState('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const admins = loadAdministrators();
    setAdministrators(admins);

    if (initialProperty) {
      setSelectedAdminId(initialProperty.administratorId || admins[0]?.id || 'admin-1');
      setPropertyIdentifier(initialProperty.propertyIdentifier || '');
      setAddress(initialProperty.address || '');
      setRentAmount(initialProperty.rentAmount ?? '');
      setRentDueDay(initialProperty.rentDueDay ?? 5);
      setGraceDays(initialProperty.graceDays ?? 3);
      setLateFeeBase(initialProperty.lateFeeBase ?? 300);
      setLateFeeDaily(initialProperty.lateFeeDaily ?? 50);

      setLateFeeCapEnabled(Boolean(initialProperty.lateFeeCapEnabled));
      setLateFeeCapType(initialProperty.lateFeeCapType || 'amount');
      setLateFeeMaxAmount(initialProperty.lateFeeMaxAmount ?? 75);
      setLateFeeMaxDays(initialProperty.lateFeeMaxDays ?? 10);

      setContractStartDate(initialProperty.contractStartDate || '');
      setContractEndDate(initialProperty.contractEndDate || '');
      setDepositAmount(initialProperty.depositAmount ?? '');
      setNotes(initialProperty.notes || '');

      setUtilitiesWaterActive(Boolean(initialProperty.utilitiesWaterActive));
      setUtilitiesWaterAmount(initialProperty.utilitiesWaterAmount ?? '');
      setUtilitiesElectricActive(Boolean(initialProperty.utilitiesElectricActive));
      setUtilitiesElectricAmount(initialProperty.utilitiesElectricAmount ?? '');
      setUtilitiesMaintenanceActive(Boolean(initialProperty.utilitiesMaintenanceActive));
      setUtilitiesMaintenanceAmount(initialProperty.utilitiesMaintenanceAmount ?? '');

      setTenant1Name(initialProperty.tenant1?.name || '');
      setTenant1Phone(initialProperty.tenant1?.phone || '');
      setTenant1Email(initialProperty.tenant1?.email || '');
      setTenant1Id(initialProperty.tenant1?.idNumber || '');

      if (initialProperty.tenant2 && (initialProperty.tenant2.name || initialProperty.tenant2.phone)) {
        setHasTenant2(true);
        setTenant2Name(initialProperty.tenant2.name || '');
        setTenant2Phone(initialProperty.tenant2.phone || '');
        setTenant2Email(initialProperty.tenant2.email || '');
        setTenant2Id(initialProperty.tenant2.idNumber || '');
      } else {
        setHasTenant2(false);
        setTenant2Name('');
        setTenant2Phone('');
        setTenant2Email('');
        setTenant2Id('');
      }
    } else {
      setSelectedAdminId(admins[0]?.id || 'admin-1');
      // Default empty form for new property
      setPropertyIdentifier('');
      setAddress('');
      setRentAmount('');
      setRentDueDay(5);
      setGraceDays(3);
      setLateFeeBase(300);
      setLateFeeDaily(50);
      setLateFeeCapEnabled(false);
      setLateFeeCapType('amount');
      setLateFeeMaxAmount(75);
      setLateFeeMaxDays(10);

      setUtilitiesWaterActive(false);
      setUtilitiesWaterAmount('');
      setUtilitiesElectricActive(false);
      setUtilitiesElectricAmount('');
      
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      
      setContractStartDate(today.toISOString().split('T')[0]);
      setContractEndDate(nextYear.toISOString().split('T')[0]);
      setDepositAmount('');
      setNotes('');

      setTenant1Name('');
      setTenant1Phone('');
      setTenant1Email('');
      setTenant1Id('');

      setHasTenant2(false);
      setTenant2Name('');
      setTenant2Phone('');
      setTenant2Email('');
      setTenant2Id('');
    }
    setError(null);
  }, [initialProperty, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyIdentifier.trim()) {
      setError('Por favor ingresa la identificación de la propiedad (ej. Apto 302).');
      return;
    }
    if (!address.trim()) {
      setError('Por favor ingresa la dirección de la propiedad.');
      return;
    }
    if (rentAmount === '' || Number(rentAmount) <= 0) {
      setError('Por favor especifica una cantidad de renta válida.');
      return;
    }
    if (!tenant1Name.trim() || !tenant1Phone.trim()) {
      setError('El Inquilino 1 requiere al menos nombre completo y teléfono de contacto.');
      return;
    }
    if (!contractEndDate) {
      setError('Por favor especifica la fecha de vencimiento o renovación de contrato.');
      return;
    }

    const tenant1: Tenant = {
      name: tenant1Name.trim(),
      phone: tenant1Phone.trim(),
      email: tenant1Email.trim() || undefined,
      idNumber: tenant1Id.trim() || undefined,
    };

    let tenant2: Tenant | undefined = undefined;
    if (hasTenant2 && tenant2Name.trim()) {
      tenant2 = {
        name: tenant2Name.trim(),
        phone: tenant2Phone.trim(),
        email: tenant2Email.trim() || undefined,
        idNumber: tenant2Id.trim() || undefined,
      };
    }

    const savedProp: Property = {
      id: initialProperty?.id || `prop-${Date.now()}`,
      administratorId: selectedAdminId,
      propertyIdentifier: propertyIdentifier.trim(),
      address: address.trim(),
      rentAmount: Number(rentAmount),
      rentDueDay: Number(rentDueDay) || 1,
      graceDays: Number(graceDays) || 0,
      lateFeeBase: Number(lateFeeBase) || 0,
      lateFeeDaily: Number(lateFeeDaily) || 0,
      lateFeeCapEnabled,
      lateFeeCapType: lateFeeCapEnabled ? lateFeeCapType : undefined,
      lateFeeMaxAmount:
        lateFeeCapEnabled && lateFeeCapType === 'amount' && lateFeeMaxAmount !== ''
          ? Number(lateFeeMaxAmount)
          : undefined,
      lateFeeMaxDays:
        lateFeeCapEnabled && lateFeeCapType === 'days' && lateFeeMaxDays !== ''
          ? Number(lateFeeMaxDays)
          : undefined,
      contractStartDate: contractStartDate || new Date().toISOString().split('T')[0],
      contractEndDate,
      tenant1,
      tenant2,
      depositAmount: depositAmount === '' ? undefined : Number(depositAmount),
      notes: notes.trim() || undefined,
      active: true,
      createdAt: initialProperty?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Utilidades Variables Adicionales
      utilitiesWaterActive,
      utilitiesWaterAmount: utilitiesWaterActive && utilitiesWaterAmount !== '' ? Number(utilitiesWaterAmount) : 0,
      utilitiesElectricActive,
      utilitiesElectricAmount: utilitiesElectricActive && utilitiesElectricAmount !== '' ? Number(utilitiesElectricAmount) : 0,
      utilitiesMaintenanceActive,
      utilitiesMaintenanceAmount: utilitiesMaintenanceActive && utilitiesMaintenanceAmount !== '' ? Number(utilitiesMaintenanceAmount) : 0,
    };

    onSave(savedProp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {initialProperty ? 'Editar Propiedad en Arrendamiento' : 'Nueva Propiedad en Arrendamiento'}
              </h2>
              <p className="text-xs text-slate-400">
                Ingreso de datos de inmueble, inquilinos, cobros y contrato
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Property Identification & Administrator */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> 1. Datos de la Propiedad & Administrador
            </h3>

            {/* Administrator Assignment Selector */}
            <div className="p-3 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  Empresa / Administrador Asignado para Cobro & Facturas *
                </label>
                {administrators.find((a) => a.id === selectedAdminId) && (
                  <span className="px-2 py-0.5 bg-sky-600 text-white rounded text-[10px] font-black">
                    Moneda: {administrators.find((a) => a.id === selectedAdminId)?.currencySymbol} ({administrators.find((a) => a.id === selectedAdminId)?.currencyCode})
                  </span>
                )}
              </div>
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                {administrators.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    🏢 {admin.companyName} {admin.landlordName ? `(${admin.landlordName})` : ''} • Símbolo: {admin.currencySymbol}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Esta propiedad emitirá facturas, recibos y avisos con el logotipo, cuentas bancarias y moneda de la empresa seleccionada.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Identificación de Propiedad *
                </label>
                <input
                  type="text"
                  value={propertyIdentifier}
                  onChange={(e) => setPropertyIdentifier(e.target.value)}
                  placeholder="Ej: Depto 402 - Torre Altura"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección Completa *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, colonia, ciudad"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Rent and Late Fee Conditions */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> 2. Renta y Políticas de Demora
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Renta Mensual ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Día de Pago (1-31) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={rentDueDay}
                  onChange={(e) => setRentDueDay(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo Demora Base ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lateFeeBase}
                  onChange={(e) => setLateFeeBase(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Fijo por atraso"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Demora Diaria ($/día)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lateFeeDaily}
                  onChange={(e) => setLateFeeDaily(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Por día de atraso"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Días de Gracia
                </label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={graceDays}
                  onChange={(e) => setGraceDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500">
                  Días tras la fecha de pago antes de aplicar recargos por mora.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Depósito en Garantía ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Control de Tope Máximo de Penalidad por Morosidad */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Tope Máximo de Penalidad por Morosidad (Límite Mensual)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Define si el contrato impone un límite máximo a los recargos acumulables en cada ciclo mensual.
                  </span>
                </div>

                <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLateFeeCapEnabled(false)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                      !lateFeeCapEnabled
                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Sin Tope (Ilimitado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLateFeeCapEnabled(true)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                      lateFeeCapEnabled
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Aplicar Tope Máximo
                  </button>
                </div>
              </div>

              {lateFeeCapEnabled && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Modalidad del Tope Máximo Mensual:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLateFeeCapType('amount')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          lateFeeCapType === 'amount'
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Por Costo Máximo ($)
                          </span>
                          {lateFeeCapType === 'amount' && (
                            <span className="text-[10px] font-bold bg-amber-600 text-white px-1.5 py-0.2 rounded">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tope fijo monetario total mensual (ej. máximo $75.00 sumando base y demoras diarias).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLateFeeCapType('days')}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          lateFeeCapType === 'days'
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" /> Por Cantidad Máxima de Días
                          </span>
                          {lateFeeCapType === 'days' && (
                            <span className="text-[10px] font-bold bg-amber-600 text-white px-1.5 py-0.2 rounded">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tope de días diarios a computar tras gracia (ej. máximo 10 días computables de demora).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Input value for selected cap type */}
                  {lateFeeCapType === 'amount' ? (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Costo Máximo Mensual por Penalidad ($) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-amber-600 dark:text-amber-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lateFeeMaxAmount}
                          onChange={(e) => setLateFeeMaxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ej: 75.00"
                          className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                          required={lateFeeCapEnabled && lateFeeCapType === 'amount'}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        La suma del cargo base más las demoras diarias no excederá este límite en cada ciclo mensual.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Cantidad Máxima de Días Adicionales a Computar tras Gracia *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={lateFeeMaxDays}
                        onChange={(e) => setLateFeeMaxDays(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ej: 10"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        required={lateFeeCapEnabled && lateFeeCapType === 'days'}
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        El recargo por demora diaria se multiplicará como máximo por esta cantidad de días transcurridos tras el período de gracia.
                      </p>
                    </div>
                  )}

                  {/* Informative explanation note */}
                  <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      Reglas de cómputo y acumulación mensual:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400 text-[10px] leading-relaxed">
                      <li><strong>Ventana de Gracia:</strong> El día pactado de pago cuenta como el 1er día de gracia. Durante los días de gracia convenidos no se cobra recargo.</li>
                      <li><strong>Demora Diaria:</strong> Comienza a computarse a partir del día siguiente al vencimiento del período de gracia (ej. día 16 si vence día 10 con 5 días de gracia).</li>
                      <li><strong>Reinicio Mensual:</strong> El tope se calcula por cada mes. Si el saldo no se liquida se acumula al próximo mes, pero en el nuevo ciclo el contador de límite máximo vuelve a cero y aplica nuevamente igual.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2.1: Cargos Variables Adicionales por Utilidades (Agua y LUMA / AEE) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Cargos Variables Adicionales por Utilidades</span>
              </h3>
              <span className="text-[10px] text-slate-400">
                Partidas separadas de la renta
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
              💡 Si se activan, se agregarán como concepto adicional a la renta en contratos y facturas. Al registrar pagos y calcular balances pendientes se mantendrán como <strong>partidas separadas</strong>. Puedes modificar manualmente el costo según el consumo de la factura del proveedor.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Utilidad 1: Agua */}
              <div className={`p-3 rounded-xl border transition-all ${
                utilitiesWaterActive
                  ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 ring-1 ring-sky-300/60 dark:ring-sky-800'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-lg ${utilitiesWaterActive ? 'bg-sky-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Agua Potable
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {utilitiesWaterActive ? 'Activo' : 'No incluido'}
                      </span>
                    </div>
                  </div>

                  {/* Botón Aplica / No Aplica */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-700">
                    <button
                      type="button"
                      onClick={() => setUtilitiesWaterActive(true)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition ${
                        utilitiesWaterActive
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Aplica
                    </button>
                    <button
                      type="button"
                      onClick={() => setUtilitiesWaterActive(false)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition ${
                        !utilitiesWaterActive
                          ? 'bg-slate-400 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {utilitiesWaterActive && (
                  <div className="mt-2 pt-2 border-t border-sky-200/80 dark:border-sky-800/60 space-y-1">
                    <label className="block text-[10px] font-semibold text-sky-900 dark:text-sky-200">
                      Costo mensual ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-sky-600 dark:text-sky-400 font-bold text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={utilitiesWaterAmount}
                        onChange={(e) => setUtilitiesWaterAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ej: 350.00"
                        className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 rounded-lg text-xs font-bold text-sky-900 dark:text-sky-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Utilidad 2: Electricidad (LUMA / AEE) */}
              <div className={`p-3 rounded-xl border transition-all ${
                utilitiesElectricActive
                  ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-1 ring-amber-300/60 dark:ring-amber-800'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-lg ${utilitiesElectricActive ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Electricidad
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {utilitiesElectricActive ? 'Activo' : 'No incluido'}
                      </span>
                    </div>
                  </div>

                  {/* Botón Aplica / No Aplica */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-700">
                    <button
                      type="button"
                      onClick={() => setUtilitiesElectricActive(true)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition ${
                        utilitiesElectricActive
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Aplica
                    </button>
                    <button
                      type="button"
                      onClick={() => setUtilitiesElectricActive(false)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition ${
                        !utilitiesElectricActive
                          ? 'bg-slate-400 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {utilitiesElectricActive && (
                  <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/60 space-y-1">
                    <label className="block text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                      Costo mensual ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={utilitiesElectricAmount}
                        onChange={(e) => setUtilitiesElectricAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ej: 850.00"
                        className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-100 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Utilidad 3: Mantenimiento o Cuota de Residentes */}
              <div className={`p-3 rounded-xl border transition-all ${
                utilitiesMaintenanceActive
                  ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 ring-1 ring-purple-300/60 dark:ring-purple-800'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-lg ${utilitiesMaintenanceActive ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Mantenimiento / Cuota
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {utilitiesMaintenanceActive ? 'Activo' : 'No incluido'}
                      </span>
                    </div>
                  </div>

                  {/* Botón Aplica / No Aplica */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-700">
                    <button
                      type="button"
                      onClick={() => setUtilitiesMaintenanceActive(true)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition ${
                        utilitiesMaintenanceActive
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Aplica
                    </button>
                    <button
                      type="button"
                      onClick={() => setUtilitiesMaintenanceActive(false)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition ${
                        !utilitiesMaintenanceActive
                          ? 'bg-slate-400 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {utilitiesMaintenanceActive && (
                  <div className="mt-2 pt-2 border-t border-purple-200/80 dark:border-purple-800/60 space-y-1">
                    <label className="block text-[10px] font-semibold text-purple-900 dark:text-purple-200">
                      Cuota mensual de residentes ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-purple-600 dark:text-purple-400 font-bold text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={utilitiesMaintenanceAmount}
                        onChange={(e) => setUtilitiesMaintenanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ej: 50.00"
                        className="w-full pl-6 pr-2 py-1 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-lg text-xs font-bold text-purple-900 dark:text-purple-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Contract Dates */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 3. Fechas de Contrato y Renovación
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Inicio del Contrato
                </label>
                <input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vencimiento / Renovación *
                </label>
                <input
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-semibold text-amber-600 dark:text-amber-400"
                  required
                />
                <span className="text-[11px] text-slate-500">
                  Activará recordatorios automáticos para formalizar la renovación.
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Tenants (Up to 2 Tenants) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> 4. Inquilino Principal (Inquilino 1) *
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={tenant1Name}
                  onChange={(e) => setTenant1Name(e.target.value)}
                  placeholder="Ej: Carlos Mendoza Silva"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono de Contacto (WhatsApp) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={tenant1Phone}
                    onChange={(e) => setTenant1Phone(e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={tenant1Email}
                  onChange={(e) => setTenant1Email(e.target.value)}
                  placeholder="inquilino@ejemplo.com"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Identificación Oficial (DNI / INE / RFC)
                </label>
                <input
                  type="text"
                  value={tenant1Id}
                  onChange={(e) => setTenant1Id(e.target.value)}
                  placeholder="INE / DNI / Pasaporte"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Tenant 2 toggle */}
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasTenant2}
                  onChange={(e) => setHasTenant2(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Agregar segundo inquilino / co-arrendatario (Inquilino 2)
                </span>
              </label>
            </div>

            {hasTenant2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-sky-50/50 dark:bg-slate-800/80 rounded-xl border border-sky-200 dark:border-slate-700 animate-fadeIn">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Inquilino 2
                  </label>
                  <input
                    type="text"
                    value={tenant2Name}
                    onChange={(e) => setTenant2Name(e.target.value)}
                    placeholder="Ej: Mariana Ortiz Delgado"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono Inquilino 2 (WhatsApp)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={tenant2Phone}
                      onChange={(e) => setTenant2Phone(e.target.value)}
                      placeholder="+52 55 9876 5432"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correo Inquilino 2
                  </label>
                  <input
                    type="email"
                    value={tenant2Email}
                    onChange={(e) => setTenant2Email(e.target.value)}
                    placeholder="inquilino2@ejemplo.com"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Identificación Inquilino 2
                  </label>
                  <input
                    type="text"
                    value={tenant2Id}
                    onChange={(e) => setTenant2Id(e.target.value)}
                    placeholder="INE / DNI / Pasaporte"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Additional Notes */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" /> Notas o Especificaciones Adicionales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Incluye mantenimiento, cajón #12, restricciones de mascotas, inventario entregado..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow-md transition"
            >
              {initialProperty ? 'Guardar Cambios' : 'Registrar Propiedad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
