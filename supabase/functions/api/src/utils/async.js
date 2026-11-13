/*
 * 📘 PARA LA DEFENSA — src/utils/async.js — ayudas para los controladores.
 *   - ruta(fn): Express no atrapa solo los errores de las funciones async; este envoltorio los manda al manejador central.
 *   - datos(respuesta): Supabase devuelve { data, error }. Si hay error lo traduce (deSupabase) y lo lanza; si no, devuelve data.
 */
import { deSupabase } from './errors.js';

/** Envuelve controladores async para que los errores lleguen al manejador central. */
export const ruta = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Lanza el error de Supabase traducido si existe; si no, devuelve los datos. */
export function datos({ data, error }, contexto) {
  if (error) throw deSupabase(error, contexto);
  return data;
}
