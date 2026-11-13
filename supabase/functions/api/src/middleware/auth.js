/*
 * 📘 PARA LA DEFENSA — src/middleware/auth.js — AUTENTICACIÓN (¿quién sos?).
 * Qué es un JWT: un "pase" firmado que entrega Supabase al iniciar sesión. Lleva el id del usuario y cuándo vence.
 * Como está firmado, no se puede falsificar ni modificar sin que se note.
 * La app lo manda en cada pedido en la cabecera:  Authorization: Bearer <token>
 *
 * requireAuth hace 4 pasos:
 *   1. Lee la cabecera. Si no hay token → 401 "Tenés que iniciar sesión".
 *   2. Le pregunta a Supabase si el token es válido (firma y vencimiento). Si no → 401 "Tu sesión venció".
 *   3. Busca el perfil en la tabla profiles para saber el ROL y si la cuenta está activa.
 *   4. Guarda en req.user los datos de la persona y en req.db un cliente de Supabase que actúa como ella.
 *
 * Diferencia 401 y 403: 401 = no sé quién sos (sin sesión). 403 = sé quién sos, pero no tenés permiso.
 */
import { supabaseAnon, clientePara } from '../config/supabase.js';
import { AppError, MENSAJES } from '../utils/errors.js';

/**
 * Verifica el JWT (access token de Supabase Auth) enviado en
 * "Authorization: Bearer <token>". La firma y el vencimiento los valida
 * Supabase Auth; después se carga el rol desde la tabla profiles.
 *
 * Deja disponible:
 *   req.user = { id, email, rol, activo }
 *   req.db   = cliente de Supabase que actúa como ese usuario (aplica RLS)
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');
    if (tipo !== 'Bearer' || !token) throw new AppError(401, MENSAJES.sinSesion, 'sin_sesion');

    // 📘 Acá se valida el token: Supabase revisa la firma y que no esté vencido.
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) throw new AppError(401, MENSAJES.sesionVencida, 'sesion_vencida');

    // 📘 Desde acá, todas las consultas de este pedido van "como el usuario": la base aplica sus reglas RLS.
    const db = clientePara(token);
    const { data: perfil, error: errPerfil } = await db
      .from('profiles')
      .select('id, nombre, apellido, telefono, rol, activo, avatar_url, solicita_barbero')
      .eq('id', data.user.id)
      .maybeSingle();
    if (errPerfil) throw new AppError(503, MENSAJES.conexion, 'conexion');
    if (!perfil) throw new AppError(403, 'Tu perfil no existe. Contactá a la barbería.', 'sin_perfil');

    req.user = { id: perfil.id, email: data.user.email, rol: perfil.rol, activo: perfil.activo, perfil };
    req.token = token;
    req.db = db;
    next();
  } catch (err) {
    next(err);
  }
}

/** Bloquea las operaciones de escritura de cuentas desactivadas. */
// 📘 Si el admin desactivó la cuenta, la persona puede mirar pero no reservar ni modificar nada (403).
export function requireActivo(req, _res, next) {
  if (req.user && req.user.activo === false) {
    return next(new AppError(403, 'Tu cuenta está desactivada. Contactá a la barbería.', 'cuenta_desactivada'));
  }
  next();
}
