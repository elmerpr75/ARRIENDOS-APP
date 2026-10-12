import { Property, Payment, LandlordProfile, Administrator } from '../types';

const STORAGE_KEYS = {
  PROPERTIES: 'gestor_arrendamientos_properties_v1',
  PAYMENTS: 'gestor_arrendamientos_payments_v1',
  PROFILE: 'gestor_arrendamientos_profile_v1',
  ADMINISTRATORS: 'gestor_arrendamientos_administrators_v1',
};

export const DEFAULT_ADMINISTRATORS: Administrator[] = [
  {
    id: 'admin-1',
    companyName: 'Inmobiliaria & Arrendamientos Premier',
    landlordName: 'Ing. Alejandro Morales V.',
    taxId: 'IAP-920415-XYZ',
    phone: '+52 55 4123 9876',
    email: 'administracion@inmobiliariapremier.com',
    address: 'Av. Reforma 1240, Piso 5, CDMX',
    bankDetails: 'Banco BBVA • Cuenta: 0123 4567 8901 • CLABE: 012 180 00123456789 0',
    invoiceNote: 'El pago debe realizarse dentro de los primeros días estipulados en contrato para evitar cargos por mora.',
    currencyCode: 'USD',
    currencySymbol: '$',
    isDefault: true,
  },
];

const DEFAULT_PROFILE: LandlordProfile = {
  companyName: 'Inmobiliaria & Arrendamientos',
  landlordName: 'Administrador de Propiedades',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  bankDetails: '',
  invoiceNote: 'El pago debe realizarse dentro de los primeros días estipulados en contrato para evitar cargos por mora.',
  currencyCode: 'USD',
  currencySymbol: '$',
  googleDriveFolderId: '',
  googleDriveAccountEmail: '',
  administrators: DEFAULT_ADMINISTRATORS,
};

