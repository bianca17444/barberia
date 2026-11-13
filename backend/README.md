# BELABARBERÍA — API REST (Node.js + Express)

API publicada: **https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api** (probar: `/health`). Es el mismo Express publicado como función de Supabase (`supabase/functions/api`). También se puede publicar en Vercel (ver abajo).

## Qué hace

- Verifica el token JWT de cada pedido (`Authorization: Bearer <token>`) contra Supabase Auth (`middleware/auth.js`).
- Carga el rol del usuario desde `profiles` en cada pedido y lo controla con `requireRole(...)` (`middleware/roles.js`).
- Cada consulta a la base se hace **con el token del usuario**, así también se aplican las políticas RLS y los triggers de Supabase (doble control: API + base de datos).
- No usa la clave `service_role`: solo la clave pública (publishable). No hay secretos en el código.
- Valida datos (`utils/validar.js`) y traduce los errores a mensajes claros en español (`utils/errors.js`).

## Estructura

```
backend/
├─ api/index.js            ← entrada para Vercel (exporta la app)
├─ src/
│  ├─ app.js               ← Express: CORS, JSON, cabeceras seguras, rutas, errores
│  ├─ index.js             ← servidor local (npm run dev)
│  ├─ config/              ← variables de entorno y cliente Supabase por pedido
│  ├─ middleware/          ← auth (JWT), roles, seguridad, errores
│  ├─ routes/index.js      ← todas las rutas
│  ├─ controllers/         ← auth, users, catalogo, barberos, turnos, pagos, resenas, notificaciones, home
│  └─ utils/               ← validaciones, errores, helpers
├─ vercel.json
└─ .env.example
```

## Endpoints

| Método | Ruta | Quién |
|---|---|---|
| GET | /health | público |
| POST | /auth/register, /auth/login, /auth/refresh, /auth/forgot-password | público |
| POST | /auth/logout, /auth/reset-password, /auth/change-password · GET /auth/me | con sesión |
| GET | /home | con sesión (resumen según rol) |
| GET / PUT | /barbershop | todos / ADMIN |
| GET / PUT | /barbershop/barber-code | ADMIN (estado del código para barberos / definirlo o desactivarlo; nunca se devuelve) |
| POST | /users/me/barber-code | CLIENTE: canjea el código y pasa a BARBERO |
| POST · GET · DELETE | /users/me/barber-request · /users/barber-requests · /users/:id/barber-request | pedido sin código (CLIENTE) · ver / rechazar (ADMIN) |
| GET · GET/:id · PUT/:id · DELETE/:id | /users | ADMIN · ADMIN o uno mismo · uno mismo (ADMIN también rol/activo) · ADMIN (baja lógica) |
| GET · POST · PUT · DELETE | /categories | todos · ADMIN |
| GET · POST · PUT · DELETE | /services | todos · ADMIN (si tiene turnos se desactiva) |
| GET · GET/PUT /barbers/me · POST · PUT · DELETE | /barbers | todos · BARBERO · ADMIN |
| GET · POST · PUT · DELETE | /schedules | todos · ADMIN |
| GET | /appointments/availability?barbero_id&servicio_id&fecha | con sesión |
| GET · GET/:id · POST · PUT/:id · DELETE/:id | /appointments | según rol · CLIENTE/ADMIN · cambio de estado · cancelar |
| GET · POST · PUT | /payments | según rol · ADMIN registra cobro |
| GET · POST · PUT · DELETE | /reviews | según rol · CLIENTE · CLIENTE · autor o ADMIN |
| GET · PUT read-all · PUT /:id/read · POST/DELETE push-token | /notifications | con sesión |
| GET · POST · DELETE /barbers/:id · DELETE /services/:id | /favorites | CLIENTE (solo los propios; RLS en la tabla `favoritos`) |

Errores: `{ "error": { "mensaje": "...", "codigo": "..." } }` con 400, 401, 403, 404, 409, 429 o 500.

## Correr en la PC

```bash
cd backend
npm install
copy .env.example .env      # (en Windows) y completar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY
npm run dev                 # http://localhost:3000/health
```

## Publicar en Vercel

```bash
npm i -g vercel
cd backend
vercel login
vercel link                 # elegir el proyecto belabarberia-api
vercel env add SUPABASE_URL production
vercel env add SUPABASE_PUBLISHABLE_KEY production
vercel env add CORS_ORIGINS production   # ej: https://belabarberia.vercel.app,http://localhost:5173
vercel --prod
```
