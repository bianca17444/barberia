# BELABARBERÍA — Checklist final

✅ = hecho y probado · 🟡 = hecho, falta probarlo en un teléfono real o depende de una configuración · ⬜ = pendiente (requiere una acción tuya)

## Backend / API
- ✅ API Express publicada en Vercel (`/health` responde ok)
- ✅ Middleware JWT (401 sin token o token inválido) y middleware de roles (403)
- ✅ Endpoints de auth, usuarios, barbería, categorías, servicios, barberos, horarios, turnos, disponibilidad, pagos, reseñas, notificaciones
- ✅ Validaciones y mensajes de error en español (400/401/403/404/409/429/500)
- ✅ Pruebas reales contra la API publicada con cuentas reales (reserva, conflicto, 24 h, roles, pagos, reseñas, desactivar cuenta)
- ✅ Sin `service_role` ni secretos en el código

## Base de datos (Supabase)
- ✅ Entidades del enunciado (USUARIO, BARBERÍA, BARBERO, TURNO, DETALLE_TURNO, SERVICIO, CATEGORÍA, PAGO, ESTADO_PAGO, RESEÑA)
- ✅ RLS activo en todas las tablas; reglas de negocio en triggers
- ✅ Proceso en segundo plano: recordatorio 2 h antes (pg_cron cada 10 min)
- 🟡 Push reales (pg_net → Expo): implementado; falta verlo llegar a un teléfono con el APK

## App móvil
- ✅ Consume la API publicada (no localhost)
- ✅ Login, registro, recuperación, nueva contraseña, cambio de contraseña, cerrar sesión
- ✅ Inicio con próximo turno y avisos · Reserva · Mis turnos · Reseñas
- ✅ Agenda y ficha del barbero · Panel admin completo (9 secciones)
- ✅ Tema claro/oscuro/automático persistente
- ✅ Interfaz rediseñada: reserva en 4 pasos con calendario, turnos como tickets con detalle, panel admin con formularios, admin carga turnos para clientes, deslizar para actualizar
- ✅ Pruebas automatizadas de interfaz con API simulada: 66/66
- ✅ Registro sin confirmación por email (se desactivó en Supabase por el límite de envíos)
- ✅ Fotos de perfil (cliente, barbero, admin) en Storage, carpeta propia de cada usuario
- ✅ Pago del corte: el cliente elige pagar en el local o por transferencia (ve alias/CBU) y avisa; el barbero o admin confirma el cobro
- ✅ Cancelar y borrar turnos de la lista (cliente y barbero); se conservan para el local
- ✅ **Pedidos para ser barbero**: el admin los ve en Inicio (con email y teléfono) y puede *Aprobar como barbero*, *Mandar código* (se guarda cifrado y se comparte por WhatsApp/SMS/mail) o *Rechazar*. Al aprobar, a la persona le llega un aviso (trigger `profiles_avisar_rol_barbero`) y su app pasa sola a la Agenda. Las notificaciones push al teléfono requieren el APK (Expo Go en Android no las recibe)
- ✅ **Favoritos** (barberos y servicios): tabla `favoritos` con RLS (cada uno ve/agrega/quita solo los suyos, sin duplicados), API `/favorites`, corazón en Inicio, "Mis favoritos" en Perfil y favoritos primero al reservar. Probado: RLS en la base, API en vivo (lectura/validaciones/403/401) y 11 pruebas de la app simuladas
- ✅ **Reservar de nuevo** desde el historial (mismo servicio y barbero; elige fecha/hora libre y confirma; avisa si el servicio o barbero ya no está)
- ✅ **Face ID / huella** para abrir la app (expo-local-authentication; se activa en Perfil → Seguridad; la biometría no sale del teléfono). *Probado en simulación; debe comprobarse en el celular real (en iPhone, Face ID requiere el APK/IPA, no Expo Go).*
- ✅ Registro de barbero **sin código**: la cuenta se crea y el pedido le llega al dueño (aviso en la app)
- ✅ Alta de barberos con el **código de la barbería** (cifrado, validado en la base, 5 intentos/hora); también por pedido + aprobación del admin. Probado en la base (transacción revertida) y la API en vivo (401/403/409/400)
- ✅ Asistente responde siempre: con IA si hay clave, y si no, con respuestas armadas con los datos reales (probado en vivo)
- ✅ API completa publicada como función de Supabase y probada en vivo (login, reservar, pagar, cobrar, cancelar, borrar, pedido de barbero)
- ✅ Asistente con IA para el cliente (función de Supabase publicada; sesión y validaciones probadas contra el servidor real)
- ⬜ Cargar la clave de IA (GEMINI_API_KEY o ANTHROPIC_API_KEY) en Supabase → Edge Functions → Secrets
- ✅ Recordatorio el día anterior y 2 h antes (probado en la base con un turno simulado y deshecho)
- ✅ Cuentas de prueba de cliente y barbero verificadas contra Supabase Auth real; botón "Entrar con otra cuenta"
- 🟡 Ingreso con Google: requiere `npx expo start --go --tunnel`
- 🟡 Probar la versión nueva en tu teléfono (después de `npx expo install expo-notifications expo-device @expo/vector-icons expo-image-picker`)
- ⬜ Generar el APK (`npx eas build -p android --profile preview`)
- ⬜ (Opcional) `npx eas update` para un QR permanente de Expo Go
- ⬜ Credenciales FCM en EAS para push en Android

