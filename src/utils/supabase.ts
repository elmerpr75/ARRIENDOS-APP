import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_STORAGE_CONFIG_KEY = 'gestor_arrendamientos_supabase_config_v1';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface ServerSubscriptionResponse {
  can_use_full_features: boolean;
  can_export_code: boolean;
  is_lifetime: boolean;
  status: 'trial' | 'active' | 'expired' | 'lifetime';
  plan?: 'monthly' | 'annual' | 'lifetime';
  days_remaining_in_trial: number;
  total_trial_days: number;
  start_date?: string;
  expiry_date?: string;
  server_timestamp?: string;
  message?: string;
}

// Read from env or local config
export const DEFAULT_SUPABASE_URL = 'https://eofanfysekycgrzxuazp.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvZmFuZnlzZWt5Y2dyenh1YXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTczNDAsImV4cCI6MjEwNzA5MzM0MH0.c9BxLvCB0RKADjTi5FOZWsECpvxQ9Pw0MKEmmjlt_R0';

export function getSupabaseConfig(): SupabaseConfig {
  let url = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

  if (!url || !anonKey) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(SUPABASE_STORAGE_CONFIG_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.url) url = parsed.url;
          if (parsed.anonKey) anonKey = parsed.anonKey;
        }
      }
    } catch {
      // Ignore local storage error
    }
  }

  // Pre-fill with the user's project URL and Anon Key if none was specified yet
  if (!url) {
    url = DEFAULT_SUPABASE_URL;
  }
  if (!anonKey) {
    anonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  return {
    url: (url || '').trim(),
    anonKey: (anonKey || '').trim(),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(
        SUPABASE_STORAGE_CONFIG_KEY,
        JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
      );
      // Re-initialize client
      cachedClient = null;
    }
  } catch (err) {
    console.error('Error saving Supabase config:', err);
  }
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey && cfg.url.startsWith('https://'));
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey || !cfg.url.startsWith('https://')) {
    return null;
  }

  try {
    cachedClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

export interface DetailedConnectionResult {
  success: boolean;
  stage: 'config' | 'network' | 'credentials' | 'tables' | 'rpc';
  message: string;
  details?: string;
  serverData?: ServerSubscriptionResponse;
  plansCount?: number;
  testedEmail?: string;
  urlConfirmed: boolean;
  keyConfirmed: boolean;
  tablesConfirmed: boolean;
  rpcConfirmed: boolean;
}

/**
 * Checks subscription authorization directly on the Supabase Backend.
 * Calls the secure PostgreSQL RPC function `check_subscription_access`.
 * The server enforces VIP status, trial limits, and subscription expiration.
 */
export async function verifyServerSubscription(
  emails: (string | null | undefined)[]
): Promise<ServerSubscriptionResponse | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  let validEmails = (emails || [])
    .filter((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0))
    .map((e) => e.trim().toLowerCase());

  // Si no se pasaron correos válidos, revisar correo guardado en el perfil
  if (validEmails.length === 0) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedProfile = localStorage.getItem('gestor_arrendamientos_profile_v1');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed.email && typeof parsed.email === 'string') {
            validEmails.push(parsed.email.trim().toLowerCase());
          }
          if (parsed.googleDriveAccountEmail && typeof parsed.googleDriveAccountEmail === 'string') {
            validEmails.push(parsed.googleDriveAccountEmail.trim().toLowerCase());
          }
        }
      }
    } catch {
      // Ignorar error de storage
    }
  }

  // Fallback por defecto al correo principal del propietario para pruebas
  if (validEmails.length === 0) {
    validEmails = ['elmerpr@gmail.com'];
  }

  try {
    const { data, error } = await client.rpc('check_subscription_access', {
      p_emails: validEmails,
    });

    if (error) {
      console.warn('Supabase subscription check RPC error:', error.message);
      return null;
    }

    if (data && typeof data === 'object') {
      return data as ServerSubscriptionResponse;
    }
  } catch (err) {
    console.warn('Network or server error during Supabase subscription verification:', err);
  }

  return null;
}

