/*
 * 📘 PARA LA DEFENSA — backend/api/index.js — entrada para publicar la API en Vercel (opción alternativa).
 * Hoy la API publicada corre como función de Supabase (supabase/functions/api/index.ts).
 * Las dos usan el mismo app.js, así que funcionan igual.
 */
// Punto de entrada para Vercel: todas las rutas se redirigen acá (ver vercel.json).
import app from '../src/app.js';

export default app;
