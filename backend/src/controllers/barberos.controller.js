/*
 * 📘 PARA LA DEFENSA — src/controllers/barberos.controller.js — barberos y sus horarios de trabajo.
 * Cada barbero tiene una FICHA (tabla barberos) vinculada a su cuenta (usuario_id).
 * Sus horarios (tabla horarios_barberos) dicen qué días y en qué franjas atiende: con eso se calculan los horarios libres.
 * La base rechaza franjas superpuestas del mismo barbero.
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const esAdmin = (req) => req.user.rol === 'ADMIN';
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ======================= BARBEROS =======================

/** GET /barbers */
export async function listar(req, res) {
  let q = req.db.from('barberos').select('id, nombre, apellido, especialidad, foto_url, activo, usuario_id, estilos').order('nombre');
  if (!(esAdmin(req) && req.query.todos === 'true')) q = q.eq('activo', true);
  const barberos = datos(await q).map((b) => (esAdmin(req) ? b : { ...b, usuario_id: undefined }));
  res.json({ barberos });
}

/** GET /barbers/me (BARBERO) — su ficha y sus horarios */
export async function miFicha(req, res) {
  const barbero = datos(await req.db.from('barberos').select('*').eq('usuario_id', req.user.id).maybeSingle());
  if (!barbero) throw new AppError(404, 'Tu cuenta todavía no está vinculada a una ficha de barbero. Pedíselo al administrador.', 'sin_ficha');
  const horarios = datos(await req.db.from('horarios_barberos').select('*').eq('barbero_id', barbero.id).order('dia_semana').order('hora_inicio'));
  res.json({ barbero, horarios: horarios.map((h) => ({ ...h, dia: DIAS[h.dia_semana] })) });
}

/** PUT /barbers/me (BARBERO) — solo especialidad y foto */
// 📘 El barbero solo puede cambiar su especialidad y su foto. Lo demás (estado, horarios) lo maneja el admin.
export async function actualizarMiFicha(req, res) {
  const barbero = datos(await req.db.rpc('barbero_actualizar_ficha', {
    p_especialidad: v.texto(req.body?.especialidad, 'especialidad', { requerido: false, max: 120 }),
    p_foto_url: v.url(req.body?.foto_url, 'foto')
  }));
  res.json({ mensaje: 'Tus datos se actualizaron.', barbero });
}

/** GET /barbers/:id */
export async function obtener(req, res) {
  const id = v.entero(req.params.id, 'id');
  const barbero = datos(await req.db.from('barberos').select('id, nombre, apellido, especialidad, foto_url, activo, usuario_id, estilos').eq('id', id).single(), { noEncontrado: 'El barbero no existe.' });
  if (!esAdmin(req)) delete barbero.usuario_id;
  res.json({ barbero });
}

function filaBarbero(b, parcial = false) {
  const fila = {};
  if (!parcial || 'nombre' in b) fila.nombre = v.texto(b.nombre, 'nombre', { max: 60 });
  if (!parcial || 'apellido' in b) fila.apellido = v.texto(b.apellido, 'apellido', { max: 60 });
  if (!parcial || 'especialidad' in b) fila.especialidad = v.texto(b.especialidad, 'especialidad', { requerido: false, max: 120 });
  if (!parcial || 'foto_url' in b) fila.foto_url = v.url(b.foto_url, 'foto');
  if ('activo' in b) fila.activo = v.booleano(b.activo, 'activo');
  if ('estilos' in b) fila.estilos = v.estilos(b.estilos);
  if ('usuario_id' in b) fila.usuario_id = b.usuario_id ? v.uuid(b.usuario_id, 'usuario') : null;
  return fila;
}

/** POST /barbers (ADMIN) */
export async function crear(req, res) {
  const fila = filaBarbero(req.body ?? {});
  const barbero = datos(await req.db.from('barberos').insert(fila).select().single(), { duplicado: 'Esa cuenta ya está vinculada a otro barbero.' });
  res.status(201).json({ mensaje: 'Barbero creado.', barbero });
}

