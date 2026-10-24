export const SUPABASE_PROJECT_ID = 'eofanfysekycgrzxuazp';
export const SUPABASE_DEFAULT_URL = 'https://eofanfysekycgrzxuazp.supabase.co';
export const SUPABASE_SQL_EDITOR_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`;
export const SUPABASE_API_SETTINGS_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/api`;

export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- ARRIENDOS (RENT MANAGER) - ESQUEMA DE BASE DE DATOS Y BACKEND PARA SUPABASE
-- ==============================================================================
-- Este script se ejecuta en el Editor SQL de tu proyecto en Supabase:
-- https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/sql/new
--
-- Protege la lógica del negocio en el servidor con funciones PostgreSQL (RPC),
-- Row Level Security (RLS) y almacenamiento seguro de cuentas VIP y suscripciones.
-- ==============================================================================

-- 1. Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- TABLA: vip_accounts (PROTEGIDA DEL LADO DEL SERVIDOR)
-- Esta tabla almacena los correos con acceso VIP vitalicio.
-- Los usuarios del frontend NUNCA pueden modificar esta tabla.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vip_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'vip_lifetime',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS en vip_accounts
ALTER TABLE public.vip_accounts ENABLE ROW LEVEL SECURITY;

-- Por seguridad estricta: nadie en anon/authenticated puede alterar la tabla directamente
DROP POLICY IF EXISTS "Deny direct access to vip_accounts" ON public.vip_accounts;
CREATE POLICY "Deny direct access to vip_accounts" 
ON public.vip_accounts FOR ALL 
TO anon, authenticated 
USING (false);

-- Insertar cuentas VIP Vitalicias oficiales (Propietario y Administradores de prueba)
INSERT INTO public.vip_accounts (email, role, notes)
VALUES
    ('elmerpr@gmail.com', 'owner_vip', 'Propietario / Super Administrador Vitalicio'),
    ('fam.sanchez.y.flores@gmail.com', 'admin_test', 'Administrador de prueba Vitalicio'),
    ('carmensanchezpr2@gmail.com', 'admin_test', 'Administrador de prueba Vitalicio'),
    ('amnerys.miflosa@gmail.com', 'admin_test', 'Administrador de prueba Vitalicio')
ON CONFLICT (email) DO UPDATE 
SET notes = EXCLUDED.notes, role = EXCLUDED.role;


-- ==============================================================================
-- TABLA: subscription_plans (PLANES DE PAGO OFICIALES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    billing_period TEXT NOT NULL, -- 'monthly' o 'annual'
    price_usd NUMERIC(10, 2) NOT NULL,
    monthly_equivalent NUMERIC(10, 2) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Los usuarios anónimos y autenticados pueden consultar los planes de precios
DROP POLICY IF EXISTS "Allow read access to subscription plans" ON public.subscription_plans;
CREATE POLICY "Allow read access to subscription plans"
ON public.subscription_plans FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Insertar planes de precios oficiales
INSERT INTO public.subscription_plans (id, name, billing_period, price_usd, monthly_equivalent, discount_percentage, features)
VALUES
    (
        'monthly',
        'Plan Mensual Adelantado',
        'monthly',
        17.85,
        17.85,
        0,
        '["Facturas y Recibos Ilimitados", "Envío por WhatsApp y Correo", "Creación de PDF e Impresión", "Recordatorios Push Nativos"]'::jsonb
    ),
    (
        'annual',
        'Plan Anual Adelantado (Con Descuento)',
        'annual',
        187.20,
        15.60,
        12.60,
        '["Cobertura Anual Completa (365 días)", "Ahorro de ~13%", "Todas las funciones premium", "Respaldo seguro en Google Drive y Supabase"]'::jsonb
    )
ON CONFLICT (id) DO UPDATE
SET price_usd = EXCLUDED.price_usd,
    monthly_equivalent = EXCLUDED.monthly_equivalent,
    discount_percentage = EXCLUDED.discount_percentage,
    features = EXCLUDED.features;


-- ==============================================================================
-- TABLA: user_subscriptions (REGISTRO Y ESTADO DE SUSCRIPCIONES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'lifetime')) DEFAULT 'trial',
    plan TEXT CHECK (plan IN ('monthly', 'annual', 'lifetime')),
    trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    subscription_started_at TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    amount_paid NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    payment_method TEXT DEFAULT 'Tarjeta / Pasarela Online',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can read their own subscription"
