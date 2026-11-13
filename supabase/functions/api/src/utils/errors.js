/*
 * 📘 PARA LA DEFENSA — src/utils/errors.js — errores y mensajes para el usuario.
 * AppError = error con código HTTP (400, 401, 403, 404, 409, 429, 500) y un mensaje en español.
 * deSupabase traduce los errores de PostgreSQL a mensajes entendibles. Los más importantes:
 *   - 23505 / 23P01 → 409 "El horario seleccionado ya está ocupado" (dos turnos al mismo tiempo).
 *   - 42501         → 403 sin permiso (lo rechazó RLS o una regla de la base).
 *   - PGRST116      → 404 no existe.
 * Los mensajes en español que escriben nuestros triggers se muestran tal cual; los técnicos se ocultan.
 */
/** Error de aplicación con código HTTP y mensaje apto para el usuario. */
export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const MENSAJES = {
  sinPermiso: 'No tenés permisos para realizar esta operación.',
  noEncontrado: 'El registro solicitado no existe.',
  sinSesion: 'Tenés que iniciar sesión para continuar.',
  sesionVencida: 'Tu sesión venció. Volvé a iniciar sesión.',
  horarioOcupado: 'El horario seleccionado ya está ocupado.',
  servidor: 'Ocurrió un error en el servidor. Intentá nuevamente.',
  conexion: 'No se pudo conectar con la base de datos. Intentá nuevamente.'
};

/** Mensajes técnicos que nunca se muestran tal cual al usuario. */
const TECNICO = /permission denied|row-level security|violates|duplicate key|syntax|relation |column |function |JWT|PGRST|null value/i;

/**
 * Traduce un error de Supabase/PostgreSQL a un AppError entendible.
 * Los mensajes en español que generan nuestros triggers se respetan.
 */
export function deSupabase(error, contexto = {}) {
  if (!error) return new AppError(500, MENSAJES.servidor);
  if (error instanceof AppError) return error;

  const code = error.code || '';
  const msg = error.message || '';

  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) return new AppError(503, MENSAJES.conexion, 'conexion');
  if (/JWT expired|invalid JWT|token is expired/i.test(msg) || code === 'PGRST301') return new AppError(401, MENSAJES.sesionVencida, 'sesion_vencida');
  if (code === 'PGRST116') return new AppError(404, contexto.noEncontrado || MENSAJES.noEncontrado, 'no_encontrado');
  if (code === '23P01' || code === '23505') {
    return new AppError(409, contexto.duplicado || (contexto.turno ? MENSAJES.horarioOcupado : 'Ya existe un registro con esos datos.'), 'conflicto');
  }
  if (code === '23503') {
    // Mensaje propio de un trigger (por ejemplo "El barbero no existe"): se respeta
    if (!TECNICO.test(msg)) return new AppError(404, msg, 'no_encontrado');
    if (/is still referenced/i.test(error.details || '') || /delete/i.test(msg)) {
      return new AppError(409, contexto.relacionado || 'El registro está relacionado con otros datos (por ejemplo, turnos) y no puede eliminarse. Podés desactivarlo.', 'relacionado');
    }
    return new AppError(400, contexto.relacionado || 'Alguno de los datos seleccionados no existe.', 'relacionado');
  }
  if (code === '23514' || code === '22P02' || code === '22007' || code === '22008') {
    return new AppError(400, 'Los datos enviados no son válidos.', 'datos_invalidos');
  }
  if (code === 'P0002') return new AppError(404, TECNICO.test(msg) ? MENSAJES.noEncontrado : msg, 'no_encontrado');
  if (code === '22023') return new AppError(400, TECNICO.test(msg) ? 'Los datos enviados no son válidos.' : msg, 'regla_negocio');
  if (code === '42501') return new AppError(403, TECNICO.test(msg) ? MENSAJES.sinPermiso : msg, 'sin_permiso');

  console.error('[supabase]', code, msg);
  return new AppError(500, MENSAJES.servidor, 'servidor');
}
