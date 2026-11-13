/*
 * 📘 PARA LA DEFENSA — src/app.js — arma la aplicación Express (la API).
 * Express es un framework de Node.js para hacer APIs: recibe pedidos HTTP (GET, POST, PUT, DELETE)
 * y los pasa por una cadena de MIDDLEWARES (funciones que se ejecutan en orden) hasta llegar a la ruta.
 *
 * Orden de la cadena en esta API:
 *   1. cabecerasSeguras → agrega cabeceras de seguridad a cada respuesta.
 *   2. cors            → decide desde qué páginas web se puede llamar a la API.
 *   3. express.json    → convierte el cuerpo JSON del pedido en un objeto (máximo 100 KB).
 *   4. rutas           → cada URL con sus controles (sesión, rol) y su controlador.
 *   5. noEncontrado    → si ninguna ruta coincidió, responde 404.
 *   6. manejarErrores  → cualquier error termina acá y se responde con un mensaje claro.
 *
 * Si el profe pregunta "¿qué es un middleware?": es una función (req, res, next) que se ejecuta antes
 * del controlador. Puede cortar el pedido (por ejemplo, responder 401) o llamar a next() para seguir.
 */
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import rutas from './routes/index.js';
import { cabecerasSeguras } from './middleware/seguridad.js';
import { noEncontrado, manejarErrores } from './middleware/errores.js';

const app = express();

// 📘 Oculta que el servidor es Express (no le damos pistas a un atacante).
//    'trust proxy' hace que se lea bien la IP real del cliente detrás de Supabase o Vercel (la usa el límite de intentos).
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cabecerasSeguras);

// CORS: la app móvil no envía Origin (siempre permitida); en navegador solo los orígenes configurados.
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));

// 📘 Lee el cuerpo JSON del pedido y lo deja en req.body. El límite de 100 KB evita pedidos gigantes.
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => {
  res.json({ servicio: 'API de BELABARBERÍA', documentacion: 'Ver README.md', salud: '/health' });
});

// 📘 Acá se conectan todas las rutas de routes/index.js. Lo que sigue solo se usa si la ruta no existe o hubo un error.
app.use(rutas);
app.use(noEncontrado);
app.use(manejarErrores);

export default app;