## Página pública
- ✅ Página hecha (`landing/`): descripción, problema, funciones, público, instrucciones, estado del servidor, tema claro/oscuro
- ✅ Publicada en Vercel: https://belabarberia.vercel.app (27/10; con las funciones nuevas y la paleta de la app). 🟡 Abrirla en un navegador sin sesión para confirmar que es pública
- ⬜ Cargar en `landing/config.js` los enlaces del APK y de Expo Go

## Configuración y datos
- ⬜ SMTP propio en Supabase (o desactivar "Confirm email" para la demo)
- ✅ Datos DEMO cargados para probar (4 servicios "DEMO…", 2 barberos "Demo Barbero Uno/Dos", horarios lun–sáb 9–13 y 15–19)
- ✅ Servicios reales cargados por el admin, con estilos (Corte clásico, Corte + lavado, Perfilado de barba, Corte + barba, Fade, Crop, Moderno, Formal)
- ✅ Datos de prueba borrados (27/10): 2 turnos, servicio y barbero "PRUEBA", su horario y las categorías PRUEBA/DEMO sin uso
- ⬜ Entregar al profesor las cuentas de prueba en privado

## Documentación
- ✅ README.md general, backend/README.md, mobile/README.md
- ✅ DEFENSA.md (demo en 22 pasos + preguntas probables)
- ✅ DISENO.md (Fases 1–7), ACCESIBILIDAD.md (auditoría WCAG 2.2 AA, 19 hallazgos)
- ✅ Wireframes (`diseno/wireframes.png`) y user journey (`diseno/user_journey.png`)
- ✅ Informe PDF con 17 figuras numeradas (`informe/Informe_UX_UI_BELABARBERIA.pdf`; se regenera con `python3 informe/generar.py`)
- ⬜ Comprobación manual de accesibilidad en el celular (lista en ACCESIBILIDAD.md)
- ⬜ Capturas en el celular real para comparar con las de la simulación

## Funcionalidades nuevas (23/10)
- ✅ Favoritos, Reservar de nuevo, historial, puntos, niveles, recompensas, logros, galería, estilos, recomendado, cuenta regresiva, calendario mejorado, lista de espera, dashboards, Face ID
- ✅ Migraciones 15–20 aplicadas y guardadas en `supabase/migrations/`
- ✅ API v5 publicada (rutas nuevas)
- ✅ `expo-local-authentication` instalado en `mobile/`
- ⬜ Probar en el celular: completar un turno y ver los puntos; canjear y validar el código; anotarse a la lista de espera y cancelar el turno desde otra cuenta
- ✅ Figma: página "02 · Pantallas nuevas" con 6 pantallas, componentes y prototipo (13 conexiones)
- ⬜ Figma: arrastrar las 7 fotos de `mobile/assets/estilos/` sobre las capas "foto"
