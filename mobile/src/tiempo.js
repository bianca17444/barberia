/*
 * 📘 PARA LA DEFENSA — mobile/src/tiempo.js — fechas y horas en la zona de Argentina, para MOSTRAR.
 * Las reglas (24 h para cancelar, horarios disponibles) las controla el servidor con su reloj, porque la hora del celular se puede cambiar.
 */
// Fechas y horas del negocio. Solo para la interfaz:
// la regla de 24 h y la disponibilidad las valida Supabase con el reloj del servidor.
const OFFSET = '-03:00'; // America/Argentina/Buenos_Aires (sin horario de verano)
const ZONA = 'America/Argentina/Buenos_Aires';

function partes(fecha) {
  // Hermes no siempre soporta timeZone en Intl: se calcula con el offset fijo
  const local = new Date(fecha.getTime() - 3 * 3600e3);
  return {
    y: local.getUTCFullYear(),
    m: String(local.getUTCMonth() + 1).padStart(2, '0'),
    d: String(local.getUTCDate()).padStart(2, '0'),
    dow: local.getUTCDay()
  };
}

export function hoyNegocio() {
  const p = partes(new Date());
  return `${p.y}-${p.m}-${p.d}`;
}

/** Próximos N días (incluye hoy) en la zona del negocio. */
export function proximosDias(n = 14) {
  const base = new Date(`${hoyNegocio()}T12:00:00${OFFSET}`);
  return Array.from({ length: n }, (_, i) => {
    const p = partes(new Date(base.getTime() + i * 86400e3));
    return { iso: `${p.y}-${p.m}-${p.d}`, dow: p.dow, dia: Number(p.d), mes: Number(p.m) };
  });
}

export function inicioTurno(fecha, hora) {
  return new Date(`${fecha}T${String(hora).slice(0, 8)}${OFFSET}`);
}

export function faltanAlMenos24h(fecha, hora) {
  return inicioTurno(fecha, hora).getTime() - Date.now() >= 24 * 3600e3;
}

export const horaCorta = (h) => String(h ?? '').slice(0, 5);
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return `${DIAS_CORTOS[dow]} ${d} ${MESES[m - 1]}`;
}

export { ZONA };
