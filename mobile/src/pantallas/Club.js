/*
 * 📘 PARA LA DEFENSA — pantallas/Club.js — club de puntos, recompensas, estilos, galería, cuenta regresiva y paneles con números.
 * Los puntos los suma la BASE al completar un turno: la app nunca suma ni resta puntos por su cuenta.
 */
// Fidelización, estilos, galería, cuenta regresiva y dashboards.
// Todo se lee de la API (datos reales de Supabase). Los puntos los otorga la base al completar un turno:
// la app nunca suma ni resta puntos por su cuenta.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { api, textoError } from '../api';
import { supabase } from '../supabase';
import { Avatar, Boton, Campo, Cargando, Chip, ErrorCaja, Estado, Hoja, Icono, Seccion, Tarjeta, Texto, Vacio, avisar, colors, elevacion, styles } from '../ui';
import { fechaCorta, horaCorta, inicioTurno } from '../tiempo';

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const miles = (n) => Number(n || 0).toLocaleString('es-AR');
const nombreDe = (p) => `${p?.nombre || ''} ${p?.apellido || ''}`.trim();
/** Timestamp de la base (UTC) → fecha y hora de Argentina. */
const local = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
const fechaHora = (iso) => (iso ? `${fechaCorta(local(iso).slice(0, 10))} · ${local(iso).slice(11, 16)}` : '');
const soloFecha = (iso) => fechaCorta(local(iso).slice(0, 10));

/** Estilos de corte (los mismos valores que valida la base). */
export const ESTILOS = [
  ['FADE', 'Fade', 'flash-outline'], ['CLASICO', 'Clásico', 'ribbon-outline'], ['CROP', 'Crop', 'cut-outline'],
  ['BARBA', 'Barba', 'man-outline'], ['PREMIUM', 'Premium', 'diamond-outline'], ['FORMAL', 'Formal', 'briefcase-outline'],
  ['MODERNO', 'Moderno', 'sparkles-outline'], ['OTRO', 'Otro', 'ellipsis-horizontal']
];
export const nombreEstilo = (e) => ESTILOS.find(([k]) => k === e)?.[1] || e;

/** Foto de referencia de cada estilo (incluida en la app: se ve aunque la galería esté vacía). */
const REFERENCIA = {
  FADE: { foto: require('../../assets/estilos/fade.jpg'), detalle: 'Degradé prolijo' },
  CLASICO: { foto: require('../../assets/estilos/clasico.jpg'), detalle: 'Raya al costado' },
  CROP: { foto: require('../../assets/estilos/crop.jpg'), detalle: 'Flequillo corto' },
  BARBA: { foto: require('../../assets/estilos/barba.jpg'), detalle: 'Perfilado y barba' },
  PREMIUM: { foto: require('../../assets/estilos/premium.jpg'), detalle: 'Texturizado y barba' },
  FORMAL: { foto: require('../../assets/estilos/formal.jpg'), detalle: 'Peinado hacia atrás' },
  MODERNO: { foto: require('../../assets/estilos/moderno.jpg'), detalle: 'Textura arriba' }
};

