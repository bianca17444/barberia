# BELABARBERÍA — Guía para la defensa

## 1. Qué es (30 segundos)

BELABARBERÍA es un sistema de turnos para una barbería: **app móvil** (Expo / React Native) para clientes, barberos y administrador; **API REST** propia (Node.js + Express, publicada en Vercel); **Supabase** como base de datos PostgreSQL, autenticación y almacenamiento; y una **página pública** para descargar la app.

Problema que resuelve: los turnos por mensaje se pierden y se superponen. Acá el cliente solo ve horarios libres y el servidor impide superposiciones.

## 2. Arquitectura

```
App móvil (Expo)  ──HTTPS + JWT──►  API Express (Vercel)  ──token del usuario──►  Supabase (PostgreSQL + RLS + triggers)
      │                                   │                                              ▲
      └── Supabase Auth (login Google, sesión guardada en el teléfono) ────────────────────┘
Página pública (Vercel) ── consulta /health de la API
```

- La API **verifica el JWT** de cada pedido (`middleware/auth.js`) y **controla el rol** (`middleware/roles.js`).
- La API consulta la base **con el token del usuario**: también se aplican las políticas RLS y los triggers. Si alguien saltea la API y llama directo a Supabase, las reglas siguen valiendo (defensa en profundidad).
- No se usa la clave `service_role` en ningún lado. Las variables van en `.env` / variables de entorno de Vercel.

## 3. Modelo de datos (entidades del enunciado → tablas)

| Entidad | Tabla | Notas |
|---|---|---|
| USUARIO | `profiles` (+ `auth.users`) | rol USUARIO/BARBERO/ADMIN, `activo` |
| BARBERÍA | `barberia` | una fila (id = 1) |
| BARBERO | `barberos` | `usuario_id` vincula la cuenta con rol BARBERO |
| TURNO | `turnos` | estado PENDIENTE / CONFIRMADO / FINALIZADO (se muestra "COMPLETADO") / CANCELADO |
| DETALLE_TURNO | `detalle_turno` | se crea solo al reservar; guarda el **precio del momento** |
| SERVICIO | `servicios` | precio > 0, duración en minutos, categoría opcional |
| CATEGORÍA_SERVICIO | `categorias_servicio` | |
| PAGO | `pagos` | se crea PENDIENTE al reservar; CANCELADO si se cancela el turno; el admin registra el cobro |
| ESTADO_PAGO | `estados_pago` | 1 PENDIENTE, 2 PAGADO, 3 CANCELADO |
| RESEÑA | `resenas` | solo turnos propios completados, 1–5, una por turno |
| (extra) | `horarios_barberos`, `notificaciones`, `push_tokens` | franjas laborales, avisos, dispositivos |

## 4. Reglas de negocio (dónde se validan)

| Regla | Dónde |
|---|---|
| No se reserva en el pasado ni fuera del horario del barbero | trigger `turnos_validar_disponibilidad` |
| No hay superposición (según duración del servicio, con bloqueo para reservas simultáneas) | mismo trigger + advisory lock |
| El cliente cancela solo hasta 24 h antes | función `cancelar_turno` y trigger `turnos_proteger_cambios` (reloj del servidor, hora Argentina) |
| El barbero solo pasa PENDIENTE→CONFIRMADO/CANCELADO y CONFIRMADO→FINALIZADO/CANCELADO | trigger |
| Un usuario no puede cambiarse el rol | trigger `profiles_proteger_rol` + API |
| Cuenta desactivada no reserva | trigger + middleware `requireActivo` |
| Reseña solo de turno propio completado, una por turno | trigger `resenas_validar` + índice único |
| Catálogo privado (solo con sesión) | RLS + `requireAuth` |

## 5. Demo en 22 pasos (≈ 10 minutos)

Preparar antes: teléfono con la app (APK o Expo Go), las 3 cuentas de prueba anotadas en papel (no en la presentación), la página pública abierta.