/**
 * Realiza un diagnóstico exhaustivo de la conexión a Supabase:
 * 1. Valida el formato de URL y Anon Key.
 * 2. Verifica la conectividad de red con Supabase.
 * 3. Comprueba que las tablas del script SQL (schema.sql) existan.
 * 4. Ejecuta la función RPC check_subscription_access con el correo indicado.
 */
export async function testSupabaseConnectionDetailed(
  url: string,
  anonKey: string,
  testEmail?: string
): Promise<DetailedConnectionResult> {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();

  const result: DetailedConnectionResult = {
    success: false,
    stage: 'config',
    message: '',
    details: '',
    urlConfirmed: false,
    keyConfirmed: false,
    tablesConfirmed: false,
    rpcConfirmed: false,
  };

  // 1. Validar URL
  if (!cleanUrl || !cleanUrl.startsWith('https://') || !cleanUrl.includes('.')) {
    result.stage = 'config';
    result.message = 'La URL de Supabase es inválida o está vacía.';
    result.details = 'Debe tener el formato: https://<id-proyecto>.supabase.co (ej: https://eofanfysekycgrzxuazp.supabase.co)';
    return result;
  }
  result.urlConfirmed = true;

  // 2. Validar Clave Anon
  if (!cleanKey || cleanKey.length < 20) {
    result.stage = 'credentials';
    result.message = 'La clave anónima (anon public key) es requerida o demasiado corta.';
    result.details = 'Cópiala en Supabase > Project Settings ⚙️ > API > Project API keys > anon.';
    return result;
  }
  result.keyConfirmed = true;

  // 3. Crear cliente temporal para pruebas
  let testClient: SupabaseClient;
  try {
    testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (err: any) {
    result.stage = 'config';
    result.message = 'No se pudo inicializar el cliente de Supabase.';
    result.details = err?.message || 'Revisa la sintaxis de la URL y clave.';
    return result;
  }

  // 4. Probar consulta a la tabla subscription_plans
  try {
    const { data: plansData, error: plansError } = await testClient
      .from('subscription_plans')
      .select('id, name, price_usd')
      .limit(5);

    if (plansError) {
      const errMsg = plansError.message || '';
      if (
        errMsg.includes('relation') &&
        (errMsg.includes('does not exist') || errMsg.includes('no existe'))
      ) {
        result.stage = 'tables';
        result.message = '¡Conexión exitosa, pero las tablas aún no existen en Supabase!';
        result.details =
          'El servidor respondió, pero la tabla "subscription_plans" no ha sido creada. Abre el SQL Editor en Supabase, pega el script schema.sql y haz clic en RUN.';
        return result;
      }

      if (
        errMsg.includes('Invalid API key') ||
        errMsg.includes('JWT') ||
        plansError.code === 'PGRST301' ||
        plansError.code === '401'
      ) {
        result.stage = 'credentials';
        result.keyConfirmed = false;
        result.message = 'La clave Anon no es válida para este proyecto de Supabase.';
        result.details =
          'Asegúrate de copiar la clave "anon public" desde Project Settings > API > Project API keys.';
        return result;
      }

      result.stage = 'network';
      result.message = 'Error al consultar Supabase: ' + errMsg;
      result.details = 'Verifica que tu proyecto no esté pausado y que tengas conexión.';
      return result;
    }

    result.tablesConfirmed = true;
    result.plansCount = plansData ? plansData.length : 0;
  } catch (err: any) {
    result.stage = 'network';
    result.message = 'Error de red al conectar con ' + cleanUrl;
    result.details = err?.message || 'Verifica la URL asignada y tu conexión a internet.';
    return result;
  }

  // 5. Probar función RPC check_subscription_access
  const emailToCheck = (testEmail || '').trim().toLowerCase() || 'elmerpr@gmail.com';
  result.testedEmail = emailToCheck;

  try {
    const { data: rpcData, error: rpcError } = await testClient.rpc('check_subscription_access', {
      p_emails: [emailToCheck],
    });

    if (rpcError) {
      const rpcMsg = rpcError.message || '';
      result.stage = 'rpc';
      if (
        rpcMsg.includes('function') &&
        (rpcMsg.includes('does not exist') || rpcMsg.includes('no existe'))
      ) {
        result.message = 'Las tablas existen, pero falta la función RPC check_subscription_access.';
        result.details =
          'Vuelve a ejecutar la sección de funciones RPC del script schema.sql en el SQL Editor de Supabase.';
      } else {
        result.message = 'Error en la función check_subscription_access: ' + rpcMsg;
        result.details =
          'Asegúrate de haber otorgado permisos GRANT EXECUTE a los roles anon y authenticated.';
      }
      return result;
    }

    if (!rpcData || typeof rpcData !== 'object') {
      result.stage = 'rpc';
      result.message = 'La función check_subscription_access respondió sin contenido.';
      result.details =
        'Verifica que el script SQL haya creado la función completa con RETURNING jsonb_build_object.';
      return result;
    }

    const subResp = rpcData as ServerSubscriptionResponse;
    result.serverData = subResp;
    result.rpcConfirmed = true;
    result.success = true;
    result.stage = 'rpc';

    const statusLabel =
      subResp.status === 'lifetime'
        ? 'VIP VITALICIO (Acceso Total y Permanente)'
        : subResp.status === 'active'
        ? 'ACTIVA (Plan Pagado Vigente)'
        : subResp.status === 'trial'
        ? `PRUEBA GRATUITA (${subResp.days_remaining_in_trial} días restantes)`
        : 'EXPIRADA';

    result.message = '✓ ¡Conexión con Supabase verificada al 100%!';
    result.details = `El backend PostgreSQL validó el correo "${emailToCheck}" con estado: ${statusLabel}. ${subResp.message || ''}`;
    return result;
  } catch (err: any) {
    result.stage = 'rpc';
    result.message = 'Error al ejecutar prueba RPC: ' + (err?.message || 'Error desconocido');
    return result;
  }
}

/**
 * Registers or activates a paid subscription plan on Supabase.
 */
export async function recordServerSubscription(
  email: string,
  plan: 'monthly' | 'annual',
  amountPaid: number,
  paymentMethod: string = 'Tarjeta / Pasarela Online'
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  try {
    const { data, error } = await client.rpc('activate_user_subscription', {
      p_email: cleanEmail,
      p_plan: plan,
      p_amount_paid: amountPaid,
      p_payment_method: paymentMethod,
    });

    if (error) {
      console.error('Supabase subscription activation RPC error:', error.message);
      return false;
    }

    return Boolean(data);
  } catch (err) {
    console.error('Failed to record subscription on Supabase:', err);
    return false;
  }
}

/**
 * Syncs app data (Properties, Payments, Profile, Administrators) to Supabase tables.
 */
export async function syncAppDataToSupabase(payload: {
  profile: any;
  administrators: any[];
  properties: any[];
  payments: any[];
}): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase no está configurado.' };
  }

  try {
    const ownerEmail =
      payload.profile.email || payload.profile.googleDriveAccountEmail || 'anonymous_user';

    const { error } = await client.from('app_backups').upsert(
      {
        user_email: ownerEmail.toLowerCase(),
        data: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Datos sincronizados exitosamente con Supabase.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error desconocido al sincronizar.' };
  }
}

/**
 * Fetches app data from Supabase
 */
export async function fetchAppDataFromSupabase(
  userEmail: string
): Promise<{ success: boolean; data?: any; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase no está configurado.' };
  }

  try {
    const { data, error } = await client
      .from('app_backups')
      .select('data, updated_at')
      .eq('user_email', userEmail.toLowerCase())
      .maybeSingle();

    if (error) {
      return { success: false, message: error.message };
    }

    if (!data || !data.data) {
      return { success: false, message: 'No se encontraron datos en Supabase para este correo.' };
    }

    return { success: true, data: data.data, message: 'Datos recuperados exitosamente.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al descargar datos de Supabase.' };
  }
}
