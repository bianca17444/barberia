/*
 * 📘 PARA LA DEFENSA — pantallas/Cliente.js — pantallas del CLIENTE: Inicio, Reservar y Mis turnos.
 *   - useCatalogo: trae servicios y barberos (solo con sesión: el catálogo es privado).
 *   - Inicio: próximo turno con cuenta regresiva, avisos, recomendaciones y estilos.
 *   - Reservar: 4 pasos (Servicio → Barbero → Día y hora → Confirmar).
 *   - Mis turnos: próximos e historial; cancelar, pagar, calificar y reservar de nuevo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api, textoError } from '../api';
import {
  Avatar, Boton, Campo, Cargando, Chip, ErrorCaja, Estado, Hoja, Icono, Pestanas, Seccion, Seleccionable,
  Corazon, Tarjeta, Texto, Ticket, Titulo, Vacio, avisar, colors, nombreEstado, styles
} from '../ui';
import { DIAS, MESES, faltanAlMenos24h, fechaCorta, horaCorta, hoyNegocio, proximosDias } from '../tiempo';
import { BarberoRecomendado, CuentaRegresiva, Dashboard, ElegiTuEstilo, ValidarCanje } from './Club';
import { destinoDe } from './Avisos';

export const precio = (n) => (n === null || n === undefined ? '-' : `$${Number(n).toLocaleString('es-AR')}`);
const estrellas = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const nombreDe = (p) => `${p?.nombre || ''} ${p?.apellido || ''}`.trim();

/** Catálogo privado: se consulta a la API solo con sesión iniciada. */
// 📘 Hook que pide servicios y barberos al mismo tiempo (Promise.all) para cargar más rápido.
export function useCatalogo(session, recarga) {
  const [servicios, setServicios] = useState([]);
  const [barberos, setBarberos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!session?.user) { setServicios([]); setBarberos([]); return; }
    setCargando(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([api('/services'), api('/barbers')]);
      setServicios([...s.servicios].sort((x, y) => Number(x.precio) - Number(y.precio)));
      setBarberos(b.barberos);
    } catch (e) {
      setError(textoError(e));
    } finally {
      setCargando(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { cargar(); }, [cargar, recarga]);
  return { servicios, barberos, cargando, error, recargar: cargar };
}

// ======================================================================
// INICIO
// ======================================================================
// 📘 INICIO: pide el resumen (/home) y los avisos (/notifications). El contenido cambia según el rol.
export function Inicio({ session, rol, perfil, catalogo, onIr, onIrAviso, recargarClave, onLeidas, favoritos, onReservarCon }) {
  const [home, setHome] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [error, setError] = useState(null);
  const [porConfirmar, setPorConfirmar] = useState(0); // barbero: turnos esperando su confirmación

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [h, n] = await Promise.all([api('/home'), api('/notifications')]);
      setHome(h);
      setNotifs(n.notificaciones);
      if (rol === 'BARBERO') {
        const p = await api(`/appointments?estado=PENDIENTE&desde=${hoyNegocio()}`);
        setPorConfirmar(p.turnos.length);
      }
    } catch (e) {
      setError(textoError(e));
    }
  }, [session?.user?.id, rol]);

  useEffect(() => { cargar(); }, [cargar, recargarClave]);

  const leerTodas = async () => {
    try {
      await api('/notifications/read-all', { method: 'PUT' });
      avisar('Avisos marcados como leídos');
      cargar();
      onLeidas?.();
    } catch (e) { avisar(textoError(e), 'error'); }
  };

  const leerUno = async (n) => {
    if (n.leida) return;
    try { await api(`/notifications/${n.id}/read`, { method: 'PUT' }); cargar(); onLeidas?.(); } catch { /* sin conexión */ }
  };

  if (error) return <ErrorCaja texto={error} onReintentar={cargar} />;
  if (!home) return <Cargando />;

  const t = home.proximoTurno;
  const nombre = home.usuario?.nombre;
  const noLeidas = notifs.filter((n) => !n.leida);

  return (
    <View>
      <Text style={styles.saludo}>{nombre ? `Hola, ${nombre}` : 'Hola'}</Text>
      <Texto>{{ USUARIO: '¿Cuándo te cortamos?', BARBERO: 'Así viene tu día.', ADMIN: 'Resumen del local.' }[rol]}</Texto>

      {/* Próximo turno destacado */}
      {t ? (
        <Pressable onPress={() => onIr(rol === 'USUARIO' ? 'Mis turnos' : rol === 'BARBERO' ? 'Agenda' : 'Admin')} style={styles.destacado} accessibilityRole="button">
          <Text style={[styles.destacadoTexto, { fontWeight: '700', marginBottom: 6 }]}>
            {rol === 'BARBERO' ? 'Tu próximo cliente' : rol === 'ADMIN' ? 'Próximo turno del local' : 'Tu próximo turno'}
          </Text>
          <Text style={styles.destacadoTitulo}>{fechaCorta(t.fecha)} · {horaCorta(t.hora)} hs</Text>
          <Text style={styles.destacadoTexto}>
            {t.servicio?.nombre || t.servicio || 'Servicio'}
            {t.barbero?.nombre ? ` con ${nombreDe(t.barbero)}` : ''}
            {typeof t.cliente === 'string' && t.cliente ? ` · ${t.cliente}` : ''}
          </Text>
          <View style={{ marginTop: 6 }}><Text style={[styles.destacadoTexto, { fontWeight: '800' }]}>{t.estado === 'CONFIRMADO' ? 'Confirmado ✓' : 'Esperando confirmación'}</Text></View>
          {rol === 'USUARIO' && <CuentaRegresiva fecha={t.fecha} hora={t.hora} />}
        </Pressable>
      ) : (
        <Vacio
          icono="calendar-outline"
          titulo={rol === 'USUARIO' ? '¿Listo para tu próximo corte?' : 'No hay turnos próximos'}
          texto={rol === 'USUARIO' ? 'No tenés turnos próximos. Elegí servicio, barbero y horario en menos de un minuto.' : null}
        >
          {rol === 'USUARIO' && <Boton titulo="Reservar turno" icono="add" onPress={() => onIr('Reservar')} style={{ alignSelf: 'stretch', marginTop: 6 }} />}
        </Vacio>
      )}

      {/* Barbero: turnos que esperan su confirmación (de cualquier día) */}
      {rol === 'BARBERO' && porConfirmar > 0 && (
        <Pressable onPress={() => onIr('Agenda')} accessibilityRole="button" style={[styles.opcion, { borderColor: colors.gold, marginTop: 12 }]}>
          <Icono nombre="alert-circle-outline" color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opcionTitulo}>{porConfirmar === 1 ? '1 turno espera tu confirmación' : `${porConfirmar} turnos esperan tu confirmación`}</Text>
            <Text style={styles.opcionSub}>Tocá para ir a tu agenda y confirmarlos</Text>
          </View>
          <Icono nombre="chevron-forward" color={colors.faint} />
        </Pressable>
      )}

      {/* Pedido para ser barbero pendiente */}
      {rol === 'USUARIO' && perfil?.solicita_barbero && (
        <Tarjeta style={{ borderColor: colors.gold, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icono nombre="hourglass-outline" color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tu pedido para ser barbero está pendiente</Text>
              <Text style={styles.cardDescription}>El dueño ya recibió el aviso. Cuando te apruebe te avisamos y vas a ver tu agenda.</Text>
            </View>
          </View>
        </Tarjeta>
      )}

      {/* Accesos rápidos */}
      {rol === 'USUARIO' && (
        <View style={[styles.accesos, { marginTop: 12 }]}>
          <Acceso icono="add-circle-outline" texto="Reservar" onPress={() => onIr('Reservar')} />
          <Acceso icono="receipt-outline" texto="Mis turnos" onPress={() => onIr('Mis turnos')} />
          <Acceso icono="chatbubbles-outline" texto="Asistente" onPress={() => onIr('Asistente')} />
        </View>
      )}

      {/* Avisos */}
      <Seccion titulo={`Avisos${noLeidas.length ? ` (${noLeidas.length})` : ''}`} accion={notifs.length ? 'Ver todos' : null} onAccion={() => onIr('Avisos')} />
      {notifs.length ? notifs.slice(0, 3).map((n) => <AvisoFila key={n.id} n={n} onPress={() => { leerUno(n); const d = destinoDe(n, rol); if (d && onIrAviso) onIrAviso(d); else onIr('Avisos'); }} />)
        : <Texto>Cuando un turno cambie de estado te avisamos acá.</Texto>}

      {rol === 'USUARIO' && <BarberoRecomendado catalogo={catalogo} favoritos={favoritos} onReservarCon={onReservarCon} recarga={recargarClave} />}
      {rol === 'USUARIO' && <ElegiTuEstilo onReservarCon={onReservarCon} />}
      {rol !== 'USUARIO' && <Dashboard rol={rol} recarga={recargarClave} onIr={onIr} />}
      {rol === 'BARBERO' && <View style={{ marginTop: 12 }}><ValidarCanje /></View>}

      {rol === 'USUARIO' && <Catalogo catalogo={catalogo} favoritos={favoritos} onReservar={(inicial) => (inicial && onReservarCon ? onReservarCon(inicial) : onIr('Reservar'))} />}

    </View>
  );
}

