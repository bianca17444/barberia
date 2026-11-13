/*
 * 📘 PARA LA DEFENSA — src/controllers/turnos.controller.js — TURNOS (el corazón de la app).
 * Un controlador recibe el pedido ya controlado por los middlewares, revisa los datos y habla con la base.
 * Estados de un turno: PENDIENTE → CONFIRMADO → FINALIZADO (en la app dice "Completado"), o CANCELADO.
 *
 * Las reglas importantes NO están solo acá: están en la base (triggers y funciones), así nadie las puede saltear:
 *   - no reservar en el pasado ni fuera del horario del barbero;
 *   - no superponer turnos (con un bloqueo por si dos personas reservan al mismo tiempo);
 *   - el cliente cancela solo hasta 24 h antes (con la hora del servidor, no la del celular);
 *   - qué cambios de estado puede hacer cada rol.
 * Todas las consultas usan req.db (el token del usuario) → RLS: el cliente solo ve sus turnos.
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const ESTADOS = ['PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'FINALIZADO'];
// 📘 Qué datos se piden de cada turno. En una sola consulta trae también servicio, barbero, precio, pago y reseña.
const TURNO_SELECT = `
  id, fecha, hora, estado, created_at, usuario_id, barbero_id, servicio_id,
  servicio:servicio_id (id, nombre, duracion, categoria:categoria_id (nombre)),
  barbero:barbero_id (id, nombre, apellido),
  detalle:detalle_turno (servicio_id, precio),
  pago:pagos (id, monto, metodo, informado_at, comprobante, estado:estado_pago_id (nombre)),
  resena:resenas (id, calificacion, comentario)
`;

/** Normaliza un turno para el frontend (precio y estado de pago planos). */
// 📘 Acomoda los datos para la app: hora en formato HH:MM, y precio y estado del pago en campos simples.
function plano(t) {
  const pago = Array.isArray(t.pago) ? t.pago[0] : t.pago;
  const resena = Array.isArray(t.resena) ? t.resena[0] : t.resena;
  const detalle = Array.isArray(t.detalle) ? t.detalle[0] : t.detalle;
  return {
    ...t,
    hora: String(t.hora).slice(0, 5),
    precio: detalle ? Number(detalle.precio) : null,
    pago: pago ? { id: pago.id, monto: Number(pago.monto), metodo: pago.metodo, informado_at: pago.informado_at, comprobante: pago.comprobante, estado: pago.estado?.nombre } : null,
    resena: resena || null,
    detalle: undefined
  };
}

/** GET /appointments/availability?barbero_id&servicio_id&fecha */
// 📘 Horarios LIBRES de un barbero para un servicio y un día.
//    Los calcula la función de la base horarios_disponibles (usa la duración del servicio y los turnos ya tomados).
export async function disponibilidad(req, res) {
  const barberoId = v.entero(req.query.barbero_id, 'barbero');
  const servicioId = v.entero(req.query.servicio_id, 'servicio');
  const fecha = v.fecha(req.query.fecha);

  const horas = datos(await req.db.rpc('horarios_disponibles', { p_barbero_id: barberoId, p_servicio_id: servicioId, p_fecha: fecha }));
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const { count } = await req.db.from('horarios_barberos').select('id', { count: 'exact', head: true })
    .eq('barbero_id', barberoId).eq('dia_semana', dia).eq('activo', true);

  const lista = horas.map((h) => String(h.hora).slice(0, 5));
  let mensaje = null;
  if (!lista.length) {
    mensaje = (count || 0) === 0
      ? 'Todavía no hay horarios de atención configurados para este barbero en ese día.'
      : 'No hay horarios disponibles para esta fecha.';
  }
  res.json({ fecha, horarios: lista, configurado: (count || 0) > 0, mensaje });
}

/** GET /appointments/slots?barbero_id&servicio_id&fecha — todos los horarios del día: LIBRE, OCUPADO o PASADO */
// 📘 Todos los horarios del día con su estado (LIBRE, OCUPADO o PASADO): así la app muestra los ocupados tachados y ofrece "Avisarme si se libera".
export async function horariosDelDia(req, res) {
  const filas = datos(await req.db.rpc('horarios_del_dia', {
    p_barbero_id: v.entero(req.query.barbero_id, 'barbero'),
    p_servicio_id: v.entero(req.query.servicio_id, 'servicio'),
    p_fecha: v.fecha(req.query.fecha)
  }));
  res.json({ horarios: filas.map((h) => ({ hora: String(h.hora).slice(0, 5), estado: h.estado })) });
}

