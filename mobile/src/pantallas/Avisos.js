/*
 * 📘 PARA LA DEFENSA — pantallas/Avisos.js — centro de avisos (la campana).
 * Lista las notificaciones que creó la base (GET /notifications), las agrupa por fecha y, al tocar una,
 * la marca como leída y te lleva a la pantalla que corresponde.
 */
// Centro de avisos: se abre con la campana. Cada aviso se puede tocar para marcarlo
// como leído e ir a lo que corresponde (el turno, los puntos, la agenda, los pedidos…).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, textoError } from '../api';
import { Boton, Cargando, ErrorCaja, Icono, Pestanas, Vacio, avisar, colors, styles } from '../ui';

const FILTROS = ['Todos', 'Sin leer'];

/** Ícono según el tipo de aviso (los tipos los genera la base de datos). */
function iconoDe(tipo = '') {
  const t = String(tipo).toUpperCase();
  if (t.includes('CANCEL')) return 'close-circle';
  if (t.includes('CONFIRM')) return 'checkmark-circle';
  if (t.includes('COMPLET')) return 'star';
  if (t.includes('RECORD')) return 'alarm';
  if (t.includes('PAGO')) return 'cash';
  if (t.includes('PUNTOS')) return 'trophy';
  if (t.includes('RECOMPENSA')) return 'gift';
  if (t.includes('ESPERA')) return 'hourglass';
  if (t.includes('BARBERO') || t.includes('SOLICITUD')) return 'person-add';
  if (t.includes('TURNO') || t.includes('RESERV')) return 'calendar';
  return 'notifications';
}

/** Adónde lleva tocar un aviso, según el tipo y el rol de la cuenta. */
export function destinoDe(n, rol) {
  const t = String(n.tipo || '').toUpperCase();
  if (rol === 'ADMIN') {
    if (t.includes('SOLICITUD') || t.includes('BARBERO')) return { tab: 'Inicio', texto: 'Ver pedidos' };
    if (n.turno_id || t.includes('PAGO')) return { tab: 'Admin', texto: 'Ver en Administración' };
    return null;
  }
  if (rol === 'BARBERO') {
    if (n.turno_id || t.includes('TURNO') || t.includes('PAGO') || t.includes('RECORD')) return { tab: 'Agenda', texto: 'Ver en mi agenda' };
    return null;
  }
  // Cliente
  if (t.includes('PUNTOS') || t.includes('RECOMPENSA')) return { tab: 'Perfil', texto: 'Ver mis puntos' };
  if (t.includes('ESPERA')) return { tab: 'Reservar', texto: 'Reservar ahora' };
  if (n.turno_id) return { tab: 'Mis turnos', turnoId: n.turno_id, texto: 'Ver el turno' };
  if (t.includes('TURNO') || t.includes('PAGO') || t.includes('RECORD')) return { tab: 'Mis turnos', texto: 'Ver mis turnos' };
  return null;
}

/** "hace 5 min", "ayer 18:30", "12 oct" */
function cuando(iso) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return '';
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.floor(min / 60)} h`;
  const local = new Date(d.getTime() - 3 * 3600e3);
  const hoy = new Date(Date.now() - 3 * 3600e3);
  const dias = Math.round((Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())) / 86400e3);
  const hora = local.toISOString().slice(11, 16);
  if (dias === 1) return `ayer ${hora}`;
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${local.getUTCDate()} ${MES[local.getUTCMonth()]} · ${hora}`;
}

/** Agrupa por "Hoy", "Esta semana" y "Anteriores" (zona Argentina). */
function grupoDe(iso) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return 'Anteriores';
  const ms = Date.now() - new Date(iso).getTime();
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dia = new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
  if (dia === hoy) return 'Hoy';
  if (ms < 7 * 86400e3) return 'Esta semana';
  return 'Anteriores';
}

