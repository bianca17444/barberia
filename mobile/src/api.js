/*
 * 📘 PARA LA DEFENSA — mobile/src/api.js — cómo la app habla con la API.
 * api(path, opciones) hace un fetch a la dirección de la API + path y además:
 *   - agrega el token de la sesión en la cabecera  Authorization: Bearer <token>;
 *   - corta si el servidor tarda más de 20 segundos;
 *   - convierte los errores en mensajes claros ("Sin conexión…" o el mensaje que manda la API);
 *   - si la API dice que la sesión venció, cierra la sesión en el teléfono.
 * Ejemplo: api('/appointments', { method: 'POST', body: {...} }) reserva un turno.
 * La dirección de la API sale de la variable EXPO_PUBLIC_API_URL (no está escrita a mano en cada pantalla).
 */
import { supabase } from './supabase';

/**
 * URL de la API REST (Express) publicada. Se puede cambiar con EXPO_PUBLIC_API_URL en mobile/.env.
 * Por defecto: la API publicada como función de Supabase (el mismo código que backend/).
 * Nunca debe ser localhost en la entrega final.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(mensaje, status, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

/**
 * Llama a la API REST de BELABARBERÍA.
 * - Agrega el token de la sesión (Supabase Auth lo renueva solo).
 * - Traduce errores de red y del servidor a mensajes comprensibles.
 */
export async function api(path, { method = 'GET', body, auth = true, token } = {}) {
  let accessToken = token;
  if (auth && !accessToken) {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
    if (!accessToken) throw new ApiError('Tenés que iniciar sesión para continuar.', 401, 'sin_sesion');
  }

  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 20000);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controlador.signal
    });
  } catch (e) {
    throw new ApiError(
      e?.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Intentá nuevamente.'
        : 'Sin conexión. Revisá tu internet e intentá de nuevo.',
      0,
      'conexion'
    );
  } finally {
    clearTimeout(limite);
  }

  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const mensaje = data?.error?.mensaje || (res.status >= 500
      ? 'Ocurrió un error en el servidor. Intentá nuevamente.'
      : 'No se pudo completar la operación.');
    if (res.status === 401 && auth && data?.error?.codigo === 'sesion_vencida') {
      supabase.auth.signOut().catch(() => {});
    }
    throw new ApiError(mensaje, res.status, data?.error?.codigo);
  }
  return data;
}

/** Texto de error listo para mostrar. */
export const textoError = (e, porDefecto = 'Ocurrió un error. Intentá nuevamente.') => e?.message || porDefecto;

/**
 * Asistente con IA (función "asistente" de Supabase). La clave de la IA vive en el servidor.
 * mensajes: [{ rol: 'usuario' | 'asistente', texto }]
 * El asistente puede proponer reservar o cancelar: la app pide confirmación y lo hace con la API normal.
 */
// 📘 Asistente: manda la conversación a la función "asistente" de Supabase con el token del cliente.
//    La clave de la IA está en el servidor, nunca en la app. Si el asistente propone reservar o cancelar,
//    la app le pide confirmación al cliente y recién ahí usa la API normal.
export async function preguntarAsistente(mensajes) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('Tenés que iniciar sesión para continuar.', 401, 'sin_sesion');
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 45000);
  let res;
  try {
    res = await fetch(`${base}/functions/v1/asistente`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
      },
      body: JSON.stringify({ mensajes }),
      signal: controlador.signal
    });
  } catch (e) {
    throw new ApiError(e?.name === 'AbortError' ? 'El asistente tardó demasiado. Probá de nuevo.' : 'Sin conexión. Revisá tu internet e intentá de nuevo.', 0, 'conexion');
  } finally {
    clearTimeout(limite);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error?.mensaje || 'El asistente no está disponible en este momento.', res.status, json?.error?.codigo);
  // { respuesta, accion } — accion: propuesta de RESERVAR o CANCELAR ya validada por el servidor (o null)
  return { respuesta: json.respuesta, accion: json.accion || null };
}