/** GET /appointments/days?barbero_id&servicio_id&desde&dias — días con atención y cantidad de horarios libres */
// 📘 Calendario: qué días tienen atención y cuántos horarios libres quedan (para marcar días "lleno" o "cerrado").
export async function diasDisponibles(req, res) {
  const filas = datos(await req.db.rpc('dias_disponibles', {
    p_barbero_id: v.entero(req.query.barbero_id, 'barbero'),
    p_servicio_id: v.entero(req.query.servicio_id, 'servicio'),
    p_desde: v.fecha(req.query.desde, 'fecha desde'),
    p_dias: req.query.dias ? v.entero(req.query.dias, 'días', { min: 1, max: 60 }) : 21
  }));
  res.json({ dias: filas });
}

/** GET /appointments — cada rol ve solo lo que le corresponde */
// 📘 Lista de turnos según el rol: el barbero ve su agenda (función agenda_barbero), el admin ve todos con el cliente y el cliente solo los suyos.
export async function listar(req, res) {
  const { estado, desde, hasta } = req.query;

  if (req.user.rol === 'BARBERO') {
    const filas = datos(await req.db.rpc('agenda_barbero', {
      p_desde: desde ? v.fecha(desde, 'fecha desde') : null,
      p_hasta: hasta ? v.fecha(hasta, 'fecha hasta') : null
    }));
    const turnos = filas
      .filter((t) => !estado || t.estado === String(estado).toUpperCase())
      .map((t) => ({
        id: t.id, fecha: t.fecha, hora: String(t.hora).slice(0, 5), estado: t.estado,
        servicio: { id: t.servicio_id, nombre: t.servicio_nombre, duracion: t.servicio_duracion },
        cliente: { nombre: t.cliente_nombre, apellido: t.cliente_apellido, telefono: t.cliente_telefono, avatar_url: t.cliente_avatar },
        precio: t.precio === null ? null : Number(t.precio),
        pago: t.pago_estado ? { estado: t.pago_estado, metodo: t.pago_metodo, informado_at: t.pago_informado_at, comprobante: t.comprobante } : null
      }));
    return res.json({ turnos });
  }

  const select = req.user.rol === 'ADMIN'
    ? `${TURNO_SELECT}, cliente:usuario_id (id, nombre, apellido, telefono)`
    : TURNO_SELECT;
  let q = req.db.from('turnos').select(select).order('fecha', { ascending: false }).order('hora', { ascending: false });
  if (req.user.rol === 'USUARIO') q = q.eq('usuario_id', req.user.id).eq('oculto_cliente', false);
  if (estado) q = q.eq('estado', v.enumerado(estado, 'estado', ESTADOS));
  if (desde) q = q.gte('fecha', v.fecha(desde, 'fecha desde'));
  if (hasta) q = q.lte('fecha', v.fecha(hasta, 'fecha hasta'));
  res.json({ turnos: datos(await q).map(plano) });
}

/** GET /appointments/:id */
export async function obtener(req, res) {
  const id = v.entero(req.params.id, 'id');
  const select = req.user.rol === 'ADMIN' ? `${TURNO_SELECT}, cliente:usuario_id (id, nombre, apellido, telefono)` : TURNO_SELECT;
  const turno = datos(await req.db.from('turnos').select(select).eq('id', id).maybeSingle());
  if (!turno) throw new AppError(404, 'El turno no existe o no tenés acceso.', 'no_encontrado');
  res.json({ turno: plano(turno) });
}

/** POST /appointments (CLIENTE; el ADMIN puede reservar para otro usuario) */
// 📘 RESERVAR UN TURNO (POST /appointments).
//      1) valida los datos que manda la app;
//      2) inserta el turno en la base con el token del cliente;
//      3) un trigger de la base controla horario, fecha y superposición. Si el horario se ocupó recién,
//         la base da error y se responde 409 "El horario seleccionado ya está ocupado".
//    Si sale bien responde 201 (creado) y el turno queda PENDIENTE hasta que el barbero lo confirme.
export async function crear(req, res) {
  const b = req.body ?? {};
  const fila = {
    // 📘 El dueño del turno sale del TOKEN, no de lo que manda la app: un cliente no puede reservar a nombre de otro.
    usuario_id: req.user.rol === 'ADMIN' && b.usuario_id ? v.uuid(b.usuario_id, 'cliente') : req.user.id,
    barbero_id: v.entero(b.barbero_id, 'barbero'),
    servicio_id: v.entero(b.servicio_id, 'servicio'),
    fecha: v.fecha(b.fecha),
    hora: v.hora(b.hora)
  };
  // La base valida: barbero y servicio existentes y activos, horario laboral,
  // fecha no pasada y que no haya solapamientos (con bloqueo ante reservas simultáneas).
  const creado = datos(await req.db.from('turnos').insert(fila).select('id').single(), { turno: true });
  const turno = datos(await req.db.from('turnos').select(TURNO_SELECT).eq('id', creado.id).single());
  res.status(201).json({ mensaje: 'Turno reservado. Queda pendiente hasta que el barbero lo confirme.', turno: plano(turno) });
}