ON public.user_subscriptions FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- ==============================================================================
-- TABLA: app_backups (RESPALDO DE PROPIEDADES, PAGOS Y CONFIGURACIÓN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own app backups" ON public.app_backups;
CREATE POLICY "Users can manage their own app backups"
ON public.app_backups FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- ==============================================================================
-- FUNCIÓN RPC: check_subscription_access (LÓGICA DEL SERVIDOR PROTEGIDA)
-- Evalúa en el backend si el usuario tiene acceso completo a las funciones.
-- Admite arreglo de correos TEXT[]
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_subscription_access(p_emails TEXT[] DEFAULT ARRAY[]::TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_emails TEXT[];
    v_is_vip BOOLEAN := false;
    v_primary_email TEXT;
    v_sub RECORD;
    v_now TIMESTAMPTZ := now();
    v_trial_days INTEGER := 42; -- 6 Semanas de prueba gratuita (42 días)
    v_elapsed_days INTEGER := 0;
    v_days_remaining INTEGER := 0;
BEGIN
    -- 1. Normalizar correos recibidos
    IF p_emails IS NOT NULL AND COALESCE(array_length(p_emails, 1), 0) > 0 THEN
        SELECT array_agg(lower(trim(e))) INTO v_clean_emails
        FROM unnest(p_emails) AS e
        WHERE e IS NOT NULL AND length(trim(e)) > 0;
    ELSE
        v_clean_emails := ARRAY[]::TEXT[];
    END IF;

    -- Si no se proporcionó ningún correo, devolver estado de expirado por defecto
    IF v_clean_emails IS NULL OR COALESCE(array_length(v_clean_emails, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'can_use_full_features', false,
            'can_export_code', false,
            'is_lifetime', false,
            'status', 'expired',
            'days_remaining_in_trial', 0,
            'total_trial_days', v_trial_days,
            'server_timestamp', v_now,
            'message', 'No se proporcionó correo electrónico para verificar'
        );
    END IF;

    -- 2. VERIFICACIÓN VIP VITALICIO EN BASE DE DATOS
    SELECT EXISTS (
        SELECT 1 FROM public.vip_accounts 
        WHERE lower(email) = ANY(v_clean_emails)
    ) INTO v_is_vip;

    IF v_is_vip THEN
        RETURN jsonb_build_object(
            'can_use_full_features', true,
            'can_export_code', true,
            'is_lifetime', true,
            'status', 'lifetime',
            'plan', 'lifetime',
            'days_remaining_in_trial', v_trial_days,
            'total_trial_days', v_trial_days,
            'server_timestamp', v_now,
            'message', 'Cuenta VIP Vitalicia Autorizada por el Servidor'
        );
    END IF;

    -- Tomar el primer correo para registrar o verificar suscripción
    v_primary_email := v_clean_emails[1];

    -- 3. BUSCAR O INICIALIZAR REGISTRO DE SUSCRIPCIÓN
    SELECT * INTO v_sub FROM public.user_subscriptions WHERE lower(user_email) = v_primary_email;

    IF v_sub IS NULL THEN
        -- Registrar primer uso (inicio de las 6 semanas de prueba)
        INSERT INTO public.user_subscriptions (user_email, status, trial_started_at)
        VALUES (v_primary_email, 'trial', v_now)
        RETURNING * INTO v_sub;
    END IF;

    -- 4. VERIFICAR SI TIENE SUSCRIPCIÓN DE PAGO ACTIVA
    IF v_sub.status = 'active' AND v_sub.expiry_date IS NOT NULL THEN
        IF v_sub.expiry_date > v_now THEN
            RETURN jsonb_build_object(
                'can_use_full_features', true,
                'can_export_code', false,
                'is_lifetime', false,
                'status', 'active',
                'plan', v_sub.plan,
                'start_date', v_sub.subscription_started_at,
                'expiry_date', v_sub.expiry_date,
                'days_remaining_in_trial', 0,
                'total_trial_days', v_trial_days,
                'server_timestamp', v_now,
                'message', 'Suscripción Activa y Vigente en el Servidor'
            );
        END IF;
    END IF;

    -- 5. EVALUAR PERIODO DE PRUEBA DE 6 SEMANAS (42 DÍAS)
    v_elapsed_days := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_sub.trial_started_at)) / 86400)::INTEGER);
    v_days_remaining := GREATEST(0, v_trial_days - v_elapsed_days);

    IF v_elapsed_days < v_trial_days THEN
        RETURN jsonb_build_object(
            'can_use_full_features', true,
            'can_export_code', false,
            'is_lifetime', false,
            'status', 'trial',
            'days_remaining_in_trial', v_days_remaining,
            'total_trial_days', v_trial_days,
            'start_date', v_sub.trial_started_at,
            'server_timestamp', v_now,
            'message', format('Periodo de prueba activo (%s días restantes)', v_days_remaining)
        );
    END IF;

    -- 6. PERIODO DE PRUEBA VENCIDO SIN SUSCRIPCIÓN ACTIVA
    UPDATE public.user_subscriptions
    SET status = 'expired', updated_at = v_now
    WHERE id = v_sub.id AND status != 'expired';

    RETURN jsonb_build_object(
        'can_use_full_features', false,
        'can_export_code', false,
        'is_lifetime', false,
        'status', 'expired',
        'days_remaining_in_trial', 0,
        'total_trial_days', v_trial_days,
        'start_date', v_sub.trial_started_at,
        'server_timestamp', v_now,
        'message', 'Periodo de prueba finalizado. Requiere plan de pago activo.'
    );
