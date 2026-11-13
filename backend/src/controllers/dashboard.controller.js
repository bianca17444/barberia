/*
 * 📘 PARA LA DEFENSA — src/controllers/dashboard.controller.js — indicadores.
 * Barbero: sus números del día. Admin: indicadores del local. Los calculan funciones de la base
 * (dashboard_barbero y dashboard_admin), que además controlan el rol.
 */
import { datos } from '../utils/async.js';

/** GET /dashboard — barbero: sus números del día · admin: indicadores del local */
export async function obtener(req, res) {
  const fn = req.user.rol === 'ADMIN' ? 'dashboard_admin' : 'dashboard_barbero';
  res.json({ dashboard: datos(await req.db.rpc(fn)) });
}
