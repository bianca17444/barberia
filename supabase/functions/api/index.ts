/*
 * 📘 PARA LA DEFENSA — supabase/functions/api/index.ts — así se publica la API.
 * Es una "Edge Function" de Supabase: código que corre en los servidores de Supabase (con Deno, no en tu compu).
 * Usa el MISMO Express de backend/src (copiado en ./src). Dirección pública:
 *     https://iznytpilnjbqtctfbvnf.supabase.co/functions/v1/api
 * Supabase entrega las rutas con "/api" adelante (/api/health); acá se lo sacamos para que Express las reconozca.
 */
// API REST de BELABARBERÍA (Express) publicada como función de Supabase.
// Es el mismo código que backend/src (también se puede publicar en Vercel).
// URL: https://<proyecto>.supabase.co/functions/v1/api/...
import express from 'express';
import app from './src/app.js';

const raiz = express();
// Supabase entrega la ruta con el nombre de la función adelante (/api/health): se lo quitamos.
raiz.use((req, _res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
    req.url = req.url.slice(4) || '/';
  }
  next();
});
raiz.use(app);
raiz.listen(8000);