/** Tarjeta con foto: nombre del estilo sobre una franja oscura (texto blanco, contraste alto en cualquier foto). */
function TarjetaEstilo({ clave, nombre, onPress }) {
  const ref = REFERENCIA[clave];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Estilo ${nombre}: ${ref.detalle}. Ver servicios y barberos`}
      style={({ pressed }) => [{ position: 'relative', borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 172, marginRight: 12, overflow: 'hidden', width: 132, ...elevacion(colors, 1) }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}>
      <Image source={ref.foto} style={{ height: '100%', position: 'absolute', width: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={{ backgroundColor: 'rgba(17,17,17,0.72)', bottom: 0, left: 0, paddingHorizontal: 10, paddingVertical: 8, position: 'absolute', right: 0 }}>
        <Text style={{ color: '#F2EFEA', fontSize: 15, fontWeight: '800' }}>{nombre}</Text>
        <Text style={{ color: '#D4BC98', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{ref.detalle}</Text>
      </View>
    </Pressable>
  );
}

/** Carga simple con estado de error y recarga. */
function useCarga(fn, deps = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await fn()); } catch (e) { setError(textoError(e)); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [cargar]);
  return { datos, error, cargar };
}

// ======================================================================
// CUENTA REGRESIVA
// ======================================================================
/** Re-renderiza cada 30 s (suficiente para minutos; no gasta batería). */
export function useAhora(cadaMs = 30000) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), cadaMs); return () => clearInterval(id); }, [cadaMs]);
  return ahora;
}

/** "Faltan 02h 17m" / "Faltan 3 días" + versión para lector de pantalla. */
export function faltan(fecha, hora, ahora = Date.now()) {
  const ms = inicioTurno(fecha, hora).getTime() - ahora;
  if (ms <= 0) return { texto: 'Es ahora', voz: 'Tu turno es ahora', pasado: true };
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const dos = (n) => String(n).padStart(2, '0');
  if (d >= 2) return { texto: `Faltan ${d} días`, voz: `Faltan ${d} días` };
  if (d === 1) return { texto: `Falta 1 día y ${h} h`, voz: `Falta un día y ${h} horas` };
  return { texto: `Faltan ${dos(h)}h ${dos(m)}m`, voz: `Faltan ${h} horas y ${m} minutos` };
}

// 📘 "Faltan 2 h 17 min" para el próximo turno. Se actualiza cada 30 segundos (no gasta batería).
export function CuentaRegresiva({ fecha, hora }) {
  const ahora = useAhora();
  const f = faltan(fecha, hora, ahora);
  return (
    <View style={{ alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 10, flexDirection: 'row', gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5 }}
      accessible accessibilityLabel={f.voz} accessibilityLiveRegion="polite">
      <Icono nombre="hourglass-outline" tam={16} color={colors.sobreGold} />
      <Text style={{ color: colors.sobreGold, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '800' }}>{f.texto}</Text>
    </View>
  );
}

// ======================================================================
// BARBERO RECOMENDADO (reglas simples y explicadas)
// ======================================================================
/**
 * 1) Tu favorito · 2) Con quien fuiste la última vez · 3) Especialista en el estilo que más reservás · 4) Uno disponible.
 * Solo recomienda barberos activos (los que devuelve /barbers).
 */
// 📘 Recomienda un barbero con reglas simples y muestra el motivo de la recomendación.
export function BarberoRecomendado({ catalogo, favoritos, onReservarCon, recarga }) {
  const [turnos, setTurnos] = useState(null);
  useEffect(() => {
    api('/appointments').then((r) => setTurnos(r.turnos)).catch(() => setTurnos([]));
  }, [recarga]);

  const reco = useMemo(() => {
    const barberos = catalogo.barberos || [];
    if (!barberos.length || turnos === null) return null;
    const porId = new Map(barberos.map((b) => [b.id, b]));
    const fav = (favoritos?.barberos || []).find((b) => porId.has(b.id));
    if (fav) return { b: porId.get(fav.id), motivo: 'Es tu barbero favorito.', icono: 'heart' };
    const ultimo = (turnos || []).filter((t) => t.estado !== 'CANCELADO' && porId.has(t.barbero_id))
      .sort((x, y) => `${y.fecha}${y.hora}`.localeCompare(`${x.fecha}${x.hora}`))[0];
    if (ultimo) return { b: porId.get(ultimo.barbero_id), motivo: `Tu último turno (${fechaCorta(ultimo.fecha)}) fue con este barbero.`, icono: 'repeat' };
    // Estilo más reservado según los servicios del catálogo
    const conteo = {};
    (turnos || []).forEach((t) => (catalogo.servicios.find((s) => s.id === t.servicio_id)?.estilos || []).forEach((e) => { conteo[e] = (conteo[e] || 0) + 1; }));
    const estilo = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0];
    const experto = estilo && barberos.find((b) => (b.estilos || []).includes(estilo));
    if (experto) return { b: experto, motivo: `Trabaja el estilo ${nombreEstilo(estilo)}, el que más reservás.`, icono: 'sparkles' };
    const conEsp = barberos.find((b) => b.especialidad);
    if (conEsp) return { b: conEsp, motivo: `Especialidad: ${conEsp.especialidad}.`, icono: 'cut' };
    return { b: barberos[0], motivo: 'Está tomando turnos.', icono: 'calendar' };
  }, [catalogo.barberos, catalogo.servicios, favoritos?.barberos, turnos]);

  if (!reco) return null;
  return (
    <View>
      <Seccion titulo="Te recomendamos" />
      <Tarjeta style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <Avatar nombre={nombreDe(reco.b)} tam={52} foto={reco.b.foto_url} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{nombreDe(reco.b)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Icono nombre={reco.icono} tam={15} color={colors.gold} />
            <Text style={[styles.cardDescription, { flex: 1 }]}>{reco.motivo}</Text>
          </View>
        </View>
        <Boton titulo="Reservar" chico onPress={() => onReservarCon?.({ barberoId: reco.b.id })} style={{ marginBottom: 0 }} />
      </Tarjeta>
    </View>
  );
}

// ======================================================================
// ELEGÍ TU ESTILO + GALERÍA
// ======================================================================
function Foto({ f, ancho = 140 }) {
  return (
    <View style={{ marginRight: 10, width: ancho }}>
      <Image source={{ uri: f.url }} style={{ backgroundColor: colors.surface2, borderRadius: 14, height: ancho * 1.25, width: ancho }}
        accessible accessibilityLabel={`${nombreEstilo(f.estilo)}${f.descripcion ? `: ${f.descripcion}` : ''}, trabajo de ${nombreDe(f.barbero)}`} />
      <Text style={[styles.aviso, { marginTop: 4 }]} numberOfLines={1}>{nombreEstilo(f.estilo)} · {nombreDe(f.barbero)}</Text>
    </View>
  );
}

export function ElegiTuEstilo({ onReservarCon }) {
  const [estilo, setEstilo] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState(null);
  const recientes = useCarga(() => api('/gallery').then((r) => r.fotos.slice(0, 10)), []);

  const abrir = async (e) => {
    setEstilo(e); setDetalle(null); setError(null);
    try { setDetalle(await api(`/styles/${e}`)); } catch (err) { setError(textoError(err)); }
  };
  const reservar = (inicial) => { setEstilo(null); onReservarCon?.(inicial); };

  return (
    <View>
      <Seccion titulo="Elegí tu estilo" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {ESTILOS.filter(([k]) => REFERENCIA[k]).map(([k, t]) => <TarjetaEstilo key={k} clave={k} nombre={t} onPress={() => abrir(k)} />)}
      </ScrollView>
      {recientes.datos?.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.label, { marginBottom: 8 }]}>Trabajos recientes del equipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{recientes.datos.map((f) => <Foto key={f.id} f={f} />)}</ScrollView>
        </View>
      )}

      <Hoja visible={!!estilo} titulo={estilo ? `Estilo ${nombreEstilo(estilo)}` : ''} onCerrar={() => setEstilo(null)}>
        {error ? <ErrorCaja texto={error} onReintentar={() => abrir(estilo)} />
          : !detalle ? <Cargando />
            : (
              <View>
                {REFERENCIA[estilo] && (
                  <View style={{ borderRadius: 18, height: 230, marginBottom: 12, overflow: 'hidden' }}>
                    <Image source={REFERENCIA[estilo].foto} style={{ height: '100%', width: '100%' }} resizeMode="cover" accessible accessibilityLabel={`Imagen de referencia del estilo ${nombreEstilo(estilo)}: ${REFERENCIA[estilo].detalle}`} />
                    <View style={{ backgroundColor: 'rgba(17,17,17,0.72)', borderRadius: 10, bottom: 10, left: 10, paddingHorizontal: 10, paddingVertical: 5, position: 'absolute' }}>
                      <Text style={{ color: '#F2EFEA', fontSize: 13, fontWeight: '700' }}>{REFERENCIA[estilo].detalle} · referencia</Text>
                    </View>
                  </View>
                )}
                {detalle.fotos.length > 0 && (
                  <View>
                    <Text style={[styles.label, { marginBottom: 8 }]}>Trabajos del equipo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>{detalle.fotos.map((f) => <Foto key={f.id} f={f} ancho={150} />)}</ScrollView>
                  </View>
                )}
                <Seccion titulo="Servicios" />
                {detalle.servicios.length ? detalle.servicios.map((s) => (
                  <Tarjeta key={s.id} style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{s.nombre}</Text>
                      <Text style={styles.cardDescription}>{s.duracion} min · {pesos(s.precio)}</Text>
                    </View>
                    <Boton titulo="Reservar" chico variante="secundario" onPress={() => reservar({ servicioId: s.id })} style={{ marginBottom: 0 }} />
                  </Tarjeta>
                )) : <Texto>Ningún servicio está marcado con este estilo todavía.</Texto>}
                <Seccion titulo="Barberos" />
                {detalle.barberos.length ? detalle.barberos.map((b) => (
                  <Tarjeta key={b.id} style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                    <Avatar nombre={nombreDe(b)} foto={b.foto_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{nombreDe(b)}</Text>
                      <Text style={styles.cardDescription}>{b.especialidad || 'Barbero'}</Text>
                    </View>
                    <Boton titulo="Reservar" chico variante="secundario" onPress={() => reservar({ barberoId: b.id })} style={{ marginBottom: 0 }} />
                  </Tarjeta>
                )) : <Texto>Ningún barbero tiene este estilo cargado todavía.</Texto>}
              </View>
            )}
      </Hoja>
    </View>
  );
}

// ======================================================================
// CLUB DEL CLIENTE: puntos, nivel, recompensas, logros, historial y lista de espera
// ======================================================================
const ICONO_NIVEL = { Bronze: 'medal-outline', Silver: 'medal', Gold: 'trophy', VIP: 'diamond' };

export function Progreso({ valor, etiqueta }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(valor || 0) * 100)));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={etiqueta} accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ backgroundColor: colors.surface2, borderColor: colors.borderInput, borderRadius: 6, borderWidth: 1, height: 12, overflow: 'hidden' }}>
      <View style={{ backgroundColor: colors.gold, height: '100%', width: `${pct}%` }} />
    </View>
  );
}

// 📘 Club del cliente: puntos, nivel (Bronze, Silver, Gold, VIP), recompensas, logros, historial y lista de espera.
export function ClubCliente({ recarga, onReservarCon }) {
  const club = useCarga(() => api('/loyalty'), [recarga]);
  const [hoja, setHoja] = useState(null);
  const p = club.datos;

  return (
    <View>
      <Seccion titulo="Mis puntos" />
      {club.error ? <ErrorCaja texto={club.error} onReintentar={club.cargar} />
        : !p ? <Cargando />
          : (
            <Tarjeta style={{ borderColor: colors.gold }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <View style={[styles.opcionIcono, { height: 48, width: 48, borderRadius: 24 }]}><Icono nombre={ICONO_NIVEL[p.nivel] || 'medal-outline'} tam={24} color={colors.gold} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardDescription}>Nivel</Text>
                  <Text style={[styles.cardTitle, { fontSize: 20, marginBottom: 0 }]}>{p.nivel || 'Bronze'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.statNumero, { color: colors.gold, fontVariant: ['tabular-nums'] }]}>{miles(p.saldo)}</Text>
                  <Text style={styles.statTexto}>puntos para canjear</Text>
                </View>
              </View>
              <Progreso valor={p.progreso} etiqueta={p.siguiente ? `Progreso hacia ${p.siguiente}` : 'Nivel máximo alcanzado'} />
              <Text style={[styles.aviso, { marginTop: 8 }]}>
                {p.siguiente ? `Te faltan ${miles(p.faltan)} puntos para ${p.siguiente}.` : '¡Llegaste al nivel máximo!'} Sumás puntos cada vez que completás un turno.
              </Text>
            </Tarjeta>
          )}
      <View style={styles.accesos}>
        <AccesoClub icono="gift-outline" texto="Recompensas" onPress={() => setHoja('recompensas')} />
        <AccesoClub icono="trophy-outline" texto="Logros" onPress={() => setHoja('logros')} />
      </View>
      <View style={styles.accesos}>
        <AccesoClub icono="time-outline" texto="Mi historial" onPress={() => setHoja('historial')} />
        <AccesoClub icono="hourglass-outline" texto="Lista de espera" onPress={() => setHoja('espera')} />
      </View>

      <Hoja visible={hoja === 'recompensas'} titulo="Recompensas" onCerrar={() => setHoja(null)}>
        {hoja === 'recompensas' && <Recompensas saldo={p?.saldo ?? 0} onCanje={club.cargar} />}
      </Hoja>
      <Hoja visible={hoja === 'logros'} titulo="Logros" onCerrar={() => setHoja(null)}>
        {hoja === 'logros' && <Logros />}
      </Hoja>
      <Hoja visible={hoja === 'historial'} titulo="Mi historial" onCerrar={() => setHoja(null)}>
        {hoja === 'historial' && <Historial movimientos={p?.historial || []} onReservarCon={(i) => { setHoja(null); onReservarCon?.(i); }} />}
      </Hoja>
      <Hoja visible={hoja === 'espera'} titulo="Lista de espera" onCerrar={() => setHoja(null)}>
        {hoja === 'espera' && <ListaEspera onReservarCon={(i) => { setHoja(null); onReservarCon?.(i); }} />}
      </Hoja>
    </View>
  );
}

function AccesoClub({ icono, texto, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.acceso, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={texto}>
      <Icono nombre={icono} tam={24} color={colors.gold} />
      <Text style={styles.accesoTexto}>{texto}</Text>
    </Pressable>
  );
}

// 📘 Canjear (POST /rewards/:id/redeem): la base descuenta los puntos y da un código BB-XXXXXX para mostrar en el local.
function Recompensas({ saldo, onCanje }) {
  const lista = useCarga(() => Promise.all([api('/rewards'), api('/rewards/mine')]).then(([r, m]) => ({ recompensas: r.recompensas, canjes: m.canjes })), []);
  const [canjeando, setCanjeando] = useState(null);

  const canjear = (r) => Alert.alert('Canjear recompensa', `¿Usar ${miles(r.costo)} puntos en "${r.nombre}"? Te damos un código para mostrar en la barbería.`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Canjear', onPress: async () => {
        setCanjeando(r.id);
        try {
          const res = await api(`/rewards/${r.id}/redeem`, { method: 'POST' });
          Alert.alert('¡Recompensa canjeada!', `Tu código es ${res.canje.codigo}. Mostralo en la barbería: el barbero lo valida al cobrarte.`);
          lista.cargar(); onCanje?.();
        } catch (e) {
          Alert.alert('No se pudo canjear', textoError(e));
        } finally { setCanjeando(null); }
      }
    }
  ]);

  if (lista.error) return <ErrorCaja texto={lista.error} onReintentar={lista.cargar} />;
  if (!lista.datos) return <Cargando />;
  const { recompensas, canjes } = lista.datos;
  return (
    <View>
      <Texto>Tenés <Text style={{ color: colors.gold, fontWeight: '800' }}>{miles(saldo)} puntos</Text> para canjear.</Texto>
      {recompensas.length ? recompensas.map((r) => {
        const alcanza = saldo >= r.costo;
        return (
          <Tarjeta key={r.id}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.opcionIcono}><Icono nombre="gift-outline" tam={18} color={colors.gold} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.nombre}</Text>
                {r.descripcion ? <Text style={styles.cardDescription}>{r.descripcion}</Text> : null}
                <Text style={[styles.price, { marginTop: 4 }]}>{miles(r.costo)} puntos</Text>
              </View>
            </View>
            {alcanza
              ? <Boton titulo="Canjear" icono="gift" chico onPress={() => canjear(r)} cargando={canjeando === r.id} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
              : <Text style={[styles.aviso, { marginTop: 8 }]}>Te faltan {miles(r.costo - saldo)} puntos.</Text>}
          </Tarjeta>
        );
      }) : <Vacio icono="gift-outline" texto="La barbería todavía no cargó recompensas." />}

      <Seccion titulo="Mis recompensas" />
      {canjes.length ? canjes.map((c) => (
        <Tarjeta key={c.id} style={c.estado !== 'DISPONIBLE' && { opacity: 0.65 }}>
          <Text style={styles.cardTitle}>{c.nombre}</Text>
          <Text style={[styles.statNumero, { color: colors.gold, fontSize: 22, letterSpacing: 2 }]} selectable accessibilityLabel={`Código ${c.codigo.split('').join(' ')}`}>{c.codigo}</Text>
          <Text style={styles.cardDescription}>
            {c.estado === 'DISPONIBLE' ? 'Sin usar: mostralo en la barbería.' : `Usado el ${fechaHora(c.usado_at)}`} · {Number(c.costo) === 0 ? 'regalo de la barbería' : 'canjeado'} el {soloFecha(c.creado_at)}
          </Text>
        </Tarjeta>
      )) : <Texto>Cuando canjees una recompensa o la barbería te regale una, el código aparece acá.</Texto>}
    </View>
  );
}

function Logros() {
  const logros = useCarga(() => api('/achievements').then((r) => r.logros), []);
  if (logros.error) return <ErrorCaja texto={logros.error} onReintentar={logros.cargar} />;
  if (!logros.datos) return <Cargando />;
  const hechos = logros.datos.filter((l) => l.desbloqueado).length;
  return (
    <View>
      <Texto>Desbloqueaste {hechos} de {logros.datos.length} logros.</Texto>
      {logros.datos.map((l) => (
        <Tarjeta key={l.id} style={[{ flexDirection: 'row', gap: 12 }, !l.desbloqueado && { opacity: 0.75 }]}>
          <View style={[styles.opcionIcono, { height: 44, width: 44, borderRadius: 22 }, l.desbloqueado && { backgroundColor: colors.goldFill }]}>
            <Icono nombre={l.desbloqueado ? l.icono : 'lock-closed-outline'} tam={20} color={l.desbloqueado ? colors.sobreGold : colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{l.titulo}{l.desbloqueado ? ' ✓' : ''}</Text>
            <Text style={[styles.cardDescription, { marginBottom: 8 }]}>{l.descripcion}</Text>
            <Progreso valor={l.meta ? l.actual / l.meta : 0} etiqueta={`${l.titulo}: ${l.actual} de ${l.meta}`} />
            <Text style={styles.aviso}>{miles(l.actual)} / {miles(l.meta)}</Text>
          </View>
        </Tarjeta>
      ))}
    </View>
  );
}

const FILTROS_HIST = ['Todos', 'Completados', 'Cancelados'];
function Historial({ movimientos, onReservarCon }) {
  const turnos = useCarga(() => api('/appointments').then((r) => r.turnos), []);
  const [filtro, setFiltro] = useState('Todos');
  const [verPuntos, setVerPuntos] = useState(false);
  if (turnos.error) return <ErrorCaja texto={turnos.error} onReintentar={turnos.cargar} />;
  if (!turnos.datos) return <Cargando />;
  const lista = turnos.datos.filter((t) => filtro === 'Todos' || (filtro === 'Completados' ? t.estado === 'FINALIZADO' : t.estado === 'CANCELADO'));
  const gastado = turnos.datos.filter((t) => t.estado === 'FINALIZADO').reduce((s, t) => s + Number(t.precio || 0), 0);
  return (
    <View>
      <View style={styles.accesos}>
        <View style={styles.stat}><Text style={styles.statNumero}>{turnos.datos.filter((t) => t.estado === 'FINALIZADO').length}</Text><Text style={styles.statTexto}>servicios completados</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumero, { fontSize: 22 }]}>{pesos(gastado)}</Text><Text style={styles.statTexto}>en servicios completados</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
        {FILTROS_HIST.map((f) => <Chip key={f} texto={f} activo={filtro === f} onPress={() => setFiltro(f)} />)}
        <Chip texto="Movimientos de puntos" icono="star-outline" activo={verPuntos} onPress={() => setVerPuntos(!verPuntos)} />
      </ScrollView>
      {verPuntos ? (
        movimientos.length ? movimientos.map((m) => (
          <View key={m.id} style={[styles.resumenFila, { borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 8 }]}>
            <Icono nombre={m.puntos > 0 ? 'add-circle-outline' : 'remove-circle-outline'} tam={18} color={m.puntos > 0 ? colors.ok : colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resumenTexto}>{m.motivo || (m.puntos > 0 ? 'Puntos ganados' : 'Canje')}</Text>
              <Text style={styles.aviso}>{soloFecha(m.creado_at)}</Text>
            </View>
            <Text style={[styles.price, { color: m.puntos > 0 ? colors.ok : colors.warning }]}>{m.puntos > 0 ? '+' : ''}{miles(m.puntos)}</Text>
          </View>
        )) : <Texto>Todavía no tenés movimientos. Sumás puntos al completar un turno.</Texto>
      ) : lista.length ? lista.map((t) => (
        <Tarjeta key={t.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.cardTitle}>{fechaCorta(t.fecha)} · {horaCorta(t.hora)} hs</Text>
            <Text style={styles.price}>{t.precio === null ? '-' : pesos(t.precio)}</Text>
          </View>
          <Text style={styles.cardDescription}>{t.servicio?.nombre || 'Servicio'} · {t.servicio?.duracion ? `${t.servicio.duracion} min` : ''} · con {nombreDe(t.barbero) || 'barbero'}</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <Estado estado={t.estado} />
            {t.estado === 'FINALIZADO' && t.servicio && t.barbero && (
              <Pressable onPress={() => onReservarCon({ servicioId: t.servicio.id, barberoId: t.barbero.id, servicioNombre: t.servicio.nombre, barberoNombre: nombreDe(t.barbero) })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Reservar de nuevo ${t.servicio.nombre}`} style={{ justifyContent: 'center', minHeight: 44 }}>
                <Text style={[styles.seccionAccion, { marginTop: 4 }]}>Reservar de nuevo</Text>
              </Pressable>
            )}
          </View>
        </Tarjeta>
      )) : <Vacio icono="time-outline" texto={filtro === 'Todos' ? 'Todavía no tenés turnos.' : `No tenés turnos ${filtro.toLowerCase()}.`} />}
    </View>
  );
}