function Acceso({ icono, texto, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.acceso, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={texto}>
      <Icono nombre={icono} tam={24} color={colors.gold} />
      <Text style={styles.accesoTexto}>{texto}</Text>
    </Pressable>
  );
}

const ICONO_AVISO = { BARBERO_APROBADO: 'cut', SOLICITUD_BARBERO: 'person-add', NUEVO_BARBERO: 'person-add', CONFIRMADO: 'checkmark-circle', CANCELADO: 'close-circle', COMPLETADO: 'star', RECORDATORIO: 'alarm', RESERVADO: 'calendar' };
function AvisoFila({ n, onPress }) {
  const icono = Object.entries(ICONO_AVISO).find(([k]) => String(n.tipo || '').toUpperCase().includes(k))?.[1] || 'notifications';
  return (
    <Pressable onPress={onPress} style={[styles.card, { flexDirection: 'row', gap: 12, padding: 14 }, n.leida && { opacity: 0.6 }]} accessibilityRole="button">
      <View style={styles.opcionIcono}><Icono nombre={icono} tam={18} color={colors.gold} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{n.titulo}</Text>
        <Text style={styles.cardDescription}>{n.mensaje}</Text>
      </View>
      {!n.leida && <View style={{ backgroundColor: colors.gold, borderRadius: 5, height: 10, marginTop: 6, width: 10 }} />}
    </Pressable>
  );
}

