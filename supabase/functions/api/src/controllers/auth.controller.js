/*
 * 📘 PARA LA DEFENSA — src/controllers/auth.controller.js — registro, inicio de sesión y contraseñas.
 * Las contraseñas las guarda Supabase Auth, cifradas: nuestra API no las guarda en ninguna tabla.
 * Al iniciar sesión, Supabase devuelve dos tokens:
 *   - access_token (JWT, vence en poco tiempo): se manda en cada pedido.
 *   - refresh_token: sirve para pedir un access_token nuevo sin volver a escribir la contraseña.
 * La app los guarda en el teléfono y la sesión se renueva sola.
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseAnon, authFetch } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import * as v from '../utils/validar.js';

// Direcciones a las que Supabase puede devolver al usuario (deben estar permitidas en Supabase)
function redireccion(valor) {
  if (typeof valor !== 'string') return undefined;
  return /^(https?|exp|barberiaimperial):\/\/\S+$/i.test(valor) && valor.length < 300 ? valor : undefined;
}

function sesionPublica(session) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    token_type: 'bearer'
  };
}

// 📘 Traduce los errores de Supabase Auth a mensajes en español. Por seguridad no se dice si falló el email o la contraseña.
function errorAuth(error) {
  const msg = error?.message || '';
  if (/Invalid login credentials/i.test(msg)) return new AppError(401, 'Email o contraseña incorrectos.', 'credenciales_invalidas');
  if (/Email not confirmed/i.test(msg)) return new AppError(403, 'Tenés que confirmar tu email antes de ingresar. Revisá tu casilla.', 'email_sin_confirmar');
  if (/already registered|already exists/i.test(msg)) return new AppError(409, 'Ya existe una cuenta con ese email.', 'email_registrado');
  if (/rate limit|too many/i.test(msg)) return new AppError(429, 'Demasiados intentos. Esperá unos minutos y volvé a probar.', 'demasiados_intentos');
  if (/password/i.test(msg) && /weak|short|characters|pwned|leaked/i.test(msg)) return new AppError(400, 'La contraseña es muy débil. Usá al menos 8 caracteres con letras y números.', 'password_debil');
  if (/refresh token/i.test(msg)) return new AppError(401, 'Tu sesión venció. Volvé a iniciar sesión.', 'sesion_vencida');
  if (/same password|should be different/i.test(msg)) return new AppError(400, 'La nueva contraseña debe ser distinta de la anterior.', 'password_repetida');
  console.error('[auth]', msg);
  return new AppError(400, 'No se pudo completar la operación de autenticación.', 'auth');
}

/** POST /auth/register */
// 📘 CREAR CUENTA. El rol NO se manda: un trigger de la base (handle_new_user) crea el perfil siempre como USUARIO.
//    Así nadie se puede registrar como ADMIN o BARBERO mandando datos falsos.
export async function register(req, res) {
  const email = v.email(req.body?.email);
  const password = v.password(req.body?.password);
  const nombre = v.texto(req.body?.nombre, 'nombre', { max: 60 });
  const apellido = v.texto(req.body?.apellido, 'apellido', { max: 60 });
  const telefono = v.telefono(req.body?.telefono);

  // El rol NUNCA se envía: la base siempre crea el perfil como USUARIO.
  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido, telefono }, emailRedirectTo: redireccion(req.body?.redirectTo) }
  });
  if (error) throw errorAuth(error);

  // Supabase no revela si el email ya existía: devuelve un usuario sin identidades
  // 📘 Si el email ya existía, Supabase no lo dice directo: devuelve un usuario sin identidades. Así lo detectamos.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AppError(409, 'Ya existe una cuenta con ese email.', 'email_registrado');
  }

  res.status(201).json({
    mensaje: data.session ? 'Cuenta creada correctamente.' : 'Cuenta creada. Revisá tu email para confirmarla.',
    requiereConfirmacion: !data.session,
    session: sesionPublica(data.session)
  });
}

/** POST /auth/login */
// 📘 INICIAR SESIÓN con email y contraseña. Si está bien, devuelve la sesión (los tokens) para que la app la guarde.
export async function login(req, res) {
  const email = v.email(req.body?.email);
  if (!req.body?.password) throw new AppError(400, 'La contraseña es obligatoria.', 'validacion');

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password: String(req.body.password) });
  if (error) throw errorAuth(error);
  res.json({ mensaje: 'Sesión iniciada.', session: sesionPublica(data.session) });
}

/** POST /auth/refresh */
// 📘 Renueva la sesión con el refresh_token cuando el access_token vence.
export async function refresh(req, res) {
  const refreshToken = v.texto(req.body?.refresh_token, 'refresh_token', { max: 500 });
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw errorAuth(error || { message: 'refresh token' });
  res.json({ session: sesionPublica(data.session) });
}

/** POST /auth/logout (requiere token) */
export async function logout(req, res) {
  await authFetch('/logout?scope=local', { method: 'POST', token: req.token });
  res.status(204).end();
}

/** POST /auth/forgot-password */
// 📘 RECUPERAR CONTRASEÑA: Supabase manda un email con un enlace. Respondemos lo mismo exista o no la cuenta, para no revelar qué emails están registrados.
export async function forgotPassword(req, res) {
  const email = v.email(req.body?.email);
  const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo: redireccion(req.body?.redirectTo) });
  if (error && /rate limit|too many/i.test(error.message || '')) throw errorAuth(error);
  // Respuesta idéntica exista o no la cuenta (no se revela qué emails están registrados)
  res.json({ mensaje: 'Si el email está registrado, vas a recibir un enlace para restablecer la contraseña.' });
}

/** POST /auth/reset-password (requiere el token de recuperación que llega por email) */
export async function resetPassword(req, res) {
  const password = v.password(req.body?.password, 'nueva contraseña');
  const r = await authFetch('/user', { method: 'PUT', token: req.token, body: { password } });
  if (!r.ok) throw errorAuth({ message: r.data?.msg || r.data?.message || r.data?.error_description || '' });
  res.json({ mensaje: 'Contraseña actualizada correctamente.' });
}

/** POST /auth/change-password (usuario logueado: pide la contraseña actual) */
// 📘 CAMBIAR CONTRASEÑA con la sesión abierta: primero se comprueba la contraseña actual (si alguien agarra tu celular desbloqueado, no puede cambiarla).
export async function changePassword(req, res) {
  if (!req.body?.actual) throw new AppError(400, 'La contraseña actual es obligatoria.', 'validacion');
  const nueva = v.password(req.body?.nueva, 'nueva contraseña');

  // Se verifica la contraseña actual con un cliente aislado (no toca otras sesiones)
  const verificador = createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: errActual } = await verificador.auth.signInWithPassword({ email: req.user.email, password: String(req.body.actual) });
  if (errActual) {
    throw new AppError(400, 'La contraseña actual es incorrecta. Si ingresaste con Google, usá "Recuperar contraseña" para crear una.', 'password_actual_incorrecta');
  }

  const r = await authFetch('/user', { method: 'PUT', token: req.token, body: { password: nueva } });
  if (!r.ok) throw errorAuth({ message: r.data?.msg || r.data?.message || '' });
  res.json({ mensaje: 'Contraseña cambiada correctamente.' });
}

/** GET /auth/me */
// 📘 Devuelve el perfil de la persona logueada, con su rol. La app lo usa para saber qué pestañas mostrar.
export async function me(req, res) {
  res.json({ usuario: { ...req.user.perfil, email: req.user.email } });
}