const INITIAL_PROPERTIES: Property[] = [
  {
    id: 'prop-1',
    administratorId: 'admin-1',
    propertyIdentifier: 'Depto 402 - Torre Altura',
    address: 'Av. Insurgentes Sur 1890, Col. Florida, CDMX',
    rentAmount: 11500,
    rentDueDay: 5,
    graceDays: 3,
    lateFeeBase: 300,
    lateFeeDaily: 50,
    lateFeeCapEnabled: true,
    lateFeeCapType: 'amount',
    lateFeeMaxAmount: 800,
    lateFeeMaxDays: 10,
    contractStartDate: '2025-10-01',
    contractEndDate: '2026-09-30', // Expiring in ~24 days!
    tenant1: {
      name: 'Carlos Mendoza Silva',
      phone: '+52 55 9876 5432',
      email: 'carlos.mendoza@gmail.com',
      idNumber: 'INE: 3829103948',
    },
    tenant2: {
      name: 'Mariana Ortiz Delgado',
      phone: '+52 55 1234 5678',
      email: 'mariana.ortiz@outlook.com',
      idNumber: 'INE: 5938201948',
    },
    depositAmount: 11500,
    notes: 'Incluye 1 cajón de estacionamiento y cuota de mantenimiento.',
    active: true,
    createdAt: '2025-10-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'prop-2',
    administratorId: 'admin-1',
    propertyIdentifier: 'Casa 18 - Condominio Los Encinos',
    address: 'Calle Cedros #45, Fracc. Los Encinos, Querétaro',
    rentAmount: 16000,
    rentDueDay: 1,
    graceDays: 3,
    lateFeeBase: 400,
    lateFeeDaily: 80,
    lateFeeCapEnabled: true,
    lateFeeCapType: 'days',
    lateFeeMaxAmount: 1000,
    lateFeeMaxDays: 10,
    contractStartDate: '2026-01-15',
    contractEndDate: '2027-01-14',
    tenant1: {
      name: 'Roberto Valenzuela Gómez',
      phone: '+52 44 2345 6789',
      email: 'rvalenzuela@empresa.com',
      idNumber: 'INE: 9283719482',
    },
    depositAmount: 16000,
    notes: 'Mascota permitida bajo depósito adicional.',
    active: true,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  },
  {
    id: 'prop-3',
    administratorId: 'admin-1',
    propertyIdentifier: 'Local 3B - Plaza Campanario',
    address: 'Blvd. Bernardo Quintana 200, Local 3B, Querétaro',
    rentAmount: 14500,
    rentDueDay: 10,
    graceDays: 2,
    lateFeeBase: 500,
    lateFeeDaily: 100,
    contractStartDate: '2025-11-01',
    contractEndDate: '2026-10-31',
    tenant1: {
      name: 'Dra. Elena Ramos Morales',
      phone: '+52 44 2987 6543',
      email: 'clinica.ramos@gmail.com',
      idNumber: 'RFC: RAMM850412A12',
    },
    tenant2: {
      name: 'Lic. Andrés Ramos Morales',
      phone: '+52 44 2112 3344',
      email: 'andres.ramos@corporativo.mx',
    },
    depositAmount: 29000,
    notes: 'Giro consultorio dental y nutrición.',
    active: true,
    createdAt: '2025-11-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    propertyId: 'prop-1',
    date: '2026-09-03',
    amount: 11500,
    payerName: 'Carlos Mendoza Silva',
    paymentMethod: 'transferencia',
    reference: 'SPEI-88492019',
    period: 'Septiembre 2026',
    notes: 'Renta Septiembre pagada puntual vía transferencia BBVA.',
    createdAt: '2026-09-03T11:20:00.000Z',
  },
  {
    id: 'pay-2',
    propertyId: 'prop-2',
    date: '2026-08-02',
    amount: 16000,
    payerName: 'Roberto Valenzuela Gómez',
    paymentMethod: 'transferencia',
    reference: 'SPEI-19283746',
    period: 'Agosto 2026',
    notes: 'Pago correspondiente al mes de Agosto.',
    createdAt: '2026-08-02T16:45:00.000Z',
  },
  {
    id: 'pay-3',
    propertyId: 'prop-3',
    date: '2026-08-09',
    amount: 14500,
    payerName: 'Dra. Elena Ramos Morales',
    paymentMethod: 'deposito',
    reference: 'DEP-492019',
    period: 'Agosto 2026',
    notes: 'Depósito en ventanilla Santander.',
    createdAt: '2026-08-09T14:10:00.000Z',
  },
];

const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch (e) {
    console.warn('localStorage read error, falling back to memoryStore:', e);
  }
  return memoryStore[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  memoryStore[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage write error, saved to memoryStore:', e);
  }
}

export function loadAdministrators(): Administrator[] {
  try {
    const raw = safeGetItem(STORAGE_KEYS.ADMINISTRATORS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 7);
      }
    }
  } catch (e) {
    console.error('Error loading administrators:', e);
  }

  // Fallback: check profile.administrators or build from current profile
  const currentProfile = loadLandlordProfile();
  if (currentProfile.administrators && currentProfile.administrators.length > 0) {
    const valid = currentProfile.administrators.slice(0, 7);
    saveAdministrators(valid);
    return valid;
  }

  const initialAdmin: Administrator = {
    id: 'admin-1',
    companyName: currentProfile.companyName || 'Inmobiliaria & Arrendamientos Premier',
    landlordName: currentProfile.landlordName || 'Ing. Alejandro Morales V.',
    taxId: currentProfile.taxId || 'IAP-920415-XYZ',
    phone: currentProfile.phone || '+52 55 4123 9876',
    email: currentProfile.email || 'administracion@inmobiliariapremier.com',
    address: currentProfile.address || 'Av. Reforma 1240, Piso 5, CDMX',
    logoUrl: currentProfile.logoUrl,
    bankDetails: currentProfile.bankDetails || 'Banco BBVA • Cuenta: 0123 4567 8901 • CLABE: 012 180 00123456789 0',
    invoiceNote: currentProfile.invoiceNote || 'El pago debe realizarse dentro de los primeros días estipulados en contrato para evitar cargos por mora.',
    currencyCode: currentProfile.currencyCode || 'USD',
    currencySymbol: currentProfile.currencySymbol || '$',
    isDefault: true,
  };

  const defaults = [initialAdmin];
  saveAdministrators(defaults);
  return defaults;
}

