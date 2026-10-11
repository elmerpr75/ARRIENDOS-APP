import { Property, Payment, LandlordProfile, NotificationSettings } from '../types';
import { formatCurrency, formatDate } from './calculations';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  daysBeforeRentDue: 5, // 5 días antes del 1er día de renta o vencimiento
  notifyOnDueDay: true,
  notifyOnOverdue: true,
  notifyContractExpiry: true,
  contractExpiryDays: 30,
};

const STORAGE_KEY_SETTINGS = 'gestor_arrendamientos_notification_settings_v1';
const STORAGE_KEY_LOG = 'gestor_arrendamientos_notification_log_v1';

/**
 * Obtener configuración de notificaciones guardada
 */
export function getNotificationSettings(profile?: LandlordProfile): NotificationSettings {
  if (profile?.notificationSettings) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...profile.notificationSettings };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Error al cargar configuración de notificaciones:', err);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

/**
 * Guardar configuración de notificaciones
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Error al guardar configuración de notificaciones:', err);
  }
}

/**
 * Verificar estado del permiso del navegador en Windows / Android
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Solicitar permiso de notificaciones nativas en el sistema operativo
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.error('Error solicitando permiso de notificaciones:', err);
    return Notification.permission;
  }
}

/**
 * Sonido sutil y elegante de notificación usando Web Audio API
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  } catch {
    // Silently ignore audio restrictions if user hasn't interacted
  }
}

export interface SendNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Disparar una notificación nativa en Android y Windows
 */
export async function sendNativeNotification(options: SendNotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  playNotificationSound();

  const iconUrl = options.icon || '/icon.svg';
  const badgeUrl = options.badge || '/icon.svg';

  // Intentar primero a través de Service Worker (es el estándar para PWA en Android y Windows)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(options.title, {
          body: options.body,
          icon: iconUrl,
          badge: badgeUrl,
          tag: options.tag || 'gestor-arrendamientos',
          vibrate: [200, 100, 200],
          data: {
            url: options.url || window.location.href,
            ...options.data,
          },
        } as NotificationOptions);
        return true;
      }
    } catch (swErr) {
      console.warn('ServiceWorker showNotification no disponible, usando Notification nativa:', swErr);
    }
  }

  // Fallback con Notification API estándar del navegador
  try {
    const notif = new Notification(options.title, {
      body: options.body,
      icon: iconUrl,
      tag: options.tag,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.error('Error enviando notificación:', err);
    return false;
  }
}

export interface UpcomingInvoiceReminder {
  property: Property;
  tenantName: string;
  propertyIdentifier: string;
  rentAmount: number;
  targetDueDate: Date;
  dueDateStr: string;
  daysRemaining: number;
  period: string; // Ej: "Octubre 2026"
  isPaid: boolean;
  statusCategory: 'dentro_de_ventana' | 'hoy_es_vencimiento' | 'atrasado';
}

/**
 * Calcula las facturas que están en la ventana de recordatorio (ej. 5 días antes del 1ro de mes o día de cobro)
 */
export function getUpcomingInvoiceReminders(
  properties: Property[],
  payments: Payment[],
  settings: NotificationSettings
): UpcomingInvoiceReminder[] {
  const activeProperties = properties.filter((p) => p.active);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminders: UpcomingInvoiceReminder[] = [];
  const daysWindow = settings.daysBeforeRentDue || 5;

  for (const property of activeProperties) {
    // Determinamos la fecha de vencimiento objetivo más cercana:
    // El usuario especificó "antes del primer día de mes de cada renta a pagar de inquilino"
    // Usamos property.rentDueDay (o día 1 por defecto)
    const dueDay = property.rentDueDay || 1;

    // Evaluamos el vencimiento del mes actual y del próximo mes
    const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
    currentMonthDue.setHours(0, 0, 0, 0);

    const nextMonthDue = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    nextMonthDue.setHours(0, 0, 0, 0);

    // ¿Cuál es el vencimiento relevante?
    // Si hoy está antes o igual al vencimiento de este mes:
    let targetDue: Date;
    if (today <= currentMonthDue) {
      targetDue = currentMonthDue;
    } else {
      // Si ya pasó el vencimiento de este mes, la siguiente factura es la del próximo mes
      targetDue = nextMonthDue;
    }

    const diffTime = targetDue.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Nombre del periodo de la factura (mes y año del vencimiento)
    const period = targetDue.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const formattedPeriod = period.charAt(0).toUpperCase() + period.slice(1);

    // Verificar si el inquilino ya pagó este periodo
    const hasPaid = payments.some(
      (pmt) =>
        pmt.propertyId === property.id &&
        pmt.period.toLowerCase().trim() === formattedPeriod.toLowerCase().trim()
    );

    // Si faltan entre 0 y `daysWindow` días, estamos en la ventana de recordatorio
    if (daysRemaining >= 0 && daysRemaining <= daysWindow) {
      reminders.push({
        property,
        tenantName: property.tenant1.name,
        propertyIdentifier: property.propertyIdentifier,
        rentAmount: property.rentAmount,
        targetDueDate: targetDue,
        dueDateStr: targetDue.toISOString().split('T')[0],
        daysRemaining,
        period: formattedPeriod,
        isPaid: hasPaid,
        statusCategory: daysRemaining === 0 ? 'hoy_es_vencimiento' : 'dentro_de_ventana',
      });
    }
  }

  // Ordenar por días restantes (los más próximos primero)
  return reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Registro de notificaciones enviadas hoy para evitar spam
 */
function getNotificationLog(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOG);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotificationLog(log: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_LOG, JSON.stringify(log));
  } catch {
    // Ignore storage issues
  }
}

