/*
 * 📘 PARA LA DEFENSA — pantallas/Barbero.js — pantallas del BARBERO.
 *   - AgendaBarbero: sus turnos agrupados por día. Puede Confirmar, Completar, Cancelar y Cobrar.
 *     Solo ve SUS turnos (los arma la función agenda_barbero de la base).
 *   - MiFicha: especialidad, foto, horarios y las reseñas que recibió.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { api, textoError } from '../api';
import { Avatar, Boton, Campo, Cargando, Chip, ErrorCaja, Estado, Hoja, Icono, Pestanas, Seccion, Tarjeta, Texto, Ticket, Titulo, Vacio, avisar, colors, styles } from '../ui';
import { fechaCorta, horaCorta, hoyNegocio, proximosDias } from '../tiempo';

// 📘 Qué botones aparecen según el estado: PENDIENTE → Confirmar o Cancelar; CONFIRMADO → Completar o Cancelar.
//    La base vuelve a controlar que el cambio esté permitido.
const ACCIONES = {
  PENDIENTE: [['CONFIRMADO', 'Confirmar', 'primario', 'checkmark'], ['CANCELADO', 'Cancelar', 'peligro', 'close']],
  CONFIRMADO: [['FINALIZADO', 'Completar', 'primario', 'checkmark-done'], ['CANCELADO', 'Cancelar', 'peligro', 'close']]
};
const estrellas = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Agenda del barbero agrupada por día. */
export function AgendaBarbero({ onCambio, recargarClave }) {
  // "Próximos" por defecto: así un turno reservado para otro día nunca queda escondido detrás de "Hoy"
  const [filtro, setFiltro] = useState('Próximos');
  const [turnos, setTurnos] = useState([]);
  const [pendientesOtrosDias, setPendientesOtrosDias] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [cobrando, setCobrando] = useState(null);
  const [metodo, setMetodo] = useState('EFECTIVO');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const hoy = hoyNegocio();
      const semana = proximosDias(7)[6].iso;
      const ruta = { Próximos: `/appointments?desde=${hoy}`, Hoy: `/appointments?desde=${hoy}&hasta=${hoy}`, Semana: `/appointments?desde=${hoy}&hasta=${semana}`, Todos: '/appointments' }[filtro];
      const r = await api(ruta);
      const lista = filtro === 'Todos' ? r.turnos : r.turnos.filter((t) => t.estado !== 'CANCELADO');
      lista.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) * (filtro === 'Todos' ? -1 : 1));
      setTurnos(lista);
      // En "Hoy" se avisa si hay turnos para confirmar en otros días
      if (filtro === 'Hoy') {
        const p = await api(`/appointments?estado=PENDIENTE&desde=${hoy}`);
        setPendientesOtrosDias(p.turnos.filter((t) => t.fecha !== hoy).length);
      } else setPendientesOtrosDias(0);
      setError(null);
    } catch (e) {
      setError(textoError(e));
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar, recargarClave]);

  // 📘 Cambia el estado con PUT /appointments/:id. Al completar, la base le suma los puntos al cliente y le manda un aviso.
  const cambiar = (t, estado) => {
    const ejecutar = async () => {
      setOcupado(t.id);
      try {
        await api(`/appointments/${t.id}`, { method: 'PUT', body: { estado } });
        avisar({ CONFIRMADO: 'Turno confirmado. Le avisamos al cliente.', FINALIZADO: 'Turno completado.', CANCELADO: 'Turno cancelado.' }[estado]);
        onCambio?.();
      } catch (e) {
        Alert.alert('No se pudo actualizar', textoError(e));
      } finally {
        setOcupado(null);
        cargar();
      }
    };
    if (estado === 'CANCELADO') {
      Alert.alert('Cancelar turno', '¿Cancelar este turno? El cliente recibirá el aviso.', [
        { text: 'No', style: 'cancel' }, { text: 'Sí, cancelar', style: 'destructive', onPress: ejecutar }
      ]);
    } else ejecutar();
  };

  // 📘 Registra el cobro (POST /appointments/:id/charge): el pago pasa a PAGADO y el cliente recibe un aviso.
  const cobrar = async () => {
    setOcupado(cobrando.id);
    try {
      await api(`/appointments/${cobrando.id}/charge`, { method: 'POST', body: { metodo } });
      avisar('Cobro registrado. Le avisamos al cliente.');
      setCobrando(null);
      onCambio?.();
    } catch (e) {
      Alert.alert('No se pudo registrar el cobro', textoError(e));
    } finally {
      setOcupado(null);
      cargar();
    }
  };

  const borrar = (t) => Alert.alert('Borrar de mi agenda', 'El turno deja de aparecer en tu agenda. El local conserva el registro.', [
    { text: 'No', style: 'cancel' },
    {
      text: 'Borrar', style: 'destructive', onPress: async () => {
        try {
          await api(`/appointments/${t.id}/hide`, { method: 'POST' });
          avisar('Turno borrado de tu agenda');
          cargar();
        } catch (e) { Alert.alert('No se pudo borrar', textoError(e)); }
      }
    }
  ]);

  // Agrupar por fecha
  // (fuera de "Todos", los que esperan confirmación van primero, en su propio grupo)
  const grupos = [];
  const porConfirmar = filtro === 'Todos' ? [] : turnos.filter((t) => t.estado === 'PENDIENTE');
  if (porConfirmar.length) grupos.push({ fecha: 'PENDIENTES', titulo: `Esperando tu confirmación (${porConfirmar.length})`, items: porConfirmar });
  for (const t of turnos) {
    if (porConfirmar.includes(t)) continue;
    const g = grupos[grupos.length - 1];
    if (g && g.fecha === t.fecha) g.items.push(t); else grupos.push({ fecha: t.fecha, items: [t] });
  }
  const pendientes = turnos.filter((t) => t.estado === 'PENDIENTE').length;

  return (
    <View>
      <Titulo>Mi agenda</Titulo>
      <Pestanas opciones={['Próximos', 'Hoy', 'Todos']} activa={filtro} onCambiar={setFiltro} />
      {pendientes > 0 && !cargando && <Texto>Tenés {pendientes} turno{pendientes > 1 ? 's' : ''} para confirmar. Tocá "Confirmar" para avisarle al cliente.</Texto>}
      {pendientesOtrosDias > 0 && !cargando && (
        <Pressable onPress={() => setFiltro('Próximos')} accessibilityRole="button" style={[styles.opcion, { borderColor: colors.gold }]}>
          <Icono nombre="alert-circle-outline" color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opcionTitulo}>{pendientesOtrosDias} turno{pendientesOtrosDias > 1 ? 's' : ''} de otros días esperan tu confirmación</Text>
            <Text style={styles.opcionSub}>Tocá para verlos en Próximos</Text>
          </View>
          <Icono nombre="chevron-forward" color={colors.faint} />
        </Pressable>
      )}
      {cargando && !turnos.length && <Cargando />}
      {error && <ErrorCaja texto={error} onReintentar={cargar} />}
      {!cargando && !error && !turnos.length && (
        <Vacio icono="calendar-clear-outline" titulo={filtro === 'Hoy' ? 'Hoy no tenés turnos' : filtro === 'Próximos' ? 'No tenés turnos próximos' : 'No hay turnos'}
          texto={filtro === 'Todos' ? 'Si esperabas verlos, pedile al administrador que vincule tu cuenta con tu ficha de barbero.' : null} />
      )}
      {!error && grupos.map((g) => (
        <View key={g.fecha}>
          {(filtro !== 'Hoy' || g.titulo) && <Seccion titulo={g.titulo || (g.fecha === hoyNegocio() ? 'Hoy' : fechaCorta(g.fecha))} />}
          {g.items.map((t) => (
            <Ticket key={t.id} fecha={t.fecha} hora={t.hora} apagado={t.estado === 'CANCELADO' || t.estado === 'FINALIZADO'}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                <Avatar nombre={`${t.cliente?.nombre || ''} ${t.cliente?.apellido || ''}`} tam={34} foto={t.cliente?.avatar_url} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{`${t.cliente?.nombre || ''} ${t.cliente?.apellido || ''}`.trim() || 'Cliente sin nombre'}</Text>
                  {t.cliente?.telefono ? <Text style={styles.aviso}>Tel. {t.cliente.telefono}</Text> : null}
                </View>
              </View>
              <Text style={[styles.cardDescription, { marginTop: 6 }]}>{t.servicio?.nombre} · {t.servicio?.duracion} min{t.precio ? ` · $${Number(t.precio).toLocaleString('es-AR')}` : ''}</Text>
              <Estado estado={t.estado} />
              {t.pago && t.estado !== 'CANCELADO' && (
                <Text style={[styles.aviso, t.pago.estado === 'PAGADO' && { color: colors.ok }]}>
                  {t.pago.estado === 'PAGADO' ? `Pagado${t.pago.metodo ? ` (${t.pago.metodo.toLowerCase()})` : ''}`
                    : t.pago.informado_at ? (t.pago.metodo === 'TRANSFERENCIA' ? `El cliente avisó que transfirió${t.pago.comprobante ? ` · op. ${t.pago.comprobante}` : ''}` : `Paga en el local (${(t.pago.metodo || '').toLowerCase()})`)
                    : 'Pago pendiente'}
                </Text>
              )}
              <View style={styles.fila}>
                {(ACCIONES[t.estado] || []).map(([estado, texto, variante, icono]) => (
                  <Boton key={estado} titulo={texto} icono={icono} variante={variante} chico cargando={ocupado === t.id} onPress={() => cambiar(t, estado)} />
                ))}
                {t.estado !== 'CANCELADO' && t.pago?.estado === 'PENDIENTE' && (
                  <Boton titulo="Cobrar" icono="cash-outline" variante="secundario" chico onPress={() => { setMetodo(t.pago.metodo || 'EFECTIVO'); setCobrando(t); }} />
                )}
                {(t.estado === 'CANCELADO' || t.estado === 'FINALIZADO') && (
                  <Boton titulo="Borrar" icono="trash-outline" variante="fantasma" chico onPress={() => borrar(t)} />
                )}
              </View>
            </Ticket>
          ))}
        </View>
      ))}

      <Hoja visible={!!cobrando} titulo="Registrar cobro" onCerrar={() => setCobrando(null)}>
        {cobrando && (
          <View>
            <Texto>{`${cobrando.cliente?.nombre || ''} ${cobrando.cliente?.apellido || ''}`.trim()} · {cobrando.servicio?.nombre}</Texto>
            <Text style={[styles.price, { fontSize: 28, marginBottom: 14 }]}>${Number(cobrando.precio || 0).toLocaleString('es-AR')}</Text>
            {cobrando.pago?.informado_at && cobrando.pago.metodo === 'TRANSFERENCIA' && (
              <Texto>El cliente avisó que transfirió{cobrando.pago.comprobante ? ` (operación ${cobrando.pago.comprobante})` : ''}. Revisá que te haya llegado antes de confirmar.</Texto>
            )}
            <Text style={styles.label}>Método</Text>
            <View style={styles.subTabs}>
              {[['EFECTIVO', 'Efectivo'], ['TARJETA', 'Tarjeta'], ['TRANSFERENCIA', 'Transferencia'], ['OTRO', 'Otro']].map(([m, txt]) => <Chip key={m} texto={txt} activo={metodo === m} onPress={() => setMetodo(m)} />)}
            </View>
            <Boton titulo="Confirmar cobro" icono="checkmark" onPress={cobrar} cargando={ocupado === cobrando.id} style={{ marginTop: 8 }} />
          </View>
        )}
      </Hoja>
    </View>
  );
}

