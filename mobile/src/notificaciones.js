/*
 * 📘 PARA LA DEFENSA — mobile/src/notificaciones.js — notificaciones push (los avisos que aparecen en el celular).
 * El circuito completo:
 *   1. Al iniciar sesión, la app pide permiso y obtiene un "token de push" de Expo (la dirección de este celular).
 *   2. Lo guarda en la base con la API (POST /notifications/push-token).
 *   3. Cuando cambia un turno, un trigger de la base crea el aviso y otro lo envía a Expo, que lo entrega al celular.
 *   4. Al cerrar sesión se borra el token, para no recibir avisos de esa cuenta.
 * Limitación: en el APK de Android falta configurar Firebase (FCM) para que lleguen; en Expo Go para Android no llegan.
 * Los avisos dentro de la app (la campana) funcionan siempre.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';

// Cómo se muestran las notificaciones con la app abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

let tokenActual = null;

/**
 * Pide permiso, obtiene el token push de Expo y lo registra en la API.
 * Devuelve { ok, motivo } — nunca lanza: las notificaciones son opcionales.
 *
 * Limitaciones reales:
 * - En un emulador no hay push (se necesita un teléfono).
 * - En Expo Go para Android, Expo ya no entrega push remotas (SDK 53+): usar el APK.
 * - El APK de Android necesita credenciales de Firebase (FCM) cargadas en EAS.
 */
export async function registrarPush() {
  try {
    if (!Device.isDevice) return { ok: false, motivo: 'Las notificaciones push solo funcionan en un teléfono real.' };
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
      return { ok: false, motivo: 'En Expo Go para Android no llegan notificaciones push. Instalá el APK para recibirlas.' };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Turnos',
        importance: Notifications.AndroidImportance.HIGH
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return { ok: false, motivo: 'No diste permiso para notificaciones. Podés activarlo desde la configuración del teléfono.' };

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('/notifications/push-token', { method: 'POST', body: { token, plataforma: Platform.OS } });
    tokenActual = token;
    return { ok: true };
  } catch (e) {
    console.warn('No se pudo activar push:', e?.message);
    return { ok: false, motivo: 'No se pudieron activar las notificaciones en este dispositivo.' };
  }
}

/** Al cerrar sesión: este teléfono deja de recibir avisos de esa cuenta. */
export async function desregistrarPush() {
  if (!tokenActual) return;
  try {
    await api('/notifications/push-token', { method: 'DELETE', body: { token: tokenActual } });
  } catch { /* si falla, la base limpia tokens inválidos al enviar */ }
  tokenActual = null;
}

/** Escucha notificaciones recibidas con la app abierta (para refrescar la pantalla). */
export function alRecibir(fn) {
  const sub = Notifications.addNotificationReceivedListener(fn);
  return () => sub.remove();
}