export function Catalogo({ catalogo, onReservar, favoritos }) {
  const { servicios, barberos, cargando, error, recargar } = catalogo;
  const fav = favoritos?.habilitado ? favoritos : null;
  if (cargando && !servicios.length) return <Cargando />;
  if (error) return <ErrorCaja texto={error} onReintentar={recargar} />;
  return (
    <View>
      <Seccion titulo="Servicios" accion={servicios.length && barberos.length ? 'Reservar' : null} onAccion={() => onReservar()} />
      {servicios.length ? servicios.map((s) => (
        <Tarjeta key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6 }}>
          <Pressable
            onPress={() => onReservar({ servicioId: s.id })}
            style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`${s.nombre}, ${s.duracion} minutos, ${precio(s.precio)}. Reservar`}
          >
            <View style={styles.opcionIcono}><Icono nombre="cut-outline" tam={18} color={colors.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.nombre}</Text>
              <Text style={styles.cardDescription}>{s.duracion} min{s.categoria?.nombre ? ` · ${s.categoria.nombre}` : ''}</Text>
            </View>
            <Text style={styles.price}>{precio(s.precio)}</Text>
          </Pressable>
          {fav && <Corazon activo={fav.esFavorito('servicio', s.id)} nombre={s.nombre} onPress={() => fav.alternar('servicio', s)} />}
        </Tarjeta>
      )) : <Vacio icono="cut-outline" texto="Todavía no hay servicios disponibles." />}

      <Seccion titulo="Barberos" />
      {barberos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {barberos.map((b) => (
            <View key={b.id} style={{ alignItems: 'center', marginRight: 14, width: 92 }}>
              <Pressable onPress={() => onReservar({ barberoId: b.id })} style={{ alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={`${nombreDe(b)}${b.especialidad ? `, ${b.especialidad}` : ''}. Reservar con este barbero`}>
                <Avatar nombre={nombreDe(b)} tam={60} foto={b.foto_url} />
                <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 6, textAlign: 'center' }]} numberOfLines={2}>{nombreDe(b)}</Text>
                {b.especialidad ? <Text style={[styles.aviso, { marginTop: 0, textAlign: 'center' }]} numberOfLines={2}>{b.especialidad}</Text> : null}
              </Pressable>
              {fav && <Corazon activo={fav.esFavorito('barbero', b.id)} nombre={nombreDe(b)} onPress={() => fav.alternar('barbero', b)} />}
            </View>
          ))}
        </ScrollView>
      ) : <Vacio icono="people-outline" texto="Todavía no hay barberos disponibles." />}
    </View>
  );
}

// ======================================================================
// RESERVAR (también lo usa el admin para cargar un turno a un cliente)
// ======================================================================
const PASOS = ['Servicio', 'Barbero', 'Día y hora', 'Confirmar'];

