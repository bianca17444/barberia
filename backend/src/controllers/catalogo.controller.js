/*
 * 📘 PARA LA DEFENSA — src/controllers/catalogo.controller.js — categorías, servicios y datos de la barbería.
 * Leer: cualquiera con sesión. Crear, modificar o borrar: solo el ADMIN (lo controla la ruta con requireRole y la base con RLS).
 * El precio tiene que ser mayor a 0 y la duración va en minutos (se valida acá y también en la base).
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const esAdmin = (req) => req.user.rol === 'ADMIN';
const SERVICIO_SELECT = 'id, nombre, descripcion, precio, duracion, activo, categoria_id, created_at, puntos, estilos, categoria:categoria_id (id, nombre)';

// ======================= CATEGORÍAS =======================

/** GET /categories */
export async function listarCategorias(req, res) {
  let q = req.db.from('categorias_servicio').select('*').order('nombre');
  if (!(esAdmin(req) && req.query.todas === 'true')) q = q.eq('activo', true);
  res.json({ categorias: datos(await q) });
}

/** POST /categories (ADMIN) */
export async function crearCategoria(req, res) {
  const fila = {
    nombre: v.texto(req.body?.nombre, 'nombre', { min: 2, max: 60 }),
    descripcion: v.texto(req.body?.descripcion, 'descripción', { requerido: false, max: 300 }),
    activo: req.body?.activo === undefined ? true : v.booleano(req.body.activo, 'activo')
  };
  const categoria = datos(await req.db.from('categorias_servicio').insert(fila).select().single(), { duplicado: 'Ya existe una categoría con ese nombre.' });
  res.status(201).json({ mensaje: 'Categoría creada.', categoria });
}

/** PUT /categories/:id (ADMIN) */
export async function actualizarCategoria(req, res) {
  const id = v.entero(req.params.id, 'id');
  const b = req.body ?? {};
  const cambios = {};
  if ('nombre' in b) cambios.nombre = v.texto(b.nombre, 'nombre', { min: 2, max: 60 });
  if ('descripcion' in b) cambios.descripcion = v.texto(b.descripcion, 'descripción', { requerido: false, max: 300 });
  if ('activo' in b) cambios.activo = v.booleano(b.activo, 'activo');
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const categoria = datos(await req.db.from('categorias_servicio').update(cambios).eq('id', id).select().single(),
    { noEncontrado: 'La categoría no existe.', duplicado: 'Ya existe una categoría con ese nombre.' });
  res.json({ mensaje: 'Categoría actualizada.', categoria });
}

/** DELETE /categories/:id (ADMIN) — los servicios quedan sin categoría */
export async function eliminarCategoria(req, res) {
  const id = v.entero(req.params.id, 'id');
  const filas = datos(await req.db.from('categorias_servicio').delete().eq('id', id).select('id'));
  if (!filas.length) throw new AppError(404, 'La categoría no existe.', 'no_encontrado');
  res.json({ mensaje: 'Categoría eliminada. Sus servicios quedaron sin categoría.' });
}

// ======================= SERVICIOS =======================

/** GET /services */
export async function listarServicios(req, res) {
  let q = req.db.from('servicios').select(SERVICIO_SELECT).order('nombre');
  if (!(esAdmin(req) && req.query.todos === 'true')) q = q.eq('activo', true);
  if (req.query.categoria_id) q = q.eq('categoria_id', v.entero(req.query.categoria_id, 'categoría'));
  res.json({ servicios: datos(await q) });
}

/** GET /services/:id */
export async function obtenerServicio(req, res) {
  const id = v.entero(req.params.id, 'id');
  const servicio = datos(await req.db.from('servicios').select(SERVICIO_SELECT).eq('id', id).single(), { noEncontrado: 'El servicio no existe.' });
  res.json({ servicio });
}

async function validarCategoria(req, valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const id = v.entero(valor, 'categoría');
  const cat = datos(await req.db.from('categorias_servicio').select('id').eq('id', id).maybeSingle());
  if (!cat) throw new AppError(400, 'La categoría seleccionada no existe.', 'validacion');
  return id;
}

