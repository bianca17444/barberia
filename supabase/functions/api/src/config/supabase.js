/*
 * 📘 PARA LA DEFENSA — src/config/supabase.js — cómo se conecta la API con Supabase.
 * Hay dos clientes:
 *   1) supabaseAnon: sin usuario. Solo para registrarse, iniciar sesión, renovar la sesión y recuperar la contraseña.
 *   2) clientePara(token): "en nombre del usuario". Cada consulta viaja con SU token, entonces la base de datos
 *      aplica las políticas RLS de esa persona (por ejemplo, un cliente solo ve sus turnos).
 * CLAVE PARA LA DEFENSA: la API nunca usa una clave con permisos totales. Aunque la API tuviera un error,
 * la base solo devuelve lo que ese usuario tiene permitido (defensa en profundidad).
 */
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const opcionesBase = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
};

/** Cliente anónimo: solo para registro, login, refresco y recuperación. */
export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseKey, opcionesBase);

/**
 * Cliente "como el usuario": todas las consultas viajan con su token,
 * así Supabase aplica las políticas RLS de ese usuario (segunda capa de seguridad).
 */
export function clientePara(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseKey, {
    ...opcionesBase,
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

/** Llamada directa a Supabase Auth (para operaciones que necesitan el token del usuario). */
// 📘 Llama directo al servicio de Auth de Supabase por HTTP. Se usa para cerrar sesión y cambiar la contraseña con el token del usuario.
export async function authFetch(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${env.supabaseUrl}/auth/v1${path}`, {
    method,
    headers: {
      apikey: env.supabaseKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
