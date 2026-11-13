/*
 * 📘 PARA LA DEFENSA — src/controllers/notificaciones.controller.js — avisos dentro de la app y registro del celular para push.
 * Las notificaciones NO las crea la app: las crean triggers de la base cuando cambia un turno, y otro trigger
 * las manda al celular con el servicio de push de Expo.
 * registrar_push_token guarda el "token de push" del dispositivo (su dirección para recibir avisos).
 */
import { AppError } from '../utils/errors.js';
import { datos } from '../utils/async.js';
import * as v from '../utils/validar.js';

/** GET /notifications */
export async function listar(req, res) {
  const notificaciones = datos(await req.db.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(50));
  res.json({ notificaciones, noLeidas: notificaciones.filter((n) => !n.leida).length });
}

/** PUT /notifications/:id/read */
export async function marcarLeida(req, res) {
  const id = v.entero(req.params.id, 'id');
  const filas = datos(await req.db.from('notificaciones').update({ leida: true }).eq('id', id).select('id'));
  if (!filas.length) throw new AppError(404, 'La notificación no existe.', 'no_encontrado');
  res.json({ mensaje: 'Notificación leída.' });
}

/** PUT /notifications/read-all */
export async function marcarTodas(req, res) {
  datos(await req.db.from('notificaciones').update({ leida: true }).eq('leida', false).select('id'));
  res.json({ mensaje: 'Todas las notificaciones quedaron leídas.' });
}

/** POST /notifications/push-token — registra el dispositivo para recibir push */
export async function registrarToken(req, res) {
  const token = v.texto(req.body?.token, 'token', { max: 200 });
  const plataforma = v.texto(req.body?.plataforma, 'plataforma', { requerido: false, max: 20 });
  datos(await req.db.rpc('registrar_push_token', { p_token: token, p_plataforma: plataforma }));
  res.status(201).json({ mensaje: 'Dispositivo registrado para notificaciones.' });
}

/** DELETE /notifications/push-token — al cerrar sesión */
export async function borrarToken(req, res) {
  const token = v.texto(req.body?.token, 'token', { max: 200 });
  datos(await req.db.from('push_tokens').delete().eq('token', token));
  res.status(204).end();
}