/**
 * Comprueba automáticamente y envía notificaciones push nativas en Windows / Android
 * si hay facturas pendientes dentro de la ventana de anticipación configurada.
 */
export async function checkAndTriggerAutomatedReminders(
  properties: Property[],
  payments: Payment[],
  profile: LandlordProfile
): Promise<{ sentCount: number; reminders: UpcomingInvoiceReminder[] }> {
  const settings = getNotificationSettings(profile);

  if (!settings.enabled) {
    return { sentCount: 0, reminders: [] };
  }

  if (getNotificationPermissionStatus() !== 'granted') {
    return { sentCount: 0, reminders: [] };
  }

  const upcoming = getUpcomingInvoiceReminders(properties, payments, settings);
  const unpaidReminders = upcoming.filter((r) => !r.isPaid);

  if (unpaidReminders.length === 0) {
    return { sentCount: 0, reminders: [] };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const log = getNotificationLog();
  let sentCount = 0;

  for (const item of unpaidReminders) {
    const logKey = `rent_invoice_${item.property.id}_${item.dueDateStr}`;
    const lastSentDate = log[logKey];

    // Solo enviar 1 vez por día por cada inquilino
    if (lastSentDate === todayStr) {
      continue;
    }

    const daysText =
      item.daysRemaining === 0
        ? '¡Hoy es día de renta!'
        : item.daysRemaining === 1
        ? 'Falta 1 día para la renta'
        : `Faltan ${item.daysRemaining} días para la renta (${formatDate(item.dueDateStr)})`;

    const title = `📄 Recordatorio: Enviar factura a ${item.tenantName}`;
    const body = `${daysText} en ${item.propertyIdentifier} (${formatCurrency(item.rentAmount)}). Envía la factura a tiempo.`;

    const success = await sendNativeNotification({
      title,
      body,
      tag: logKey,
      data: {
        propertyId: item.property.id,
        tenantName: item.tenantName,
        dueDate: item.dueDateStr,
      },
    });

    if (success) {
      log[logKey] = todayStr;
      sentCount++;
    }
  }

  if (sentCount > 0) {
    saveNotificationLog(log);
  }

  return { sentCount, reminders: unpaidReminders };
}
