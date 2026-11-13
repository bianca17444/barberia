/*
 * 📘 PARA LA DEFENSA — mobile/src/biometria.js — bloqueo opcional con Face ID o huella (expo-local-authentication).
 * El sistema operativo hace la verificación: la app solo recibe "sí" o "no". No se guarda ni se envía la cara o la huella.
 * En el teléfono solo queda anotado si la persona activó el bloqueo.
 */
// Desbloqueo con Face ID / huella (expo-local-authentication).
// La verificación la hace el sistema operativo: la app nunca ve ni guarda la cara o la huella,
// y no se envía nada a Supabase. Solo se guarda en el teléfono si la persona activó el bloqueo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as LA from 'expo-local-authentication';

const clave = (uid) => `bela_biometria_${uid}`;

/** ¿Hay sensor y la persona tiene una cara/huella registrada en el teléfono? */
export async function biometriaDisponible() {
  try {
    const hardware = await LA.hasHardwareAsync();
    if (!hardware) return { ok: false, motivo: 'Este teléfono no tiene Face ID ni lector de huellas.' };
    const registrado = await LA.isEnrolledAsync();
    const tipos = await LA.supportedAuthenticationTypesAsync();
    const cara = tipos.includes(LA.AuthenticationType.FACIAL_RECOGNITION);
    const nombre = cara ? (Platform.OS === 'ios' ? 'Face ID' : 'reconocimiento facial') : (Platform.OS === 'ios' ? 'Touch ID' : 'huella');
    if (!registrado) return { ok: false, nombre, motivo: `Primero registrá tu ${nombre} en la configuración del teléfono.` };
    return { ok: true, nombre };
  } catch {
    return { ok: false, motivo: 'No se pudo consultar el sensor del teléfono.' };
  }
}

/** Pide la cara o la huella. Si falla, permite el PIN o patrón del teléfono como alternativa. */
export async function autenticar(mensaje = 'Desbloquear BELABARBERÍA') {
  try {
    const r = await LA.authenticateAsync({
      promptMessage: mensaje,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar el código del teléfono',
      disableDeviceFallback: false
    });
    return r.success ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: 'error' };
  }
}

export async function bloqueoActivado(uid) {
  if (!uid) return false;
  try { return (await AsyncStorage.getItem(clave(uid))) === '1'; } catch { return false; }
}

export async function guardarBloqueo(uid, activo) {
  try {
    if (activo) await AsyncStorage.setItem(clave(uid), '1');
    else await AsyncStorage.removeItem(clave(uid));
  } catch { /* sin almacenamiento: queda desactivado */ }
}
