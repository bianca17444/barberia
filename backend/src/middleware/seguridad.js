/*
 * 📘 PARA LA DEFENSA — src/middleware/seguridad.js — protecciones extra.
 *   - cabecerasSeguras: le indican al navegador que no adivine el tipo de archivo (nosniff), que no muestre la API
 *     dentro de otra página (DENY, evita "clickjacking") y que no guarde las respuestas (pueden tener datos personales).
 *   - limitarIntentos: cuenta pedidos por IP en 15 minutos. Se usa en login, registro y recuperar contraseña para
 *     frenar ataques de "fuerza bruta" (probar muchas contraseñas). Si se pasa del límite → 429 "Demasiados intentos".
 */
import { AppError } from '../utils/errors.js';

/** Cabeceras de seguridad básicas (equivalente reducido a helmet). */
export function cabecerasSeguras(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Límite simple de intentos por IP (por ejemplo, para login).
 * En Vercel cada instancia tiene su propia memoria: es una protección básica
 * contra fuerza bruta; Supabase Auth aplica además sus propios límites.
 */
export function limitarIntentos({ ventanaMs = 15 * 60 * 1000, maximo = 20 } = {}) {
  const intentos = new Map();
  return (req, _res, next) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const ahora = Date.now();
    const registro = intentos.get(ip);
    if (!registro || ahora - registro.inicio > ventanaMs) {
      intentos.set(ip, { inicio: ahora, cantidad: 1 });
      return next();
    }
    registro.cantidad += 1;
    if (registro.cantidad > maximo) {
      return next(new AppError(429, 'Demasiados intentos. Esperá unos minutos y volvé a probar.', 'demasiados_intentos'));
    }
    next();
  };
}