// Función (no constante) para tomar los colores del tema activo
const estadoEspera = (e) => ({ ESPERANDO: ['Esperando', colors.warning], AVISADO: ['¡Se liberó! Reservalo', colors.ok], RESERVADO: ['Reservado', colors.info], VENCIDO: ['Venció el aviso', colors.muted], CANCELADO: ['Saliste de la lista', colors.muted] }[e] || [e, colors.muted]);
function ListaEspera({ onReservarCon }) {
  const espera = useCarga(() => api('/waitlist').then((r) => r.espera), []);
  const salir = (e) => Alert.alert('Salir de la lista', `¿Dejar de esperar el ${fechaCorta(e.fecha)} a las ${e.hora}?`, [
    { text: 'No', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: async () => { try { const r = await api(`/waitlist/${e.id}`, { method: 'DELETE' }); avisar(r.mensaje); espera.cargar(); } catch (err) { Alert.alert('No se pudo', textoError(err)); } } }
  ]);
  if (espera.error) return <ErrorCaja texto={espera.error} onReintentar={espera.cargar} />;
  if (!espera.datos) return <Cargando />;
  return (
    <View>
      <Texto>Si un horario ocupado se libera, avisamos al primero de la lista. Tenés 30 minutos para reservarlo; después pasa al siguiente.</Texto>
      {espera.datos.length ? espera.datos.map((e) => {
        const [txt, color] = estadoEspera(e.estado);
        const activo = e.estado === 'ESPERANDO' || e.estado === 'AVISADO';
        return (
          <Tarjeta key={e.id} style={!activo && { opacity: 0.65 }}>
            <Text style={styles.cardTitle}>{fechaCorta(e.fecha)} · {e.hora} hs</Text>
            <Text style={styles.cardDescription}>{e.servicio?.nombre} con {nombreDe(e.barbero)}</Text>
            <View style={[styles.estado, { borderColor: color }]}><Icono nombre={e.estado === 'AVISADO' ? 'notifications' : 'hourglass-outline'} tam={14} color={color} /><Text style={[styles.estadoTexto, { color }]}>{txt}</Text></View>
            {activo && (
              <View style={[styles.btnFila, { marginTop: 10 }]}>
                {e.estado === 'AVISADO' && <Boton titulo="Reservar" chico onPress={() => onReservarCon({ servicioId: e.servicio?.id, barberoId: e.barbero?.id })} style={{ marginBottom: 0 }} />}
                <Boton titulo="Salir de la lista" chico variante="fantasma" onPress={() => salir(e)} style={{ marginBottom: 0 }} />
              </View>
            )}
          </Tarjeta>
        );
      }) : <Vacio icono="hourglass-outline" titulo="No estás en ninguna lista" texto='Al reservar, tocá un horario ocupado y elegí "Avisarme si se libera".' />}
    </View>
  );
}

