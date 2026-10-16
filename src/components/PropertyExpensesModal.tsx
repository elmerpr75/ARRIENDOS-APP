import React, { useState } from 'react';
import {
  X,
  TrendingDown,
  Plus,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  User,
  Hash,
  Trash2,
  Edit2,
  CheckCircle2,
  Building2,
  FolderPlus,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { Property, Expense, Administrator } from '../types';
import { SupportedLanguage } from '../utils/i18n';
import { formatCurrency, formatDate } from '../utils/calculations';

interface PropertyExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  expenses: Expense[];
  expenseCategories: string[];
  admin?: Administrator;
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onAddCategory: (categoryName: string) => void;
  currentLang?: SupportedLanguage;
}

export const PropertyExpensesModal: React.FC<PropertyExpensesModalProps> = ({
  isOpen,
  onClose,
  property,
  expenses,
  expenseCategories,
  admin,
  onSaveExpense,
  onDeleteExpense,
  onAddCategory,
  currentLang = 'es',
}) => {
  const isEn = currentLang === 'en';
  const currencySymbol = admin?.currencySymbol || '$';

  // Form states
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(() => expenseCategories[0] || 'Mantenimiento & Reparación');
  const [description, setDescription] = useState<string>('');
  const [vendorOrPayee, setVendorOrPayee] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');

  // New category creation state
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  // UI state
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('create');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!isOpen || !property) return null;

  // Filter expenses strictly for this property
  const propertyExpenses = expenses
    .filter((e) => e.propertyId === property.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalExpensesAmount = propertyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const resetForm = () => {
    setEditingExpenseId(null);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory(expenseCategories[0] || 'Mantenimiento & Reparación');
    setDescription('');
    setVendorOrPayee('');
    setReceiptNumber('');
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setFormError(null);
  };

  const handleStartEdit = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setAmount(String(exp.amount));
    setDate(exp.date);
    setCategory(exp.category);
    setDescription(exp.description);
    setVendorOrPayee(exp.vendorOrPayee || '');
    setReceiptNumber(exp.receiptNumber || '');
    setActiveTab('create');
    setFormError(null);
  };

  const handleSaveNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (!expenseCategories.includes(trimmed)) {
      onAddCategory(trimmed);
    }
    setCategory(trimmed);
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(isEn ? 'Please enter a valid expense amount greater than 0.' : 'Por favor introduce un monto de gasto válido mayor a 0.');
      return;
    }

    if (!date) {
      setFormError(isEn ? 'Please select a date for the expense.' : 'Por favor selecciona la fecha del gasto.');
      return;
    }

    if (!description.trim()) {
      setFormError(isEn ? 'Please describe the expense.' : 'Por favor ingresa una descripción o motivo del gasto.');
      return;
    }

    const expensePayload: Expense = {
      id: editingExpenseId || `exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      propertyId: property.id,
      amount: numAmount,
      date,
      category: category || 'Otros Gastos Operativos',
      description: description.trim(),
      vendorOrPayee: vendorOrPayee.trim() || undefined,
      receiptNumber: receiptNumber.trim() || undefined,
      createdAt: editingExpenseId ? (expenses.find((e) => e.id === editingExpenseId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveExpense(expensePayload);
    resetForm();
    setActiveTab('list');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto text-slate-900 dark:text-slate-100 relative animate-fade-in flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isEn ? 'Property Expenses' : 'Gastos de la Propiedad'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  {propertyExpenses.length} {isEn ? 'recorded' : 'registrados'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200">{property.propertyIdentifier}</span>
                <span>•</span>
                <span>{property.tenant1.name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
            title={isEn ? 'Close' : 'Cerrar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Header & Summary */}
        <div className="px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                if (editingExpenseId) resetForm();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingExpenseId ? (isEn ? 'Edit Expense' : 'Modificar Gasto') : (isEn ? '+ Record Expense' : '+ Registrar Gasto')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isEn ? 'Expense History' : 'Historial de Gastos'} ({propertyExpenses.length})</span>
            </button>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">{isEn ? 'Total Expenses' : 'Total Gastos'}</span>
            <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
              {formatCurrency(totalExpensesAmount, currencySymbol)}
            </span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: FORM (Create or Edit) */}
          {activeTab === 'create' && (
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isEn ? 'Expense Amount' : 'Cantidad del Gasto'} ({currencySymbol}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isEn ? 'Expense Date' : 'Fecha del Gasto'} *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Category selector & option to define a new category */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-500" />
                    <span>{isEn ? 'Expense Category' : 'Categoría del Gasto'} *</span>
                  </label>

                  {!isCreatingCategory && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(true)}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>{isEn ? '+ Define new category' : '+ Definir nueva categoría'}</span>
                    </button>
                  )}
                </div>

                {isCreatingCategory ? (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-rose-400 space-y-2">
                    <label className="block text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      {isEn ? 'New Category Name (will be saved for future expenses):' : 'Nombre de la nueva categoría (se guardará para futuros gastos):'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder={isEn ? 'e.g. Gardening, Waterproofing...' : 'Ej: Jardinería, Fumigación, Impermeabilización...'}
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveNewCategory}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        {isEn ? 'Save' : 'Guardar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCategory(false)}
                        className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition cursor-pointer"
                      >
                        {isEn ? 'Cancel' : 'Cancelar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setIsCreatingCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    {expenseCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__new__">
                      {isEn ? '➕ + Define new category...' : '➕ + Definir nueva categoría...'}
                    </option>
                  </select>
                )}
              </div>

              {/* Description / Detail */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isEn ? 'Description / Detail of Expense' : 'Concepto o Detalle del Gasto'} *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder={
                      isEn
                        ? 'e.g. Replaced bathroom water faucet and seals'
                        : 'Ej: Arreglo de fuga de tubería en baño principal y empaques'
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Optional: Vendor / Payee and Receipt / Invoice Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isEn ? 'Vendor / Contractor / Payee (Optional)' : 'Proveedor / Contratista (Opcional)'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={isEn ? 'e.g. Home Depot, Juan Plumber' : 'Ej: Ferretería El Centro, Plomero Roberto'}
                      value={vendorOrPayee}
                      onChange={(e) => setVendorOrPayee(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {isEn ? 'Invoice / Receipt # (Optional)' : 'Factura / Recibo / Comprobante #'}
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={isEn ? 'e.g. REC-1042' : 'Ej: FAC-8931 / TICKET-42'}
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                {editingExpenseId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                  >
                    {isEn ? 'Cancel Edit' : 'Cancelar Edición'}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    * {isEn ? 'Fields marked with * are required' : 'Campos con * son obligatorios'}
                  </span>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer ml-auto"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingExpenseId
                      ? (isEn ? 'Update Expense' : 'Guardar Cambios del Gasto')
                      : (isEn ? 'Record Expense' : 'Registrar Gasto')}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: EXPENSE LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {propertyExpenses.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {isEn ? 'No expenses registered for this property' : 'No hay gastos registrados para esta propiedad'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {isEn
                        ? 'Record maintenance repairs, taxes, insurance, or operational costs to track net cashflow.'
                        : 'Registra reparaciones, mantenimiento, plomería, seguros o impuestos para fiscalizar el flujo neto de tu propiedad.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Record First Expense' : 'Registrar Primer Gasto'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {propertyExpenses.map((exp) => {
                    const isDeleting = deleteConfirmId === exp.id;

                    return (
                      <div
                        key={exp.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              {exp.category}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDate(exp.date)}
                            </span>
                            {exp.receiptNumber && (
                              <span className="text-[10px] text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono">
                                #{exp.receiptNumber}
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {exp.description}
                          </p>

                          {exp.vendorOrPayee && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{isEn ? 'Payee:' : 'Pagado a:'} <strong>{exp.vendorOrPayee}</strong></span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
                          <div className="text-right">
                            <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                              {formatCurrency(exp.amount, currencySymbol)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {isDeleting ? (
                              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-rose-300 dark:border-rose-800">
                                <span className="text-[10px] font-bold text-rose-600 px-1">
                                  {isEn ? 'Delete?' : '¿Borrar?'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteExpense(exp.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-500"
                                >
                                  {isEn ? 'Yes' : 'Sí'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-1.5 py-1 text-slate-500 rounded-lg text-[10px]"
                                >
                                  {isEn ? 'No' : 'No'}
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(exp)}
                                  className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                                  title={isEn ? 'Edit expense' : 'Editar gasto'}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(exp.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                                  title={isEn ? 'Delete expense' : 'Eliminar gasto'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>
            {propertyExpenses.length} {isEn ? 'expenses for this property' : 'gastos en esta propiedad'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {isEn ? 'Done' : 'Listo'}
          </button>
        </div>

      </div>
    </div>
  );
};
