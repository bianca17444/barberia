/*
 * 📘 PARA LA DEFENSA — src/middleware/roles.js — AUTORIZACIÓN (¿qué podés hacer?).
 * requireRole('ADMIN') o requireRole('BARBERO', 'ADMIN') deja pasar solo a esos roles; al resto le responde 403.
 * Va SIEMPRE después de requireAuth, porque primero hay que saber quién es la persona.
 * Ejemplo: un cliente que llama a POST /services (crear un servicio) recibe 403.
 * Es la primera barrera. La segunda está en la base (RLS + triggers): aunque alguien llame directo a Supabase
 * salteando la API, la base tampoco lo deja.
 */
import { AppError, MENSAJES } from '../utils/errors.js';

/**
 * Middleware de autorización por rol. Uso: requireRole('ADMIN') o requireRole('BARBERO', 'ADMIN').
 * Debe ir después de requireAuth. Es la primera capa; la base (RLS) es la segunda.
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, MENSAJES.sinSesion, 'sin_sesion'));
    if (!roles.includes(req.user.rol)) return next(new AppError(403, MENSAJES.sinPermiso, 'sin_permiso'));
    next();
  };
}