1. Abrir la **página pública**: mostrar descripción, funciones y el indicador "Servidor en línea".
2. Abrir `https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api/health` → `estado: ok` (la API está publicada, no es localhost).
3. Abrir la app: portada sin datos (el catálogo es privado).
4. **Crear cuenta** con contraseña débil → error claro. Corregir → "Revisá tu email".
5. **Ingresar** con email y contraseña incorrecta → "Email o contraseña incorrectos".
6. Ingresar como **ADMIN**.
7. Admin → **Barbería**: completar dirección/teléfono.
8. Admin → **Categorías**: crear una.
9. Admin → **Servicios**: intentar precio 0 → error; crear un servicio real.
10. Admin → **Barbería → Código para barberos**: crear un código. Desde otro teléfono, **Crear cuenta → Barbero** con ese código: entra directo con su Agenda (la ficha se crea sola).
11. Admin → **Equipo**: cargarle los horarios al barbero nuevo. (Alternativa sin código: el pedido se aprueba en Admin → Usuarios.)
12. Admin → **Horarios**: cargar una franja (ej. lunes 09:00–13:00). Mostrar que una franja superpuesta se rechaza.
13. Cerrar sesión. Ingresar como **CLIENTE** (o con **Google**).
14. Inicio: "No tenés turnos próximos". **Reservar**: servicio → barbero → fecha sin horarios → mensaje claro; fecha con franja → horarios libres.
15. Confirmar la reserva → queda PENDIENTE; **Mis turnos** muestra precio y pago PENDIENTE.
16. Intentar reservar el mismo horario de nuevo → "El horario seleccionado ya está ocupado" (validado en el servidor).
17. Ingresar como **BARBERO** → Agenda → **Confirmar** el turno. Mostrar que el cliente recibe la notificación (Inicio → Avisos / push en APK).
18. Barbero → **Completar** el turno.
19. Cliente → Mis turnos → Historial → **Calificar** con 5 estrellas. Intentar de nuevo → no aparece el botón (una por turno).
20. Admin → **Pagos** → registrar el cobro en EFECTIVO → PAGADO. Admin → **Reseñas**: promedio.
21. Perfil → cambiar a **tema claro**, cerrar y abrir la app → sigue claro. **Cambiar contraseña** con la actual incorrecta → error.
22. Mostrar en el código: `backend/src/middleware/auth.js` (JWT) y `roles.js` (rol), y una política RLS en Supabase.

## 6. Preguntas probables del profesor

**¿Por qué una API si Supabase ya tiene API?** Porque el enunciado pide API propia con middleware de JWT y roles; centraliza validaciones y mensajes, y la app no depende de la estructura de las tablas. Igual dejamos RLS activo como segunda barrera.

**¿Cómo verifica el token la API?** Lee `Authorization: Bearer`, llama a `supabase.auth.getUser(token)` (Supabase valida firma y vencimiento), carga el perfil y su rol de `profiles`. Sin token → 401; rol insuficiente → 403.

**¿Qué pasa si alguien manda `rol: "ADMIN"` al registrarse o en su perfil?** El registro no envía rol y el trigger `handle_new_user` siempre crea USUARIO. El `PUT /users/:id` rechaza `rol` si no sos admin, y además el trigger `profiles_proteger_rol` lo bloquea en la base.

**¿Cualquiera puede registrarse como barbero?** No. Necesita el código de la barbería, que solo conoce el dueño. Se guarda cifrado con bcrypt (ni el admin lo puede volver a ver), lo valida una función de la base (no la app) y hay un límite de 5 intentos fallidos por hora por cuenta. Un usuario tampoco puede cambiarse el rol a mano: el trigger `profiles_proteger_rol` lo bloquea y solo deja pasar de cliente a barbero durante un canje válido.

**¿Cómo evitan dos reservas al mismo horario al mismo tiempo?** El trigger toma un *advisory lock* por barbero y fecha, y compara rangos (inicio + duración). La segunda reserva recibe 409.

