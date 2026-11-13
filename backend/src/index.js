/*
 * 📘 PARA LA DEFENSA — backend/src/index.js — arranca la API en tu compu para probarla (npm run dev → http://localhost:3000).
 * app.listen(puerto) deja al servidor escuchando pedidos HTTP.
 */
// Servidor local (desarrollo). En Vercel se usa api/index.js.
import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`API de BELABARBERÍA escuchando en http://localhost:${env.port}`);
});
