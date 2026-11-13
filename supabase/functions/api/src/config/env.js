/*
 * 📘 PARA LA DEFENSA — src/config/env.js — lee la configuración desde VARIABLES DE ENTORNO.
 * Por qué: las claves no se escriben en el código. Si el código se sube a GitHub, no se filtra nada.
 *   - SUPABASE_URL: dirección del proyecto de Supabase.
 *   - SUPABASE_PUBLISHABLE_KEY: clave PÚBLICA de Supabase. Puede estar en la app: lo que protege los datos es RLS.
 *   - CORS_ORIGINS: páginas web que pueden llamar a la API desde el navegador.
 *   - PORT: puerto para probar en la compu.
 * Si falta una variable obligatoria, la API no arranca y dice cuál falta (mejor fallar al inicio que a mitad de un pedido).
 * La clave secreta "service_role" (permisos totales) NO se usa en ningún lado.
 */
// Configuración leída de variables de entorno. Ningún secreto queda en el código.
// Funciona en Node (Vercel / local) y en Deno (función de Supabase).
// 📘 Sirve en Node (process.env) y en Deno (Deno.env), que es lo que usan las funciones de Supabase.
const leer = (nombre) => globalThis.process?.env?.[nombre] ?? globalThis.Deno?.env?.get?.(nombre);

function requerida(nombre, alternativa) {
  const valor = leer(nombre) ?? (alternativa ? leer(alternativa) : undefined);
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisá backend/.env.example.`);
  }
  return valor;
}

export const env = {
  supabaseUrl: requerida('SUPABASE_URL').replace(/\/+$/, ''),
  supabaseKey: requerida('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
  corsOrigins: (leer('CORS_ORIGINS') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  port: Number(leer('PORT')) || 3000
};
