# BELABARBERÍA

Sistema de turnos para barbería — Proyecto de 6.º año, Construcción de Software.

| Parte | Carpeta | Tecnología | Dónde corre |
|---|---|---|---|
| App móvil (principal) | `mobile/` | Expo SDK 57 / React Native | Expo Go o APK |
| API REST | `backend/` (publicada en `supabase/functions/api`) | Node.js + Express | https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api |
| Página pública | `landing/` | HTML estático | Vercel (proyecto `belabarberia`) |
| Web de gestión (anterior) | raíz (`index.html`, `src/`) | Vite | local / Vercel |
| Base de datos y Auth | — | Supabase (PostgreSQL, RLS, triggers, pg_cron, pg_net) | proyecto `barberia` |

Guía de defensa (demo en 22 pasos y preguntas): **[DEFENSA.md](DEFENSA.md)**. API en detalle: **[backend/README.md](backend/README.md)**.

## Funcionalidades

- Registro, login (email o Google), recuperación y cambio de contraseña, sesión persistente, cierre de sesión.
- Roles **USUARIO** (cliente), **BARBERO** y **ADMIN**, controlados en la API (middleware) y en la base (RLS + triggers).
- **Cómo se crea cada cuenta:** cualquiera se registra como **cliente**. Un **barbero** se registra eligiendo "Barbero" y escribiendo el **código de la barbería** que define el dueño en **Admin → Barbería → Código para barberos** (o lo carga después en **Perfil**). El código se guarda cifrado (bcrypt), se valida en la base (`canjear_codigo_barbero`) y tiene límite de 5 intentos fallidos por hora. Sin código, el cliente puede enviar un pedido y el dueño lo aprueba en **Admin → Usuarios**. El **administrador** es la cuenta del dueño.
- Inicio con próximo turno y avisos; reserva en 4 pasos con horarios libres reales; mis turnos con estado y pago; cancelación hasta 24 h antes; reseñas 1–5 de turnos completados.
- Agenda del barbero (confirmar / completar / cancelar), ficha y reseñas recibidas.
- Panel admin: turnos, pagos (registro de cobros, sin pasarela), servicios, categorías, barberos, horarios, usuarios (rol y activación), reseñas y datos de la barbería.
- Notificaciones: en la app (tabla `notificaciones`) y push (Expo Push) al confirmar/cancelar/completar; recordatorio 2 h antes con un proceso en segundo plano (`pg_cron`).
- Tema claro / oscuro / automático, guardado en el teléfono.
- **Fidelización:** puntos que otorga la base al completar un turno (`turnos_otorgar_puntos`, nunca dos veces por turno), niveles Bronze/Silver/Gold/VIP, recompensas canjeables con código `BB-XXXXXX` que valida el barbero o el admin (`usar_canje`), logros y historial.
- **Favoritos**, **Reservar de nuevo**, **barbero recomendado** (con el motivo) y **cuenta regresiva** al próximo turno.
- **Galería y "Elegí tu estilo":** fotos de trabajos por barbero y estilo (bucket `galeria`, solo el admin sube); estilos asignados a servicios y barberos.
- **Calendario mejorado** (`/appointments/days` y `/appointments/slots`): días "lleno" y "cerrado", horarios ocupados visibles y tachados.
- **Lista de espera:** "Avisarme si se libera"; al cancelarse un turno se avisa al primero, que tiene 30 min (`pg_cron` cada 5 min).
- **Dashboards** del barbero y del admin (`GET /dashboard`).
- **Face ID / huella** opcional para abrir la app (`expo-local-authentication`).
- Diseño y accesibilidad: ver `DISENO.md`, `ACCESIBILIDAD.md` e `informe/Informe_UX_UI_BELABARBERIA.pdf`.

## Cómo ejecutar

### 1. App móvil

```bash
cd mobile
npm install
npx expo install expo-notifications expo-device @expo/vector-icons expo-image-picker expo-local-authentication   # una sola vez
npx expo start --go --tunnel --clear              # escanear el QR con Expo Go
```

