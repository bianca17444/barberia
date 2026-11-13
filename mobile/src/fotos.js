/*
 * 📘 PARA LA DEFENSA — mobile/src/fotos.js — elegir una foto (galería o cámara) y subirla a Supabase Storage.
 *   - Foto de perfil: bucket "avatars", en la carpeta del propio usuario (Storage no deja escribir en carpetas ajenas).
 *   - Galería de trabajos: bucket "galeria"; solo el admin puede subir.
 */
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/** Convierte base64 a bytes (Hermes trae atob). */
function aBytes(base64) {
  const bin = globalThis.atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Elige una foto (galería o cámara), la sube al bucket público "avatars" en la carpeta del usuario
 * y devuelve la URL pública. Devuelve null si el usuario cancela.
 * Las reglas de Storage solo permiten escribir en la carpeta propia (avatars/<id del usuario>/...).
 */
export async function elegirYSubirFoto(usuarioId, { camara = false } = {}) {
  const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    throw new Error(camara ? 'Necesitamos permiso para usar la cámara.' : 'Necesitamos permiso para ver tus fotos.');
  }
  const opciones = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true };
  const r = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (r.canceled || !r.assets?.[0]) return null;
  const foto = r.assets[0];
  if (!foto.base64) throw new Error('No se pudo leer la foto. Probá con otra.');
  if (foto.base64.length * 0.75 > 3 * 1024 * 1024) throw new Error('La foto pesa más de 3 MB. Elegí otra o recortala.');

  const tipo = foto.mimeType && /^image\/(jpeg|png|webp)$/.test(foto.mimeType) ? foto.mimeType : 'image/jpeg';
  const ext = tipo.split('/')[1].replace('jpeg', 'jpg');
  const ruta = `${usuarioId}/avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(ruta, aBytes(foto.base64), { contentType: tipo, upsert: true });
  if (error) throw new Error('No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.');
  const { data } = supabase.storage.from('avatars').getPublicUrl(ruta);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Galería de trabajos (solo ADMIN): elige una foto y la sube al bucket público "galeria"
 * en la carpeta del barbero (galeria/<barbero_id>/<fecha>.jpg). Las reglas de Storage
 * solo dejan escribir al administrador. Devuelve { url, path } o null si se cancela.
 */
export async function elegirFotoGaleria(barberoId, { camara = false } = {}) {
  const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error(camara ? 'Necesitamos permiso para usar la cámara.' : 'Necesitamos permiso para ver tus fotos.');
  const opciones = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.7, base64: true };
  const r = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (r.canceled || !r.assets?.[0]) return null;
  const foto = r.assets[0];
  if (!foto.base64) throw new Error('No se pudo leer la foto. Probá con otra.');
  if (foto.base64.length * 0.75 > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB. Elegí otra o recortala.');
  const tipo = foto.mimeType && /^image\/(jpeg|png|webp)$/.test(foto.mimeType) ? foto.mimeType : 'image/jpeg';
  const ext = tipo.split('/')[1].replace('jpeg', 'jpg');
  const path = `${barberoId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('galeria').upload(path, aBytes(foto.base64), { contentType: tipo, upsert: false });
  if (error) throw new Error('No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.');
  const { data } = supabase.storage.from('galeria').getPublicUrl(path);
  return { url: data.publicUrl, path };
}
