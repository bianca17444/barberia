/*
 * 📘 PARA LA DEFENSA — src/routes/index.js — el MAPA de la API: qué URL existe, qué controles pasa y qué función la atiende.
 * Cómo leer una línea:
 *     r.post('/appointments', requireRole('USUARIO', 'ADMIN'), requireActivo, ruta(turnos.crear));
 *   - r.post('/appointments'):  método HTTP + dirección. POST /appointments = crear un turno.
 *   - requireRole(...):         solo esos roles (si no → 403).
 *   - requireActivo:            la cuenta no puede estar desactivada.
 *   - ruta(turnos.crear):       la función del controlador que hace el trabajo.
 * Métodos REST: GET = leer · POST = crear · PUT = modificar · DELETE = borrar o desactivar.
 * Las rutas de salud y de autenticación son públicas. Desde r.use(requireAuth) para abajo, TODAS piden sesión.
 */
import { Router } from 'express';
import { ruta } from '../utils/async.js';
import { requireAuth, requireActivo } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { limitarIntentos } from '../middleware/seguridad.js';

import * as auth from '../controllers/auth.controller.js';
import * as users from '../controllers/users.controller.js';
import * as catalogo from '../controllers/catalogo.controller.js';
import * as barberos from '../controllers/barberos.controller.js';
import * as turnos from '../controllers/turnos.controller.js';
import * as pagos from '../controllers/pagos.controller.js';
import * as resenas from '../controllers/resenas.controller.js';
import * as notif from '../controllers/notificaciones.controller.js';
import * as home from '../controllers/home.controller.js';
import * as favoritos from '../controllers/favoritos.controller.js';
import * as fidelizacion from '../controllers/fidelizacion.controller.js';
import * as galeria from '../controllers/galeria.controller.js';
import * as espera from '../controllers/espera.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';

const r = Router();
const ADMIN = requireRole('ADMIN');
// 📘 Máximo 20 intentos cada 15 minutos por IP en login, registro y recuperar contraseña.
const limiteAuth = limitarIntentos({ maximo: 20 });

// ---------------- Salud ----------------
r.get('/health', ruta(home.health));

// ---------------- AUTH ----------------
r.post('/auth/register', limiteAuth, ruta(auth.register));
r.post('/auth/login', limiteAuth, ruta(auth.login));
r.post('/auth/refresh', ruta(auth.refresh));
r.post('/auth/forgot-password', limiteAuth, ruta(auth.forgotPassword));
r.post('/auth/logout', requireAuth, ruta(auth.logout));
r.post('/auth/reset-password', requireAuth, ruta(auth.resetPassword));
r.post('/auth/change-password', requireAuth, limiteAuth, ruta(auth.changePassword));
r.get('/auth/me', requireAuth, ruta(auth.me));

// ---------------- Pública (sin sesión): información de la barbería ----------------
// Todo lo demás requiere sesión: el catálogo es privado por decisión del negocio.

// ---------------- Rutas con sesión ----------------
// 📘 A partir de esta línea todas las rutas exigen un token válido (si no hay → 401).
r.use(requireAuth);

r.get('/home', ruta(home.resumen));
r.get('/barbershop', ruta(catalogo.obtenerBarberia));
r.put('/barbershop', ADMIN, ruta(catalogo.actualizarBarberia));
r.get('/barbershop/barber-code', ADMIN, ruta(users.estadoCodigoBarbero));
r.put('/barbershop/barber-code', ADMIN, ruta(users.definirCodigoBarbero));

// USUARIOS
r.get('/users', ADMIN, ruta(users.listar));
r.get('/users/barber-requests', ADMIN, ruta(users.solicitudesBarbero));
r.post('/users/me/barber-request', requireRole('USUARIO'), requireActivo, ruta(users.solicitarBarbero));
// 📘 Canjear el código de barbero: solo una cuenta de cliente activa y con límite de intentos.
r.post('/users/me/barber-code', requireRole('USUARIO'), requireActivo, limiteAuth, ruta(users.canjearCodigoBarbero));
r.delete('/users/:id/barber-request', ADMIN, ruta(users.rechazarSolicitud));
r.get('/users/:id', ruta(users.obtener));
r.put('/users/:id', requireActivo, ruta(users.actualizar));
r.delete('/users/:id', ADMIN, ruta(users.desactivar));

// CATEGORÍAS
r.get('/categories', ruta(catalogo.listarCategorias));
r.post('/categories', ADMIN, ruta(catalogo.crearCategoria));
r.put('/categories/:id', ADMIN, ruta(catalogo.actualizarCategoria));
r.delete('/categories/:id', ADMIN, ruta(catalogo.eliminarCategoria));

// SERVICIOS
r.get('/services', ruta(catalogo.listarServicios));
r.get('/services/:id', ruta(catalogo.obtenerServicio));
r.post('/services', ADMIN, ruta(catalogo.crearServicio));
r.put('/services/:id', ADMIN, ruta(catalogo.actualizarServicio));
r.delete('/services/:id', ADMIN, ruta(catalogo.eliminarServicio));