/** PUT /appointments/:id — cambio de estado (las reglas por rol y las 24 h las aplica la base) */
// 📘 Cambiar el estado de un turno. El cliente solo puede CANCELAR (cancelar_turno controla las 24 h).
//    Barbero y admin usan cambiar_estado_turno, que valida qué pasos se permiten (por ejemplo, no se completa un turno cancelado).
export async function actualizar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const estado = v.enumerado(req.body?.estado, 'estado', ESTADOS);
  if (req.user.rol === 'USUARIO' && estado !== 'CANCELADO') {
    throw new AppError(403, 'Solo podés cancelar tus turnos.', 'sin_permiso');
  }
  const rpc = estado === 'CANCELADO' && req.user.rol === 'USUARIO'
    ? req.db.rpc('cancelar_turno', { p_turno_id: id })
    : req.db.rpc('cambiar_estado_turno', { p_turno_id: id, p_estado: estado });
  datos(await rpc, { noEncontrado: 'El turno no existe o no tenés acceso.' });
  const turno = datos(await req.db.from('turnos').select(TURNO_SELECT).eq('id', id).maybeSingle());
  res.json({ mensaje: `Turno ${estado === 'FINALIZADO' ? 'completado' : estado.toLowerCase()}.`, turno: turno ? plano(turno) : null });
}

/** DELETE /appointments/:id — cancelación (baja lógica, el historial se conserva) */
// 📘 DELETE no borra el turno: lo pasa a CANCELADO (baja lógica). Se conserva el historial y el horario queda libre.
export async function cancelar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const rpc = req.user.rol === 'USUARIO'
    ? req.db.rpc('cancelar_turno', { p_turno_id: id })
    : req.db.rpc('cambiar_estado_turno', { p_turno_id: id, p_estado: 'CANCELADO' });
  datos(await rpc, { noEncontrado: 'El turno no existe o no tenés acceso.' });
  res.json({ mensaje: 'Turno cancelado. El horario quedó libre.' });
}

const METODOS_CLIENTE = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'];

/** POST /appointments/:id/pay (CLIENTE) — elige cómo paga / avisa que transfirió. Queda pendiente hasta que lo confirmen. */
// 📘 El cliente avisa cómo va a pagar. No hay pasarela de pago online: queda PENDIENTE hasta que el barbero o el admin confirme el cobro.
export async function informarPago(req, res) {
  const id = v.entero(req.params.id, 'id');
  const metodo = v.enumerado(req.body?.metodo, 'método de pago', METODOS_CLIENTE);
  const comprobante = v.texto(req.body?.comprobante, 'comprobante', { requerido: false, max: 200 });
  datos(await req.db.rpc('pago_informar', { p_turno_id: id, p_metodo: metodo, p_comprobante: comprobante }));
  res.json({ mensaje: metodo === 'TRANSFERENCIA' ? 'Listo, avisamos al barbero que transferiste. Te confirmamos cuando lo verifique.' : 'Listo, pagás en el local al llegar.' });
}

/** POST /appointments/:id/charge (BARBERO del turno o ADMIN) — registra el cobro (PAGADO). */
// 📘 El barbero del turno o el admin registra el cobro: el pago pasa a PAGADO y al cliente le llega un aviso.
export async function cobrar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const metodo = req.body?.metodo ? v.enumerado(req.body.metodo, 'método de pago', METODOS) : null;
  datos(await req.db.rpc('pago_cobrar', { p_turno_id: id, p_metodo: metodo }));
  res.json({ mensaje: 'Cobro registrado. Le avisamos al cliente.' });
}

/** POST /appointments/:id/hide — borra el turno del listado de quien lo pide (cliente o barbero). */
// 📘 Saca el turno de la lista de quien lo pide, pero no lo borra de la base (sigue en el historial del negocio).
export async function ocultar(req, res) {
  const id = v.entero(req.params.id, 'id');
  datos(await req.db.rpc('turno_ocultar', { p_turno_id: id }));
  res.json({ mensaje: 'Turno borrado de tu lista.' });
}
