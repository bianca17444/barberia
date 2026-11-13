/**
 * Escapa texto antes de insertarlo con innerHTML.
 * Todo dato que venga de la base (nombres, descripciones, teléfonos)
 * debe pasar por acá: un nombre como <img onerror=...> no debe ejecutarse
 * en la sesión de otro usuario (por ejemplo, la del administrador).
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo permite URLs http(s) para atributos src. */
export function safeUrl(value, fallback = '') {
  const url = String(value ?? '').trim();
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : escapeHtml(fallback);
}
