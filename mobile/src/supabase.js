/*
 * 📘 PARA LA DEFENSA — mobile/src/supabase.js — conexión directa de la app con Supabase (sobre todo para la SESIÓN).
 *   - createClient con la URL y la clave PÚBLICA (publishable). Nunca la service_role.
 *   - storage: AsyncStorage → la sesión queda guardada en el teléfono (no hay que ingresar cada vez).
 *   - autoRefreshToken: renueva el token solo, antes de que venza.
 *   - flowType 'pkce': forma segura de ingresar con Google (el código de retorno solo sirve en este teléfono).
 * La mayoría de los datos se piden por la API (api.js). Supabase directo se usa para la sesión, el login con Google,
 * subir fotos a Storage y algunas consultas puntuales; siempre con las reglas RLS de la base.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Solo la clave PÚBLICA (publishable). Nunca la service_role en la app.
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * URL de retorno para OAuth y recuperación de contraseña.
 * En Expo Go es exp://...; en el APK es barberiaimperial://...
 * Ambas deben estar en Supabase → Authentication → URL Configuration → Redirect URLs.
 */
// 📘 A qué dirección vuelve el usuario después de Google o del email: en Expo Go exp://… y en el APK barberiaimperial://… (las dos están permitidas en Supabase).
export function redirectUrl(path = 'auth/callback') {
  return Constants.appOwnership === 'expo'
    ? Linking.createURL(path)
    : AuthSession.makeRedirectUri({ native: `barberiaimperial://${path}`, scheme: 'barberiaimperial', path });
}

/**
 * Supabase Auth rechaza direcciones de retorno cuyo host es una IP
 * (por ejemplo exp://192.168.1.211:8081/...), aunque estén en la lista permitida.
 * En Expo Go eso pasa cuando se inicia en modo LAN; con --tunnel el host es un nombre
 * (xxxx.exp.direct) y Supabase sí lo acepta.
 */
export function hostEsIP(url) {
  const match = String(url).match(/^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i);
  return Boolean(match && /^\d{1,3}(\.\d{1,3}){3}$/.test(match[1]));
}

export const enExpoGo = Constants.appOwnership === 'expo';

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce'
      }
    })
  : null;

/** Mensaje claro para errores de Supabase. */
// 📘 Traduce errores de Supabase a mensajes para el usuario (horario ocupado, sin permiso, sin conexión, sesión vencida).
export function mensajeError(error, porDefecto = 'Ocurrió un error. Intentá nuevamente.') {
  if (!error) return porDefecto;
  if (error.code === '23P01' || error.code === '23505') return 'Ese horario acaba de ocuparse. Elegí otro.';
  if (error.code === '42501') return error.message?.includes('permission denied')
    ? 'No tenés permiso para realizar esta operación.'
    : error.message;
  if (/Failed to fetch|Network request failed/i.test(error.message || '')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  if (/JWT|expired|refresh token/i.test(error.message || '')) return 'Tu sesión venció. Volvé a iniciar sesión.';
  return error.message || porDefecto;
}
