/**
 * Utilidades de fecha y hora del negocio.
 *
 * IMPORTANTE: estas funciones son solo para la interfaz (mostrar u ocultar
 * botones, elegir fechas). La regla real de 24 h y los horarios disponibles
 * los valida Supabase con el reloj del servidor, nunca con el del dispositivo.
 */
export const ZONA_NEGOCIO = 'America/Argentina/Buenos_Aires';
const OFFSET_NEGOCIO = '-03:00'; // Argentina no aplica horario de verano

/** Fecha de hoy (YYYY-MM-DD) en la zona del negocio. */
export function hoyNegocio() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO }).format(new Date());
}

/** Suma días a una fecha YYYY-MM-DD. */
export function sumarDias(fechaIso, dias) {
  const d = new Date(`${fechaIso}T12:00:00${OFFSET_NEGOCIO}`);
  d.setUTCDate(d.getUTCDate() + dias);
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO }).format(d);
}

/** Instante de inicio de un turno (fecha + hora local del negocio). */
export function inicioTurno(fecha, hora) {
  return new Date(`${fecha}T${String(hora).slice(0, 8)}${OFFSET_NEGOCIO}`);
}

/** Estimación de interfaz: ¿faltan al menos 24 h? */
export function faltanAlMenos24h(fecha, hora) {
  return inicioTurno(fecha, hora).getTime() - Date.now() >= 24 * 60 * 60 * 1000;
}

/** HH:MM a partir de un valor time de Postgres. */
export function horaCorta(hora) {
  return String(hora ?? '').slice(0, 5);
}

/** Fecha legible en español. */
export function fechaLarga(fechaIso) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA_NEGOCIO
  }).format(new Date(`${fechaIso}T12:00:00${OFFSET_NEGOCIO}`));
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD. */
export function diaSemana(fechaIso) {
  return new Date(`${fechaIso}T12:00:00${OFFSET_NEGOCIO}`).getUTCDay();
}
