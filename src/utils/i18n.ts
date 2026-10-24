export type SupportedLanguage = 'es' | 'en';

export const STORAGE_KEY_LANG = 'gestor_arrendamientos_lang_v1';
export const STORAGE_KEY_ONBOARDING_DONE = 'gestor_arrendamientos_onboarding_done_v1';

export function getSavedLanguage(): SupportedLanguage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved === 'en' || saved === 'es') {
        return saved;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return 'es'; // default
}

export function saveLanguage(lang: SupportedLanguage): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    }
  } catch (e) {
    console.error(e);
  }
}

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_ONBOARDING_DONE) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY_ONBOARDING_DONE, 'true');
  } catch {
    // ignore
  }
}

export const translations = {
  es: {
    // Header & Brand
    appTitle: 'ARRIENDOS - Rent Manager',
    appSubtitle: 'Control Integral de Alquileres, Cobranza & Recibos',
    androidWeb: 'Android & Web',
    googleDriveSync: 'Google Drive',
    logoTimbre: 'Configuración',
    notifications: 'Notificaciones',
    pendingAlerts: 'avisos pendientes',

    // Nav Tabs
    tabProperties: 'Propiedades',
    tabTracking: 'Cobranza',
    tabAudit: 'Libro',
    tabReminders: 'Alertas',
    tabReports: 'Reporte',

    // Common Buttons & Actions
    newProperty: '+ Nueva Propiedad',
    recordPayment: '+ Registrar Pago',
    exportReport: 'Exportar Reporte',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    downloadPdf: 'Descargar PDF',
    print: 'Imprimir',
    shareWhatsapp: 'Enviar WhatsApp',
    copyText: 'Copiar Texto',
    copied: '¡Copiado!',
    searchPlaceholder: 'Buscar por propiedad, inquilino, dirección...',
    all: 'Todos',
    active: 'Activo',
    inactive: 'Inactivo',
    daysRemaining: 'días restantes',
    overdue: 'Atrasado',
    upToDate: 'Al día',
    upcomingDue: 'Por vencer',
    viewInvoice: 'Ver Factura',
    viewReceipt: 'Ver Recibo',

    // Financial & Terms
    rent: 'Renta',
    rentAmount: 'Monto de Renta',
    rentDueDay: 'Día de cobro',
    graceDays: 'Días de gracia',
    lateFeeBase: 'Mora inicial fija',
    lateFeeDaily: 'Mora diaria',
    depositAmount: 'Depósito en garantía',
    contractStart: 'Inicio de contrato',
    contractEnd: 'Vencimiento de contrato',
    tenant: 'Inquilino',
    tenant1: 'Inquilino Titular',
    tenant2: 'Segundo Inquilino / Fiador',
    address: 'Dirección',
    identifier: 'Identificador / N° Propiedad',
    notes: 'Notas y observaciones',
    bankDetails: 'Datos Bancarios para Pago',
    taxId: 'RFC / Identificación Fiscal',
    companyName: 'Nombre de Empresa / Arrendador',
    landlordName: 'Nombre del Propietario / Encargado',
    phone: 'Teléfono',
    email: 'Correo Electrónico',

    // Settings Modal
    settingsTitle: 'Configuración del Arrendador & Recibos',
    settingsSubtitle: 'Personaliza los datos y logotipo para facturas, recibos y avisos',
    generalData: 'Datos Generales & Logotipo',
    bankingData: 'Cuentas Bancarias & Notas Legales',
    pushNotificationsTitle: 'Notificaciones Push y Recordatorios de Factura',
    pushNotificationsDesc: 'Alertas en la barra de Android y Centro de Actividades de Windows',
    languageSectionTitle: 'Idioma de la Aplicación',
    languageSectionDesc: 'Selecciona el idioma de la interfaz (Español o Inglés)',
    spanish: 'Español (Principal)',
    english: 'English (Inglés)',
    themeSectionTitle: 'Tema y Apariencia Visual',
    themeSectionDesc: 'Elige entre tema claro, oscuro o sincronizar automáticamente con la configuración de tu equipo',
    themeLight: 'Tema Claro',
    themeLightDesc: 'Fondo blanco y colores nítidos de alto contraste',
    themeDark: 'Tema Oscuro',
    themeDarkDesc: 'Modo oscuro para reducir la fatiga visual',
    themeSystem: 'Definido por el Equipo (Automático)',
    themeSystemDesc: 'Se adapta automáticamente a la configuración de tu dispositivo',
    anticipationDays: 'Anticipación para recordar enviar factura:',
    daysBefore: 'días antes',
    testNotification: 'Probar Notificación Ahora',
    enableNotifications: 'Activar Notificaciones',
    quickOptions: 'Accesos rápidos:',
    defaultPreset: '(Por defecto)',
    googleDriveBackup: 'Copia de Seguridad en Google Drive',
    backupAndRestore: 'Copia de Seguridad y Restauración de Datos',
    downloadBackupJson: 'Descargar respaldo de mis datos (json)',
    restoreBackupJson: 'Restaurar mis datos (json)',
    backupNoticeUser: 'Guarda tus propiedades, inquilinos, recibos y logotipo en un archivo seguro.',
    exportZipCode: 'Descargar Código Fuente (.ZIP)',

    // Invoicing & Receipts Modal
    docQuestion: '¿Qué tipo de documento deseas generar?',
    docQuestionSubtitleReceipt: 'Recibo individual de pago con prelación contable y balances liquidados.',
    docQuestionSubtitleNextMonth: 'Aviso anticipado para el próximo ciclo con recordatorio de fecha límite.',
    docQuestionSubtitlePaid: 'Recibo comprobante de pago del mes actual - Cuenta al día.',
    docQuestionSubtitleInvoice: 'Factura del mes corriente con saldos y recargos vigentes.',
    btnCurrentInvoice: 'Factura Actual',
    btnCurrentReceipt: 'Recibo Actual',
    btnNextMonthInvoice: 'Próximo Mes',
    btnNextMonthBadge: 'Aviso',
    btnPaymentReceipt: 'Recibo de Pago',
    btnAdjustUtilities: 'Ajustar Utilidades',
    btnAdjustUtilitiesFull: 'Ajustar Factura Utilidades (Consumo Mes Anterior)',
    btnAdjustUtilitiesShort: 'Consumo anterior',
    sheetReceipt: 'Hoja de Recibo',
    sheetStatement: 'Hoja de Comprobante',
    sheetInvoice: 'Hoja de Factura',
    sendWhatsapp: 'Enviar por WhatsApp',
    emailTemplate: 'Plantilla de Correo',
    recipientLabel: 'Destinatario:',
    bothTenants: 'Ambos Inquilinos',
    createPdf: 'Crear PDF',
    generatingPdf: 'Generando...',
    printDoc: 'Imprimir',
    closeDoc: 'Cerrar',
    paymentReceiptTitle: 'Recibo de Pago / Comprobante',
    nextMonthTitle: 'Factura / Aviso de Cobro del Próximo Mes',
    currentReceiptTitle: 'Comprobante de Pago Liquidado',
    currentInvoiceTitle: 'Factura / Estado de Cuenta',
    quickUtilitiesTitle: 'Editar Factura de Utilidad según Consumo del Mes Anterior:',
    quickUtilitiesSubtitle: 'Modifique aquí los importes de agua y luz de la factura recibida del mes anterior para reflejarlos en esta factura corriente.',
    selectPaymentPrompt: 'Selecciona la entrada de pago a emitir en el recibo:',
    noPaymentsRegistered: 'No hay entradas de pago registradas aún para esta propiedad.',
    viewClearedReceipt: 'Ver Recibo del Mes Actual Liquidado',
    waterCost: 'Agua ($):',
    electricCost: 'LUMA / AEE ($):',
    saveCosts: 'Guardar Costos',
    costsSaved: '¡Guardado!',

    // Onboarding Modal (Initial Setup)
    welcomeTitle: 'Bienvenido a ARRIENDOS - Rent Manager',
    welcomeSubtitle: 'Configura tu idioma preferido para comenzar',
    chooseLanguage: 'Elige tu idioma / Choose your language',
    chooseLanguageDesc: 'Puedes cambiar el idioma en cualquier momento desde la barra superior o en Configuración.',
    getStarted: 'Comenzar a usar la Aplicación',
    continueEn: 'Continue in English',
    continueEs: 'Continuar en Español',
    feature1Title: 'Notificaciones Push Nativas',
    feature1Desc: 'Recordatorios automáticos en tu celular Android y en tu PC Windows para emitir tus facturas con 5 días de anticipación.',
    feature2Title: 'Recibos & Facturas Oficiales en PDF',
    feature2Desc: 'Generación instantánea de comprobantes con tu propio logo, cálculo de mora y envío directo a WhatsApp.',
    feature3Title: 'Respaldo Seguro en Google Drive',
    feature3Desc: 'Toda tu información sincronizada de forma segura en tu cuenta personal de Google Drive.',
  },
  en: {
    // Header & Brand
    appTitle: 'ARRIENDOS - Rent Manager',
    appSubtitle: 'Complete Rental Tracking, Collections & Invoices',
    androidWeb: 'Android & Web',
    googleDriveSync: 'Google Drive',
    logoTimbre: 'Configuration',
    notifications: 'Notifications',
    pendingAlerts: 'pending notices',

    // Nav Tabs
    tabProperties: 'Properties',
    tabTracking: 'Tracking',
    tabAudit: 'Ledger',
    tabReminders: 'Alerts',
    tabReports: 'Report',

    // Common Buttons & Actions
    newProperty: '+ New Property',
    recordPayment: '+ Record Payment',
    exportReport: 'Export Report',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    downloadPdf: 'Download PDF',
    print: 'Print',
    shareWhatsapp: 'Send WhatsApp',
    copyText: 'Copy Text',
    copied: 'Copied!',
    searchPlaceholder: 'Search property, tenant, address...',
    all: 'All',
    active: 'Active',
    inactive: 'Inactive',
    daysRemaining: 'days left',
    overdue: 'Overdue',
    upToDate: 'Up to Date',
    upcomingDue: 'Due Soon',
    viewInvoice: 'View Invoice',
    viewReceipt: 'View Receipt',

    // Financial & Terms
    rent: 'Rent',
    rentAmount: 'Monthly Rent',
    rentDueDay: 'Due day of month',
    graceDays: 'Grace period days',
    lateFeeBase: 'Initial flat late fee',
    lateFeeDaily: 'Daily late fee',
    depositAmount: 'Security deposit',
    contractStart: 'Lease start date',
    contractEnd: 'Lease end date',
    tenant: 'Tenant',
    tenant1: 'Primary Tenant',
    tenant2: 'Secondary Tenant / Guarantor',
    address: 'Address',
    identifier: 'Property ID / Unit Name',
    notes: 'Notes & Remarks',
    bankDetails: 'Bank Details for Payment',
    taxId: 'Tax ID / Fiscal Number',
    companyName: 'Company Name / Landlord',
    landlordName: 'Owner / Property Manager Name',
    phone: 'Phone',
    email: 'Email Address',

    // Settings Modal
    settingsTitle: 'Landlord Profile & Invoice Settings',
    settingsSubtitle: 'Customize your business details and logo for invoices, receipts and notifications',
    generalData: 'General Details & Logo',
    bankingData: 'Bank Accounts & Legal Notice',
    pushNotificationsTitle: 'Push Notifications & Invoice Reminders',
    pushNotificationsDesc: 'Status bar alerts on Android and Action Center banners on Windows',
    languageSectionTitle: 'Application Language',
    languageSectionDesc: 'Select your interface language (Spanish or English)',
    spanish: 'Español (Spanish)',
    english: 'English (Principal)',
    themeSectionTitle: 'Theme & Visual Appearance',
    themeSectionDesc: 'Choose between light theme, dark theme, or sync automatically with your device settings',
    themeLight: 'Light Theme',
    themeLightDesc: 'Clean white background and high-contrast styling',
    themeDark: 'Dark Theme',
    themeDarkDesc: 'Dark mode to reduce eye strain in low-light environments',
    themeSystem: 'Device Default (Automatic)',
    themeSystemDesc: 'Follows your phone, tablet or computer system preference',
    anticipationDays: 'Days in advance to remind sending rent invoice:',
    daysBefore: 'days before',
    testNotification: 'Test Notification Now',
    enableNotifications: 'Enable Notifications',
    quickOptions: 'Quick presets:',
    defaultPreset: '(Default)',
    googleDriveBackup: 'Google Drive Cloud Backup',
    backupAndRestore: 'Data Backup & Restore',
    downloadBackupJson: 'Download backup of my data (json)',
    restoreBackupJson: 'Restore my data (json)',
    backupNoticeUser: 'Save your properties, tenants, invoices and logo onto a secure file.',
    exportZipCode: 'Download Source Code (.ZIP)',

    // Invoicing & Receipts Modal
    docQuestion: 'What type of document do you want to generate?',
    docQuestionSubtitleReceipt: 'Individual payment receipt with accounting order and cleared balances.',
    docQuestionSubtitleNextMonth: 'Advance notice for the upcoming period with due date reminder.',
    docQuestionSubtitlePaid: 'Current month payment receipt voucher - Account up to date.',
    docQuestionSubtitleInvoice: 'Current month invoice with balance and applicable charges.',
    btnCurrentInvoice: 'Current Invoice',
    btnCurrentReceipt: 'Current Receipt',
    btnNextMonthInvoice: 'Next Month',
    btnNextMonthBadge: 'Notice',
    btnPaymentReceipt: 'Payment Receipt',
    btnAdjustUtilities: 'Adjust Utilities',
    btnAdjustUtilitiesFull: 'Adjust Utility Charges (Prior Month)',
    btnAdjustUtilitiesShort: 'Prior month',
    sheetReceipt: 'Receipt Sheet',
    sheetStatement: 'Voucher Sheet',
    sheetInvoice: 'Invoice Sheet',
    sendWhatsapp: 'Send via WhatsApp',
    emailTemplate: 'Email Template',
    recipientLabel: 'Recipient:',
    bothTenants: 'Both Tenants',
    createPdf: 'Create PDF',
    generatingPdf: 'Generating...',
    printDoc: 'Print',
    closeDoc: 'Close',
    paymentReceiptTitle: 'Payment Receipt / Voucher',
    nextMonthTitle: 'Invoice / Advance Notice for Next Month',
    currentReceiptTitle: 'Cleared Payment Voucher',
    currentInvoiceTitle: 'Invoice / Statement of Account',
    quickUtilitiesTitle: 'Edit Utility Invoice from Prior Month Consumption:',
    quickUtilitiesSubtitle: 'Update water and power charges from the prior month provider bill to reflect on this current invoice.',
    selectPaymentPrompt: 'Select payment entry to issue receipt for:',
    noPaymentsRegistered: 'No payment entries recorded yet for this property.',
    viewClearedReceipt: 'View Settled Current Month Receipt',
    waterCost: 'Water ($):',
    electricCost: 'Power / LUMA ($):',
    saveCosts: 'Save Costs',
    costsSaved: 'Saved!',

    // Onboarding Modal (Initial Setup)
    welcomeTitle: 'Welcome to ARRIENDOS - Rent Manager',
    welcomeSubtitle: 'Configure your preferred language to get started',
    chooseLanguage: 'Elige tu idioma / Choose your language',
    chooseLanguageDesc: 'You can change the language at any time from the top navigation or Settings.',
    getStarted: 'Start Using the Application',
    continueEn: 'Continue in English',
    continueEs: 'Continuar en Español',
    feature1Title: 'Native Push Notifications',
    feature1Desc: 'Automated reminders on your Android phone and Windows desktop 5 days before each rent is due.',
    feature2Title: 'Official PDF Invoices & Receipts',
    feature2Desc: 'Instant receipts with your own logo, automated late fees, and direct 1-click WhatsApp delivery.',
    feature3Title: 'Secure Google Drive Cloud Backup',
    feature3Desc: 'All your tenant records securely synchronized with your personal Google Drive account.',
  },
};
