/**
 * Utilidad de Gestión de Prueba Gratuita (6 Semanas), Suscripción y Licenciamiento
 * 
 * Reglas de negocio:
 * 1. 6 Semanas de prueba gratuita (42 días) con todas las funciones activas.
 * 2. Tras 6 semanas, si no hay suscripción activa:
 *    - Se limitan: Push notifications, envío de WhatsApp, envío de Email, generar PDF e Imprimir.
 *    - Se mantienen activas: Registro de pagos recibidos (+ Pago), gestión interna de cobros en pantalla,
 *      backup y restauración en Google Drive.
 * 3. Usuarios vitalicios (Lifetime VIP) reconocidos internamente en el código sin cobro alguno.
 * 4. Planes de pago:
 *    - Mensual: $17.85 USD / mes por adelantado.
 *    - Anual: $187.20 USD / año por adelantado.
 * 5. La descarga/copia del código fuente (.ZIP) es de uso exclusivo para los usuarios vitalicios autorizados.
 */

import {
  verifyServerSubscription,
  recordServerSubscription,
  ServerSubscriptionResponse,
} from './supabase';

// Lista interna de correos vitalicios autorizados (con permisos de desarrollador como respaldo offline)
export const LIFETIME_VIP_EMAILS: string[] = [
  'elmerpr@gmail.com',
  'fam.sanchez.y.flores@gmail.com',
  'carmensanchezpr2@gmail.com',
  'amnerys.miflosa@gmail.com',
];

export const SUBSCRIPTION_PRICING = {
  monthly: 17.85,
  annual: 187.20,
  monthlyEquivalentAnnual: 15.60,
  currency: 'USD',
  currencySymbol: '$',
  trialWeeks: 6,
  trialDays: 42,
};

const STORAGE_KEY_FIRST_USE = 'gestor_arrendamientos_first_use_v1';
const STORAGE_KEY_SUBSCRIPTION = 'gestor_arrendamientos_subscription_v1';
const STORAGE_KEY_SERVER_CACHE = 'gestor_arrendamientos_server_sub_cache_v1';

export type SubscriptionPlan = 'monthly' | 'annual' | 'lifetime';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'lifetime';

export interface StoredSubscription {
  status: SubscriptionStatus;
  plan?: SubscriptionPlan;
  startDate: string;
  expiryDate?: string;
  amountPaid?: number;
  currency?: string;
  email?: string;
  paymentMethod?: string;
  serverVerified?: boolean;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  plan?: SubscriptionPlan;
  startDate: string;
  expiryDate?: string;
  daysRemainingInTrial: number;
  totalTrialDays: number;
  elapsedTrialDays: number;
  isLifetime: boolean;
  canUseFullFeatures: boolean; // Enviar WhatsApp, Email, Generar PDF, Imprimir, Push Notif
  canExportCode: boolean; // Descarga de código .ZIP protegida por el backend
  pricing: typeof SUBSCRIPTION_PRICING;
  isServerVerified?: boolean;
  serverMessage?: string;
}

/**
 * Normaliza un email eliminando espacios y convirtiendo a minúsculas
 */
function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Verifica si alguno de los correos suministrados pertenece a la lista de usuarios vitalicios
 */
export function isLifetimeVip(emails?: (string | null | undefined)[] | string | null): boolean {
  if (!emails) return false;
  const list = Array.isArray(emails) ? emails : [emails];
  return list.some((e) => {
    const norm = normalizeEmail(e);
    return norm.length > 0 && LIFETIME_VIP_EMAILS.some((vip) => normalizeEmail(vip) === norm);
  });
}

/**
 * Obtiene el último estado verificado desde el servidor Supabase
 */
export function getServerCachedSubscription(): ServerSubscriptionResponse | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY_SERVER_CACHE);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.error('Error al leer caché del servidor:', e);
  }
  return null;
}

/**
 * Guarda el estado verificado del servidor en caché local
 */
