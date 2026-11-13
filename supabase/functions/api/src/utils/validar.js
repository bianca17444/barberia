/*
 * 📘 PARA LA DEFENSA — src/utils/validar.js — VALIDACIÓN de lo que manda la app.
 * Nunca se confía en los datos que llegan: cada campo se revisa (tipo, largo, formato) antes de tocar la base.
 * Si algo está mal → 400 con un mensaje claro.
 * Ejemplos: email con formato válido; contraseña de 8 a 72 caracteres con letras y números; precio mayor a 0.
 * Además la base vuelve a validar con restricciones (CHECK) y triggers: doble control.
 */
import { AppError } from './errors.js';

/**
 * Validaciones de entrada. Cada función devuelve el valor normalizado
 * o lanza un AppError 400 con un mensaje claro para el usuario.
 */
const falla = (mensaje) => { throw new AppError(400, mensaje, 'validacion'); };

export function texto(valor, campo, { requerido = true, min = 1, max = 200 } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (requerido) falla(`El campo ${campo} es obligatorio.`);
    return null;
  }
  if (typeof valor !== 'string') falla(`El campo ${campo} debe ser texto.`);
  const limpio = valor.trim();
  if (limpio.length < min) falla(`El campo ${campo} debe tener al menos ${min} caracteres.`);
  if (limpio.length > max) falla(`El campo ${campo} no puede superar los ${max} caracteres.`);
  return limpio;
}

export function email(valor) {
  const e = texto(valor, 'email', { max: 254 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) falla('El email ingresado no es válido.');
  return e.toLowerCase();
}

export function password(valor, campo = 'contraseña') {
  if (!valor) falla(`La ${campo} es obligatoria.`);
  if (typeof valor !== 'string' || valor.length < 8) falla(`La ${campo} debe tener al menos 8 caracteres.`);
  if (valor.length > 72) falla(`La ${campo} no puede superar los 72 caracteres.`);
  if (!/[A-Za-z]/.test(valor) || !/\d/.test(valor)) falla(`La ${campo} debe incluir letras y números.`);
  return valor;
}

export function telefono(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const t = String(valor).trim();
  if (!/^\+?[\d\s()-]{6,20}$/.test(t)) falla('El teléfono ingresado no es válido.');
  return t;
}

export function entero(valor, campo, { min = 1, max = Number.MAX_SAFE_INTEGER, requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) falla(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) falla(`El campo ${campo} no es válido.`);
  return n;
}

export function precio(valor) {
  const n = Number(valor);
  if (valor === undefined || valor === null || valor === '' || !Number.isFinite(n)) falla('El precio es obligatorio.');
  if (n <= 0) falla('El precio debe ser mayor a 0.');
  if (n > 10_000_000) falla('El precio no es válido.');
  return Math.round(n * 100) / 100;
}

export function fecha(valor, campo = 'fecha') {
  if (!valor) falla(`La ${campo} es obligatoria.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) falla(`La ${campo} debe tener el formato AAAA-MM-DD.`);
  const d = new Date(`${valor}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) falla(`La ${campo} no es válida.`);
  return valor;
}

export function hora(valor, campo = 'hora') {
  if (!valor) falla(`La ${campo} es obligatoria.`);
  const m = String(valor).match(/^([01]\d|2[0-3]):([0-5]\d)(:00)?$/);
  if (!m) falla(`La ${campo} debe tener el formato HH:MM.`);
  return `${m[1]}:${m[2]}`;
}

export function booleano(valor, campo) {
  if (typeof valor === 'boolean') return valor;
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  falla(`El campo ${campo} debe ser verdadero o falso.`);
}

export function enumerado(valor, campo, opciones) {
  const v = String(valor ?? '').toUpperCase();
  if (!opciones.includes(v)) falla(`El campo ${campo} debe ser uno de: ${opciones.join(', ')}.`);
  return v;
}

export function uuid(valor, campo = 'id') {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor))) {
    falla(`El ${campo} no es válido.`);
  }
  return String(valor).toLowerCase();
}

export function url(valor, campo) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const u = String(valor).trim();
  if (!/^https?:\/\/\S+$/i.test(u) || u.length > 500) falla(`El campo ${campo} debe ser una URL que empiece con http(s)://`);
  return u;
}

/** Solo copia las claves presentes (para PUT parciales). */
export function presentes(body, claves) {
  return claves.filter((k) => Object.prototype.hasOwnProperty.call(body ?? {}, k));
}

export const ESTILOS = ['FADE', 'CLASICO', 'CROP', 'BARBA', 'PREMIUM', 'FORMAL', 'MODERNO', 'OTRO'];

/** Lista de estilos válidos (para servicios, barberos y galería). */
export function estilos(valor) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) falla('Los estilos deben ser una lista.');
  const lista = [...new Set(valor.map((e) => String(e).toUpperCase()))];
  const malos = lista.filter((e) => !ESTILOS.includes(e));
  if (malos.length) falla(`Estilo no válido: ${malos.join(', ')}. Opciones: ${ESTILOS.join(', ')}.`);
  return lista;
}