END;
$$;


-- Sobrecarga para permitir llamado pasando un solo correo TEXT
CREATE OR REPLACE FUNCTION public.check_subscription_access(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.check_subscription_access(ARRAY[p_email]::TEXT[]);
END;
$$;


-- ==============================================================================
-- FUNCIÓN RPC: activate_user_subscription
-- Registra una activación de pago en el backend
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.activate_user_subscription(
    p_email TEXT,
    p_plan TEXT,
    p_amount_paid NUMERIC,
    p_payment_method TEXT DEFAULT 'Tarjeta de Crédito / Débito'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email TEXT := lower(trim(p_email));
    v_now TIMESTAMPTZ := now();
    v_expiry TIMESTAMPTZ;
    v_sub RECORD;
BEGIN
    IF p_plan = 'monthly' THEN
        v_expiry := v_now + INTERVAL '1 month';
    ELSIF p_plan = 'annual' THEN
        v_expiry := v_now + INTERVAL '1 year';
    ELSE
        RAISE EXCEPTION 'Plan inválido: %', p_plan;
    END IF;

    INSERT INTO public.user_subscriptions (
        user_email,
        status,
        plan,
        subscription_started_at,
        expiry_date,
        amount_paid,
        currency,
        payment_method,
        updated_at
    )
    VALUES (
        v_clean_email,
        'active',
        p_plan,
        v_now,
        v_expiry,
        p_amount_paid,
        'USD',
        p_payment_method,
        v_now
    )
    ON CONFLICT (user_email) DO UPDATE
    SET status = 'active',
        plan = EXCLUDED.plan,
        subscription_started_at = EXCLUDED.subscription_started_at,
        expiry_date = EXCLUDED.expiry_date,
        amount_paid = EXCLUDED.amount_paid,
        payment_method = EXCLUDED.payment_method,
        updated_at = v_now
    RETURNING * INTO v_sub;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'active',
        'plan', v_sub.plan,
        'expiry_date', v_sub.expiry_date,
        'message', 'Suscripción activada exitosamente en el servidor'
    );
END;
$$;

-- Otorgar permisos de ejecución a los roles anónimo y autenticado
GRANT EXECUTE ON FUNCTION public.check_subscription_access(TEXT[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_subscription_access(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_user_subscription(TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- Fin del script de inicialización para Supabase
-- ==============================================================================
`;
