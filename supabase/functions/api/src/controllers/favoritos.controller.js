/*
 * 📘 PARA LA DEFENSA — src/controllers/favoritos.controller.js — barberos y servicios favoritos del cliente.
 * La política RLS de la tabla favoritos asegura que cada cliente solo ve, agrega y quita los suyos.
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

// Cada consulta va con el token del cliente: la política RLS de "favoritos"
// garantiza que solo ve, agrega y quita los suyos.
const SELECT = `id, barbero_id, servicio_id, creado_at,
  barbero:barbero_id (id, nombre, apellido, especialidad, foto_url, activo),
  servicio:servicio_id (id, nombre, precio, duracion, activo)`;

/** GET /favorites — barberos y servicios favoritos del cliente */
export async function listar(req, res) {
  const filas = datos(await req.db.from('favoritos').select(SELECT).order('creado_at', { ascending: false }));
  res.json({
    barberos: filas.filter((f) => f.barbero).map((f) => ({ ...f.barbero, favorito_desde: f.creado_at })),
    servicios: filas.filter((f) => f.servicio).map((f) => ({ ...f.servicio, precio: Number(f.servicio.precio), favorito_desde: f.creado_at }))
  });
}

/** POST /favorites { barbero_id } o { servicio_id } — si ya estaba, no lo duplica */
export async function agregar(req, res) {
  const b = req.body ?? {};
  const barbero = b.barbero_id !== undefined && b.barbero_id !== null;
  const servicio = b.servicio_id !== undefined && b.servicio_id !== null;
  if (barbero === servicio) throw new AppError(400, 'Indicá un barbero o un servicio.', 'validacion');
  const fila = barbero ? { barbero_id: v.entero(b.barbero_id, 'barbero') } : { servicio_id: v.entero(b.servicio_id, 'servicio') };
  const { error } = await req.db.from('favoritos').insert(fila);
  if (error?.code === '23505') return res.json({ mensaje: 'Ya estaba en tus favoritos.', agregado: false });
  if (error?.code === '23503') throw new AppError(404, barbero ? 'El barbero no existe.' : 'El servicio no existe.', 'no_encontrado');
  if (error) datos({ error });
  res.status(201).json({ mensaje: 'Agregado a tus favoritos.', agregado: true });
}

/** DELETE /favorites/barbers/:id y /favorites/services/:id */
export async function quitar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const columna = req.params.tipo === 'barbers' ? 'barbero_id' : 'servicio_id';
  datos(await req.db.from('favoritos').delete().eq(columna, id));
  res.json({ mensaje: 'Quitado de tus favoritos.' });
}