// ======================================================================
// BARBERO / ADMIN: validar el código de una recompensa
// ======================================================================
/** "ab12cd", "bb ab12cd" o "BB-AB12CD" → "BB-AB12CD" (así el cliente puede dictarlo sin el prefijo). */
// 📘 Acepta el código como lo dicten ("ab12cd", "bb ab12cd") y lo deja como BB-AB12CD.
export function normalizarCodigo(texto) {
  const c = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z0-9]{6}$/.test(c)) return `BB-${c}`;
  if (/^BB[A-Z0-9]{6}$/.test(c)) return `BB-${c.slice(2)}`;
  return String(texto || '').trim().toUpperCase();
}

/**
 * Validar el código de una recompensa al cobrar.
 * Con `conLista` (dueño) también muestra los códigos que los clientes canjearon y todavía no usaron,
 * para validarlos con un toque sin tener que escribirlos. La lista se lee con la sesión del dueño:
 * la política RLS "ver mis canjes" solo deja ver todos los canjes a un administrador.
 */
// 📘 Barbero o admin: validar el código de una recompensa (POST /rewards/use). Se usa UNA sola vez: la base lo marca USADO.
//    El admin además ve la lista de códigos entregados y puede marcarlos como usados desde ahí.
export function ValidarCanje({ conLista = false, recarga }) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const [validando, setValidando] = useState(null); // código que se está validando
  const [pendientes, setPendientes] = useState(conLista ? null : []);
  const [errorLista, setErrorLista] = useState(null);

  const cargarPendientes = useCallback(async () => {
    if (!conLista) return;
    setErrorLista(null);
    try {
      const { data, error: e } = await supabase.from('canjes')
        .select('id, codigo, nombre, creado_at, cliente:profiles!canjes_usuario_id_fkey(nombre, apellido)')
        .eq('estado', 'DISPONIBLE').order('creado_at', { ascending: false }).limit(30);
      if (e) throw e;
      setPendientes(data || []);
    } catch { setErrorLista('No se pudieron cargar los códigos sin usar.'); setPendientes([]); }
  }, [conLista]);
  useEffect(() => { cargarPendientes(); }, [cargarPendientes, recarga]);

  const usar = async (c) => {
    setError(null); setOk(null); setValidando(c);
    try {
      const r = await api('/rewards/use', { method: 'POST', body: { codigo: c } });
      setOk(r.mensaje); setCodigo('');
      avisar('Marcado como usado', 'ok');
      cargarPendientes();
    } catch (e) {
      const t = textoError(e);
      setError(/no existe/i.test(t) ? `No hay ninguna recompensa con el código ${c}. Pedile al cliente que lo muestre en Cuenta → Recompensas → Mis recompensas.` : t);
    } finally { setValidando(null); }
  };

  const validar = () => {
    const c = normalizarCodigo(codigo);
    if (!/^BB-[A-Z0-9]{6}$/.test(c)) return setError('Escribí el código completo: son 6 letras o números, por ejemplo BB-AB12CD o solo AB12CD.');
    usar(c);
  };

  const validarDeLista = (p) => {
    const quien = [p.cliente?.nombre, p.cliente?.apellido].filter(Boolean).join(' ') || 'el cliente';
    Alert.alert('Marcar como usado', `¿Marcar como usado el código ${p.codigo} (${p.nombre}) de ${quien}? No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Marcar como usado', onPress: () => usar(p.codigo) }
    ]);
  };

  const campo = (
    <View>
      <Campo
        etiqueta={conLista ? '¿Te muestran un código? Escribilo' : 'Código'}
        value={codigo}
        onChangeText={(v) => { setCodigo(v); setError(null); setOk(null); }}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={12}
        error={error}
        placeholder="Ej.: BB-AB12CD"
        returnKeyType="done"
        onSubmitEditing={validar}
        accessibilityHint="Código de 6 letras o números, con o sin BB-"
      />
      {ok ? <Text style={[styles.cardDescription, { color: colors.ok, marginBottom: 10 }]} accessibilityRole="alert" accessibilityLiveRegion="polite">✓ {ok}</Text> : null}
      <Boton titulo={conLista ? 'Marcar como usado' : 'Validar código'} icono="checkmark-circle-outline" variante={conLista ? 'secundario' : 'primario'} onPress={validar} cargando={validando !== null && validando === normalizarCodigo(codigo)} style={{ marginBottom: 0 }} />
    </View>
  );

  if (!conLista) {
    return (
      <Tarjeta>
        <Text style={styles.cardTitle}>Validar recompensa</Text>
        <Text style={[styles.cardDescription, { marginBottom: 10 }]}>Escribí el código que te muestra el cliente. Queda marcado como usado.</Text>
        {campo}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Text style={styles.cardTitle}>Códigos entregados{pendientes?.length ? ` (${pendientes.length})` : ''}</Text>
      <Text style={[styles.cardDescription, { marginBottom: 6 }]}>Cuando el cliente use su recompensa en la barbería, marcala como usada.</Text>
      {pendientes === null ? <Cargando /> : errorLista ? <ErrorCaja texto={errorLista} onReintentar={cargarPendientes} />
        : !pendientes.length ? <Text style={[styles.aviso, { marginBottom: 12 }]}>Todavía no hay códigos sin usar. Aparecen acá cuando le regalás una recompensa a un cliente o cuando un cliente canjea sus puntos.</Text>
          : pendientes.map((p) => (
            <View key={p.id} style={{ alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resumenTexto, { fontWeight: '700' }]}>{p.codigo}</Text>
                <Text style={styles.cardDescription}>{p.nombre} · {[p.cliente?.nombre, p.cliente?.apellido].filter(Boolean).join(' ') || 'Cliente'}</Text>
              </View>
              <Boton chico titulo="Usado" variante="secundario" onPress={() => validarDeLista(p)} cargando={validando === p.codigo} style={{ marginBottom: 0 }} accessibilityLabel={`Marcar como usado el código ${p.codigo}`} />
            </View>
          ))}
      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, marginTop: 4, paddingTop: 12 }}>{campo}</View>
    </Tarjeta>
  );
}

// ======================================================================
// DASHBOARDS
// ======================================================================
/** Gráfico de barras vertical simple: un solo color, valor arriba, etiqueta abajo. */
function Barras({ datos, titulo, marcar }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const resumen = datos.map((d) => `${d.etiqueta}: ${d.valor}`).join(', ');
  return (
    <Tarjeta>
      <Text style={styles.cardTitle}>{titulo}</Text>
      <View accessible accessibilityLabel={`${titulo}. ${resumen}`} style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 4, height: 150, marginTop: 8 }}>
        {datos.map((d, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            <Text style={[styles.aviso, { color: colors.muted, fontSize: 12, marginTop: 0 }]}>{d.valor || ''}</Text>
            <View style={{ backgroundColor: colors.gold, borderTopLeftRadius: 4, borderTopRightRadius: 4, height: Math.max(2, (d.valor / max) * 110), width: '80%' }} />
            <Text style={[styles.aviso, { fontSize: 12, marginTop: 4 }, marcar?.(d) && { color: colors.text, fontWeight: '800' }]}>{marcar?.(d) ? 'Hoy' : d.etiqueta}</Text>
          </View>
        ))}
      </View>
    </Tarjeta>
  );
}

/** Ranking horizontal (top servicios / barberos). */
function Ranking({ titulo, filas }) {
  const max = Math.max(1, ...filas.map((f) => f.turnos));
  return (
    <Tarjeta>
      <Text style={[styles.cardTitle, { marginBottom: 10 }]}>{titulo}</Text>
      {filas.length ? filas.map((f) => (
        <View key={f.nombre} style={{ marginBottom: 10 }} accessible accessibilityLabel={`${f.nombre}: ${f.turnos} turnos`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[styles.resumenTexto, { fontSize: 14 }]} numberOfLines={1}>{f.nombre}</Text>
            <Text style={[styles.resumenTexto, { flex: 0, fontSize: 14, fontWeight: '700' }]}>{f.turnos}</Text>
          </View>
          <View style={{ backgroundColor: colors.surface2, borderRadius: 4, height: 8 }}>
            <View style={{ backgroundColor: colors.gold, borderRadius: 4, height: 8, width: `${(f.turnos / max) * 100}%` }} />
          </View>
        </View>
      )) : <Text style={styles.cardDescription}>Sin turnos en los últimos 30 días.</Text>}
    </Tarjeta>
  );
}

function Dato({ numero, texto, icono }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${numero} ${texto}`}>
      {icono && <Icono nombre={icono} tam={18} color={colors.gold} />}
      <Text style={[styles.statNumero, { fontVariant: ['tabular-nums'] }]} numberOfLines={1} adjustsFontSizeToFit>{numero}</Text>
      <Text style={styles.statTexto}>{texto}</Text>
    </View>
  );
}

