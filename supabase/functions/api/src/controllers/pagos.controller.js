/*
 * 📘 PARA LA DEFENSA — src/controllers/pagos.controller.js — pagos.
 * No hay pasarela de pago online (decisión del proyecto: no simulamos cobros falsos).
 * El pago se crea solo, PENDIENTE, cuando se reserva un turno. Después el admin o el barbero lo marca PAGADO al cobrar.
 * Estados (tabla estados_pago): 1 PENDIENTE, 2 PAGADO, 3 CANCELADO. El cliente solo ve sus pagos (RLS).
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const ESTADOS = { PENDIENTE: 1, PAGADO: 2, CANCELADO: 3 };
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'];
const PAGO_SELECT = `
  id, monto, metodo, fecha, updated_at, turno_id,
  estado:estado_pago_id (id, nombre),
  turno:turno_id (id, fecha, hora, estado, servicio:servicio_id (nombre), barbero:barbero_id (nombre, apellido))
`;

const plano = (p) => ({ ...p, monto: Number(p.monto), estado: p.estado?.nombre, turno: p.turno && { ...p.turno, hora: String(p.turno.hora).slice(0, 5) } });

/** GET /payments — ADMIN ve todos; el cliente ve los suyos (RLS) */
export async function listar(req, res) {
  let q = req.db.from('pagos').select(PAGO_SELECT).order('fecha', { ascending: false });
  if (req.query.estado) q = q.eq('estado_pago_id', ESTADOS[v.enumerado(req.query.estado, 'estado', Object.keys(ESTADOS))]);
  res.json({ pagos: datos(await q).map(plano) });
}

/** GET /payments/:id */
export async function obtener(req, res) {
  const id = v.entero(req.params.id, 'id');
  const pago = datos(await req.db.from('pagos').select(PAGO_SELECT).eq('id', id).maybeSingle());
  if (!pago) throw new AppError(404, 'El pago no existe o no tenés acceso.', 'no_encontrado');
  res.json({ pago: plano(pago) });
}

/**
 * POST /payments (ADMIN) — registra el cobro de un turno.
 * El pago se crea automáticamente (PENDIENTE) al reservar; acá se marca como PAGADO.
 */
export async function registrar(req, res) {
  const turnoId = v.entero(req.body?.turno_id, 'turno');
  const metodo = v.enumerado(req.body?.metodo ?? 'EFECTIVO', 'método', METODOS);
  const actual = datos(await req.db.from('pagos').select('id, estado_pago_id').eq('turno_id', turnoId).maybeSingle());
  if (!actual) throw new AppError(404, 'El turno no existe o no tiene un pago asociado.', 'no_encontrado');
  if (actual.estado_pago_id === ESTADOS.CANCELADO) throw new AppError(400, 'No se puede cobrar un turno cancelado.', 'regla_negocio');
  const cambios = { estado_pago_id: ESTADOS.PAGADO, metodo };
  if (req.body?.monto !== undefined) cambios.monto = v.precio(req.body.monto);
  const pago = datos(await req.db.from('pagos').update(cambios).eq('id', actual.id).select(PAGO_SELECT).single());
  res.status(201).json({ mensaje: 'Pago registrado.', pago: plano(pago) });
}

/** PUT /payments/:id (ADMIN) — modificar estado, método o monto */
export async function actualizar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const b = req.body ?? {};
  const cambios = {};
  if ('estado' in b) cambios.estado_pago_id = ESTADOS[v.enumerado(b.estado, 'estado', Object.keys(ESTADOS))];
  if ('metodo' in b) cambios.metodo = b.metodo === null ? null : v.enumerado(b.metodo, 'método', METODOS);
  if ('monto' in b) cambios.monto = v.precio(b.monto);
  if (!Object.keys(cambios).length) throw new AppError(400, 'No enviaste datos para modificar.', 'validacion');
  const filas = datos(await req.db.from('pagos').update(cambios).eq('id', id).select(PAGO_SELECT));
  if (!filas.length) throw new AppError(404, 'El pago no existe.', 'no_encontrado');
  res.json({ mensaje: 'Pago actualizado.', pago: plano(filas[0]) });
}
