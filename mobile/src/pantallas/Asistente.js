/*
 * 📘 PARA LA DEFENSA — pantallas/Asistente.js — chat del cliente con el asistente.
 *   - El saludo con el próximo turno se arma en el teléfono (no gasta IA).
 *   - Cada mensaje va a la función "asistente" de Supabase (api.js → preguntarAsistente), que responde con datos reales.
 *   - Si el asistente PROPONE reservar o cancelar, aparece una tarjeta para confirmar. Recién cuando el cliente toca
 *     "Confirmar", la app lo hace con la API normal (con las mismas reglas de siempre).
 *   - Diseño: la caja de texto queda fija abajo, arriba del teclado, y los mensajes se desplazan.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, preguntarAsistente, textoError } from '../api';
import { Boton, Chip, Icono, Titulo, avisar, colors, styles } from '../ui';
import { fechaCorta, horaCorta } from '../tiempo';

const SUGERENCIAS = ['Quiero reservar un turno', '¿Hay lugar mañana a la tarde?', '¿Cuándo es mi próximo turno?', 'Quiero cancelar un turno', '¿Qué servicios tienen y cuánto salen?'];
const MAX_GUARDADOS = 30;

/** Saludo armado en el teléfono (sin gastar IA) con el recordatorio del próximo turno. */
function saludo(nombre, t) {
  const hola = `¡Hola${nombre ? `, ${nombre}` : ''}! Soy el asistente de BELABARBERÍA.`;
  if (!t) return `${hola} No tenés turnos próximos. ¿Querés que te ayude a elegir servicio u horario?`;
  const quien = t.barbero?.nombre ? ` con ${t.barbero.nombre} ${t.barbero.apellido || ''}`.trimEnd() : '';
  const estado = t.estado === 'CONFIRMADO' ? 'ya está confirmado' : 'está esperando la confirmación del barbero';
  return `${hola} Te recuerdo tu próximo turno: ${fechaCorta(t.fecha)} a las ${horaCorta(t.hora)} hs, ${t.servicio?.nombre || 'servicio'}${quien}. Tu turno ${estado}. ¿En qué te ayudo?`;
}

/**
 * Chat con el asistente. Ocupa toda la pantalla: los mensajes se desplazan arriba y la caja
 * para escribir queda fija abajo, justo encima del teclado (App.js lo envuelve en un
 * KeyboardAvoidingView). `espacioInferior` deja lugar para la barra de pestañas cuando el
 * teclado está cerrado.
 */