**¿Por qué la regla de 24 h está en el servidor?** Porque el reloj del teléfono se puede cambiar. Se calcula con `privado.ahora_local()` en hora de Argentina.

**¿Dónde están las claves?** En variables de entorno (`.env` local, variables de Vercel). La app solo tiene la clave pública de Supabase, que está diseñada para ser pública: lo que protege los datos es RLS.

**¿Cómo funcionan las notificaciones?** Un trigger crea la notificación en la tabla cuando cambia el estado de un turno; otro trigger la envía a la API de push de Expo con `pg_net`. Un proceso en segundo plano (`pg_cron`, cada 10 minutos) manda el recordatorio 2 h antes.

**¿Proceso en segundo plano?** Sí: el job `belabarberia_recordatorios` de pg_cron en Supabase. La app no necesita estar abierta.

**¿Cómo se registra un pago?** No hay pasarela (no se simula un cobro falso). El pago se crea PENDIENTE al reservar y el administrador lo marca PAGADO con el método al cobrar en el local.

**¿Qué pasa si borro un servicio que tiene turnos?** No se borra: se desactiva para conservar el historial (y el precio quedó guardado en `detalle_turno`).

**¿Por qué Google funciona con túnel en Expo Go?** Supabase rechaza direcciones de retorno con IP (exp://192.168…). Con `--tunnel` la dirección tiene nombre de dominio y se acepta; en el APK se usa `barberiaimperial://`.

**¿Qué probaron?** Pruebas reales contra la API publicada (registro, login, reservas, conflictos, 24 h, roles 401/403, pagos, reseñas) y pruebas automatizadas de la interfaz móvil con una API simulada (37/37). Push en teléfono real: pendiente de probar con el APK.

**¿Cómo funciona el asistente con IA?** La app manda la conversación a una función de Supabase con el token del cliente. La función verifica la sesión, controla un límite diario, arma el contexto con datos reales leídos con los permisos del propio cliente (RLS: solo ve sus turnos) y se lo pasa al modelo con reglas: no inventar precios ni horarios, no reservar, solo temas de la barbería. La clave de la IA es un secreto del servidor.

**Limitaciones conocidas:** el envío de emails de Supabase sin SMTP propio tiene límite (~2 por hora); las push en Android requieren el APK (Expo Go Android no las recibe) con credenciales FCM; los datos del negocio (servicios, precios, horarios) los carga el administrador.

## 7. Funcionalidades nuevas: demo extra (≈ 4 minutos)
1. **Cliente:**
   - **Inicio:** cuenta regresiva del próximo turno, "Te recomendamos" (con el motivo) y "Elegí tu estilo".
   - **Reservar → día y hora:** días "lleno" y "cerrado"; tocar un horario tachado y elegir **"Avisarme si se libera"**.
2. **Barbero:** completar un turno.
3. **Cliente:** Cuenta → Mis puntos sube y llega el aviso "Sumaste X puntos". Canjear una recompensa y copiar el código.
4. **Barbero:** en Inicio, "Validar recompensa" con ese código. Si se repite, avisa que ya se usó.
5. **Admin:**
   - Inicio con indicadores y gráfico de 14 días.
   - Admin → Galería: subir una foto.
   - Admin → Recompensas.

**Preguntas probables**
- *¿Se pueden falsear los puntos desde la app?* No. Los otorga un trigger de la base cuando el turno pasa a FINALIZADO, con un índice único por turno. La tabla no tiene permiso de escritura para usuarios.
- *¿Un cliente puede validar su propio código?* No. `usar_canje` exige el rol BARBERO o ADMIN y marca el código como usado una sola vez.
- *¿Por qué los horarios ocupados se muestran?* Para no esconder información: así el cliente puede sumarse a la lista de espera. Están tachados y con texto, no solo con color (WCAG 1.4.1).