`--tunnel` es necesario para **ingresar con Google** en Expo Go (Supabase no acepta direcciones con IP).

La app usa la API publicada en Supabase. Para cambiarla: `mobile/.env` → `EXPO_PUBLIC_API_URL=https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api`.

### 2. APK (Android)

```bash
cd mobile
npx eas login
npx eas build -p android --profile preview     # al terminar da el enlace del .apk
```

Para un QR permanente de Expo Go (sin tener la PC prendida):

```bash
npx eas update --branch preview --message "Entrega"
```

Copiar los enlaces en `landing/config.js` (`apkUrl`, `expoGoUrl`) y volver a publicar la página.

Push en el APK de Android: cargar las credenciales de Firebase (FCM) con `npx eas credentials` (Expo Go en Android no recibe push).

### 3. API

```bash
cd backend
npm install
copy .env.example .env     # completar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY
npm run dev                # http://localhost:3000/health
```

Publicar: `npx vercel --prod` dentro de `backend/` (ver `backend/README.md`).

### 4. Página pública

```bash
cd landing
npx vercel --prod          # proyecto: belabarberia
```

### 5. Web (Vite)

```bash
npm install
npm run dev
```

## Asistente con IA (chat del cliente)

- Pestaña **Asistente** (solo clientes). Responde con los datos reales: servicios y precios, barberos, horarios de atención, horarios libres de los próximos 7 días y los turnos del cliente. Al abrirlo saluda con el **recordatorio del próximo turno**.
- No reserva ni cancela: indica los pasos en la app. Tiene un límite de 40 mensajes por día por usuario.
- **Sin clave de IA también responde**: arma las respuestas con los datos reales (turnos, servicios, horarios libres, barberos, pagos y cómo usar la app). Con la clave, conversa libremente.
- Código: `supabase/functions/asistente/index.ts` (función de Supabase, ya publicada). La clave de la IA es un **secreto del servidor**: nunca va en la app.
- Para activarla, en Supabase → Edge Functions → Secrets agregá **una** de estas claves:
  - `GEMINI_API_KEY` (Google AI Studio, tiene uso gratuito) — opcional `GEMINI_MODEL` (por defecto `gemini-2.5-flash`)
  - `ANTHROPIC_API_KEY` (Claude, pago) — opcional `ANTHROPIC_MODEL` (por defecto `claude-haiku-5-5`)

## Pagos del corte

No hay pasarela online. El cliente, en **Mis turnos → turno → Pagar**, elige **en el local** (efectivo o tarjeta) o **transferencia** (ve el alias/CBU que carga el admin en **Admin → Barbería** y avisa con el número de operación). El barbero (o el admin) confirma con **Cobrar** y el pago pasa a PAGADO; el cliente recibe un aviso.

## Recordatorios automáticos

Un proceso en segundo plano (`pg_cron`, cada 10 minutos) avisa al cliente **el día anterior** (si reservó con más de 26 h de anticipación) y **2 horas antes** del turno, como notificación en la app y push.

## Variables de entorno (nunca secretos en el código)

| Dónde | Variables |
|---|---|
| `backend/.env` y Vercel | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CORS_ORIGINS`, `PORT` |
| `mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL` |
| `.env` (web) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

La clave `service_role` no se usa en ningún lugar.

## Configuración en Supabase (panel)

- **Authentication → URL Configuration → Redirect URLs**: `exp://**`, `barberiaimperial://**`, `http://localhost:5173/**` (ya cargadas).
- **Authentication → Emails → SMTP**: configurar un SMTP propio para que los emails de confirmación y recuperación no queden limitados (~2 por hora con el servicio incluido).
- **Datos del negocio**: los servicios, precios, barberos y horarios reales los carga el ADMIN desde la app.

## Usuarios de prueba

Se entregan **en privado** al profesor (no se publican en este repositorio ni en la página).

## Archivo obsoleto

`supabase_schema.sql` no corresponde a la base actual: no lo ejecutes. La estructura vigente está en Supabase → Database → Migrations.