const diaCorto = (iso) => fechaCorta(iso).split(' ').slice(0, 2).join(' ');

// 📘 Panel con números: barbero (su día) y admin (indicadores del local y gráfico de 14 días). Datos de GET /dashboard.
export function Dashboard({ rol, recarga, onIr }) {
  const d = useCarga(() => api('/dashboard').then((r) => r.dashboard), [recarga]);
  if (d.error) return <ErrorCaja texto={d.error} onReintentar={d.cargar} />;
  if (!d.datos) return <Cargando />;
  const x = d.datos;

  if (rol === 'BARBERO') {
    return (
      <View>
        <Seccion titulo="Tu día" />
        <View style={styles.accesos}>
          <Dato numero={x.turnos_hoy} texto="turnos hoy" icono="calendar-outline" />
          <Dato numero={x.pendientes_total} texto="por confirmar" icono="alert-circle-outline" />
        </View>
        <View style={styles.accesos}>
          <Dato numero={x.completados_hoy} texto="completados hoy" icono="checkmark-done-outline" />
          <Dato numero={pesos(x.ingresos_estimados_hoy)} texto="estimado de hoy" icono="cash-outline" />
        </View>
        {x.proximo && (
          <Pressable onPress={() => onIr?.('Agenda')} style={styles.opcion} accessibilityRole="button">
            <Icono nombre="person-outline" color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.opcionTitulo}>Próximo: {x.proximo.cliente || 'Cliente'}</Text>
              <Text style={styles.opcionSub}>{fechaCorta(x.proximo.fecha)} · {x.proximo.hora} hs · {x.proximo.servicio}</Text>
            </View>
            <Estado estado={x.proximo.estado} />
          </Pressable>
        )}
        {Array.isArray(x.semana) && <Barras titulo="Turnos de los próximos 7 días" datos={x.semana.map((s) => ({ etiqueta: diaCorto(s.fecha), valor: s.turnos, fecha: s.fecha }))} marcar={(s) => s.fecha === x.hoy} />}
        <Text style={styles.aviso}>Completados en los últimos 7 días: {pesos(x.ingresos_semana)} (según el precio de cada turno).</Text>
      </View>
    );
  }

  return (
    <View>
      <Seccion titulo="Indicadores del local" />
      <View style={styles.accesos}>
        <Dato numero={x.turnos_hoy} texto="turnos hoy" icono="calendar-outline" />
        <Dato numero={x.pendientes_hoy} texto="pendientes hoy" icono="alert-circle-outline" />
      </View>
      <View style={styles.accesos}>
        <Dato numero={x.turnos_semana} texto="turnos esta semana" icono="stats-chart-outline" />
        <Dato numero={x.cancelados_semana} texto="cancelados esta semana" icono="close-circle-outline" />
      </View>
      <View style={styles.accesos}>
        <Dato numero={pesos(x.ingresos_semana)} texto="cobrado esta semana" icono="cash-outline" />
        <Dato numero={pesos(x.ingresos_mes)} texto="cobrado este mes" icono="wallet-outline" />
      </View>
      <View style={styles.accesos}>
        <Dato numero={x.clientes} texto="clientes activos" icono="people-outline" />
        <Dato numero={x.barberos} texto="barberos activos" icono="cut-outline" />
      </View>
      {Array.isArray(x.ultimos_14_dias) && (
        <Barras titulo="Turnos de los últimos 14 días" datos={x.ultimos_14_dias.map((s) => ({ etiqueta: String(s.fecha).slice(8, 10), valor: s.turnos, fecha: s.fecha }))} marcar={(s) => s.fecha === x.hoy} />
      )}
      <Ranking titulo="Servicios más pedidos (30 días)" filas={x.top_servicios || []} />
      <Ranking titulo="Barberos con más turnos (30 días)" filas={x.top_barberos || []} />
      <Text style={styles.aviso}>"Cobrado" suma los pagos marcados como pagados. Estimado de hoy: {pesos(x.ingresos_estimados_hoy)}.</Text>
    </View>
  );
}