/** Ficha del barbero: especialidad, foto, horarios y reseñas recibidas. */
export function MiFicha({ recargarClave }) {
  const [ficha, setFicha] = useState(null);
  const [resenas, setResenas] = useState(null);
  const [error, setError] = useState(null);
  const [especialidad, setEspecialidad] = useState('');
  const [foto, setFoto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [f, r] = await Promise.all([api('/barbers/me'), api('/reviews')]);
      setFicha(f);
      setEspecialidad(f.barbero.especialidad || '');
      setFoto(f.barbero.foto_url || '');
      setResenas(r);
    } catch (e) {
      setError(textoError(e));
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, recargarClave]);

  const guardar = async () => {
    if (foto.trim() && !/^https?:\/\/\S+$/i.test(foto.trim())) return avisar('La foto debe ser un enlace que empiece con https://', 'error');
    setGuardando(true);
    try {
      await api('/barbers/me', { method: 'PUT', body: { especialidad: especialidad.trim() || null, foto_url: foto.trim() || null } });
      avisar('Ficha actualizada');
      cargar();
    } catch (e) {
      Alert.alert('No se pudo guardar', textoError(e));
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <View><Titulo>Mi ficha</Titulo><ErrorCaja texto={error} onReintentar={cargar} /></View>;
  if (!ficha) return <Cargando />;
  const nombre = `${ficha.barbero.nombre} ${ficha.barbero.apellido}`;

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar nombre={nombre} tam={84} foto={ficha.barbero.foto_url} />
        <Text style={[styles.sectionTitle, { marginTop: 10, marginBottom: 2 }]}>{nombre}</Text>
        {resenas?.promedio ? <Text style={styles.estrellas}>{resenas.promedio} ★ · {resenas.total} reseña{resenas.total > 1 ? 's' : ''}</Text> : <Texto>Todavía sin reseñas</Texto>}
      </View>

      <Seccion titulo="Mis datos" />
      <Campo etiqueta="Especialidad" value={especialidad} onChangeText={setEspecialidad} maxLength={120} placeholder="Ej.: degradés, barba" />
      <Text style={[styles.aviso, { marginBottom: 12, marginTop: -4 }]}>Tu foto la cambiás desde la pestaña Cuenta tocando tu imagen.</Text>
      <Boton titulo="Guardar" icono="save-outline" onPress={guardar} cargando={guardando} />

      <Seccion titulo="Mis horarios" />
      {ficha.horarios.length ? (
        <Tarjeta>
          {ficha.horarios.map((h) => (
            <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
              <Text style={styles.cardTitle}>{h.dia}</Text>
              <Text style={styles.cardDescription}>{horaCorta(h.hora_inicio)} a {horaCorta(h.hora_fin)}{h.activo ? '' : ' (pausada)'}</Text>
            </View>
          ))}
        </Tarjeta>
      ) : <Texto>Todavía no tenés horarios cargados. Los configura el administrador.</Texto>}

      <Seccion titulo="Reseñas recibidas" />
      {resenas?.resenas?.length ? resenas.resenas.map((r) => (
        <Tarjeta key={r.id}>
          <Text style={styles.estrellas}>{estrellas(r.calificacion)}</Text>
          <Text style={[styles.cardDescription, { marginTop: 4 }]}>{r.turno?.servicio?.nombre} · {r.turno ? fechaCorta(r.turno.fecha) : ''}</Text>
          {r.comentario ? <Text style={[styles.cardTitle, { fontWeight: '500', marginTop: 6 }]}>“{r.comentario}”</Text> : null}
        </Tarjeta>
      )) : <Vacio icono="star-outline" texto="Cuando un cliente califique un turno completado, aparece acá." />}
    </View>
  );
}