/** POST /services (ADMIN) */
export async function crearServicio(req, res) {
  const b = req.body ?? {};
  const fila = {
    nombre: v.texto(b.nombre, 'nombre', { min: 2, max: 120 }),
    descripcion: v.texto(b.descripcion, 'descripción', { requerido: false, max: 500 }),
    precio: v.precio(b.precio),
    duracion: v.entero(b.duracion, 'duración (minutos)', { min: 5, max: 480 }),
    activo: b.activo === undefined ? true : v.booleano(b.activo, 'activo'),
    categoria_id: await validarCategoria(req, b.categoria_id),
    estilos: v.estilos(b.estilos),
    puntos: b.puntos === undefined || b.puntos === null || b.puntos === '' ? null : v.entero(b.puntos, 'puntos', { min: 0, max: 10000 })
  };
  const servicio = datos(await req.db.from('servicios').insert(fila).select(SERVICIO_SELECT).single());
  res.status(201).json({ mensaje: 'Servicio creado.', servicio });
}

/** PUT /services/:id (ADMIN) */
export async function actualizarServicio(req, res) {
  const id = v.entero(req.params.id, 'id');
  const b = req.body ?? {};
  const cambios = {};
  if ('nombre' in b) cambios.nombre = v.texto(b.nombre, 'nombre', { min: 2, max: 120 });
  if ('descripcion' in b) cambios.descripcion = v.texto(b.descripcion, 'descripción', { requerido: false, max: 500 });
  if ('precio' in b) cambios.precio = v.precio(b.precio);
  if ('duracion' in b) cambios.duracion = v.entero(b.duracion, 'duración (minutos)', { min: 5, max: 480 });
  if ('activo' in b) cambios.activo = v.booleano(b.activo, 'activo');
  if ('categoria_id' in b) cambios.categoria_id = await validarCategoria(req, b.categoria_id);
  if ('estilos' in b) cambios.estilos = v.estilos(b.estilos);
  if ('puntos' in b) cambios.puntos = b.puntos === null || b.puntos === '' ? null : v.entero(b.puntos, 'puntos', { min: 0, max: 10000 });
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const servicio = datos(await req.db.from('servicios').update(cambios).eq('id', id).select(SERVICIO_SELECT).single(), { noEncontrado: 'El servicio no existe.' });
  res.json({ mensaje: 'Servicio actualizado.', servicio });
}

/** DELETE /services/:id (ADMIN) — si tiene turnos, se desactiva en lugar de borrarse */
// 📘 Si el servicio ya tiene turnos, no se borra: se desactiva (activo = false).
//    Así no se pierde el historial, y el precio cobrado quedó guardado en detalle_turno.
export async function eliminarServicio(req, res) {
  const id = v.entero(req.params.id, 'id');
  const { data, error } = await req.db.from('servicios').delete().eq('id', id).select('id');
  if (error?.code === '23503') {
    datos(await req.db.from('servicios').update({ activo: false }).eq('id', id).select('id'));
    return res.json({ mensaje: 'El servicio tiene turnos registrados, así que se desactivó en lugar de eliminarse.', desactivado: true });
  }
  if (error) datos({ error });
  if (!data.length) throw new AppError(404, 'El servicio no existe.', 'no_encontrado');
  res.json({ mensaje: 'Servicio eliminado.', eliminado: true });
}

// ======================= BARBERÍA =======================

/** GET /barbershop */
export async function obtenerBarberia(req, res) {
  res.json({ barberia: datos(await req.db.from('barberia').select('*').eq('id', 1).single()) });
}

/** PUT /barbershop (ADMIN) */
export async function actualizarBarberia(req, res) {
  const b = req.body ?? {};
  const cambios = { updated_at: new Date().toISOString() };
  if ('nombre' in b) cambios.nombre = v.texto(b.nombre, 'nombre', { max: 80 });
  if ('direccion' in b) cambios.direccion = v.texto(b.direccion, 'dirección', { requerido: false, max: 200 });
  if ('telefono' in b) cambios.telefono = v.telefono(b.telefono);
  if ('email' in b) cambios.email = b.email ? v.email(b.email) : null;
  if ('descripcion' in b) cambios.descripcion = v.texto(b.descripcion, 'descripción', { requerido: false, max: 1000 });
  if ('alias_transferencia' in b) cambios.alias_transferencia = v.texto(b.alias_transferencia, 'alias', { requerido: false, max: 60 });
  if ('cbu' in b) {
    const cbu = b.cbu ? String(b.cbu).replace(/\s/g, '') : null;
    if (cbu && !/^\d{22}$/.test(cbu)) throw new AppError(400, 'El CBU/CVU debe tener 22 números.', 'validacion');
    cambios.cbu = cbu;
  }
  if ('titular_cuenta' in b) cambios.titular_cuenta = v.texto(b.titular_cuenta, 'titular', { requerido: false, max: 100 });
  const barberia = datos(await req.db.from('barberia').update(cambios).eq('id', 1).select().single());
  res.json({ mensaje: 'Información de la barbería actualizada.', barberia });
}