// 📘 RESERVAR en 4 pasos. Solo muestra los horarios que la API informa como libres.
//    Igual, al confirmar, el servidor vuelve a controlar todo: si otra persona tomó ese horario un segundo antes, avisa "ya está ocupado".
export function Reservar({ catalogo, onReservado, cliente, inicial, onInicialUsado, favoritos }) {
  const { cargando, error, recargar } = catalogo;
  // Los favoritos aparecen primero (solo para el cliente)
  const fav = !cliente && favoritos?.habilitado ? favoritos : null;
  const primeroFav = (lista, tipo) => (fav ? [...lista].sort((a, b) => Number(fav.esFavorito(tipo, b.id)) - Number(fav.esFavorito(tipo, a.id))) : lista);
  const servicios = useMemo(() => primeroFav(catalogo.servicios, 'servicio'), [catalogo.servicios, fav?.servicios]);
  const barberos = useMemo(() => primeroFav(catalogo.barberos, 'barbero'), [catalogo.barberos, fav?.barberos]);
  const dias = useMemo(() => proximosDias(21), []);
  const [paso, setPaso] = useState(0);
  const [servicioId, setServicioId] = useState(null);
  const [barberoId, setBarberoId] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [diasLaborales, setDiasLaborales] = useState(null); // Set de día de semana con franjas
  const [horas, setHoras] = useState([]);
  const [ocupadas, setOcupadas] = useState([]); // horarios tomados (para "Avisarme si se libera")
  const [infoDias, setInfoDias] = useState(null); // Map fecha → { trabaja, libres }
  const [estadoHoras, setEstadoHoras] = useState('elegir');
  const [mensajeHoras, setMensajeHoras] = useState('');
  const [reservando, setReservando] = useState(false);
  const [repetir, setRepetir] = useState(null); // aviso de "Reservar de nuevo"
  const [barberoFijo, setBarberoFijo] = useState(null); // barbero elegido desde Inicio o Favoritos

  const servicio = servicios.find((s) => s.id === servicioId);

  // "Reservar de nuevo": se reutilizan servicio y barbero del turno anterior y se salta a elegir día y hora.
  // Nunca reserva sola: la persona elige fecha/horario libre y confirma.
  useEffect(() => {
    if (!inicial || !servicios.length || !barberos.length) return;
    const s = servicios.find((x) => x.id === inicial.servicioId);
    const b = barberos.find((x) => x.id === inicial.barberoId);
    setFecha(null); setHora(null); setBarberoFijo(null);
    if (inicial.servicioId == null && b) {
      // Desde un barbero: primero el servicio y después directo a los horarios de ese barbero
      setServicioId(null); setBarberoId(b.id); setBarberoFijo(b.id); setPaso(0);
      setRepetir({ tipo: 'ok', titulo: `Con ${nombreDe(b)}`, texto: 'Elegí el servicio y te mostramos sus horarios libres.' });
    } else if (inicial.barberoId == null && s) {
      setServicioId(s.id); setBarberoId(null); setPaso(1);
      setRepetir({ tipo: 'ok', titulo: s.nombre, texto: 'Elegí con qué barbero.' });
    } else if (!s) {
      setServicioId(null); setBarberoId(null); setPaso(0);
      setRepetir({ tipo: 'aviso', texto: `"${inicial.servicioNombre || 'Ese servicio'}" ya no está disponible. Elegí otro servicio.` });
    } else if (!b) {
      setServicioId(s.id); setBarberoId(null); setPaso(1);
      setRepetir({ tipo: 'aviso', texto: `${inicial.barberoNombre || 'Ese barbero'} no está tomando turnos. Elegí otro barbero para ${s.nombre}.` });
    } else {
      setServicioId(s.id); setBarberoId(b.id); setPaso(2);
      setRepetir({ tipo: 'ok', texto: `Repetís ${s.nombre} con ${nombreDe(b)}. Elegí un día y un horario libre.` });
    }
    onInicialUsado?.();
  }, [inicial, servicios.length, barberos.length]);
  const barbero = barberos.find((b) => b.id === barberoId);

  // Días en que trabaja el barbero (para apagar los demás en el calendario)
  useEffect(() => {
    if (!barberoId) { setDiasLaborales(null); return; }
    api(`/schedules?barbero_id=${barberoId}`)
      .then((r) => setDiasLaborales(new Set(r.horarios.filter((h) => h.activo).map((h) => h.dia_semana))))
      .catch(() => setDiasLaborales(null));
  }, [barberoId]);

  // Calendario mejorado: cuántos horarios libres tiene cada día (para marcar los días sin lugar)
  useEffect(() => {
    if (!barberoId || !servicioId) { setInfoDias(null); return; }
    api(`/appointments/days?barbero_id=${barberoId}&servicio_id=${servicioId}&desde=${dias[0].iso}&dias=${dias.length}`)
      .then((r) => setInfoDias(new Map(r.dias.map((d) => [String(d.fecha).slice(0, 10), d]))))
      .catch(() => setInfoDias(null)); // sin este dato se usa solo el horario laboral
  }, [barberoId, servicioId]);

  // Al entrar al paso 3, elegir el primer día con lugar (o el primero en que trabaja)
  useEffect(() => {
    if (paso === 2 && !fecha && (diasLaborales || infoDias)) {
      const conLugar = infoDias && dias.find((d) => infoDias.get(d.iso)?.libres > 0);
      const primero = conLugar || dias.find((d) => !diasLaborales || diasLaborales.has(d.dow));
      setFecha((primero || dias[0]).iso);
    }
  }, [paso, diasLaborales, infoDias]);

  const consultar = useCallback(async () => {
    setHora(null);
    if (!servicioId || !barberoId || !fecha) { setEstadoHoras('elegir'); return; }
    setEstadoHoras('cargando');
    const q = `barbero_id=${barberoId}&servicio_id=${servicioId}&fecha=${fecha}`;
    try {
      let libres = null;
      let tomadas = [];
      try {
        // Todos los horarios del día con su estado: los ocupados se muestran deshabilitados
        const r = await api(`/appointments/slots?${q}`);
        libres = r.horarios.filter((h) => h.estado === 'LIBRE').map((h) => h.hora);
        tomadas = r.horarios.filter((h) => h.estado === 'OCUPADO').map((h) => h.hora);
        if (!r.horarios.length) libres = null; // sin franjas: se pide el mensaje explicativo
      } catch { libres = null; }
      if (libres === null) {
        const r = await api(`/appointments/availability?${q}`);
        libres = r.horarios;
        setMensajeHoras(r.mensaje || '');
      } else {
        setMensajeHoras(tomadas.length ? 'No quedan horarios libres este día. Tocá un horario ocupado y te avisamos si se libera.' : 'Ya pasaron los horarios de este día. Elegí otra fecha.');
      }
      setHoras(libres);
      setOcupadas(cliente ? [] : tomadas);
      setEstadoHoras(libres.length || (!cliente && tomadas.length) ? 'listo' : 'vacio');
    } catch (e) {
      setMensajeHoras(textoError(e));
      setEstadoHoras('error');
    }
  }, [servicioId, barberoId, fecha]);

  useEffect(() => { consultar(); }, [consultar]);

  /** Lista de espera: "Avisarme si se libera" en un horario ocupado. */
  // 📘 Lista de espera: si el horario está ocupado, el cliente se anota (POST /waitlist) y le avisan si se libera.
  const avisarmeSiSeLibera = (h) => Alert.alert('Horario ocupado', `Las ${h} del ${fechaCorta(fecha)} ya están tomadas. ¿Querés que te avisemos si se libera? Avisamos por orden de llegada y tenés 30 minutos para reservarlo.`, [
    { text: 'No', style: 'cancel' },
    {
      text: 'Avisarme', onPress: async () => {
        try {
          const r = await api('/waitlist', { method: 'POST', body: { barbero_id: barberoId, servicio_id: servicioId, fecha, hora: h } });
          avisar(r.mensaje || 'Te anotamos en la lista de espera');
        } catch (e) { Alert.alert('No se pudo anotar', textoError(e)); }
      }
    }
  ]);

  const reiniciar = () => { setPaso(0); setServicioId(null); setBarberoId(null); setFecha(null); setHora(null); setRepetir(null); setBarberoFijo(null); };

  // 📘 Confirmar la reserva: POST /appointments con servicio, barbero, fecha y hora. El turno queda PENDIENTE.
  const reservar = async () => {
    setReservando(true);
    try {
      const body = { barbero_id: barberoId, servicio_id: servicioId, fecha, hora };
      if (cliente) body.usuario_id = cliente.id;
      await api('/appointments', { method: 'POST', body });
      avisar(cliente ? `Turno cargado para ${nombreDe(cliente)}` : 'Turno reservado. Te avisamos cuando lo confirmen.');
      reiniciar();
      onReservado?.();
    } catch (e) {
      Alert.alert('No se pudo reservar', textoError(e));
      setPaso(2);
      consultar();
    } finally {
      setReservando(false);
    }
  };

  if (cargando && !servicios.length) return <Cargando texto="Cargando opciones..." />;
  if (error) return <ErrorCaja texto={error} onReintentar={recargar} />;
  if (!servicios.length || !barberos.length) {
    return <Vacio icono="construct-outline" titulo="Todavía no se puede reservar" texto="La barbería tiene que cargar servicios y barberos." />;
  }

  // Libres y ocupados juntos, en orden (los ocupados se ven pero no se pueden elegir)
  const todas = [...horas.map((h) => ({ h, libre: true })), ...ocupadas.map((h) => ({ h, libre: false }))].sort((a, b) => a.h.localeCompare(b.h));
  const manana = todas.filter((x) => x.h < '13:00');
  const tarde = todas.filter((x) => x.h >= '13:00');

  return (
    <View>
      {!cliente && <Titulo>Reservar turno</Titulo>}
      {cliente && <Texto>Turno para <Text style={{ color: colors.text, fontWeight: '700' }}>{nombreDe(cliente)}</Text></Texto>}
      {repetir && (
        <View style={[styles.opcion, { alignItems: 'flex-start' }]} accessibilityRole="summary" accessibilityLiveRegion="polite">
          <Icono nombre={repetir.tipo === 'ok' ? 'repeat' : 'information-circle-outline'} color={repetir.tipo === 'ok' ? colors.gold : colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opcionTitulo}>{repetir.titulo || (repetir.tipo === 'ok' ? 'Reservar de nuevo' : 'Hay que elegir de nuevo')}</Text>
            <Text style={styles.opcionSub}>{repetir.texto}</Text>
            <Pressable onPress={reiniciar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Empezar la reserva de cero" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}><Text style={[styles.seccionAccion, { marginTop: 6 }]}>Empezar de cero</Text></Pressable>
          </View>
        </View>
      )}

      {/* Progreso */}
      <View style={styles.pasos}>
        {PASOS.map((p, i) => <View key={p} style={[styles.paso, i <= paso && styles.pasoHecho]} />)}
      </View>
      <View style={[styles.seccion, { marginTop: 0 }]}>
        <Text style={styles.seccionTitulo}>{paso + 1}. {PASOS[paso]}</Text>
        {paso > 0 && <Pressable onPress={() => setPaso(paso - 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Atrás, volver al paso anterior" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}><Text style={styles.seccionAccion}>Atrás</Text></Pressable>}
      </View>

      {paso === 0 && servicios.map((s) => (
        <Seleccionable
          key={s.id}
          icono="cut-outline"
          titulo={s.nombre}
          subtitulo={`${fav?.esFavorito('servicio', s.id) ? '♥ Favorito · ' : ''}${s.duracion} min${s.categoria?.nombre ? ` · ${s.categoria.nombre}` : ''}`}
          derecha={precio(s.precio)}
          activo={s.id === servicioId}
          onPress={() => { setServicioId(s.id); setHora(null); setPaso(barberoFijo && barberos.some((b) => b.id === barberoFijo) ? 2 : 1); }}
        />
      ))}

      {paso === 1 && barberos.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="button"
          accessibilityState={{ selected: b.id === barberoId }}
          onPress={() => { setBarberoId(b.id); setBarberoFijo(null); setFecha(null); setHora(null); setPaso(2); }}
          style={[styles.opcion, b.id === barberoId && styles.opcionActiva]}
        >
          <Avatar nombre={nombreDe(b)} activo={b.id === barberoId} foto={b.foto_url} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opcionTitulo}>{nombreDe(b)}</Text>
            <Text style={styles.opcionSub}>{fav?.esFavorito('barbero', b.id) ? '♥ Favorito · ' : ''}{b.especialidad || 'Barbero'}</Text>
          </View>
          <Icono nombre="chevron-forward" color={colors.faint} />
        </Pressable>
      ))}

      {paso === 2 && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {dias.map((d) => {
              const info = infoDias?.get(d.iso);
              const trabaja = info ? info.trabaja : (!diasLaborales || diasLaborales.has(d.dow));
              const lleno = trabaja && info && info.libres === 0;
              const activo = d.iso === fecha;
              return (
                <Pressable
                  key={d.iso}
                  disabled={!trabaja}
                  onPress={() => setFecha(d.iso)}
                  accessibilityRole="button"
                  accessibilityLabel={`${DIAS[d.dow]} ${d.dia}${!trabaja ? ', no atiende' : lleno ? ', sin horarios libres' : info ? `, ${info.libres} horarios libres` : ''}`}
                  accessibilityState={{ selected: activo, disabled: !trabaja }}
                  style={[styles.dia, activo && styles.diaActivo, !trabaja && { opacity: 0.35 }, lleno && !activo && { borderStyle: 'dashed' }]}
                >
                  <Text style={[styles.diaDow, activo && { color: colors.sobreGold }]}>{DIAS[d.dow].slice(0, 3)}</Text>
                  <Text style={[styles.diaNum, activo && { color: colors.sobreGold }, lleno && !activo && { color: colors.faint }]}>{d.dia}</Text>
                  <Text style={[styles.diaMes, activo && { color: colors.sobreGold }]}>{!trabaja ? 'cerrado' : lleno ? 'lleno' : MESES[d.mes - 1]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {diasLaborales && diasLaborales.size === 0 && <Texto>Este barbero todavía no tiene horarios cargados.</Texto>}
          {estadoHoras === 'cargando' && <Cargando />}
          {estadoHoras === 'vacio' && <Vacio icono="time-outline" texto={mensajeHoras} />}
          {estadoHoras === 'error' && <ErrorCaja texto={mensajeHoras} onReintentar={consultar} />}
          {estadoHoras === 'listo' && (
            <View>
              {!horas.length && <Texto>{mensajeHoras}</Texto>}
              {ocupadas.length > 0 && horas.length > 0 && <Text style={[styles.aviso, { marginBottom: 10, marginTop: 0 }]}>Los horarios tachados están ocupados: tocalos para que te avisemos si se liberan.</Text>}
              {[['Mañana', manana, 'sunny-outline'], ['Tarde', tarde, 'moon-outline']].filter(([, l]) => l.length).map(([nombre, lista, icono]) => (
                <View key={nombre}>
                  <View style={[styles.btnFila, { marginBottom: 8 }]}>
                    <Icono nombre={icono} tam={16} color={colors.muted} />
                    <Text style={styles.label}>{nombre}</Text>
                  </View>
                  <View style={styles.horaGrid}>
                    {lista.map(({ h, libre }) => (libre ? (
                      <Pressable
                        key={h}
                        accessibilityRole="button"
                        accessibilityLabel={h}
                        accessibilityState={{ selected: h === hora }}
                        onPress={() => { setHora(h); setPaso(3); }}
                        style={[styles.hora, h === hora && styles.horaActiva]}
                      >
                        <Text style={[styles.horaTexto, h === hora && { color: colors.sobreGold }]}>{h}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        key={h}
                        accessibilityRole="button"
                        accessibilityLabel={`${h}, ocupado. Avisarme si se libera`}
                        onPress={() => avisarmeSiSeLibera(h)}
                        style={[styles.hora, { backgroundColor: colors.surface2, borderColor: colors.border, borderStyle: 'dashed' }]}
                      >
                        <Text style={[styles.horaTexto, { color: colors.faint, textDecorationLine: 'line-through' }]}>{h}</Text>
                        <Icono nombre="notifications-outline" tam={12} color={colors.faint} />
                      </Pressable>
                    )))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {paso === 3 && servicio && barbero && fecha && hora && (
        <View>
          <View style={styles.resumen}>
            <ResumenFila icono="cut-outline" texto={`${servicio.nombre} (${servicio.duracion} min)`} onEditar={() => setPaso(0)} />
            <ResumenFila icono="person-outline" texto={nombreDe(barbero)} onEditar={() => setPaso(1)} />
            <ResumenFila icono="calendar-outline" texto={`${fechaCorta(fecha)} a las ${hora} hs`} onEditar={() => setPaso(2)} />
            <View style={styles.separador} />
            <View style={[styles.resumenFila, { marginBottom: 0 }]}>
              <Text style={[styles.resumenTexto, { fontWeight: '700' }]}>Total (se paga en el local)</Text>
              <Text style={[styles.price, { fontSize: 20 }]}>{precio(servicio.precio)}</Text>
            </View>
          </View>
          <Texto style={{ marginTop: 12 }}>El turno queda pendiente hasta que el barbero lo confirme. Podés cancelarlo hasta 24 h antes.</Texto>
          <Boton titulo="Confirmar reserva" icono="checkmark" onPress={reservar} cargando={reservando} />
        </View>
      )}
    </View>
  );
}

function ResumenFila({ icono, texto, onEditar }) {
  return (
    <View style={styles.resumenFila}>
      <Icono nombre={icono} tam={18} color={colors.gold} />
      <Text style={styles.resumenTexto}>{texto}</Text>
      <Pressable onPress={onEditar} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Cambiar ${texto}`} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}><Text style={styles.seccionAccion}>Cambiar</Text></Pressable>
    </View>
  );
}

// ======================================================================
// MIS TURNOS
// ======================================================================
// 📘 Calificar un turno completado (1 a 5 estrellas y comentario). La base controla que sea tuyo, esté completado y sea una sola vez.
function FormResena({ turno, onListo }) {
  const [calificacion, setCalificacion] = useState(turno.resena?.calificacion || 0);
  const [comentario, setComentario] = useState(turno.resena?.comentario || '');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (calificacion < 1) return avisar('Elegí de 1 a 5 estrellas', 'error');
    setEnviando(true);
    try {
      turno.resena
        ? await api(`/reviews/${turno.resena.id}`, { method: 'PUT', body: { calificacion, comentario } })
        : await api('/reviews', { method: 'POST', body: { turno_id: turno.id, calificacion, comentario } });
      avisar('¡Gracias por tu reseña!');
      onListo();
    } catch (e) {
      Alert.alert('No se pudo guardar la reseña', textoError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.seccionTitulo}>¿Cómo te fue?</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setCalificacion(n)} accessibilityRole="button" accessibilityLabel={`${n} estrellas`} hitSlop={6}>
            <Icono nombre={n <= calificacion ? 'star' : 'star-outline'} tam={36} color={colors.gold} />
          </Pressable>
        ))}
      </View>
      <Campo etiqueta="Comentario (opcional)" value={comentario} onChangeText={setComentario} multiline maxLength={500} placeholder="Contanos qué te pareció" />
      <Boton titulo={turno.resena ? 'Guardar cambios' : 'Enviar reseña'} onPress={enviar} cargando={enviando} />
    </View>
  );
}

// 📘 MIS TURNOS: GET /appointments. La API (y RLS) solo devuelven los turnos de este cliente.
export function MisTurnos({ recargarClave, onCambio, onIr, onReservarDeNuevo, turnoInicial, onTurnoInicialUsado }) {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('Próximos');
  const [abierto, setAbierto] = useState(null);
  const [resenando, setResenando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api('/appointments');
      setTurnos(r.turnos);
      setError(null);
    } catch (e) {
      setError(textoError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, recargarClave]);

  // Al venir desde un aviso: abrir ese turno directamente
  useEffect(() => {
    if (!turnoInicial || !turnos.length) return;
    const t = turnos.find((x) => x.id === turnoInicial);
    if (t) { setFiltro(t.estado === 'PENDIENTE' || t.estado === 'CONFIRMADO' ? 'Próximos' : 'Historial'); setAbierto(t.id); }
    onTurnoInicialUsado?.();
  }, [turnoInicial, turnos]);

  const activos = (t) => t.estado === 'PENDIENTE' || t.estado === 'CONFIRMADO';
  const lista = filtro === 'Próximos' ? turnos.filter(activos).slice().reverse() : turnos.filter((t) => !activos(t));
  const turno = turnos.find((t) => t.id === abierto);

  const cerrar = () => { setAbierto(null); setResenando(false); };
  const repetir = (t) => {
    cerrar();
    onReservarDeNuevo?.({
      servicioId: t.servicio_id ?? t.servicio?.id, barberoId: t.barbero_id ?? t.barbero?.id,
      servicioNombre: t.servicio?.nombre, barberoNombre: t.barbero ? nombreDe(t.barbero) : null
    });
  };

  const borrar = (t) => {
    Alert.alert('Borrar de mi lista', 'El turno deja de aparecer en tu lista. La barbería conserva el registro.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Borrar', style: 'destructive', onPress: async () => {
          try {
            await api(`/appointments/${t.id}/hide`, { method: 'POST' });
            avisar('Turno borrado de tu lista');
            cerrar();
            cargar();
          } catch (e) { Alert.alert('No se pudo borrar', textoError(e)); }
        }
      }
    ]);
  };

  // 📘 Cancelar un turno. La regla de las 24 h la controla el servidor con su reloj (la hora del celular se puede cambiar).
  const cancelar = (t) => {
    Alert.alert('Cancelar turno', `¿Cancelar el turno del ${fechaCorta(t.fecha)} a las ${horaCorta(t.hora)}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
          setCancelando(true);
          try {
            await api(`/appointments/${t.id}`, { method: 'DELETE' });
            avisar('Turno cancelado. El horario quedó libre.');
            cerrar();
            onCambio?.();
          } catch (e) {
            Alert.alert('No se pudo cancelar', textoError(e));
          } finally {
            setCancelando(false);
            cargar();
          }
        }
      }
    ]);
  };

  if (cargando && !turnos.length && !error) return <Cargando texto="Cargando tus turnos..." />;
  if (error) return <ErrorCaja texto={error} onReintentar={cargar} />;

  return (
    <View>
      <Titulo>Mis turnos</Titulo>
      <Pestanas opciones={['Próximos', 'Historial']} activa={filtro} onCambiar={setFiltro} />

      {!lista.length && (
        <Vacio
          icono={filtro === 'Próximos' ? 'calendar-outline' : 'time-outline'}
          titulo={filtro === 'Próximos' ? 'No tenés turnos próximos' : 'Todavía no hay historial'}
          texto={filtro === 'Próximos' ? 'Reservá uno y aparece acá.' : 'Acá vas a ver tus turnos completados y cancelados.'}
        >
          {filtro === 'Próximos' && onIr && <Boton titulo="Reservar turno" icono="add" onPress={() => onIr('Reservar')} style={{ alignSelf: 'stretch', marginTop: 6 }} />}
        </Vacio>
      )}

      {lista.map((t) => (
        <View key={t.id}>
        <Pressable onPress={() => setAbierto(t.id)} accessibilityRole="button" accessibilityLabel={`Turno ${t.servicio?.nombre} ${fechaCorta(t.fecha)}, ${nombreEstado(t.estado)}. Ver detalle`}>
          <Ticket fecha={t.fecha} hora={t.hora} apagado={t.estado === 'CANCELADO'}>
            <Text style={styles.cardTitle}>{t.servicio?.nombre || 'Servicio'}</Text>
            <Text style={styles.cardDescription}>con {t.barbero ? nombreDe(t.barbero) : 'barbero asignado'}</Text>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Estado estado={t.estado} />
              <Text style={[styles.price, { marginTop: 8 }]}>{precio(t.precio)}</Text>
            </View>
            {t.estado === 'FINALIZADO' && !t.resena && <Text style={[styles.seccionAccion, { marginTop: 8 }]}>Calificar servicio</Text>}
            {t.resena && <Text style={[styles.estrellas, { marginTop: 6 }]}>{estrellas(t.resena.calificacion)}</Text>}
          </Ticket>
        </Pressable>
        {!activos(t) && onReservarDeNuevo && (
          <Boton titulo="Reservar de nuevo" icono="repeat" variante="secundario" onPress={() => repetir(t)} style={{ marginTop: -4, marginBottom: 16 }} />
        )}
        </View>
      ))}

      <Hoja visible={!!turno} titulo="Detalle del turno" onCerrar={cerrar}>
        {turno && (
          <View>
            <Ticket fecha={turno.fecha} hora={turno.hora} apagado={turno.estado === 'CANCELADO'}>
              <Text style={styles.cardTitle}>{turno.servicio?.nombre}</Text>
              <Text style={styles.cardDescription}>con {nombreDe(turno.barbero)}</Text>
              <Estado estado={turno.estado} />
            </Ticket>
            <Tarjeta>
              <DetalleFila etiqueta="Duración" valor={`${turno.servicio?.duracion || '-'} min`} />
              <DetalleFila etiqueta="Precio" valor={precio(turno.precio)} />
              <DetalleFila etiqueta="Pago" valor={turno.pago?.estado ? `${turno.pago.estado.charAt(0)}${turno.pago.estado.slice(1).toLowerCase()}${turno.pago.metodo ? ` (${turno.pago.metodo.toLowerCase()})` : ''}` : '-'} />
            </Tarjeta>

            {turno.estado !== 'CANCELADO' && turno.pago?.estado === 'PENDIENTE' && (
              <PagoCliente turno={turno} onListo={cargar} />
            )}
            {turno.pago?.estado === 'PAGADO' && (
              <View style={[styles.btnFila, { marginBottom: 12 }]}>
                <Icono nombre="checkmark-circle" color={colors.ok} />
                <Text style={[styles.cardTitle, { color: colors.ok, marginBottom: 0 }]}>Pagado{turno.pago.metodo ? ` (${turno.pago.metodo.toLowerCase()})` : ''}</Text>
              </View>
            )}

            {activos(turno) && (faltanAlMenos24h(turno.fecha, turno.hora)
              ? <Boton titulo="Cancelar turno" icono="close-circle-outline" variante="peligro" cargando={cancelando} onPress={() => cancelar(turno)} />
              : <Texto>Ya no se puede cancelar desde la app: faltan menos de 24 horas. Comunicate con la barbería.</Texto>)}

            {turno.estado === 'FINALIZADO' && turno.resena && !resenando && (
              <Tarjeta>
                <Text style={styles.estrellas}>{estrellas(turno.resena.calificacion)}</Text>
                {turno.resena.comentario ? <Text style={[styles.cardDescription, { marginTop: 6 }]}>“{turno.resena.comentario}”</Text> : null}
                <Boton titulo="Editar reseña" variante="fantasma" chico onPress={() => setResenando(true)} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
              </Tarjeta>
            )}
            {turno.estado === 'FINALIZADO' && (!turno.resena || resenando) && (
              <FormResena turno={turno} onListo={() => { setResenando(false); cargar(); }} />
            )}
            {!activos(turno) && onReservarDeNuevo && (
              <Boton titulo="Reservar de nuevo" icono="repeat" onPress={() => repetir(turno)} style={{ marginTop: 8 }} />
            )}
            {!activos(turno) && (
              <Boton titulo="Borrar de mi lista" icono="trash-outline" variante="fantasma" onPress={() => borrar(turno)} style={{ marginTop: 8 }} />
            )}
          </View>
        )}
      </Hoja>
    </View>
  );
}

export function DetalleFila({ etiqueta, valor }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={styles.cardDescription}>{etiqueta}</Text>
      <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{valor}</Text>
    </View>
  );
}

/** Pago del turno por parte del cliente: en el local o por transferencia (el barbero confirma el cobro). */
// 📘 Pagar: el cliente elige en el local o transferencia (ve el alias o CBU de la barbería). No hay pasarela: el barbero confirma el cobro.
function PagoCliente({ turno, onListo }) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState(null); // LOCAL | TRANSFERENCIA
  const [metodoLocal, setMetodoLocal] = useState('EFECTIVO');
  const [comprobante, setComprobante] = useState('');
  const [barberia, setBarberia] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (abierto && !barberia) api('/barbershop').then((r) => setBarberia(r.barberia)).catch(() => setBarberia({}));
  }, [abierto]);

  const enviar = async (metodo) => {
    setEnviando(true);
    try {
      const r = await api(`/appointments/${turno.id}/pay`, { method: 'POST', body: { metodo, comprobante: comprobante.trim() || undefined } });
      avisar(r.mensaje || 'Pago informado');
      setAbierto(false);
      onListo?.();
    } catch (e) {
      Alert.alert('No se pudo informar el pago', textoError(e));
    } finally {
      setEnviando(false);
    }
  };

  const informado = turno.pago?.informado_at;
  if (!abierto) {
    return (
      <View style={{ marginBottom: 6 }}>
        {informado ? (
          <View style={[styles.resumen, { marginTop: 0, marginBottom: 10 }]}>
            <View style={styles.resumenFila}>
              <Icono nombre="time-outline" color={colors.gold} />
              <Text style={styles.resumenTexto}>
                {turno.pago.metodo === 'TRANSFERENCIA' ? 'Avisaste que transferiste. El barbero lo va a confirmar.' : `Vas a pagar en el local (${(turno.pago.metodo || '').toLowerCase()}).`}
              </Text>
            </View>
            <Pressable onPress={() => setAbierto(true)}><Text style={styles.seccionAccion}>Cambiar forma de pago</Text></Pressable>
          </View>
        ) : (
          <Boton titulo={`Pagar ${precio(turno.precio)}`} icono="card-outline" onPress={() => setAbierto(true)} />
        )}
      </View>
    );
  }

  const datosTransferencia = barberia && (barberia.alias_transferencia || barberia.cbu);
  return (
    <View style={[styles.resumen, { marginTop: 0, marginBottom: 12 }]}>
      <View style={[styles.seccion, { marginTop: 0 }]}>
        <Text style={styles.seccionTitulo}>¿Cómo pagás?</Text>
        <Pressable onPress={() => setAbierto(false)} hitSlop={8} accessibilityRole="button" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}><Text style={styles.seccionAccion}>Cerrar</Text></Pressable>
      </View>
      <Seleccionable icono="storefront-outline" titulo="En el local" subtitulo="Efectivo o tarjeta al llegar" activo={modo === 'LOCAL'} onPress={() => setModo('LOCAL')} />
      <Seleccionable icono="swap-horizontal-outline" titulo="Transferencia" subtitulo="Al alias de la barbería" activo={modo === 'TRANSFERENCIA'} onPress={() => setModo('TRANSFERENCIA')} />

      {modo === 'LOCAL' && (
        <View>
          <View style={styles.subTabs}>
            {[['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta']].map(([m, t]) => <Chip key={m} texto={t} activo={metodoLocal === m} onPress={() => setMetodoLocal(m)} />)}
          </View>
          <Boton titulo="Confirmar: pago en el local" icono="checkmark" onPress={() => enviar(metodoLocal)} cargando={enviando} />
        </View>
      )}

      {modo === 'TRANSFERENCIA' && (
        <View>
          {!barberia && <Cargando />}
          {barberia && !datosTransferencia && <Texto>La barbería todavía no cargó sus datos para transferir. Por ahora pagá en el local.</Texto>}
          {datosTransferencia && (
            <View style={[styles.card, { marginTop: 4 }]}>
              {barberia.alias_transferencia ? <DetalleFila etiqueta="Alias" valor={barberia.alias_transferencia} /> : null}
              {barberia.cbu ? <DetalleFila etiqueta="CBU/CVU" valor={barberia.cbu} /> : null}
              {barberia.titular_cuenta ? <DetalleFila etiqueta="Titular" valor={barberia.titular_cuenta} /> : null}
              <DetalleFila etiqueta="Monto" valor={precio(turno.precio)} />
            </View>
          )}
          {datosTransferencia && (
            <View>
              <Campo etiqueta="Número de operación (opcional)" value={comprobante} onChangeText={setComprobante} maxLength={200} placeholder="Ej.: 123456789" />
              <Boton titulo="Ya transferí" icono="checkmark" onPress={() => enviar('TRANSFERENCIA')} cargando={enviando} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
