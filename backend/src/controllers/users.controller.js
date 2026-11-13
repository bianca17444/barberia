/*
 * 📘 PARA LA DEFENSA — src/controllers/users.controller.js — usuarios, roles y código para barberos.
 * Regla clave: nadie puede cambiarse su propio rol ni reactivar su cuenta. Solo el ADMIN, y siempre con funciones
 * seguras de la base (admin_cambiar_rol, admin_cambiar_activo) que vuelven a comprobar que sea admin.
 * Además, el trigger profiles_proteger_rol bloquea en la base cualquier cambio de rol que no venga por esas funciones.
 */
import { AppError, MENSAJES } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const ROLES = ['USUARIO', 'BARBERO', 'ADMIN'];

/** GET /users (ADMIN) — incluye email */
// 📘 Lista de usuarios para el panel del admin, con filtros por rol, estado y búsqueda.
export async function listar(req, res) {
  const usuarios = datos(await req.db.rpc('admin_listar_usuarios'));
  const { rol, activo, q } = req.query;
  let lista = usuarios;
  if (rol) lista = lista.filter((u) => u.rol === String(rol).toUpperCase());
  if (activo !== undefined) lista = lista.filter((u) => String(u.activo) === String(activo));
  if (q) {
    const t = String(q).toLowerCase();
    lista = lista.filter((u) => `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(t));
  }
  res.json({ usuarios: lista });
}

/** GET /users/:id (ADMIN o el propio usuario) */
export async function obtener(req, res) {
  const id = v.uuid(req.params.id, 'usuario');
  if (req.user.rol !== 'ADMIN' && id !== req.user.id) throw new AppError(403, MENSAJES.sinPermiso, 'sin_permiso');

  if (req.user.rol === 'ADMIN') {
    const usuario = datos(await req.db.rpc('admin_listar_usuarios')).find((u) => u.id === id);
    if (!usuario) throw new AppError(404, 'El usuario no existe.', 'no_encontrado');
    return res.json({ usuario });
  }
  res.json({ usuario: { ...req.user.perfil, email: req.user.email } });
}

/**
 * PUT /users/:id
 * - El propio usuario: nombre, apellido, telefono, avatar_url.
 * - ADMIN: además rol y activo (vía funciones seguras de la base).
 */
export async function actualizar(req, res) {
  const id = v.uuid(req.params.id, 'usuario');
  const esAdmin = req.user.rol === 'ADMIN';
  if (!esAdmin && id !== req.user.id) throw new AppError(403, MENSAJES.sinPermiso, 'sin_permiso');

  const body = req.body ?? {};
  // 📘 Si alguien que no es admin manda rol o activo → 403. Y aunque saltee la API, el trigger de la base también lo frena.
  if (!esAdmin && (body.rol !== undefined || body.activo !== undefined)) {
    throw new AppError(403, 'No podés cambiar tu rol ni el estado de tu cuenta.', 'sin_permiso');
  }

  const cambios = {};
  if (v.presentes(body, ['nombre']).length) cambios.nombre = v.texto(body.nombre, 'nombre', { max: 60 });
  if (v.presentes(body, ['apellido']).length) cambios.apellido = v.texto(body.apellido, 'apellido', { requerido: false, max: 60 }) ?? '';
  if (v.presentes(body, ['telefono']).length) cambios.telefono = v.telefono(body.telefono);
  if (v.presentes(body, ['avatar_url']).length) cambios.avatar_url = v.url(body.avatar_url, 'avatar_url');

  if (Object.keys(cambios).length) {
    const filas = datos(await req.db.from('profiles').update(cambios).eq('id', id).select('id'));
    if (!filas.length) throw new AppError(404, 'El usuario no existe.', 'no_encontrado');
  }
  if (esAdmin && body.rol !== undefined) {
    datos(await req.db.rpc('admin_cambiar_rol', { p_usuario_id: id, p_rol: v.enumerado(body.rol, 'rol', ROLES) }));
  }
  if (esAdmin && body.activo !== undefined) {
    datos(await req.db.rpc('admin_cambiar_activo', { p_usuario_id: id, p_activo: v.booleano(body.activo, 'activo') }));
  }

  const perfil = datos(await req.db.from('profiles').select('*').eq('id', id).single(), { noEncontrado: 'El usuario no existe.' });
  res.json({ mensaje: 'Datos actualizados.', usuario: perfil });
}

/** DELETE /users/:id (ADMIN) — baja lógica: desactiva la cuenta, conserva el historial */
// 📘 Baja lógica: la cuenta se desactiva pero no se borra, para conservar el historial de turnos y pagos.
export async function desactivar(req, res) {
  const id = v.uuid(req.params.id, 'usuario');
  const usuario = datos(await req.db.rpc('admin_cambiar_activo', { p_usuario_id: id, p_activo: false }));
  res.json({ mensaje: 'Usuario desactivado. Su historial de turnos se conserva.', usuario });
}

/** POST /users/me/barber-request (CLIENTE) — pide trabajar como barbero; el admin lo aprueba. */
// 📘 Sin código: se registra el pedido y le llega un aviso al admin, que lo aprueba o lo rechaza.
export async function solicitarBarbero(req, res) {
  datos(await req.db.rpc('solicitar_ser_barbero'));
  res.status(201).json({ mensaje: 'Listo, le avisamos al administrador. Cuando te apruebe vas a poder entrar como barbero.' });
}

/** GET /users/barber-requests (ADMIN) — solicitudes pendientes. */
export async function solicitudesBarbero(req, res) {
  res.json({ solicitudes: datos(await req.db.rpc('admin_solicitudes_barbero')) });
}

/** DELETE /users/:id/barber-request (ADMIN) — rechaza la solicitud. */
export async function rechazarSolicitud(req, res) {
  const id = v.uuid(req.params.id, 'usuario');
  datos(await req.db.rpc('admin_rechazar_solicitud', { p_usuario_id: id }));
  res.json({ mensaje: 'Solicitud rechazada. Le avisamos a la persona.' });
}

const CANJE = {
  OK: [200, '¡Listo! Ya sos parte del equipo. Te mostramos tu agenda.'],
  INCORRECTO: [400, 'El código no es correcto. Revisalo con el dueño de la barbería.', 'codigo_incorrecto'],
  BLOQUEADO: [429, 'Hiciste demasiados intentos. Probá de nuevo en una hora.', 'demasiados_intentos'],
  SIN_CODIGO: [409, 'La barbería todavía no activó un código para barberos. Pedíselo al dueño o enviá una solicitud.', 'sin_codigo'],
  YA_EQUIPO: [409, 'Tu cuenta ya es del equipo de la barbería.', 'ya_equipo'],
  INACTIVO: [403, 'Tu cuenta está desactivada.', 'cuenta_inactiva']
};

/** POST /users/me/barber-code (CLIENTE) — canjea el código de la barbería y pasa a ser barbero. */
// 📘 Un cliente escribe el código de la barbería para pasar a BARBERO. Lo valida la función canjear_codigo_barbero de la base:
//    el código está guardado cifrado (bcrypt) y hay un máximo de 5 intentos fallidos por hora.
export async function canjearCodigoBarbero(req, res) {
  const codigo = v.texto(req.body?.codigo, 'código', { max: 32 });
  const resultado = datos(await req.db.rpc('canjear_codigo_barbero', { p_codigo: codigo }));
  const [status, mensaje, code] = CANJE[resultado] ?? [500, MENSAJES.servidor, 'servidor'];
  if (status !== 200) throw new AppError(status, mensaje, code);
  res.json({ mensaje, rol: 'BARBERO' });
}

/** GET /barbershop/barber-code (ADMIN) — si hay un código activo (nunca lo devuelve). */
// 📘 El admin solo ve SI hay un código activo. El código nunca se devuelve: está cifrado y ni el admin lo puede volver a leer.
export async function estadoCodigoBarbero(req, res) {
  const [fila] = datos(await req.db.rpc('admin_codigo_barbero_activo'));
  res.json({ activo: !!fila?.activo, actualizado_at: fila?.actualizado_at ?? null });
}

/** PUT /barbershop/barber-code (ADMIN) — define el código; vacío o null lo desactiva. */
export async function definirCodigoBarbero(req, res) {
  const codigo = v.texto(req.body?.codigo, 'código', { requerido: false, min: 6, max: 32 });
  const activo = datos(await req.db.rpc('admin_definir_codigo_barbero', { p_codigo: codigo }));
  res.json({ activo, mensaje: activo ? 'Código guardado. Compartilo solo con tu equipo.' : 'Código desactivado: nadie puede sumarse como barbero con código.' });
}