// BARBEROS
r.get('/barbers', ruta(barberos.listar));
r.get('/barbers/me', requireRole('BARBERO'), ruta(barberos.miFicha));
r.put('/barbers/me', requireRole('BARBERO'), requireActivo, ruta(barberos.actualizarMiFicha));
r.get('/barbers/:id', ruta(barberos.obtener));
r.post('/barbers', ADMIN, ruta(barberos.crear));
r.put('/barbers/:id', ADMIN, ruta(barberos.actualizar));
r.delete('/barbers/:id', ADMIN, ruta(barberos.desactivar));

// HORARIOS LABORALES
r.get('/schedules', ruta(barberos.listarHorarios));
r.post('/schedules', ADMIN, ruta(barberos.crearHorario));
r.put('/schedules/:id', ADMIN, ruta(barberos.actualizarHorario));
r.delete('/schedules/:id', ADMIN, ruta(barberos.eliminarHorario));

// TURNOS
r.get('/appointments/availability', ruta(turnos.disponibilidad));
r.get('/appointments/slots', ruta(turnos.horariosDelDia));
r.get('/appointments/days', ruta(turnos.diasDisponibles));
r.get('/appointments', ruta(turnos.listar));
r.get('/appointments/:id', ruta(turnos.obtener));
// 📘 Reservar: solo clientes (o el admin a nombre de un cliente). Horario y superposiciones los controla la base.
r.post('/appointments', requireRole('USUARIO', 'ADMIN'), requireActivo, ruta(turnos.crear));
r.put('/appointments/:id', requireActivo, ruta(turnos.actualizar));
r.delete('/appointments/:id', requireActivo, ruta(turnos.cancelar));
r.post('/appointments/:id/pay', requireRole('USUARIO'), requireActivo, ruta(turnos.informarPago));
r.post('/appointments/:id/charge', requireRole('BARBERO', 'ADMIN'), requireActivo, ruta(turnos.cobrar));
r.post('/appointments/:id/hide', requireRole('USUARIO', 'BARBERO'), ruta(turnos.ocultar));

// PAGOS
r.get('/payments', ruta(pagos.listar));
r.get('/payments/:id', ruta(pagos.obtener));
r.post('/payments', ADMIN, ruta(pagos.registrar));
r.put('/payments/:id', ADMIN, ruta(pagos.actualizar));

// RESEÑAS
r.get('/reviews', ruta(resenas.listar));
r.post('/reviews', requireRole('USUARIO'), requireActivo, ruta(resenas.crear));
r.put('/reviews/:id', requireRole('USUARIO'), requireActivo, ruta(resenas.actualizar));
r.delete('/reviews/:id', requireRole('USUARIO', 'ADMIN'), ruta(resenas.eliminar));

// FAVORITOS (solo del propio cliente; además lo garantiza RLS)
r.get('/favorites', requireRole('USUARIO'), ruta(favoritos.listar));
r.post('/favorites', requireRole('USUARIO'), requireActivo, ruta(favoritos.agregar));
r.delete('/favorites/:tipo(barbers|services)/:id', requireRole('USUARIO'), ruta(favoritos.quitar));

// FIDELIZACIÓN: puntos, niveles, logros y recompensas (los puntos los otorga la base)
const CLIENTE = requireRole('USUARIO');
r.get('/loyalty', CLIENTE, ruta(fidelizacion.resumen));
r.get('/achievements', CLIENTE, ruta(fidelizacion.logros));
r.get('/rewards', ruta(fidelizacion.listarRecompensas));
r.get('/rewards/mine', CLIENTE, ruta(fidelizacion.misCanjes));
r.post('/rewards', ADMIN, ruta(fidelizacion.crearRecompensa));
// 📘 Validar un código de recompensa: solo barbero o admin (un cliente no puede validar su propio código).
r.post('/rewards/use', requireRole('BARBERO', 'ADMIN'), requireActivo, ruta(fidelizacion.usar));
r.put('/rewards/:id', ADMIN, ruta(fidelizacion.actualizarRecompensa));
r.post('/rewards/:id/redeem', CLIENTE, requireActivo, ruta(fidelizacion.canjear));

// GALERÍA Y ESTILOS (ver: todos con sesión · subir/borrar: ADMIN)
r.get('/gallery', ruta(galeria.listar));
r.post('/gallery', ADMIN, ruta(galeria.agregar));
r.delete('/gallery/:id', ADMIN, ruta(galeria.eliminar));
r.get('/styles/:estilo', ruta(galeria.porEstilo));

// LISTA DE ESPERA (cliente)
r.get('/waitlist', CLIENTE, ruta(espera.listar));
r.post('/waitlist', CLIENTE, requireActivo, ruta(espera.anotarse));
r.delete('/waitlist/:id', CLIENTE, ruta(espera.salir));

// DASHBOARDS
r.get('/dashboard', requireRole('BARBERO', 'ADMIN'), ruta(dashboard.obtener));

// NOTIFICACIONES
r.get('/notifications', ruta(notif.listar));
r.put('/notifications/read-all', ruta(notif.marcarTodas));
r.put('/notifications/:id/read', ruta(notif.marcarLeida));
r.post('/notifications/push-token', ruta(notif.registrarToken));
r.delete('/notifications/push-token', ruta(notif.borrarToken));

export default r;
