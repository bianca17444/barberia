/*
 * 📘 PARA LA DEFENSA — src/controllers/home.controller.js — pantalla de inicio y estado del servidor.
 *   - GET /home: resumen según el rol (próximo turno, avisos sin leer, turnos del día).
 *   - GET /health: dice si la API y Supabase responden. La página web lo usa para mostrar "Servidor en línea".
 * La hora se calcula en la zona del negocio (Argentina), no con la del celular.
 */
import { datos } from '../utils/async.js';
import { env } from '../config/env.js';

/** Fecha y hora actuales en la zona del negocio (Argentina, UTC-3 sin horario de verano). */
function ahoraNegocio() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return { fecha: d.toISOString().slice(0, 10), hora: d.toISOString().slice(11, 16) };
}

/** GET /home — resumen para la pantalla principal según el rol */
export async function resumen(req, res) {
  const { fecha, hora } = ahoraNegocio();
  const barberia = datos(await req.db.from('barberia').select('*').eq('id', 1).maybeSingle());
  const { count: noLeidas } = await req.db.from('notificaciones').select('id', { count: 'exact', head: true }).eq('leida', false);

  let proximoTurno = null;
  let turnosHoy = null;

  if (req.user.rol === 'BARBERO') {
    const filas = datos(await req.db.rpc('agenda_barbero', { p_desde: fecha, p_hasta: null }))
      .filter((t) => ['PENDIENTE', 'CONFIRMADO'].includes(t.estado));
    turnosHoy = filas.filter((t) => t.fecha === fecha).length;
    const prox = filas.find((t) => t.fecha > fecha || String(t.hora).slice(0, 5) >= hora);
    if (prox) proximoTurno = { id: prox.id, fecha: prox.fecha, hora: String(prox.hora).slice(0, 5), estado: prox.estado, servicio: prox.servicio_nombre, cliente: `${prox.cliente_nombre || ''} ${prox.cliente_apellido || ''}`.trim() };
  } else {
    let q = req.db.from('turnos')
      .select('id, fecha, hora, estado, servicio:servicio_id (nombre), barbero:barbero_id (nombre, apellido)')
      .in('estado', ['PENDIENTE', 'CONFIRMADO'])
      .gte('fecha', fecha)
      .order('fecha').order('hora').limit(10);
    if (req.user.rol === 'USUARIO') q = q.eq('usuario_id', req.user.id);
    const prox = datos(await q).find((t) => t.fecha > fecha || String(t.hora).slice(0, 5) >= hora);
    if (prox) proximoTurno = { ...prox, hora: String(prox.hora).slice(0, 5) };
    if (req.user.rol === 'ADMIN') {
      const { count } = await req.db.from('turnos').select('id', { count: 'exact', head: true }).eq('fecha', fecha).neq('estado', 'CANCELADO');
      turnosHoy = count ?? 0;
    }
  }

  res.json({
    usuario: { nombre: req.user.perfil.nombre, apellido: req.user.perfil.apellido, rol: req.user.rol },
    barberia,
    proximoTurno,
    turnosHoy,
    notificacionesNoLeidas: noLeidas ?? 0
  });
}

/** GET /health — estado de la API y de la conexión con Supabase */
export async function health(_req, res) {
  const inicio = Date.now();
  let baseDeDatos = 'ok';
  try {
    const r = await fetch(`${env.supabaseUrl}/auth/v1/health`, { headers: { apikey: env.supabaseKey } });
    if (!r.ok) baseDeDatos = 'error';
  } catch {
    baseDeDatos = 'sin_conexion';
  }
  res.status(baseDeDatos === 'ok' ? 200 : 503).json({
    estado: baseDeDatos === 'ok' ? 'ok' : 'degradado',
    servicio: 'belabarberia-api',
    supabase: baseDeDatos,
    latencia_ms: Date.now() - inicio,
    fecha: new Date().toISOString()
  });
}
