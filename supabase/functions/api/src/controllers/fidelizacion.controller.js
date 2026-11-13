/*
 * 📘 PARA LA DEFENSA — src/controllers/fidelizacion.controller.js — CLUB DE PUNTOS y recompensas.
 *   - Los puntos los suma un trigger de la base cuando un turno pasa a FINALIZADO (nunca dos veces por el mismo turno).
 *     La app no puede sumarse puntos: los usuarios no tienen permiso de escritura en esa tabla.
 *   - Canjear (canjear_recompensa): descuenta los puntos y genera un código BB-XXXXXX.
 *   - Usar (usar_canje): el barbero o el admin valida el código una sola vez (queda USADO).
 *   - El admin también puede REGALAR una recompensa (función regalar_recompensa; la app la llama directo a Supabase).
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

// Los puntos los otorga la base al finalizar un turno (trigger) y nunca dos veces por el mismo turno.
// Acá solo se consultan y se canjean, siempre a través de funciones seguras de Supabase.

/** GET /loyalty — puntos, nivel, progreso, historial y niveles */
export async function resumen(req, res) {
  const [puntos] = datos(await req.db.rpc('mis_puntos'));
  const historial = datos(await req.db.from('puntos_movimientos').select('id, tipo, puntos, motivo, turno_id, creado_at').eq('usuario_id', req.user.id).order('creado_at', { ascending: false }).limit(50));
  const niveles = datos(await req.db.from('niveles').select('nombre, desde').order('desde'));
  res.json({ ...puntos, progreso: Number(puntos?.progreso ?? 0), historial, niveles });
}

/** GET /achievements — logros calculados con los turnos reales */
export async function logros(req, res) {
  res.json({ logros: datos(await req.db.rpc('mis_logros')) });
}

/** GET /rewards — recompensas disponibles (el admin con ?todas=true ve también las desactivadas) */
export async function listarRecompensas(req, res) {
  let q = req.db.from('recompensas').select('*').order('costo');
  if (!(req.user.rol === 'ADMIN' && req.query.todas === 'true')) q = q.eq('activo', true);
  res.json({ recompensas: datos(await q) });
}

function filaRecompensa(b, parcial = false) {
  const f = {};
  if (!parcial || 'nombre' in b) f.nombre = v.texto(b.nombre, 'nombre', { min: 2, max: 80 });
  if (!parcial || 'descripcion' in b) f.descripcion = v.texto(b.descripcion, 'descripción', { requerido: false, max: 300 });
  if (!parcial || 'costo' in b) f.costo = v.entero(b.costo, 'costo en puntos', { min: 1, max: 100000 });
  if ('tipo' in b) f.tipo = v.enumerado(b.tipo, 'tipo', ['DESCUENTO', 'SERVICIO', 'OTRO']);
  if ('valor' in b) f.valor = b.valor === null || b.valor === '' ? null : v.entero(b.valor, 'valor', { min: 1, max: 100 });
  if ('activo' in b) f.activo = v.booleano(b.activo, 'activo');
  return f;
}

/** POST /rewards (ADMIN) */
export async function crearRecompensa(req, res) {
  const recompensa = datos(await req.db.from('recompensas').insert(filaRecompensa(req.body ?? {})).select().single());
  res.status(201).json({ mensaje: 'Recompensa creada.', recompensa });
}

/** PUT /rewards/:id (ADMIN) */
export async function actualizarRecompensa(req, res) {
  const id = v.entero(req.params.id, 'id');
  const cambios = filaRecompensa(req.body ?? {}, true);
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const recompensa = datos(await req.db.from('recompensas').update(cambios).eq('id', id).select().single(), { noEncontrado: 'La recompensa no existe.' });
  res.json({ mensaje: 'Recompensa actualizada.', recompensa });
}

/** POST /rewards/:id/redeem (CLIENTE) — descuenta los puntos y genera un código */
export async function canjear(req, res) {
  const id = v.entero(req.params.id, 'id');
  const canje = datos(await req.db.rpc('canjear_recompensa', { p_recompensa_id: id }));
  res.status(201).json({ mensaje: `¡Listo! Tu código es ${canje.codigo}. Mostralo en la barbería.`, canje });
}

/** GET /rewards/mine (CLIENTE) — mis recompensas canjeadas */
export async function misCanjes(req, res) {
  res.json({ canjes: datos(await req.db.from('canjes').select('id, nombre, costo, codigo, estado, creado_at, usado_at').eq('usuario_id', req.user.id).order('creado_at', { ascending: false })) });
}

/** POST /rewards/use (BARBERO o ADMIN) — valida un código al cobrar */
export async function usar(req, res) {
  const codigo = v.texto(req.body?.codigo, 'código', { min: 4, max: 20 });
  const canje = datos(await req.db.rpc('usar_canje', { p_codigo: codigo }));
  res.json({ mensaje: `Código válido: ${canje.nombre}. Quedó marcado como usado.`, canje });
}