/** PUT /barbers/:id (ADMIN) */
export async function actualizar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const cambios = filaBarbero(req.body ?? {}, true);
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const barbero = datos(await req.db.from('barberos').update(cambios).eq('id', id).select().single(),
    { noEncontrado: 'El barbero no existe.', duplicado: 'Esa cuenta ya está vinculada a otro barbero.' });
  res.json({ mensaje: 'Barbero actualizado.', barbero });
}

/** DELETE /barbers/:id (ADMIN) — baja lógica: se desactiva y deja de recibir reservas */
// 📘 Baja lógica: el barbero deja de aparecer para reservar, pero se conservan sus turnos anteriores.
export async function desactivar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const barbero = datos(await req.db.from('barberos').update({ activo: false }).eq('id', id).select().single(), { noEncontrado: 'El barbero no existe.' });
  res.json({ mensaje: 'Barbero desactivado. Ya no recibe nuevas reservas; sus turnos se conservan.', barbero });
}

// ======================= HORARIOS LABORALES =======================

/** GET /schedules?barbero_id= */
export async function listarHorarios(req, res) {
  let q = req.db.from('horarios_barberos').select('*, barbero:barbero_id (id, nombre, apellido)').order('barbero_id').order('dia_semana').order('hora_inicio');
  if (req.query.barbero_id) q = q.eq('barbero_id', v.entero(req.query.barbero_id, 'barbero'));
  res.json({ horarios: datos(await q).map((h) => ({ ...h, dia: DIAS[h.dia_semana] })) });
}

function filaHorario(b, parcial = false) {
  const fila = {};
  if (!parcial || 'barbero_id' in b) fila.barbero_id = v.entero(b.barbero_id, 'barbero');
  if (!parcial || 'dia_semana' in b) fila.dia_semana = v.entero(b.dia_semana, 'día', { min: 0, max: 6 });
  if (!parcial || 'hora_inicio' in b) fila.hora_inicio = v.hora(b.hora_inicio, 'hora de inicio');
  if (!parcial || 'hora_fin' in b) fila.hora_fin = v.hora(b.hora_fin, 'hora de fin');
  if ('activo' in b) fila.activo = v.booleano(b.activo, 'activo');
  if (fila.hora_inicio && fila.hora_fin && fila.hora_fin <= fila.hora_inicio) {
    throw new AppError(400, 'La hora de fin debe ser posterior a la de inicio.', 'validacion');
  }
  return fila;
}

/** POST /schedules (ADMIN) */
export async function crearHorario(req, res) {
  const horario = datos(await req.db.from('horarios_barberos').insert(filaHorario(req.body ?? {})).select().single(),
    { relacionado: 'El barbero seleccionado no existe.', duplicado: 'La franja se superpone con otra del mismo barbero.' });
  res.status(201).json({ mensaje: 'Franja horaria creada.', horario });
}

/** PUT /schedules/:id (ADMIN) */
export async function actualizarHorario(req, res) {
  const id = v.entero(req.params.id, 'id');
  const cambios = filaHorario(req.body ?? {}, true);
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const horario = datos(await req.db.from('horarios_barberos').update(cambios).eq('id', id).select().single(),
    { noEncontrado: 'La franja no existe.', duplicado: 'La franja se superpone con otra del mismo barbero.' });
  res.json({ mensaje: 'Franja horaria actualizada.', horario });
}

/** DELETE /schedules/:id (ADMIN) */
export async function eliminarHorario(req, res) {
  const id = v.entero(req.params.id, 'id');
  const filas = datos(await req.db.from('horarios_barberos').delete().eq('id', id).select('id'));
  if (!filas.length) throw new AppError(404, 'La franja no existe.', 'no_encontrado');
  res.json({ mensaje: 'Franja horaria eliminada.' });
}