export function saveAdministrators(admins: Administrator[]): void {
  try {
    const trimmed = (admins && admins.length > 0 ? admins : DEFAULT_ADMINISTRATORS).slice(0, 7);
    safeSetItem(STORAGE_KEYS.ADMINISTRATORS, JSON.stringify(trimmed));

    // Keep primary profile in sync with default or first administrator
    const primary = trimmed.find((a) => a.isDefault) || trimmed[0];
    if (primary) {
      const currentProfile = loadLandlordProfile();
      saveLandlordProfile({
        ...currentProfile,
        companyName: primary.companyName,
        landlordName: primary.landlordName,
        taxId: primary.taxId,
        phone: primary.phone,
        email: primary.email,
        address: primary.address,
        logoUrl: primary.logoUrl,
        bankDetails: primary.bankDetails,
        invoiceNote: primary.invoiceNote,
        currencyCode: primary.currencyCode,
        currencySymbol: primary.currencySymbol,
        administrators: trimmed,
      });
    }
  } catch (e) {
    console.error('Error saving administrators:', e);
  }
}

export function getAdministratorForProperty(
  property?: Property | null,
  administrators?: Administrator[]
): Administrator {
  const admins = administrators && administrators.length > 0 ? administrators : loadAdministrators();
  if (property?.administratorId) {
    const found = admins.find((a) => a.id === property.administratorId);
    if (found) return found;
  }
  const defaultAdmin = admins.find((a) => a.isDefault) || admins[0];
  return defaultAdmin || DEFAULT_ADMINISTRATORS[0];
}

export function loadProperties(): Property[] {
  try {
    const data = safeGetItem(STORAGE_KEYS.PROPERTIES);
    if (data) {
      const parsed: Property[] = JSON.parse(data);
      // Ensure all properties have an administratorId
      const admins = loadAdministrators();
      const defaultId = admins[0]?.id || 'admin-1';
      const updated = parsed.map((p) => ({
        ...p,
        administratorId: p.administratorId || defaultId,
      }));
      return updated;
    }
  } catch (e) {
    console.error('Error loading properties:', e);
  }
  saveProperties(INITIAL_PROPERTIES);
  return INITIAL_PROPERTIES;
}

export function saveProperties(properties: Property[]): void {
  try {
    safeSetItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
  } catch (e) {
    console.error('Error saving properties:', e);
  }
}

