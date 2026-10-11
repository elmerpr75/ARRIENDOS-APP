# Configuración del Backend en Supabase para Arriendos (Rent Manager)

Este directorio contiene la arquitectura del backend para separar la lógica de negocio y seguridad de la aplicación, ejecutándola en PostgreSQL/Supabase de manera protegida.

---

## Tu Proyecto en Supabase
- **URL Confirmada**: `https://eofanfysekycgrzxuazp.supabase.co`
- **ID de Proyecto**: `eofanfysekycgrzxuazp`
- **Editor SQL Directo**: [https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/sql/new](https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/sql/new)
- **Configuración de Claves API**: [https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/settings/api](https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/settings/api)

---

## Paso 1: Ejecutar el Esquema SQL en Supabase
1. Abre directamente el editor SQL de tu proyecto:
   👉 [https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/sql/new](https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/sql/new)
2. Copia todo el contenido del archivo `supabase/schema.sql` (o pulsa el botón "Copiar Script SQL" en la ventana de conexión de la app).
3. Pégalo en el editor SQL de Supabase y haz clic en **RUN** (o presiona `Ctrl + Enter` / `Cmd + Enter`).
4. Verás el mensaje `Success. No rows returned`. Con esto se crean:
   - Tabla protegida `vip_accounts` con los correos vitalicios oficiales (incluyendo `elmerpr@gmail.com`).
   - Tabla `subscription_plans` con los precios mensuales ($17.85) y anuales ($187.20).
   - Tabla `user_subscriptions` para rastrear las 6 semanas de prueba y membresías activas.
   - Tabla `app_backups` para respaldos de datos.
   - Función RPC protegida `check_subscription_access(p_emails TEXT[])`.
   - Función RPC `activate_user_subscription`.
   - Permisos `GRANT EXECUTE` a roles `anon` y `authenticated`.

---

## Paso 2: Copiar tu Clave Anon
1. Entra a la página de claves de tu proyecto:
   👉 [https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/settings/api](https://supabase.com/dashboard/project/eofanfysekycgrzxuazp/settings/api)
2. En la sección **Project API keys**, busca la fila **`anon` `public`**.
3. Haz clic en **Copy** (es un texto largo que comienza con `eyJhbGciOi...`).

> ⚠️ **IMPORTANTE DE SEGURIDAD**:
> - La clave `anon` es pública y segura para el frontend y GitHub porque las tablas críticas tienen RLS (Row Level Security) y sólo la función del servidor puede autorizar accesos.
> - **NUNCA** uses la clave `service_role` en el frontend.

---

## Paso 3: Conectar y Probar en la Aplicación
1. En la aplicación, abre la ventana **"Conexión con Supabase (Backend)"** o **"Ajustes de Perfil"**.
2. Pega tu clave en el campo `SUPABASE_ANON_KEY`.
3. En el campo de correo a verificar, confirma que esté tu correo (`elmerpr@gmail.com`).
4. Haz clic en **"Guardar y Probar Conexión"**.
5. Verás el checklist de diagnóstico en verde confirmando:
   - ✓ URL Supabase válida
   - ✓ Clave Pública Anon
   - ✓ Tablas SQL
   - ✓ RPC check_subscription_access (Estado: VIP VITALICIO)

---

## Paso 4: Subir a GitHub
Puedes subir todo este código a tu cuenta pública de GitHub sin ningún riesgo:
- Las tablas sensibles y reglas de suscripción están en PostgreSQL en Supabase.
- En tu hosting de frontend (Vercel, Netlify, o GitHub Pages), puedes definir en las Variables de Entorno:
  - `VITE_SUPABASE_URL = "https://eofanfysekycgrzxuazp.supabase.co"`
  - `VITE_SUPABASE_ANON_KEY = "tu_clave_anon_aqui"`
O los usuarios pueden configurarla desde la interfaz de la aplicación.

