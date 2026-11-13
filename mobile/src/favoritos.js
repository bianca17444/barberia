/*
 * 📘 PARA LA DEFENSA — mobile/src/favoritos.js — hook useFavoritos: carga, agrega y quita favoritos del cliente con la API.
 * Un "hook" es una función de React que empieza con "use" y guarda estado que se puede reutilizar en varias pantallas.
 */
// Favoritos del cliente (barberos y servicios). Se guardan en Supabase vía la API;
// la política RLS asegura que cada persona solo ve y cambia los suyos.
import { useCallback, useEffect, useState } from 'react';
import { api, textoError } from './api';
import { avisar } from './ui';

const VACIO = { barberos: [], servicios: [] };

export function useFavoritos(session, rol) {
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const activo = !!session && rol === 'USUARIO';

  const cargar = useCallback(async () => {
    if (!activo) { setDatos(VACIO); return; }
    setCargando(true);
    try {
      setDatos(await api('/favorites'));
      setError(null);
    } catch (e) {
      setError(textoError(e));
    } finally {
      setCargando(false);
    }
  }, [activo]);

  useEffect(() => { cargar(); }, [cargar, session?.user?.id]);

  const esFavorito = (tipo, id) => (tipo === 'barbero' ? datos.barberos : datos.servicios).some((x) => x.id === id);

  /** Agrega o quita. Se ve el cambio al instante y, si el servidor falla, se vuelve atrás. */
  const alternar = async (tipo, item) => {
    const clave = tipo === 'barbero' ? 'barberos' : 'servicios';
    const estaba = esFavorito(tipo, item.id);
    const anterior = datos;
    setDatos((d) => ({ ...d, [clave]: estaba ? d[clave].filter((x) => x.id !== item.id) : [item, ...d[clave]] }));
    try {
      if (estaba) await api(`/favorites/${tipo === 'barbero' ? 'barbers' : 'services'}/${item.id}`, { method: 'DELETE' });
      else await api('/favorites', { method: 'POST', body: tipo === 'barbero' ? { barbero_id: item.id } : { servicio_id: item.id } });
      avisar(estaba ? 'Quitado de tus favoritos' : 'Agregado a tus favoritos', estaba ? 'info' : 'ok');
    } catch (e) {
      setDatos(anterior);
      avisar(`No se pudo guardar: ${textoError(e)}`, 'error');
    }
  };

  return { ...datos, cargando, error, cargar, esFavorito, alternar, habilitado: activo };
}
