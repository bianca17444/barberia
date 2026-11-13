/*
 * 📘 PARA LA DEFENSA — src/controllers/espera.controller.js — lista de espera ("Avisarme si se libera").
 * Cuando se cancela un turno, la base avisa al primero anotado para ese horario, que tiene 30 minutos para reservarlo.
 * Un proceso automático de la base (pg_cron, cada 5 minutos) pasa al siguiente si el primero no reservó.
 */
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

const SELECT = 'id, fecha, hora, estado, creado_at, avisado_at, barbero:barbero_id (id, nombre, apellido), servicio:servicio_id (id, nombre, duracion)';

/** GET /waitlist — mis anotaciones activas y recientes */
export async function listar(req, res) {
  const filas = datos(await req.db.from('lista_espera').select(SELECT).eq('usuario_id', req.user.id).order('creado_at', { ascending: false }).limit(30));
  res.json({ espera: filas.map((e) => ({ ...e, hora: String(e.hora).slice(0, 5) })) });
}

/** POST /waitlist { barbero_id, servicio_id, fecha, hora } — "Avisarme si se libera" */
export async function anotarse(req, res) {
  const b = req.body ?? {};
  const fila = datos(await req.db.rpc('anotarse_lista_espera', {
    p_barbero_id: v.entero(b.barbero_id, 'barbero'),
    p_servicio_id: v.entero(b.servicio_id, 'servicio'),
    p_fecha: v.fecha(b.fecha),
    p_hora: v.hora(b.hora)
  }), { duplicado: 'Ya estás anotado para ese horario.' });
  res.status(201).json({ mensaje: 'Listo: si ese horario se libera, te avisamos. Por orden de llegada.', espera: fila });
}

/** DELETE /waitlist/:id — salir de la lista (queda registrado como cancelado) */
export async function salir(req, res) {
  datos(await req.db.rpc('salir_lista_espera', { p_id: v.entero(req.params.id, 'id') }));
  res.json({ mensaje: 'Saliste de la lista de espera.' });
}