export function Asistente({ session, recargarClave, espacioInferior = 0, tecladoVisible = false }) {
  const clave = `belabarberia:chat:${session.user.id}`;
  const [mensajes, setMensajes] = useState(null);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState(null);
  const enviando = useRef(false);
  const lista = useRef(null);
  const alFinal = useCallback((animado = true) => setTimeout(() => lista.current?.scrollToEnd?.({ animated: animado }), 60), []);

  // Al abrir el teclado, se muestra el último mensaje (si no, quedaría tapado)
  useEffect(() => { if (tecladoVisible) alFinal(); }, [tecladoVisible, alFinal]);

  const iniciar = useCallback(async (forzarNueva = false) => {
    let previos = [];
    if (!forzarNueva) {
      try { previos = JSON.parse((await AsyncStorage.getItem(clave)) || '[]'); } catch { previos = []; }
    }
    let home = null;
    try { home = await api('/home'); } catch { /* sin conexión: saludo sin turno */ }
    const inicial = { rol: 'asistente', texto: saludo(home?.usuario?.nombre, home?.proximoTurno), local: true };
    // El saludo siempre se actualiza con el turno vigente
    setMensajes([inicial, ...previos.filter((m) => !m.local)]);
  }, [clave]);

  useEffect(() => { iniciar(); }, [iniciar, recargarClave]);

  useEffect(() => {
    if (!mensajes) return;
    const guardar = mensajes.filter((m) => !m.local).slice(-MAX_GUARDADOS);
    AsyncStorage.setItem(clave, JSON.stringify(guardar)).catch(() => {});
    alFinal();
  }, [mensajes]);

  // 📘 Manda la conversación al servidor y muestra la respuesta (y la propuesta de acción, si hay).
  const enviar = async (contenido) => {
    const t = (contenido ?? texto).trim();
    if (!t || enviando.current) return;
    if (t.length > 1000) { setError('El mensaje puede tener hasta 1000 caracteres.'); return; }
    Keyboard.dismiss(); // al enviar baja el teclado y se ve la respuesta
    enviando.current = true;
    setError(null);
    setTexto('');
    const nuevos = [...mensajes, { rol: 'usuario', texto: t }];
    setMensajes(nuevos);
    setPensando(true);
    try {
      // A la IA van los mensajes reales (el saludo local no hace falta: ella ve los turnos)
      const historial = nuevos.filter((m) => !m.local).slice(-20).map(({ rol, texto: tx }) => ({ rol, texto: tx }));
      const { respuesta, accion } = await preguntarAsistente(historial);
      setMensajes((m) => [...m, { rol: 'asistente', texto: respuesta, accion: accion || undefined }]);
    } catch (e) {
      setError(textoError(e));
      setMensajes((m) => m.slice(0, -1));
      setTexto(t);
    } finally {
      setPensando(false);
      enviando.current = false;
    }
  };

  /** El cliente confirma (o descarta) lo que propuso el asistente. Se hace con la API normal y su sesión. */
  const [ejecutando, setEjecutando] = useState(null);
  // 📘 El cliente confirma o descarta lo que propuso el asistente. Si confirma, se usa la API normal con su sesión.
  const resolverAccion = async (indice, confirmar) => {
    const m = mensajes[indice];
    if (!m?.accion || m.accionEstado) return;
    const marcar = (estado, extra) => setMensajes((lista) => [...lista.slice(0, indice), { ...lista[indice], accionEstado: estado }, ...lista.slice(indice + 1), ...(extra ? [extra] : [])]);
    if (!confirmar) return marcar('descartada', { rol: 'asistente', texto: 'Listo, no hice ningún cambio. ¿Te ayudo con otra cosa?' });
    setEjecutando(indice);
    try {
      const a = m.accion;
      if (a.tipo === 'RESERVAR') {
        await api('/appointments', { method: 'POST', body: { servicio_id: a.servicio_id, barbero_id: a.barbero_id, fecha: a.fecha, hora: a.hora } });
        marcar('hecha', { rol: 'asistente', texto: `¡Listo! ${a.resumen.replace(/^Reservar/, 'Reservé')} Queda pendiente hasta que el barbero lo confirme; te aviso cuando pase. Lo ves en "Mis turnos".` });
        avisar('Turno reservado');
      } else if (a.tipo === 'CANCELAR') {
        await api(`/appointments/${a.turno_id}`, { method: 'DELETE' });
        marcar('hecha', { rol: 'asistente', texto: `Listo, cancelé el turno. ${a.resumen.replace(/^Cancelar tu turno/, 'Era el turno')} El horario quedó libre.` });
        avisar('Turno cancelado');
      }
    } catch (e) {
      marcar('error', { rol: 'asistente', texto: `No se pudo hacer: ${textoError(e)}` });
    } finally {
      setEjecutando(null);
    }
  };

  const nueva = async () => {
    await AsyncStorage.removeItem(clave).catch(() => {});
    setError(null);
    iniciar(true);
  };

  if (!mensajes) return <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />;
  const soloSaludo = mensajes.length === 1;
  const puedeEnviar = Boolean(texto.trim()) && !pensando;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={lista}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
      <Pressable onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.seccion, { marginTop: 0 }]}>
        <Titulo style={{ marginBottom: 0 }}>Asistente</Titulo>
        {!soloSaludo && <Pressable onPress={nueva} hitSlop={8} accessibilityRole="button" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}><Text style={styles.seccionAccion}>Nueva conversación</Text></Pressable>}
      </View>
      <Text style={[styles.aviso, { marginBottom: 14, marginTop: 0 }]}>Puede reservar o cancelar tus turnos y decirte qué horarios hay libres, con los datos reales de la barbería. Antes de hacer un cambio siempre te pide que lo confirmes.</Text>

      {mensajes.map((m, i) => (
        <View key={i}>
          <View style={[styles.burbuja, m.rol === 'usuario' ? styles.burbujaYo : styles.burbujaIA]}>
            {m.rol === 'asistente' && <View style={styles.burbujaIcono}><Icono nombre="sparkles" tam={14} color={colors.gold} /></View>}
            <Text style={[styles.burbujaTexto, m.rol === 'usuario' && { color: colors.sobreGold }]} selectable>{m.texto}</Text>
          </View>
          {m.accion && (
            <View style={[styles.card, { borderColor: colors.gold, marginRight: 24 }]} accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Icono nombre={m.accion.tipo === 'RESERVAR' ? 'calendar' : 'close-circle-outline'} color={colors.gold} />
                <Text style={[styles.cardTitle, { flex: 1 }]}>{m.accion.resumen}</Text>
              </View>
              {!m.accionEstado ? (
                <View style={[styles.btnFila, { marginTop: 10 }]}>
                  <Boton
                    titulo={m.accion.tipo === 'RESERVAR' ? 'Confirmar reserva' : 'Sí, cancelar turno'}
                    icono="checkmark" chico cargando={ejecutando === i} deshabilitado={ejecutando !== null}
                    variante={m.accion.tipo === 'CANCELAR' ? 'peligro' : 'primario'}
                    onPress={() => resolverAccion(i, true)} style={{ flex: 1, marginBottom: 0 }}
                  />
                  <Boton titulo="No" chico variante="fantasma" deshabilitado={ejecutando !== null} onPress={() => resolverAccion(i, false)} style={{ marginBottom: 0 }} />
                </View>
              ) : (
                <Text style={[styles.aviso, { color: m.accionEstado === 'hecha' ? colors.ok : colors.muted }]}>
                  {{ hecha: '✓ Hecho', descartada: 'Descartado', error: 'No se pudo hacer' }[m.accionEstado]}
                </Text>
              )}
            </View>
          )}
        </View>
      ))}

      {pensando && (
        <View style={[styles.burbuja, styles.burbujaIA, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={styles.cardDescription}>Escribiendo…</Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorContainer, { padding: 12 }]}>
          <Text style={[styles.errorText, { marginBottom: 0, marginTop: 0 }]}>{error}</Text>
        </View>
      )}

      {soloSaludo && !pensando && (
        <View style={[styles.subTabs, { marginTop: 6 }]}>
          {SUGERENCIAS.map((s) => <Chip key={s} texto={s} onPress={() => enviar(s)} />)}
        </View>
      )}
      </Pressable>
      </ScrollView>

      {/* Caja para escribir: fija abajo, siempre visible encima del teclado */}
      <View style={{ backgroundColor: colors.bg, paddingBottom: (tecladoVisible ? 8 : espacioInferior + 8), paddingHorizontal: 20, paddingTop: 4 }}>
        <View style={[styles.chatEntrada, { marginTop: 0 }]}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribí tu pregunta"
            placeholderTextColor={colors.faint}
            style={styles.chatInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            enterKeyHint="send"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => enviar()}
            onFocus={() => alFinal()}
            accessibilityLabel="Mensaje para el asistente"
            accessibilityHint="La tecla Enviar del teclado manda el mensaje"
          />
          <Pressable
            onPress={() => enviar()}
            disabled={!puedeEnviar}
            hitSlop={6}
            style={[styles.chatEnviar, !puedeEnviar && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !puedeEnviar }}
          >
            <Icono nombre="arrow-up" tam={22} color={colors.sobreGold} />
          </Pressable>
        </View>
        {tecladoVisible && (
          <Pressable onPress={Keyboard.dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ocultar el teclado" style={{ alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 4, minHeight: 32, paddingHorizontal: 12 }}>
            <Icono nombre="chevron-down" tam={16} color={colors.muted} />
            <Text style={[styles.aviso, { marginTop: 0 }]}>Ocultar teclado</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
