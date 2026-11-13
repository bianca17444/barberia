/*
 * 📘 PARA LA DEFENSA — src/middleware/errores.js — manejo central de errores.
 *   - noEncontrado: si la URL no existe → 404.
 *   - manejarErrores: todos los errores terminan acá. Responde siempre con el mismo formato { error: { mensaje, codigo } }
 *     y NUNCA muestra detalles técnicos (nombres de tablas o SQL), porque le darían pistas a un atacante.
 * Los errores inesperados se anotan en el registro del servidor (console.error) y al usuario le llega un 500 genérico.
 */
import { AppError, MENSAJES } from '../utils/errors.js';

export function noEncontrado(req, _res, next) {
  next(new AppError(404, `La ruta ${req.method} ${req.path} no existe.`, 'ruta_inexistente'));
}

/** Manejador central: responde siempre { error: { mensaje, codigo } } sin detalles técnicos. */
// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, _req, res, _next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { mensaje: 'El cuerpo de la petición no es un JSON válido.', codigo: 'json_invalido' } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { mensaje: err.message, codigo: err.code || 'error' } });
  }
  console.error('[error no controlado]', err);
  res.status(500).json({ error: { mensaje: MENSAJES.servidor, codigo: 'servidor' } });
}