export function CentroAvisos({ rol, recargarClave, onIr, onVolver, onLeidas }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('Todos');
  const [abierto, setAbierto] = useState(null); // id del aviso desplegado
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setLista((await api('/notifications')).notificaciones); } catch (e) { setError(textoError(e)); }
  }, []);
  useEffect(() => { cargar(); }, [cargar, recargarClave]);

  const marcar = async (n) => {
    if (n.leida) return;
    setLista((l) => l.map((x) => (x.id === n.id ? { ...x, leida: true } : x))); // al instante
    try { await api(`/notifications/${n.id}/read`, { method: 'PUT' }); onLeidas?.(); } catch { cargar(); }
  };

  const marcarTodas = async () => {
    setMarcando(true);
    try {
      await api('/notifications/read-all', { method: 'PUT' });
      setLista((l) => l.map((x) => ({ ...x, leida: true })));
      avisar('Todos los avisos quedaron leídos');
      onLeidas?.();
    } catch (e) { avisar(textoError(e), 'error'); } finally { setMarcando(false); }
  };

  const tocar = (n) => { marcar(n); setAbierto((a) => (a === n.id ? null : n.id)); };
  const ir = (n, destino) => { marcar(n); onIr(destino); };

  const visibles = useMemo(() => (lista || []).filter((n) => filtro === 'Todos' || !n.leida), [lista, filtro]);
  const grupos = useMemo(() => {
    const g = {};
    visibles.forEach((n) => { (g[grupoDe(n.created_at)] ||= []).push(n); });
    return ['Hoy', 'Esta semana', 'Anteriores'].filter((k) => g[k]).map((k) => [k, g[k]]);
  }, [visibles]);
  const sinLeer = (lista || []).filter((n) => !n.leida).length;

  return (
    <View>
      <View style={[styles.seccion, { alignItems: 'center', marginTop: 0 }]}>
        <Pressable onPress={onVolver} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver" style={{ alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 44 }}>
          <Icono nombre="chevron-back" tam={22} color={colors.gold} />
          <Text style={styles.seccionAccion}>Volver</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle} accessibilityRole="header">Avisos{sinLeer ? ` (${sinLeer} sin leer)` : ''}</Text>
      <Pestanas opciones={FILTROS} activa={filtro} onCambiar={setFiltro} />
      {sinLeer > 0 && <Boton titulo="Marcar todos como leídos" icono="checkmark-done" variante="secundario" onPress={marcarTodas} cargando={marcando} />}

      {error ? <ErrorCaja texto={error} onReintentar={cargar} />
        : !lista ? <Cargando />
          : !visibles.length ? (
            <Vacio icono="notifications-off-outline" titulo={filtro === 'Sin leer' ? 'No tenés avisos sin leer' : 'Todavía no tenés avisos'}
              texto="Te avisamos acá cuando se confirma, cancela o completa un turno, cuando sumás puntos y antes de tu turno." />
          ) : grupos.map(([titulo, items]) => (
            <View key={titulo}>
              <Text style={[styles.label, { marginBottom: 8, marginTop: 8 }]}>{titulo}</Text>
              {items.map((n) => {
                const destino = destinoDe(n, rol);
                const abiertoEste = abierto === n.id;
                return (
                  <View key={n.id} style={[styles.card, { padding: 0 }, !n.leida && { borderColor: colors.gold }]}>
                    <Pressable
                      onPress={() => tocar(n)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: abiertoEste }}
                      accessibilityLabel={`${n.leida ? '' : 'Sin leer. '}${n.titulo}. ${n.mensaje}. ${cuando(n.created_at)}`}
                      style={({ pressed }) => [{ flexDirection: 'row', gap: 12, padding: 14 }, pressed && { opacity: 0.85 }]}
                    >
                      <View style={[styles.opcionIcono, !n.leida && { backgroundColor: colors.goldFill }]}>
                        <Icono nombre={iconoDe(n.tipo)} tam={18} color={n.leida ? colors.gold : colors.sobreGold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
                          <Text style={[styles.cardTitle, { flex: 1 }, n.leida && { fontWeight: '600' }]}>{n.titulo}</Text>
                          <Text style={[styles.aviso, { marginTop: 2 }]}>{cuando(n.created_at)}</Text>
                        </View>
                        <Text style={styles.cardDescription} numberOfLines={abiertoEste ? undefined : 2}>{n.mensaje}</Text>
                      </View>
                      {!n.leida && <View style={{ backgroundColor: colors.gold, borderRadius: 5, height: 10, marginTop: 6, width: 10 }} accessibilityElementsHidden />}
                    </Pressable>
                    {abiertoEste && destino && (
                      <View style={{ paddingBottom: 12, paddingHorizontal: 14 }}>
                        <Boton titulo={destino.texto} icono="arrow-forward" chico onPress={() => ir(n, destino)} style={{ alignSelf: 'flex-start', marginBottom: 0 }} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
    </View>
  );
}