export function setServerCachedSubscription(serverResp: ServerSubscriptionResponse): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_SERVER_CACHE, JSON.stringify(serverResp));
    }
  } catch (e) {
    console.error('Error al guardar caché del servidor:', e);
  }
}

/**
 * Obtiene o inicializa la fecha del primer uso de la app (inicio de las 6 semanas)
 */
export function getFirstUseDate(): Date {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY_FIRST_USE);
      if (stored) {
        const parsed = new Date(stored);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      // Inicializar hoy
      const now = new Date();
      localStorage.setItem(STORAGE_KEY_FIRST_USE, now.toISOString());
      return now;
    }
  } catch (e) {
    console.error('Error al leer fecha de primer uso:', e);
  }
  return new Date();
}

/**
 * Obtiene la suscripción guardada
 */
export function getStoredSubscription(): StoredSubscription | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY_SUBSCRIPTION);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.error('Error al leer suscripción:', e);
  }
  return null;
}

/**
 * Guarda o actualiza la suscripción en almacenamiento local
 */
export function saveSubscription(sub: StoredSubscription): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(sub));
    }
  } catch (e) {
    console.error('Error al guardar suscripción:', e);
  }
}

/**
 * Sincroniza y verifica el estado de la suscripción contra el servidor Supabase
 */
export async function syncSubscriptionWithServer(
  userEmails?: (string | null | undefined)[]
): Promise<SubscriptionState> {
  const serverResult = await verifyServerSubscription(userEmails || []);
  if (serverResult) {
    setServerCachedSubscription(serverResult);

    // Mapear a SubscriptionState
    return {
      status: serverResult.status,
      plan: serverResult.plan,
      startDate: serverResult.start_date || new Date().toISOString(),
      expiryDate: serverResult.expiry_date,
      daysRemainingInTrial: serverResult.days_remaining_in_trial,
      totalTrialDays: serverResult.total_trial_days || 42,
      elapsedTrialDays: Math.max(0, 42 - serverResult.days_remaining_in_trial),
      isLifetime: serverResult.is_lifetime,
      canUseFullFeatures: serverResult.can_use_full_features,
      canExportCode: serverResult.can_export_code,
      pricing: SUBSCRIPTION_PRICING,
      isServerVerified: true,
      serverMessage: serverResult.message,
    };
  }

  // Si no hay respuesta del servidor, usar el estado local
  return getSubscriptionState(userEmails);
}

/**
 * Reinicia la fecha de inicio del periodo de prueba y limpia cachés obsoletos
 */
export function resetTrialStartDate(date: Date = new Date()): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_FIRST_USE, date.toISOString());
      localStorage.removeItem(STORAGE_KEY_SERVER_CACHE);
    }
  } catch (e) {
    console.error('Error al reiniciar periodo de prueba:', e);
  }
}

/**
 * Calcula el estado actual de la suscripción y permisos del usuario.
 * Prioriza la validación del servidor si está disponible en caché y corresponde a un usuario válido.
 */
