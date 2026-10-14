import React, { useState, useEffect, useMemo } from 'react';
import { Property, Payment, PaymentMethod, PaymentConcept, Administrator } from '../types';
import { getCurrentPeriodName, formatCurrency, formatDate, calculatePropertyStatus } from '../utils/calculations';
import { getAdministratorForProperty } from '../utils/storage';
import {
  X,
  DollarSign,
  Calendar,
  User,
  CreditCard,
  Tag,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  History,
  RotateCcw,
  Droplets,
  Zap,
  Wrench,
  Building2,
  FileText,
  Scale,
  Sparkles,
  Receipt,
  HelpCircle,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Plus,
  Layers,
  Copy,
} from 'lucide-react';

export interface BatchPaymentRow {
  id: string;
  date: string;
  concept: PaymentConcept;
  amount: string;
  paymentMethod: PaymentMethod;
  payerName: string;
  reference: string;
  period: string;
  notes: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (payment: Payment | Payment[]) => void;
  properties: Property[];
  payments?: Payment[];
  administrators?: Administrator[];
  initialPayment?: Payment | null;
  defaultPropertyId?: string;
  defaultPayerName?: string;
  defaultAmount?: number;
  defaultConcept?: PaymentConcept;
  onDeletePayment?: (paymentId: string) => void;
  onViewReceipt?: (payment: Payment, property: Property) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSavePayment,
  properties,
  payments = [],
  administrators = [],
  initialPayment,
  defaultPropertyId,
  defaultPayerName,
  defaultAmount,
  defaultConcept = 'renta',
  onDeletePayment,
  onViewReceipt,
}) => {
  const [activePaymentToEdit, setActivePaymentToEdit] = useState<Payment | null>(null);
  const [propertyId, setPropertyId] = useState('');
  
  // Modo de registro: Detallado por Renglones (un pago) o Lote de Múltiples Pagos
  const [entryMode, setEntryMode] = useState<'renglones' | 'batch'>('renglones');
  const [batchRows, setBatchRows] = useState<BatchPaymentRow[]>([]);

  // Renglones de pago individuales para rellenar al lado de cada concepto
  const [payLateFees, setPayLateFees] = useState<string>('0');
  const [payRent, setPayRent] = useState<string>('0');
  const [payDeposit, setPayDeposit] = useState<string>('0');
  const [payWater, setPayWater] = useState<string>('0');
  const [payElectric, setPayElectric] = useState<string>('0');
  const [payMaintenance, setPayMaintenance] = useState<string>('0');

  const [concept, setConcept] = useState<PaymentConcept>(defaultConcept);
  const [date, setDate] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [reference, setReference] = useState('');
  const [period, setPeriod] = useState(getCurrentPeriodName());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const currentProperty = properties.find((p) => p.id === propertyId);
  const admin = getAdministratorForProperty(currentProperty, administrators);

  // Payments excluding the one currently being edited to reflect true prior debts
  const paymentsExcludingActive = useMemo(() => {
    if (!activePaymentToEdit) return payments;
    return payments.filter((p) => p.id !== activePaymentToEdit.id);
  }, [payments, activePaymentToEdit]);

  // Current financial status and pending balances for the property
  const currentStatus = useMemo(() => {
    if (!currentProperty) return null;
    const refDate = date ? new Date(date) : new Date();
    return calculatePropertyStatus(currentProperty, paymentsExcludingActive, isNaN(refDate.getTime()) ? new Date() : refDate);
  }, [currentProperty, paymentsExcludingActive, date]);

  // Helper to load any existing payment into the form for editing
  function loadPaymentIntoForm(payment: Payment) {
    setActivePaymentToEdit(payment);
    setPropertyId(payment.propertyId);
    setEntryMode('renglones');
    
    setPayLateFees(String(payment.appliedToLateFees || (payment.concept === 'mora' ? payment.amount : 0)));
    setPayRent(String(payment.appliedToRent || (payment.concept === 'renta' ? payment.amount : 0)));
    setPayDeposit(String(payment.appliedToDeposit || (payment.concept === 'deposito' ? payment.amount : 0)));
    setPayWater(String(payment.appliedToWater || (payment.concept === 'agua' ? payment.amount : 0)));
    setPayElectric(String(payment.appliedToElectric || (payment.concept === 'electricidad' ? payment.amount : 0)));
    setPayMaintenance(String(payment.appliedToMaintenance || (payment.concept === 'mantenimiento' ? payment.amount : 0)));

    setConcept(payment.concept || 'renta');
    setDate(payment.date ? payment.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setPayerName(payment.payerName);
    setPaymentMethod(payment.paymentMethod);
    setReference(payment.reference || '');
    setPeriod(payment.period);
    setNotes(payment.notes || '');
    setError(null);
    setSuccessMessage(`Cargado registro de pago (${formatDate(payment.date)}) para edición.`);
    setTimeout(() => setSuccessMessage(null), 3500);
  }

  // Sync state when modal opens or initialPayment prop changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setPaymentToDelete(null);

      if (initialPayment) {
        loadPaymentIntoForm(initialPayment);
      } else {
        setActivePaymentToEdit(null);
        setEntryMode('renglones');
        const selectedId = defaultPropertyId || (properties.length > 0 ? properties[0].id : '');
        setPropertyId(selectedId);
        setConcept(defaultConcept || 'renta');

        const foundProp = properties.find((p) => p.id === selectedId);
        const statusForInit = foundProp
          ? calculatePropertyStatus(foundProp, payments, new Date())
          : null;

        // Populate initial renglones based on defaults
        if (foundProp && statusForInit) {
          if (defaultConcept === 'deposito') {
            setPayLateFees('0');
            setPayRent('0');
            setPayDeposit(String(defaultAmount !== undefined ? defaultAmount : statusForInit.pendingDepositBalance));
            setPayWater('0');
            setPayElectric('0');
          } else if (defaultConcept === 'agua' && foundProp.utilitiesWaterActive) {
            setPayLateFees('0');
            setPayRent('0');
            setPayDeposit('0');
            setPayWater(String(defaultAmount !== undefined ? defaultAmount : statusForInit.pendingWaterBalance));
            setPayElectric('0');
          } else if (defaultConcept === 'electricidad' && foundProp.utilitiesElectricActive) {
            setPayLateFees('0');
            setPayRent('0');
            setPayDeposit('0');
            setPayWater('0');
            setPayElectric(String(defaultAmount !== undefined ? defaultAmount : statusForInit.pendingElectricBalance));
          } else {
            // Default to rent
            const rentToSet = defaultAmount !== undefined
              ? defaultAmount
              : statusForInit.pendingRentBalance > 0
              ? statusForInit.pendingRentBalance
              : foundProp.rentAmount;
            setPayLateFees(String(statusForInit.pendingLateFeesBalance > 0 ? statusForInit.pendingLateFeesBalance : 0));
            setPayRent(String(rentToSet));
            setPayDeposit('0');
            setPayWater('0');
            setPayElectric('0');
          }
        } else {
          setPayLateFees('0');
          setPayRent('0');
          setPayDeposit('0');
          setPayWater('0');
          setPayElectric('0');
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const defaultPayer = defaultPayerName || foundProp?.tenant1.name || '';
        const initialBatch: BatchPaymentRow[] = [
          {
            id: `batch-${Date.now()}-1`,
            date: todayStr,
            concept: 'renta',
            amount: statusForInit && statusForInit.pendingRentBalance > 0 ? String(statusForInit.pendingRentBalance) : String(foundProp?.rentAmount || ''),
            paymentMethod: 'transferencia',
            payerName: defaultPayer,
            reference: '',
            period: getCurrentPeriodName(),
            notes: '',
          },
        ];
        if (foundProp?.depositAmount && statusForInit && statusForInit.pendingDepositBalance > 0) {
          initialBatch.push({
            id: `batch-${Date.now()}-2`,
            date: todayStr,
            concept: 'deposito',
            amount: String(statusForInit.pendingDepositBalance),
            paymentMethod: 'transferencia',
            payerName: defaultPayer,
            reference: '',
            period: getCurrentPeriodName(),
            notes: '',
          });
        }
        setBatchRows(initialBatch);

        if (defaultPayerName) {
          setPayerName(defaultPayerName);
        } else if (foundProp) {
          setPayerName(foundProp.tenant1.name);
        } else {
          setPayerName('');
        }

        setDate(new Date().toISOString().split('T')[0]);
        setPeriod(getCurrentPeriodName());
        setPaymentMethod('transferencia');
        setReference('');
        setNotes('');
      }
    }
  }, [isOpen, initialPayment, defaultPropertyId, defaultPayerName, defaultAmount, defaultConcept, properties]);

  // Switch back to "New Payment" mode
  function handleCancelEditMode() {
    setActivePaymentToEdit(null);
    if (currentProperty && currentStatus) {
      setPayLateFees('0');
      setPayRent(String(currentStatus.pendingRentBalance > 0 ? currentStatus.pendingRentBalance : currentProperty.rentAmount));
      setPayDeposit('0');
      setPayWater('0');
      setPayElectric('0');
      setPayerName(currentProperty.tenant1.name);
    } else {
      setPayLateFees('0');
      setPayRent('0');
      setPayDeposit('0');
      setPayWater('0');
      setPayElectric('0');
      setPayerName('');
    }
    setConcept('renta');
    setDate(new Date().toISOString().split('T')[0]);
    setPeriod(getCurrentPeriodName());
    setPaymentMethod('transferencia');
    setReference('');
    setNotes('');
    setError(null);
  }

  const handlePropertyChange = (newId: string) => {
    setPropertyId(newId);
    const prop = properties.find((p) => p.id === newId);
    if (prop && !activePaymentToEdit) {
      const st = calculatePropertyStatus(prop, payments, new Date(date || new Date().toISOString()));
      setPayLateFees(String(st.pendingLateFeesBalance > 0 ? st.pendingLateFeesBalance : 0));
      setPayRent(String(st.pendingRentBalance > 0 ? st.pendingRentBalance : prop.rentAmount));
      setPayDeposit('0');
      setPayWater('0');
      setPayElectric('0');
      setPayerName(prop.tenant1.name);

      // Also refresh batch rows for newly selected property
      const todayStr = date || new Date().toISOString().split('T')[0];
      const initialBatch: BatchPaymentRow[] = [
        {
          id: `batch-${Date.now()}-1`,
          date: todayStr,
          concept: 'renta',
          amount: st.pendingRentBalance > 0 ? String(st.pendingRentBalance) : String(prop.rentAmount || ''),
          paymentMethod: 'transferencia',
          payerName: prop.tenant1.name,
          reference: '',
          period: getCurrentPeriodName(),
          notes: '',
        },
      ];
      if (prop.depositAmount && st.pendingDepositBalance > 0) {
        initialBatch.push({
          id: `batch-${Date.now()}-2`,
          date: todayStr,
          concept: 'deposito',
          amount: String(st.pendingDepositBalance),
          paymentMethod: 'transferencia',
          payerName: prop.tenant1.name,
          reference: '',
          period: getCurrentPeriodName(),
          notes: '',
        });
      }
      setBatchRows(initialBatch);
    }
  };

  // Numerical values of entered renglones
  const numLateFees = Math.max(0, parseFloat(payLateFees) || 0);
  const numRent = Math.max(0, parseFloat(payRent) || 0);
  const numDeposit = Math.max(0, parseFloat(payDeposit) || 0);
  const numWater = Math.max(0, parseFloat(payWater) || 0);
  const numElectric = Math.max(0, parseFloat(payElectric) || 0);
  const numMaintenance = Math.max(0, parseFloat(payMaintenance) || 0);
  const totalEnteredAmount = Math.round((numLateFees + numRent + numDeposit + numWater + numElectric + numMaintenance) * 100) / 100;

  // Shortcuts to fill in renglones
  const handleFillAllPending = () => {
    if (!currentStatus) return;
    setPayLateFees(String(currentStatus.pendingLateFeesBalance));
    setPayRent(String(currentStatus.pendingRentBalance));
    setPayDeposit(String(currentStatus.pendingDepositBalance));
    setPayWater(String(currentProperty?.utilitiesWaterActive ? currentStatus.pendingWaterBalance : 0));
    setPayElectric(String(currentProperty?.utilitiesElectricActive ? currentStatus.pendingElectricBalance : 0));
    setPayMaintenance(String(currentProperty?.utilitiesMaintenanceActive ? currentStatus.pendingMaintenanceBalance : 0));
    setConcept('general');
  };

  const handleFillOnlyRent = () => {
    if (!currentStatus || !currentProperty) return;
    setPayLateFees('0');
    setPayRent(String(currentStatus.pendingRentBalance > 0 ? currentStatus.pendingRentBalance : currentProperty.rentAmount));
    setPayDeposit('0');
    setPayWater('0');
    setPayElectric('0');
    setConcept('renta');
  };

  const handleFillOnlyDeposit = () => {
    if (!currentStatus || !currentProperty) return;
    setPayLateFees('0');
    setPayRent('0');
    setPayDeposit(String(currentStatus.pendingDepositBalance > 0 ? currentStatus.pendingDepositBalance : currentProperty.depositAmount || 0));
    setPayWater('0');
    setPayElectric('0');
    setConcept('deposito');
  };

  const handleFillOnlyUtilities = () => {
    if (!currentStatus) return;
    setPayLateFees('0');
    setPayRent('0');
    setPayDeposit('0');
    setPayWater(String(currentProperty?.utilitiesWaterActive ? currentStatus.pendingWaterBalance : 0));
    setPayElectric(String(currentProperty?.utilitiesElectricActive ? currentStatus.pendingElectricBalance : 0));
    setConcept(
      currentProperty?.utilitiesWaterActive && !currentProperty?.utilitiesElectricActive
        ? 'agua'
        : !currentProperty?.utilitiesWaterActive && currentProperty?.utilitiesElectricActive
        ? 'electricidad'
        : 'general'
    );
  };

  const handleClearRenglones = () => {
    setPayLateFees('0');
    setPayRent('0');
    setPayDeposit('0');
    setPayWater('0');
    setPayElectric('0');
  };

  // Remaining balances preview
  const remainingLateFees = currentStatus ? Math.max(0, currentStatus.pendingLateFeesBalance - numLateFees) : 0;
  const remainingRent = currentStatus ? Math.max(0, currentStatus.pendingRentBalance - numRent) : 0;
  const remainingDeposit = currentStatus ? Math.max(0, currentStatus.pendingDepositBalance - numDeposit) : 0;
  const remainingWater = currentStatus ? Math.max(0, currentStatus.pendingWaterBalance - numWater) : 0;
  const remainingElectric = currentStatus ? Math.max(0, currentStatus.pendingElectricBalance - numElectric) : 0;
  const totalRemaining = remainingLateFees + remainingRent + remainingDeposit + remainingWater + remainingElectric;

  const propertyPreviousPayments = payments.filter((p) => p.propertyId === propertyId);

  // Batch row manipulation functions
  const handleAddBatchRow = (defaultConcept: PaymentConcept = 'renta') => {
    const newRow: BatchPaymentRow = {
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: date || new Date().toISOString().split('T')[0],
      concept: defaultConcept,
      amount: '',
      paymentMethod: paymentMethod || 'transferencia',
      payerName: payerName || currentProperty?.tenant1.name || '',
      reference: '',
      period: period || getCurrentPeriodName(),
      notes: '',
    };
    setBatchRows((prev) => [...prev, newRow]);
  };

  const handleDuplicateBatchRow = (row: BatchPaymentRow) => {
    const cloned: BatchPaymentRow = {
      ...row,
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setBatchRows((prev) => [...prev, cloned]);
  };

  const handleRemoveBatchRow = (id: string) => {
    if (batchRows.length <= 1) {
      // Just clear amount if only 1 row left
      setBatchRows((prev) => prev.map((r) => (r.id === id ? { ...r, amount: '' } : r)));
      return;
    }
    setBatchRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateBatchRow = (id: string, field: keyof BatchPaymentRow, val: any) => {
    setBatchRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const handlePopulateBatchFromPending = () => {
    if (!currentStatus) return;
    const defaultDate = date || new Date().toISOString().split('T')[0];
    const defaultTenant = payerName || currentProperty?.tenant1.name || '';
    const defaultPeriod = period || getCurrentPeriodName();
    const rows: BatchPaymentRow[] = [];

    if (currentStatus.pendingLateFeesBalance > 0) {
      rows.push({
        id: `batch-${Date.now()}-mora`,
        date: defaultDate,
        concept: 'mora',
        amount: String(currentStatus.pendingLateFeesBalance),
        paymentMethod: paymentMethod || 'transferencia',
        payerName: defaultTenant,
        reference: '',
        period: defaultPeriod,
        notes: 'Pago aplicado a recargos por mora',
      });
    }
    if (currentStatus.pendingRentBalance > 0) {
      rows.push({
        id: `batch-${Date.now()}-renta`,
        date: defaultDate,
        concept: 'renta',
        amount: String(currentStatus.pendingRentBalance),
        paymentMethod: paymentMethod || 'transferencia',
        payerName: defaultTenant,
        reference: '',
        period: defaultPeriod,
        notes: 'Pago aplicado a renta convenida',
      });
    }
    if (currentStatus.pendingDepositBalance > 0) {
      rows.push({
        id: `batch-${Date.now()}-deposito`,
        date: defaultDate,
        concept: 'deposito',
        amount: String(currentStatus.pendingDepositBalance),
        paymentMethod: paymentMethod || 'transferencia',
        payerName: defaultTenant,
        reference: '',
        period: defaultPeriod,
        notes: 'Pago aplicado a depósito requerido en contrato',
      });
    }
    if (currentStatus.pendingWaterBalance > 0) {
      rows.push({
        id: `batch-${Date.now()}-agua`,
        date: defaultDate,
        concept: 'agua',
        amount: String(currentStatus.pendingWaterBalance),
        paymentMethod: paymentMethod || 'transferencia',
        payerName: defaultTenant,
        reference: '',
        period: defaultPeriod,
        notes: 'Pago de utilidad de agua potable',
      });
    }
    if (currentStatus.pendingElectricBalance > 0) {
      rows.push({
        id: `batch-${Date.now()}-electricidad`,
        date: defaultDate,
        concept: 'electricidad',
        amount: String(currentStatus.pendingElectricBalance),
        paymentMethod: paymentMethod || 'transferencia',
        payerName: defaultTenant,
        reference: '',
        period: defaultPeriod,
        notes: 'Pago de utilidad de electricidad (LUMA / AEE)',
      });
    }

    if (rows.length > 0) {
      setBatchRows(rows);
    } else {
      handleAddBatchRow('renta');
    }
  };

  const totalBatchAmount = batchRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  // Batch submit
  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      setError('Por favor selecciona una propiedad.');
      return;
    }
    const validRows = batchRows.filter((r) => (parseFloat(r.amount) || 0) > 0);
    if (validRows.length === 0) {
      setError('Por favor ingresa al menos un pago con un importe mayor a $0 en la lista.');
      return;
    }

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (!row.date) {
        setError(`La fila ${i + 1} no tiene fecha de pago asignada.`);
        return;
      }
      if (!row.payerName.trim()) {
        setError(`La fila ${i + 1} debe especificar el nombre del inquilino que pagó.`);
        return;
      }
    }

    const createdPayments: Payment[] = validRows.map((r, idx) => {
      const numericAmt = Math.round(parseFloat(r.amount) * 100) / 100;
      const isRent = r.concept === 'renta';
      const isDeposit = r.concept === 'deposito';
      const isWater = r.concept === 'agua';
      const isElectric = r.concept === 'electricidad';
      const isLateFee = r.concept === 'mora';

      const conceptName = isRent
        ? 'Renta Básica'
        : isDeposit
        ? 'Depósito Requerido en Contrato'
        : isWater
        ? 'Utilidad de Agua Potable'
        : isElectric
        ? 'Utilidad de Electricidad (LUMA / AEE)'
        : isLateFee
        ? 'Recargos por Demora (Mora)'
        : 'Aplicación General';

      const footnote = `Recepción individual registrada específicamente para: ${conceptName} (${formatCurrency(numericAmt, admin.currencySymbol)}). Registrado en lote.`;

      return {
        id: `pay-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        propertyId,
        date: r.date,
        amount: numericAmt,
        payerName: r.payerName.trim() || currentProperty?.tenant1.name || '',
        paymentMethod: r.paymentMethod,
        reference: r.reference.trim() || undefined,
        period: r.period.trim() || getCurrentPeriodName(new Date(r.date)),
        notes: r.notes.trim() || undefined,
        createdAt: new Date().toISOString(),

        concept: r.concept,
        appliedToRent: isRent ? numericAmt : undefined,
        appliedToDeposit: isDeposit ? numericAmt : undefined,
        appliedToWater: isWater ? numericAmt : undefined,
        appliedToElectric: isElectric ? numericAmt : undefined,
        appliedToLateFees: isLateFee ? numericAmt : undefined,
        applicationFootnote: footnote,
      };
    });

    onSavePayment(createdPayments);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      setError('Por favor selecciona una propiedad.');
      return;
    }
    if (totalEnteredAmount <= 0) {
      setError('Por favor rellena al menos uno de los renglones con un monto pagado mayor a $0.');
      return;
    }
    if (!date) {
      setError('Por favor ingresa la fecha en que se realizó el pago.');
      return;
    }
    if (!payerName.trim()) {
      setError('Por favor indica el nombre del inquilino que realizó el pago.');
      return;
    }

    // Determine primary concept based on renglones filled
    let determinedConcept: PaymentConcept = concept;
    if (numRent > 0 && numLateFees === 0 && numWater === 0 && numElectric === 0 && numMaintenance === 0 && numDeposit === 0) {
      determinedConcept = 'renta';
    } else if (numDeposit > 0 && numRent === 0 && numWater === 0 && numElectric === 0 && numMaintenance === 0 && numLateFees === 0) {
      determinedConcept = 'deposito';
    } else if (numWater > 0 && numLateFees === 0 && numRent === 0 && numElectric === 0 && numMaintenance === 0 && numDeposit === 0) {
      determinedConcept = 'agua';
    } else if (numElectric > 0 && numLateFees === 0 && numRent === 0 && numWater === 0 && numMaintenance === 0 && numDeposit === 0) {
      determinedConcept = 'electricidad';
    } else if (numMaintenance > 0 && numLateFees === 0 && numRent === 0 && numWater === 0 && numElectric === 0 && numDeposit === 0) {
      determinedConcept = 'mantenimiento';
    } else if (numLateFees > 0 && numRent === 0 && numWater === 0 && numElectric === 0 && numMaintenance === 0 && numDeposit === 0) {
      determinedConcept = 'mora';
    } else {
      determinedConcept = 'general';
    }

    // Build itemized application footnote
    const breakdownParts: string[] = [];
    if (numLateFees > 0) breakdownParts.push(`Cargos por mora: ${formatCurrency(numLateFees, admin.currencySymbol)}`);
    if (numRent > 0) breakdownParts.push(`Renta: ${formatCurrency(numRent, admin.currencySymbol)}`);
    if (numDeposit > 0) breakdownParts.push(`Depósito en contrato: ${formatCurrency(numDeposit, admin.currencySymbol)}`);
    if (numWater > 0) breakdownParts.push(`Agua: ${formatCurrency(numWater, admin.currencySymbol)}`);
    if (numElectric > 0) breakdownParts.push(`Electricidad (LUMA / AEE): ${formatCurrency(numElectric, admin.currencySymbol)}`);
    if (numMaintenance > 0) breakdownParts.push(`Mantenimiento / Cuota: ${formatCurrency(numMaintenance, admin.currencySymbol)}`);

    const applicationFootnote = `Desglose de recepción: ${breakdownParts.join(', ')}. Detallado y certificado por la administración.`;

    const savedPayment: Payment = {
      id: activePaymentToEdit ? activePaymentToEdit.id : `pay-${Date.now()}`,
      propertyId,
      date,
      amount: totalEnteredAmount,
      payerName: payerName.trim(),
      paymentMethod,
      reference: reference.trim() || undefined,
      period: period.trim() || getCurrentPeriodName(),
      notes: notes.trim() || undefined,
      createdAt: activePaymentToEdit ? activePaymentToEdit.createdAt : new Date().toISOString(),

      concept: determinedConcept,
      appliedToLateFees: numLateFees,
      appliedToRent: numRent,
      appliedToDeposit: numDeposit,
      appliedToWater: numWater,
      appliedToElectric: numElectric,
      appliedToMaintenance: numMaintenance,
      applicationFootnote,
    };

    onSavePayment(savedPayment);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-6 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className={`px-5 py-4 text-white flex items-center justify-between shrink-0 transition-colors ${
          activePaymentToEdit ? 'bg-sky-800' : 'bg-emerald-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${activePaymentToEdit ? 'bg-sky-700/60' : 'bg-emerald-700/60'}`}>
              {activePaymentToEdit ? <Edit2 className="w-5 h-5 text-sky-200" /> : <DollarSign className="w-5 h-5 text-emerald-200" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {activePaymentToEdit ? 'Editar Entrada de Pago por Renglones' : 'Registro de Pago por Renglones'}
                </h2>
                {activePaymentToEdit && (
                  <span className="px-2 py-0.5 bg-sky-500/40 text-sky-100 text-[10px] font-black uppercase rounded-md tracking-wider border border-sky-400/30">
                    Modo Edición
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200">
                Consulte los balances pendientes por renglón y rellene al lado cuánto paga el inquilino
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg transition"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Edit Mode Alert Banner */}
          {activePaymentToEdit && (
            <div className="p-3.5 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-xl text-sky-900 dark:text-sky-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  Editando pago original de <strong className="font-bold">{formatCurrency(activePaymentToEdit.amount, admin.currencySymbol)}</strong> del día <strong className="font-bold">{formatDate(activePaymentToEdit.date)}</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelEditMode}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shrink-0"
              >
                <RotateCcw className="w-3 h-3" /> Nuevo Pago
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Property Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Propiedad en Arrendamiento *
            </label>
            <select
              value={propertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              required
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyIdentifier} — Renta: {formatCurrency(p.rentAmount, admin.currencySymbol)}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selector Tabs: Detallado por Renglón vs Registro de Múltiples Pagos */}
          {!activePaymentToEdit && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEntryMode('renglones')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  entryMode === 'renglones'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs border border-slate-200/80 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>1. Pago Detallado por Renglón</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('batch')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  entryMode === 'batch'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs border border-slate-200/80 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>2. Registrar Varios Pagos a la Vez (Lote)</span>
                {batchRows.filter((r) => (parseFloat(r.amount) || 0) > 0).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    {batchRows.filter((r) => (parseFloat(r.amount) || 0) > 0).length}
                  </span>
                )}
              </button>
            </div>
          )}

          {entryMode === 'renglones' ? (
            /* Form 1: Renglones individuales */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* TABLA PRINCIPAL DE RENGLONES Y BALANCES PENDIENTES */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Balances Pendientes por Renglón & Montos Abonados</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rellene al lado de cada renglón cuánto ha pagado el inquilino por cada concepto.
                    </p>
                  </div>

                  {/* Shortcut Actions */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                    <button
                      type="button"
                      onClick={handleFillAllPending}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer"
                      title="Rellenar todos los renglones con su saldo pendiente total"
                    >
                      ⚡ Todo Pendiente
                    </button>
                    <button
                      type="button"
                      onClick={handleFillOnlyRent}
                      className="px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-semibold border border-slate-300 dark:border-slate-600 transition cursor-pointer"
                    >
                      🏠 Solo Renta
                    </button>
                    {currentStatus && (currentProperty?.depositAmount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleFillOnlyDeposit}
                        className="px-2 py-1 bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-slate-100 rounded-lg text-[10px] font-semibold border border-slate-300 dark:border-slate-600 transition cursor-pointer"
                      >
                        🛡️ Solo Depósito
                      </button>
                    )}
                    {currentProperty && (currentProperty.utilitiesWaterActive || currentProperty.utilitiesElectricActive) && (
                      <button
                        type="button"
                        onClick={handleFillOnlyUtilities}
                        className="px-2 py-1 bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 hover:bg-slate-100 rounded-lg text-[10px] font-semibold border border-slate-300 dark:border-slate-600 transition cursor-pointer"
                      >
                        💧⚡ Utilidades
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearRenglones}
                      className="px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] transition cursor-pointer"
                      title="Poner montos en 0"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

              {/* Renglones Table / Grid */}
              <div className="space-y-2.5">
                {/* Renglón 1: Recargos por Demora / Mora */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            1. Recargos por Demora (Mora)
                          </span>
                          {currentStatus && currentStatus.pendingLateFeesBalance > 0 && (
                            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[9px] font-black uppercase">
                              Adeudo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Balance adeudado por mora:{' '}
                          <strong className={currentStatus && currentStatus.pendingLateFeesBalance > 0 ? 'text-rose-600 font-bold' : 'text-slate-600 font-medium'}>
                            {currentStatus ? formatCurrency(currentStatus.pendingLateFeesBalance, admin.currencySymbol) : '-'}
                          </strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-xs text-slate-400 font-medium">Abono:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{admin.currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payLateFees}
                        onChange={(e) => setPayLateFees(e.target.value)}
                        className="w-32 pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    {currentStatus && currentStatus.pendingLateFeesBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayLateFees(String(currentStatus.pendingLateFeesBalance))}
                        className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-600 transition"
                        title="Cubrir total de moras"
                      >
                        Todo
                      </button>
                    )}
                  </div>
                </div>

                {/* Renglón 2: Renta Convenida */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            2. Renta Convenida (Mes / Atrasos)
                          </span>
                          {currentStatus && currentStatus.pendingRentBalance > 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-black uppercase">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Balance adeudado de renta:{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {currentStatus ? formatCurrency(currentStatus.pendingRentBalance, admin.currencySymbol) : '-'}
                          </strong>
                          {currentProperty && (
                            <span className="text-slate-400"> (Renta contractual: {formatCurrency(currentProperty.rentAmount, admin.currencySymbol)})</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-xs text-slate-400 font-medium">Abono:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{admin.currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payRent}
                        onChange={(e) => setPayRent(e.target.value)}
                        className="w-32 pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    {currentStatus && currentStatus.pendingRentBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayRent(String(currentStatus.pendingRentBalance))}
                        className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-600 dark:text-slate-300 hover:text-emerald-600 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-600 transition"
                        title="Cubrir total de renta pendiente"
                      >
                        Todo
                      </button>
                    )}
                  </div>
                </div>

                {/* Renglón 3: Depósito Requerido en Contrato (Garantía) */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            3. Depósito Requerido en Contrato (Garantía)
                          </span>
                          {currentStatus && currentStatus.pendingDepositBalance > 0 && (
                            <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[9px] font-black uppercase">
                              Pendiente
                            </span>
                          )}
                          {currentStatus && currentStatus.depositRequired > 0 && currentStatus.pendingDepositBalance <= 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-bold">
                              Cubierto Total
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {currentProperty?.depositAmount ? (
                            <>
                              Estipulado en contrato: <strong className="font-bold text-indigo-900 dark:text-indigo-300">{formatCurrency(currentStatus?.depositRequired || currentProperty.depositAmount, admin.currencySymbol)}</strong>
                              {' • '}Cubierto: <strong>{formatCurrency(currentStatus?.totalDepositPaid || 0, admin.currencySymbol)}</strong>
                              {' • '}Saldo restante: <strong className={currentStatus && currentStatus.pendingDepositBalance > 0 ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-600 font-medium'}>{currentStatus ? formatCurrency(currentStatus.pendingDepositBalance, admin.currencySymbol) : '-'}</strong>
                            </>
                          ) : (
                            <span>No se estipuló monto de depósito en el contrato (puede registrar abono si aplica).</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-xs text-slate-400 font-medium">Abono:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{admin.currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payDeposit}
                        onChange={(e) => setPayDeposit(e.target.value)}
                        className="w-32 pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>
                    {currentStatus && currentStatus.pendingDepositBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayDeposit(String(currentStatus.pendingDepositBalance))}
                        className="px-2 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                        title="Cubrir saldo pendiente de depósito"
                      >
                        Todo
                      </button>
                    )}
                  </div>
                </div>

                {/* Renglón 4: Utilidad de Agua (Consumo de la factura anterior) */}
                {currentProperty?.utilitiesWaterActive && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-sky-200 dark:border-sky-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                          <Droplets className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                              4. Utilidad de Agua Potable
                            </span>
                            <span className="px-1.5 py-0.2 bg-sky-600 text-white rounded text-[9px] font-bold">
                              Factura Anterior
                            </span>
                          </div>
                          <p className="text-[11px] text-sky-800 dark:text-sky-300">
                            Costo factura anterior:{' '}
                            <strong className="font-bold">
                              {currentStatus ? formatCurrency(currentStatus.waterAmount, admin.currencySymbol) : '-'}
                            </strong>
                            {' • '}Balance adeudado:{' '}
                            <strong className="font-bold text-sky-700 dark:text-sky-300">
                              {currentStatus ? formatCurrency(currentStatus.pendingWaterBalance, admin.currencySymbol) : '-'}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <span className="text-xs text-slate-400 font-medium">Abono:</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{admin.currencySymbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payWater}
                          onChange={(e) => setPayWater(e.target.value)}
                          className="w-32 pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-sky-300 dark:border-sky-700 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                      {currentStatus && currentStatus.pendingWaterBalance > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayWater(String(currentStatus.pendingWaterBalance))}
                          className="px-2 py-1.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 rounded-lg text-[10px] font-bold border border-sky-200 dark:border-sky-800 transition"
                          title="Cubrir saldo de agua"
                        >
                          Todo
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Renglón 4: Utilidad de Electricidad LUMA / AEE (Consumo de la factura anterior) */}
                {currentProperty?.utilitiesElectricActive && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                          <Zap className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                              5. Utilidad de Electricidad (LUMA / AEE)
                            </span>
                            <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded text-[9px] font-bold">
                              Factura Anterior
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300">
                            Costo factura anterior:{' '}
                            <strong className="font-bold">
                              {currentStatus ? formatCurrency(currentStatus.electricAmount, admin.currencySymbol) : '-'}
                            </strong>
                            {' • '}Balance adeudado:{' '}
                            <strong className="font-bold text-amber-700 dark:text-amber-300">
                              {currentStatus ? formatCurrency(currentStatus.pendingElectricBalance, admin.currencySymbol) : '-'}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <span className="text-xs text-slate-400 font-medium">Abono:</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{admin.currencySymbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payElectric}
                          onChange={(e) => setPayElectric(e.target.value)}
                          className="w-32 pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>
                      {currentStatus && currentStatus.pendingElectricBalance > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayElectric(String(currentStatus.pendingElectricBalance))}
                          className="px-2 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold border border-amber-200 dark:border-amber-800 transition"
                          title="Cubrir saldo de electricidad"
                        >
                          Todo
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Renglón 6: Mantenimiento o Cuota de Residentes */}
                {currentProperty?.utilitiesMaintenanceActive && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                          <Wrench className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                              6. Mantenimiento / Cuota de Residentes
                            </span>
                            <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded text-[9px] font-bold">
                              Cuenta Separada
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-800 dark:text-purple-300">
                            Cuota mensual:{' '}
                            <strong className="font-bold">
                              {currentStatus ? formatCurrency(currentStatus.maintenanceAmount, admin.currencySymbol) : '-'}
                            </strong>
                            {' • '}Balance adeudado:{' '}
                            <strong className="font-bold text-purple-700 dark:text-purple-300">
                              {currentStatus ? formatCurrency(currentStatus.pendingMaintenanceBalance, admin.currencySymbol) : '-'}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <span className="text-xs text-slate-400 font-medium">Abono:</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{admin.currencySymbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payMaintenance}
                          onChange={(e) => setPayMaintenance(e.target.value)}
                          className="w-32 pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                      </div>
                      {currentStatus && currentStatus.pendingMaintenanceBalance > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayMaintenance(String(currentStatus.pendingMaintenanceBalance))}
                          className="px-2 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg text-[10px] font-bold border border-purple-200 dark:border-purple-800 transition"
                          title="Cubrir saldo de mantenimiento"
                        >
                          Todo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Total Calculation & Remaining Balances Bar */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold block text-slate-700 dark:text-slate-300">
                    Saldos restantes proyectados tras este pago:
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-0.5">
                    <span>Renta: {formatCurrency(remainingRent, admin.currencySymbol)}</span>
                    {(currentProperty?.depositAmount || 0) > 0 && (
                      <span>Depósito: {formatCurrency(remainingDeposit, admin.currencySymbol)}</span>
                    )}
                    {currentProperty?.utilitiesWaterActive && <span>Agua: {formatCurrency(remainingWater, admin.currencySymbol)}</span>}
                    {currentProperty?.utilitiesElectricActive && <span>Luz: {formatCurrency(remainingElectric, admin.currencySymbol)}</span>}
                    {remainingLateFees > 0 && <span>Mora: {formatCurrency(remainingLateFees, admin.currencySymbol)}</span>}
                    <span className="font-bold text-slate-900 dark:text-white">
                      (Total adeudado: {formatCurrency(totalRemaining, admin.currencySymbol)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Recibido:</span>
                  <span className="text-base font-black">
                    {formatCurrency(totalEnteredAmount, admin.currencySymbol)}
                  </span>
                </div>
              </div>
            </div>

            {/* Date & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha en que se Realizó el Pago *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Método de Pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="transferencia">Transferencia Electrónica (SPEI / ACH)</option>
                  <option value="ath_movil">📱 ATH Móvil</option>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="deposito">🏦 Depósito en Ventanilla / Cajero</option>
                  <option value="cheque">📜 Cheque</option>
                  <option value="tarjeta">💳 Tarjeta de Débito / Crédito</option>
                  <option value="otro">Otro método</option>
                </select>
              </div>
            </div>

            {/* Payer Tenant Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Inquilino que Realizó el Pago *
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Nombre de quien pagó"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                  required
                />

                {currentProperty && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-slate-400 self-center text-[11px]">Sugerencias:</span>
                    <button
                      type="button"
                      onClick={() => setPayerName(currentProperty.tenant1.name)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition text-[11px] font-medium"
                    >
                      1: {currentProperty.tenant1.name}
                    </button>
                    {currentProperty.tenant2 && (
                      <button
                        type="button"
                        onClick={() => setPayerName(currentProperty.tenant2?.name || '')}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition text-[11px] font-medium"
                      >
                        2: {currentProperty.tenant2.name}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPayerName(`${currentProperty.tenant1.name} / ${currentProperty.tenant2?.name || ''}`)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition text-[11px] font-medium"
                    >
                      Ambos
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Reference & Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Referencia / Folio Bancario / Recibo #
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: ATHM-92819 o Recibo #051"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mes / Periodo Correspondiente
                </label>
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Ej: Septiembre 2026"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notas Adicionales
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Pago liquidado puntualmente"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              {activePaymentToEdit ? (
                <button
                  type="button"
                  onClick={handleCancelEditMode}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Cancelar edición
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 ${
                    activePaymentToEdit
                      ? 'bg-sky-600 hover:bg-sky-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {activePaymentToEdit ? 'Guardar Cambios del Pago' : 'Registrar Pago por Renglones'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Form 2: Batch Payment Entry (Registrar varios pagos a la vez con fecha y renglón específico) */
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Registro de Uno o Múltiples Pagos por Renglón</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Especifique para cada pago la fecha y a qué renglón corresponde (Renta, Depósito en Contrato o Utilidades).
                  </p>
                </div>

                {/* Batch Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePopulateBatchFromPending}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                    title="Crear automáticamente una fila para cada saldo pendiente que tenga la propiedad"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>⚡ Pre-llenar con Adeudos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBatchRow('renta')}
                    className="px-2.5 py-1 bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-[10px] font-bold border border-slate-300 dark:border-slate-600 transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Añadir Pago</span>
                  </button>
                </div>
              </div>

              {/* Status Reference Bar */}
              {currentStatus && (
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Balances a Cubrir:</span>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                      Renta Pend: {formatCurrency(currentStatus.pendingRentBalance, admin.currencySymbol)}
                    </span>
                    {(currentProperty?.depositAmount || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                        Depósito Pend: {formatCurrency(currentStatus.pendingDepositBalance, admin.currencySymbol)}
                      </span>
                    )}
                    {currentProperty?.utilitiesWaterActive && (
                      <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">
                        Agua: {formatCurrency(currentStatus.pendingWaterBalance, admin.currencySymbol)}
                      </span>
                    )}
                    {currentProperty?.utilitiesElectricActive && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
                        Luz: {formatCurrency(currentStatus.pendingElectricBalance, admin.currencySymbol)}
                      </span>
                    )}
                    {currentStatus.pendingLateFeesBalance > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">
                        Mora: {formatCurrency(currentStatus.pendingLateFeesBalance, admin.currencySymbol)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Rows List */}
              <div className="space-y-3">
                {batchRows.map((r, index) => {
                  const numAmt = parseFloat(r.amount) || 0;
                  return (
                    <div
                      key={r.id}
                      className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2.5 transition hover:border-slate-300"
                    >
                      {/* Row Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-slate-700 text-[10px] font-black tracking-wider">
                            PAGO #{index + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            r.concept === 'renta'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : r.concept === 'deposito'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                              : r.concept === 'agua'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300'
                              : r.concept === 'electricidad'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                              : r.concept === 'mora'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          }`}>
                            {r.concept === 'renta'
                              ? '🏠 Renta Básica'
                              : r.concept === 'deposito'
                              ? '🛡️ Depósito de Contrato'
                              : r.concept === 'agua'
                              ? '💧 Agua Potable'
                              : r.concept === 'electricidad'
                              ? '⚡ Electricidad (LUMA / AEE)'
                              : r.concept === 'mora'
                              ? '🚨 Mora / Recargo'
                              : '⚖️ General / Mixto'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateBatchRow(r)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Duplicar este renglón de pago"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchRow(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Quitar este renglón"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main Inputs: Fecha, Renglón, Importe, Método */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {/* 1. Fecha de Pago */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-600" />
                            <span>Fecha del Pago *</span>
                          </label>
                          <input
                            type="date"
                            value={r.date}
                            onChange={(e) => handleUpdateBatchRow(r.id, 'date', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                            required
                          />
                        </div>

                        {/* 2. Renglón de Aplicación (Concepto) */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-emerald-600" />
                            <span>Renglón de Aplicación *</span>
                          </label>
                          <select
                            value={r.concept}
                            onChange={(e) => handleUpdateBatchRow(r.id, 'concept', e.target.value as PaymentConcept)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          >
                            <option value="renta">🏠 Renta Básica Convenida</option>
                            <option value="deposito">🛡️ Depósito Requerido en Contrato</option>
                            {currentProperty?.utilitiesWaterActive && (
                              <option value="agua">💧 Utilidad de Agua Potable</option>
                            )}
                            {currentProperty?.utilitiesElectricActive && (
                              <option value="electricidad">⚡ Utilidad de Electricidad (LUMA / AEE)</option>
                            )}
                            <option value="mora">🚨 Recargo por Demora (Mora)</option>
                            <option value="general">⚖️ Aplicación General / Mixto</option>
                          </select>
                        </div>

                        {/* 3. Importe Pagado */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-600" />
                            <span>Importe Pagado ($) *</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">
                              {admin.currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.amount}
                              onChange={(e) => handleUpdateBatchRow(r.id, 'amount', e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-6 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-black text-emerald-600 dark:text-emerald-400 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                              required
                            />
                          </div>
                        </div>

                        {/* 4. Método de Pago */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5 flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-500" />
                            <span>Método de Pago</span>
                          </label>
                          <select
                            value={r.paymentMethod}
                            onChange={(e) => handleUpdateBatchRow(r.id, 'paymentMethod', e.target.value as PaymentMethod)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          >
                            <option value="ath_movil">📱 ATH Móvil</option>
                            <option value="transferencia">🏦 Transferencia Bancaria (SPEI / ACH)</option>
                            <option value="efectivo">💵 Efectivo</option>
                            <option value="cheque">📝 Cheque</option>
                            <option value="tarjeta">💳 Tarjeta Débito / Crédito</option>
                            <option value="deposito">🏢 Depósito en Ventanilla</option>
                          </select>
                        </div>
                      </div>

                      {/* Secondary Inputs: Inquilino, Referencia, Periodo */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <User className="w-3 h-3 text-sky-600" />
                              <span>Pagado por (Inquilino) *</span>
                            </label>
                            {currentProperty?.tenant2 && (
                              <div className="flex items-center gap-1 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBatchRow(r.id, 'payerName', currentProperty.tenant1.name)}
                                  className="text-sky-600 hover:underline"
                                >
                                  Inq.1
                                </button>
                                <span>/</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBatchRow(r.id, 'payerName', currentProperty.tenant2?.name || '')}
                                  className="text-sky-600 hover:underline"
                                >
                                  Inq.2
                                </button>
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            value={r.payerName}
                            onChange={(e) => handleUpdateBatchRow(r.id, 'payerName', e.target.value)}
                            placeholder="Nombre del inquilino"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                            Referencia / Folio Bancario (Opcional)
                          </label>
                          <input
                            type="text"
                            value={r.reference}
                            onChange={(e) => handleUpdateBatchRow(r.id, 'reference', e.target.value)}
                            placeholder="Ej: ATH-9912 o SPEI-8841"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                            Periodo que Aplica
                          </label>
                          <input
                            type="text"
                            value={r.period}
                            onChange={(e) => handleUpdateBatchRow(r.id, 'period', e.target.value)}
                            placeholder="Ej: Octubre 2026"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add row button at bottom of list */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleAddBatchRow('renta')}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-300 dark:border-emerald-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Otra Fila de Pago</span>
                </button>

                <span className="text-[11px] text-slate-500">
                  {batchRows.length} fila(s) configurada(s)
                </span>
              </div>
            </div>

            {/* Batch Submission Summary Card */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-emerald-950 dark:text-emerald-200 block">
                    Total Acumulado a Registrar en Lote:
                  </span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(totalBatchAmount, admin.currencySymbol)}
                  </span>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-400 block">
                    {batchRows.filter((r) => (parseFloat(r.amount) || 0) > 0).length} pago(s) válido(s) con importe asignado
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={totalBatchAmount <= 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Registrar Todos los Pagos en Lote ({batchRows.filter((r) => (parseFloat(r.amount) || 0) > 0).length})</span>
                </button>
              </div>
            </div>
          </form>
        )}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" />
                <span>Entradas de Pago Previas de esta Propiedad ({propertyPreviousPayments.length})</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Haz clic en "Editar" para modificar renglones
              </span>
            </div>

            {propertyPreviousPayments.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                Aún no hay registros de pago previos para esta propiedad.
              </div>
            ) : (
              <div className="space-y-2">
                {propertyPreviousPayments.map((p) => {
                  const isCurrentlyEditing = activePaymentToEdit?.id === p.id;
                  return (
                    <div
                      key={`modal-prev-pay-${p.id}`}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                        isCurrentlyEditing
                          ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-700 ring-2 ring-sky-300 dark:ring-sky-800'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatDate(p.date)}
                          </span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.amount, admin.currencySymbol)}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                            {p.period}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                            {p.paymentMethod === 'ath_movil' ? '📱 ATH Móvil' : p.paymentMethod.toUpperCase()}
                          </span>
                          {isCurrentlyEditing && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-600 text-white font-bold animate-pulse">
                              Editando ahora
                            </span>
                          )}
                        </div>

                        {/* Renglones Desglose */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                          {(p.appliedToLateFees || 0) > 0 && (
                            <span className="text-rose-600 font-semibold">
                              Mora: {formatCurrency(p.appliedToLateFees || 0, admin.currencySymbol)}
                            </span>
                          )}
                          {(p.appliedToRent || 0) > 0 && (
                            <span className="text-emerald-600 font-semibold">
                              Renta: {formatCurrency(p.appliedToRent || 0, admin.currencySymbol)}
                            </span>
                          )}
                          {(p.appliedToWater || 0) > 0 && (
                            <span className="text-sky-600 font-semibold">
                              Agua: {formatCurrency(p.appliedToWater || 0, admin.currencySymbol)}
                            </span>
                          )}
                          {(p.appliedToElectric || 0) > 0 && (
                            <span className="text-amber-600 font-semibold">
                              Luz: {formatCurrency(p.appliedToElectric || 0, admin.currencySymbol)}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                          Pagó: <strong className="font-semibold text-slate-800 dark:text-slate-200">{p.payerName}</strong>
                          {p.reference && <span> (Ref: {p.reference})</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {onViewReceipt && currentProperty && (
                          <button
                            type="button"
                            onClick={() => onViewReceipt(p, currentProperty)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 transition"
                            title="Generar e imprimir o enviar el recibo de este pago con su desglose detallado"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Recibo</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => loadPaymentIntoForm(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs ${
                            isCurrentlyEditing
                              ? 'bg-sky-600 text-white hover:bg-sky-500'
                              : 'bg-white dark:bg-slate-700 hover:bg-sky-50 dark:hover:bg-slate-600 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-600'
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{isCurrentlyEditing ? 'Editando' : 'Editar'}</span>
                        </button>

                        {onDeletePayment && (
                          <button
                            type="button"
                            onClick={() => setPaymentToDelete(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Eliminar este pago"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inner Delete Confirmation Modal */}
        {paymentToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3">
              <div className="flex items-center gap-3 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  ¿Eliminar este registro de pago?
                </h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Se eliminará el pago de <strong>{formatCurrency(paymentToDelete.amount, admin.currencySymbol)}</strong> del <strong>{formatDate(paymentToDelete.date)}</strong> realizado por <strong>{paymentToDelete.payerName}</strong>.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentToDelete(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeletePayment) {
                      onDeletePayment(paymentToDelete.id);
                      if (activePaymentToEdit?.id === paymentToDelete.id) {
                        handleCancelEditMode();
                      }
                      setPaymentToDelete(null);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
