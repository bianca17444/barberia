/*
 * 📘 PARA LA DEFENSA — mobile/src/tema.js — tema claro, oscuro o automático.
 * Usa un Context de React para que todas las pantallas cambien de colores juntas, y guarda la elección
 * en el teléfono (AsyncStorage): la próxima vez la app abre igual.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aplicarTema } from './ui';
import * as ui from './ui';
import { paletas } from './paletas';

const CLAVE = 'belabarberia:tema';

export { paletas };

const TemaContext = createContext(null);

/** Tema claro/oscuro: "sistema" sigue la configuración del teléfono. Se guarda en el dispositivo. */
export function TemaProvider({ children }) {
  const delSistema = useColorScheme();
  const [preferencia, setPreferencia] = useState('sistema');

  useEffect(() => {
    AsyncStorage.getItem(CLAVE).then((v) => {
      if (v === 'claro' || v === 'oscuro' || v === 'sistema') setPreferencia(v);
    }).catch(() => {});
  }, []);

  const cambiarPreferencia = (v) => {
    setPreferencia(v);
    AsyncStorage.setItem(CLAVE, v).catch(() => {});
  };

  const modo = preferencia === 'sistema' ? (delSistema === 'light' ? 'claro' : 'oscuro') : preferencia;
  const valor = useMemo(() => {
    aplicarTema(paletas[modo]); // antes de dibujar: los componentes leen el tema actual
    return { colors: ui.colors, styles: ui.styles, modo, preferencia, cambiarPreferencia };
  }, [modo, preferencia]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema debe usarse dentro de TemaProvider');
  return ctx;
}