export function getSubscriptionState(userEmails?: (string | null | undefined)[]): SubscriptionState {
  const isVip = isLifetimeVip(userEmails);

  // 1. Revisar si tenemos una validación reciente del servidor Supabase
  const serverCache = getServerCachedSubscription();
  if (serverCache) {
    // Salvaguarda: si el caché del servidor dice VIP pero ninguno de los correos actuales es VIP, invalidar caché
    if (serverCache.is_lifetime && !isVip) {
      try {
        localStorage.removeItem(STORAGE_KEY_SERVER_CACHE);
      } catch {}
    } else {
      return {
        status: serverCache.status,
        plan: serverCache.plan,
        startDate: serverCache.start_date || new Date().toISOString(),
        expiryDate: serverCache.expiry_date,
        daysRemainingInTrial: serverCache.days_remaining_in_trial,
        totalTrialDays: serverCache.total_trial_days || 42,
        elapsedTrialDays: Math.max(0, 42 - serverCache.days_remaining_in_trial),
        isLifetime: serverCache.is_lifetime,
        canUseFullFeatures: serverCache.can_use_full_features,
        canExportCode: serverCache.can_export_code,
        pricing: SUBSCRIPTION_PRICING,
        isServerVerified: true,
        serverMessage: serverCache.message,
      };
    }
  }

  // Si es usuario vitalicio reconocido offline
  if (isVip) {
    return {
      status: 'lifetime',
      plan: 'lifetime',
      startDate: new Date().toISOString(),
      daysRemainingInTrial: 42,
      totalTrialDays: 42,
      elapsedTrialDays: 0,
      isLifetime: true,
      canUseFullFeatures: true,
      canExportCode: true,
      pricing: SUBSCRIPTION_PRICING,
    };
  }

  // Verificar si hay suscripción de pago activa
  const storedSub = getStoredSubscription();
  const now = new Date();

  if (storedSub && storedSub.status === 'active' && storedSub.expiryDate) {
    const expiry = new Date(storedSub.expiryDate);
    if (expiry.getTime() > now.getTime()) {
      return {
        status: 'active',
        plan: storedSub.plan,
        startDate: storedSub.startDate,
        expiryDate: storedSub.expiryDate,
        daysRemainingInTrial: 0,
        totalTrialDays: 42,
        elapsedTrialDays: 42,
        isLifetime: false,
        canUseFullFeatures: true,
        canExportCode: false,
        pricing: SUBSCRIPTION_PRICING,
      };
    }
  }

  // Si no hay suscripción activa, evaluar periodo de prueba de 6 semanas (42 días)
  const firstUse = getFirstUseDate();
  const diffMs = now.getTime() - firstUse.getTime();
  const elapsedDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, 42 - elapsedDays);

  if (elapsedDays < 42) {
    return {
      status: 'trial',
      startDate: firstUse.toISOString(),
      daysRemainingInTrial: daysRemaining,
      totalTrialDays: 42,
      elapsedTrialDays: elapsedDays,
      isLifetime: false,
      canUseFullFeatures: true,
      canExportCode: false,
      pricing: SUBSCRIPTION_PRICING,
    };
  }

  // Si ya pasaron las 6 semanas y no se ha pagado
  return {
    status: 'expired',
    startDate: firstUse.toISOString(),
    daysRemainingInTrial: 0,
    totalTrialDays: 42,
    elapsedTrialDays: elapsedDays,
    isLifetime: false,
    canUseFullFeatures: false, // Bloquear push, whatsapp, email, pdf e imprimir
    canExportCode: false, // Bloquear descarga de código
    pricing: SUBSCRIPTION_PRICING,
  };
}

/**
 * Activa una suscripción (Mensual o Anual)
 */
export function activateSubscription(
  plan: 'monthly' | 'annual',
  email?: string,
  paymentMethod: string = 'Tarjeta de Crédito / Débito'
): StoredSubscription {
  const now = new Date();
  const expiry = new Date(now);

  if (plan === 'monthly') {
    expiry.setMonth(expiry.getMonth() + 1);
  } else {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }

  const sub: StoredSubscription = {
    status: 'active',
    plan,
    startDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    amountPaid: plan === 'monthly' ? SUBSCRIPTION_PRICING.monthly : SUBSCRIPTION_PRICING.annual,
    currency: SUBSCRIPTION_PRICING.currency,
    email: normalizeEmail(email),
    paymentMethod,
  };

  saveSubscription(sub);

  // Sincronizar activación en segundo plano con el backend Supabase
  if (email) {
    recordServerSubscription(
      email,
      plan,
      sub.amountPaid || 0,
      paymentMethod
    ).catch((err) => console.warn('No se pudo sincronizar activación con Supabase:', err));
  }

  return sub;
}

/**
 * Cancela o reinicia la suscripción
 */
export function cancelSubscription(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY_SUBSCRIPTION);
      localStorage.removeItem(STORAGE_KEY_SERVER_CACHE);
    }
  } catch (e) {
    console.error(e);
  }
}