export function loadPayments(): Payment[] {
  try {
    const data = safeGetItem(STORAGE_KEYS.PAYMENTS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading payments:', e);
  }
  savePayments(INITIAL_PAYMENTS);
  return INITIAL_PAYMENTS;
}

export function savePayments(payments: Payment[]): void {
  try {
    safeSetItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  } catch (e) {
    console.error('Error saving payments:', e);
  }
}

export function loadLandlordProfile(): LandlordProfile {
  try {
    const data = safeGetItem(STORAGE_KEYS.PROFILE);
    if (data) {
      const parsed: LandlordProfile = JSON.parse(data);
      return parsed;
    }
  } catch (e) {
    console.error('Error loading profile:', e);
  }
  saveLandlordProfile(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

export function saveLandlordProfile(profile: LandlordProfile): void {
  try {
    safeSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile:', e);
  }
}

export function exportAppData(): string {
  const administrators = loadAdministrators();
  const profile = loadLandlordProfile();
  const data = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    properties: loadProperties(),
    payments: loadPayments(),
    profile: {
      ...profile,
      administrators,
    },
    administrators,
  };
  return JSON.stringify(data, null, 2);
}

export interface ImportDataResult {
  success: boolean;
  propertiesCount: number;
  paymentsCount: number;
  hasProfile: boolean;
  administratorsCount?: number;
  error?: string;
}

export function importAppData(jsonString: string): ImportDataResult {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return { success: false, propertiesCount: 0, paymentsCount: 0, hasProfile: false, error: 'Contenido vacío o inválido.' };
    }

    let parsed = JSON.parse(jsonString);
    // Handle cases where JSON was stringified twice
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }

    let importedPropsCount = 0;
    let importedPaymentsCount = 0;
    let hasProfile = false;
    let importedAdminsCount = 0;

    // Check administrators first
    const candidateAdmins = parsed.administrators || parsed.data?.administrators || parsed.profile?.administrators;
    if (candidateAdmins && Array.isArray(candidateAdmins) && candidateAdmins.length > 0) {
      saveAdministrators(candidateAdmins);
      importedAdminsCount = candidateAdmins.length;
    }

    // Check profile
    const candidateProfile = parsed.profile || parsed.data?.profile;
    if (candidateProfile && typeof candidateProfile === 'object' && !Array.isArray(candidateProfile)) {
      const currentProfile = loadLandlordProfile();
      saveLandlordProfile({
        ...currentProfile,
        ...candidateProfile,
      });
      hasProfile = true;

      if (importedAdminsCount === 0) {
        // Generate admin-1 from imported profile
        const adminFromProfile: Administrator = {
          id: 'admin-1',
          companyName: candidateProfile.companyName || currentProfile.companyName || 'Inmobiliaria & Arrendamientos Premier',
          landlordName: candidateProfile.landlordName || currentProfile.landlordName || '',
          taxId: candidateProfile.taxId || currentProfile.taxId || '',
          phone: candidateProfile.phone || currentProfile.phone || '',
          email: candidateProfile.email || currentProfile.email || '',
          address: candidateProfile.address || currentProfile.address || '',
          logoUrl: candidateProfile.logoUrl || currentProfile.logoUrl,
          bankDetails: candidateProfile.bankDetails || currentProfile.bankDetails || '',
          invoiceNote: candidateProfile.invoiceNote || currentProfile.invoiceNote || '',
          currencyCode: candidateProfile.currencyCode || 'USD',
          currencySymbol: candidateProfile.currencySymbol || '$',
          isDefault: true,
        };
        saveAdministrators([adminFromProfile]);
        importedAdminsCount = 1;
      }
    }

    // Check properties
    const candidateProps = parsed.properties || parsed.data?.properties || (Array.isArray(parsed) ? parsed : null);
    if (candidateProps && Array.isArray(candidateProps)) {
      const admins = loadAdministrators();
      const defaultAdminId = admins[0]?.id || 'admin-1';
      const normalizedProps = candidateProps.map((p) => ({
        ...p,
        administratorId: p.administratorId || defaultAdminId,
      }));
      saveProperties(normalizedProps);
      importedPropsCount = normalizedProps.length;
    }

    // Check payments
    const candidatePayments = parsed.payments || parsed.data?.payments;
    if (candidatePayments && Array.isArray(candidatePayments)) {
      savePayments(candidatePayments);
      importedPaymentsCount = candidatePayments.length;
    }

    if (importedPropsCount === 0 && importedPaymentsCount === 0 && !hasProfile && importedAdminsCount === 0) {
      return {
        success: false,
        propertiesCount: 0,
        paymentsCount: 0,
        hasProfile: false,
        error: 'El archivo JSON no contiene secciones de propiedades ni pagos reconocibles.',
      };
    }

    return {
      success: true,
      propertiesCount: importedPropsCount,
      paymentsCount: importedPaymentsCount,
      hasProfile,
      administratorsCount: importedAdminsCount,
    };
  } catch (e: any) {
    console.error('Error importing data:', e);
    return {
      success: false,
      propertiesCount: 0,
      paymentsCount: 0,
      hasProfile: false,
      error: e?.message || 'Error de sintaxis en archivo JSON.',
    };
  }
}

