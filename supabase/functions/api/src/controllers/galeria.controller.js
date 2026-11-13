/*
 * 📘 PARA LA DEFENSA — src/controllers/galeria.controller.js — galería de trabajos y "Elegí tu estilo".
 * Las fotos se suben a Supabase Storage (bucket "galeria") y acá se registra cada una con su barbero y su estilo.
 * Solo el ADMIN sube o borra fotos; todos los usuarios con sesión las pueden ver.
 */
import { datos } from '../utils/async.js';
import { AppError } from '../utils/errors.js';
import * as v from '../utils/validar.js';

const SELECT = 'id, barbero_id, url, path, estilo, descripcion, creado_at, barbero:barbero_id (id, nombre, apellido)';

/** GET /gallery?barbero_id=&estilo= — todos con sesión pueden ver */
export async function listar(req, res) {
  let q = req.db.from('galeria').select(SELECT).order('creado_at', { ascending: false }).limit(120);
  if (req.query.barbero_id) q = q.eq('barbero_id', v.entero(req.query.barbero_id, 'barbero'));
  if (req.query.estilo) q = q.eq('estilo', v.enumerado(req.query.estilo, 'estilo', v.ESTILOS));
  res.json({ fotos: datos(await q) });
}

/** POST /gallery (ADMIN) — la foto ya se subió a Storage (bucket "galeria"); acá se registra */
export async function agregar(req, res) {
  const b = req.body ?? {};
  const path = v.texto(b.path, 'archivo', { max: 300 });
  if (!/^[\w-]+\/[\w.-]+\.(jpe?g|png|webp)$/i.test(path)) throw new AppError(400, 'El archivo de la foto no es válido.', 'validacion');
  const fila = {
    barbero_id: v.entero(b.barbero_id, 'barbero'),
    url: v.url(b.url, 'foto'),
    path,
    estilo: b.estilo ? v.enumerado(b.estilo, 'estilo', v.ESTILOS) : 'OTRO',
    descripcion: v.texto(b.descripcion, 'descripción', { requerido: false, max: 200 })
  };
  if (!fila.url) throw new AppError(400, 'Falta la foto.', 'validacion');
  const foto = datos(await req.db.from('galeria').insert(fila).select(SELECT).single(), { relacionado: 'El barbero no existe.' });
  res.status(201).json({ mensaje: 'Foto agregada a la galería.', foto });
}

/** DELETE /gallery/:id (ADMIN) — borra el registro y el archivo */
export async function eliminar(req, res) {
  const id = v.entero(req.params.id, 'id');
  const filas = datos(await req.db.from('galeria').delete().eq('id', id).select('path'));
  if (!filas.length) throw new AppError(404, 'La foto no existe.', 'no_encontrado');
  await req.db.storage.from('galeria').remove([filas[0].path]);
  res.json({ mensaje: 'Foto eliminada.' });
}

/** GET /styles/:estilo — servicios, barberos y trabajos relacionados con un estilo */
export async function porEstilo(req, res) {
  const estilo = v.enumerado(req.params.estilo, 'estilo', v.ESTILOS);
  const [servicios, barberos, fotos] = await Promise.all([
    req.db.from('servicios').select('id, nombre, precio, duracion, estilos').eq('activo', true).contains('estilos', [estilo]).order('nombre'),
    req.db.from('barberos').select('id, nombre, apellido, especialidad, foto_url, estilos').eq('activo', true).order('nombre'),
    req.db.from('galeria').select(SELECT).eq('estilo', estilo).order('creado_at', { ascending: false }).limit(12)
  ]);
  const fotosLista = datos(fotos);
  const conFotos = new Set(fotosLista.map((f) => f.barbero_id));
  res.json({
    estilo,
    servicios: datos(servicios),
    barberos: datos(barberos).filter((b) => (b.estilos || []).includes(estilo) || conFotos.has(b.id)),
    fotos: fotosLista
  });
}
