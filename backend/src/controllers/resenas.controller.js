/*
 * 📘 PARA LA DEFENSA — src/controllers/resenas.controller.js — reseñas (calificación de 1 a 5 estrellas).
 * Regla: solo se puede calificar un turno PROPIO y COMPLETADO, y una sola vez por turno.
 * Lo controla la base (trigger resenas_validar e índice único), no solo la app.
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const RESENA_SELECT = `
  id, calificacion, comentario, fecha, turno_id, cliente_id,
  turno:turno_id (id, fecha, hora, servicio:servicio_id (nombre), barbero:barbero_id (id, nombre, apellido))
`;

/** GET /reviews — cliente: las suyas; barbero: de sus turnos; admin: todas (RLS) */
export async function listar(req, res) {
  let q = req.db.from('resenas').select(RESENA_SELECT).order('fecha', { ascending: false });
  if (req.query.calificacion) q = q.eq('calificacion', v.entero(req.query.calificacion, 'calificación', { min: 1, max: 5 }));
  const resenas = datos(await q);
  const promedio = resenas.length ? Math.round((resenas.reduce((s, r) => s + r.calificacion, 0) / resenas.length) * 10) / 10 : null;
  res.json({ resenas, promedio, total: resenas.length });
}

/** POST /reviews (CLIENTE) — solo turnos propios completados, una por turno */
export async function crear(req, res) {
  const fila = {
    turno_id: v.entero(req.body?.turno_id, 'turno'),
    cliente_id: req.user.id,
    calificacion: v.entero(req.body?.calificacion, 'calificación', { min: 1, max: 5 }),
    comentario: v.texto(req.body?.comentario, 'comentario', { requerido: false, max: 500 })
  };
  const resena = datos(await req.db.from('resenas').insert(fila).select(RESENA_SELECT).single(),
    { duplicado: 'Ya dejaste una reseña para este turno.', noEncontrado: 'El turno no existe.' });
  res.status(201).json({ mensaje: '¡Gracias por tu reseña!', resena });
}

/** PUT /reviews/:id (autor) */
export async function actualizar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const b = req.body ?? {};
  const cambios = {};
  if ('calificacion' in b) cambios.calificacion = v.entero(b.calificacion, 'calificación', { min: 1, max: 5 });
  if ('comentario' in b) cambios.comentario = v.texto(b.comentario, 'comentario', { requerido: false, max: 500 });
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const filas = datos(await req.db.from('resenas').update(cambios).eq('id', id).eq('cliente_id', req.user.id).select(RESENA_SELECT));
  if (!filas.length) throw new AppError(404, 'La reseña no existe o no es tuya.', 'no_encontrado');
  res.json({ mensaje: 'Reseña actualizada.', resena: filas[0] });
}

/** DELETE /reviews/:id (autor o ADMIN) */
export async function eliminar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const filas = datos(await req.db.from('resenas').delete().eq('id', id).select('id'));
  if (!filas.length) throw new AppError(404, 'La reseña no existe o no tenés permiso para eliminarla.', 'no_encontrado');
  res.json({ mensaje: 'Reseña eliminada.' });
}
