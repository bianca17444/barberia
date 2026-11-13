/*
 * 📘 PARA LA DEFENSA — mobile/src/ui.js — componentes reutilizables (botones, campos, tarjetas, estados, avisos breves) y estilos.
 * Se usan en todas las pantallas: la app se ve igual en todos lados y no se repite código.
 * Accesibilidad: áreas de toque de al menos 44 px, nombres para el lector de pantalla y estados con ícono + texto (no solo color).
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paletas } from './paletas';

// Tema activo. tema.js lo cambia con aplicarTema() y la App se vuelve a dibujar.
export let colors = paletas.oscuro;
export let styles = crearEstilos(colors);

export function aplicarTema(paleta) {
  if (paleta === colors) return;
  colors = paleta;
  styles = crearEstilos(paleta);
}

// ---------- Avisos breves (toast) ----------
let oyente = null;
/** Muestra un aviso breve abajo de la pantalla. tipo: ok | error | info */
// 📘 Aviso breve abajo de la pantalla (ej. "Turno reservado"). Confirma una acción sin interrumpir.
export function avisar(texto, tipo = 'ok') { oyente?.({ texto, tipo, id: Date.now() }); }

export function Avisos() {
  const [aviso, setAviso] = useState(null);
  const opacidad = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    oyente = (a) => {
      setAviso(a);
      opacidad.setValue(0);
      Animated.sequence([
        Animated.timing(opacidad, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(opacidad, { toValue: 0, duration: 220, useNativeDriver: true })
      ]).start(({ finished }) => { if (finished) setAviso(null); });
    };
    return () => { oyente = null; };
  }, []);
  if (!aviso) return null;
  const icono = { ok: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' }[aviso.tipo];
  const color = { ok: colors.ok, error: colors.danger, info: colors.info }[aviso.tipo];
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity: opacidad }]} accessibilityLiveRegion="polite">
      <Icono nombre={icono} color={color} tam={20} />
      <Text style={styles.toastTexto}>{aviso.texto}</Text>
    </Animated.View>
  );
}

// ---------- Básicos ----------
export function Icono({ nombre, tam = 20, color }) {
  return <Ionicons name={nombre} size={tam} color={color || colors.text} />;
}

export function Titulo({ children, style }) {
  return <Text style={[styles.sectionTitle, style]} accessibilityRole="header">{children}</Text>;
}

export function Texto({ children, style }) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}

export function Etiqueta({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Encabezado de sección con acción opcional a la derecha. */
export function Seccion({ titulo, accion, onAccion }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo} accessibilityRole="header">{titulo}</Text>
      {accion ? <Pressable onPress={onAccion} hitSlop={8} accessibilityRole="button" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}><Text style={styles.seccionAccion}>{accion}</Text></Pressable> : null}
    </View>
  );
}

export function Boton({ titulo, onPress, variante = 'primario', deshabilitado = false, cargando = false, chico = false, icono, style, accessibilityLabel }) {
  const fondo = {
    primario: [styles.btn, styles.btnPrimario],
    secundario: [styles.btn, styles.btnSecundario],
    peligro: [styles.btn, styles.btnPeligro],
    claro: [styles.btn, styles.btnClaro],
    fantasma: [styles.btn, styles.btnFantasma]
  }[variante];
  const colorTexto = { primario: colors.sobreGold, claro: '#1F1F1F', secundario: colors.gold, peligro: colors.danger, fantasma: colors.muted }[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || titulo}
      onPress={onPress}
      disabled={deshabilitado || cargando}
      style={({ pressed }) => [...fondo, chico && styles.btnChico, (deshabilitado || cargando) && { opacity: 0.45 }, pressed && { opacity: 0.75 }, style]}
    >
      {cargando ? <ActivityIndicator color={colorTexto} /> : (
        <View style={styles.btnFila}>
          {icono ? <Icono nombre={icono} tam={chico ? 15 : 18} color={colorTexto} /> : null}
          <Text style={[styles.btnTexto, { color: colorTexto }, chico && { fontSize: 13 }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, error, ...props }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {etiqueta ? <Text style={styles.label}>{etiqueta}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        style={[styles.input, foco && { borderColor: colors.gold }, error && { borderColor: colors.danger }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        {...props}
      />
      {error ? <Text style={styles.campoError}>{error}</Text> : null}
    </View>
  );
}

export function Tarjeta({ children, style, onPress }) {
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Cargando({ texto }) {
  return (
    <View style={styles.centro}>
      <ActivityIndicator size="large" color={colors.gold} />
      {texto ? <Text style={[styles.description, { marginTop: 12 }]}>{texto}</Text> : null}
    </View>
  );
}

export function Vacio({ texto, titulo, icono = 'cut-outline', children }) {
  return (
    <View style={styles.vacio}>
      <View style={styles.vacioIcono}><Icono nombre={icono} tam={26} color={colors.gold} /></View>
      {titulo ? <Text style={styles.vacioTitulo}>{titulo}</Text> : null}
      {texto ? <Text style={[styles.description, { textAlign: 'center' }]}>{texto}</Text> : null}
      {children}
    </View>
  );
}

export function ErrorCaja({ texto, onReintentar }) {
  return (
    <View style={styles.errorContainer}>
      <View style={styles.btnFila}>
        <Icono nombre="cloud-offline-outline" color={colors.danger} />
        <Text style={styles.errorTitle}>No se pudo cargar</Text>
      </View>
      <Text style={styles.errorText}>{texto}</Text>
      {onReintentar ? <Boton titulo="Reintentar" icono="refresh" variante="secundario" chico onPress={onReintentar} style={{ alignSelf: 'flex-start' }} /> : null}
    </View>
  );
}

export function Chip({ texto, activo, onPress, deshabilitado, icono }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo, disabled: !!deshabilitado }}
      onPress={onPress}
      disabled={deshabilitado}
      style={[styles.chip, activo && styles.chipActivo, deshabilitado && { opacity: 0.4 }]}
    >
      {icono ? <Icono nombre={icono} tam={14} color={activo ? colors.sobreGold : colors.muted} /> : null}
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

const NOMBRE_ESTADO = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', CANCELADO: 'Cancelado', FINALIZADO: 'Completado', PAGADO: 'Pagado', INFORMADO: 'Pago informado' };
export const nombreEstado = (e) => NOMBRE_ESTADO[e] || e;

/** Estado de un turno o pago: ícono + palabra + color (nunca solo color: WCAG 1.4.1). */
// 📘 Estado de un turno o pago con ícono + palabra + color. Nunca solo color, por quienes no distinguen colores (WCAG 1.4.1).
export function Estado({ estado }) {
  const [color, fondo, icono] = {
    PENDIENTE: [colors.warning, colors.warningSuave, 'time-outline'],
    CONFIRMADO: [colors.ok, colors.okSuave, 'checkmark-circle'],
    PAGADO: [colors.ok, colors.okSuave, 'checkmark-circle'],
    INFORMADO: [colors.warning, colors.warningSuave, 'cash-outline'],
    CANCELADO: [colors.danger, colors.dangerSuave, 'close-circle'],
    FINALIZADO: [colors.info, colors.infoSuave, 'flag']
  }[estado] || [colors.gold, colors.goldSuave, 'ellipse-outline'];
  return (
    <View style={[styles.estado, { backgroundColor: fondo, borderColor: color }]} accessible accessibilityLabel={`Estado: ${nombreEstado(estado)}`}>
      <Icono nombre={icono} tam={15} color={color} />
      <Text style={[styles.estadoTexto, { color }]}>{nombreEstado(estado)}</Text>
    </View>
  );
}

/** Control segmentado. */
export function Pestanas({ opciones, activa, onCambiar }) {
  return (
    <View style={styles.segmentado}>
      {opciones.map((o) => (
        <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: o === activa }} onPress={() => onCambiar(o)} style={[styles.segmento, o === activa && styles.segmentoActivo]}>
          <Text style={[styles.segmentoTexto, o === activa && styles.segmentoTextoActivo]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Avatar({ nombre = '', tam = 44, activo, foto }) {
  const ini = nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  const [fallo, setFallo] = useState(false);
  if (foto && !fallo) {
    return (
      <Image
        source={{ uri: foto }}
        onError={() => setFallo(true)}
        accessibilityLabel={`Foto de ${nombre}`}
        style={[{ width: tam, height: tam, borderRadius: tam / 2, borderWidth: 2, borderColor: activo ? colors.gold : colors.border, backgroundColor: colors.surface2 }]}
      />
    );
  }
  return (
    <View style={[styles.avatar, { width: tam, height: tam, borderRadius: tam / 2 }, activo && { backgroundColor: colors.goldFill, borderColor: colors.gold }]}>
      <Text style={[styles.avatarTexto, { fontSize: tam * 0.36 }, activo && { color: colors.sobreGold }]}>{ini}</Text>
    </View>
  );
}

/** Fila seleccionable (servicio, opción). */
export function Seleccionable({ titulo, subtitulo, derecha, activo, onPress, icono }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      onPress={onPress}
      style={({ pressed }) => [styles.opcion, activo && styles.opcionActiva, pressed && { opacity: 0.85 }]}
    >
      {icono ? <View style={[styles.opcionIcono, activo && { backgroundColor: colors.goldFill }]}><Icono nombre={icono} tam={18} color={activo ? colors.sobreGold : colors.gold} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.opcionTitulo}>{titulo}</Text>
        {subtitulo ? <Text style={styles.opcionSub}>{subtitulo}</Text> : null}
      </View>
      {derecha ? <Text style={styles.opcionDerecha}>{derecha}</Text> : null}
      <Icono nombre={activo ? 'radio-button-on' : 'radio-button-off'} tam={20} color={activo ? colors.gold : colors.faint} />
    </Pressable>
  );
}

const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Turno como ticket con troquel: talón con la fecha + cuerpo con el detalle. */
export function Ticket({ fecha, hora, children, apagado }) {
  const [y, m, d] = String(fecha).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return (
    <View style={[styles.ticket, apagado && { opacity: 0.62 }]}>
      <View style={styles.ticketTalon}>
        <Text style={styles.ticketDow}>{DIAS_C[dow]}</Text>
        <Text style={styles.ticketDia}>{d}</Text>
        <Text style={styles.ticketMes}>{MESES_C[m - 1]}</Text>
        <Text style={styles.ticketHora}>{String(hora).slice(0, 5)}</Text>
      </View>
      <View style={styles.ticketTroquel}>
        <View style={[styles.ticketMuesca, { top: -9 }]} />
        <View style={styles.ticketLinea} />
        <View style={[styles.ticketMuesca, { bottom: -9 }]} />
      </View>
      <View style={styles.ticketCuerpo}>{children}</View>
    </View>
  );
}

/** Hoja que sube desde abajo, para formularios y detalles. */
export function Hoja({ visible, titulo, onCerrar, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.hojaFondo}>
        <Pressable style={{ flex: 1 }} onPress={onCerrar} accessibilityLabel="Cerrar" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.hoja}>
          <View style={styles.hojaAsa} />
          <View style={styles.hojaEncabezado}>
            <Text style={styles.hojaTitulo}>{titulo}</Text>
            <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Icono nombre="close" tam={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Elección de hora tocando (franjas de 30 min). */
export function SelectorHora({ valor, onCambiar, desde = 7, hasta = 22 }) {
  const horas = [];
  for (let h = desde; h <= hasta; h++) for (const m of ['00', '30']) horas.push(`${String(h).padStart(2, '0')}:${m}`);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
      {horas.map((h) => <Chip key={h} texto={h} activo={valor === h} onPress={() => onCambiar(h)} />)}
    </ScrollView>
  );
}

/** Botón de favorito (corazón). Área táctil de 44 px, nombre accesible y una animación corta al tocar. */
export function Corazon({ activo, onPress, nombre, tam = 22 }) {
  const escala = useRef(new Animated.Value(1)).current;
  const tocar = () => {
    Animated.sequence([
      Animated.timing(escala, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.timing(escala, { toValue: 1, duration: 140, useNativeDriver: true })
    ]).start();
    onPress?.();
  };
  return (
    <Pressable
      onPress={tocar}
      hitSlop={6}
      style={styles.corazon}
      accessibilityRole="button"
      accessibilityLabel={activo ? `Quitar ${nombre} de favoritos` : `Agregar ${nombre} a favoritos`}
      accessibilityState={{ selected: !!activo }}
    >
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Icono nombre={activo ? 'heart' : 'heart-outline'} tam={tam} color={activo ? colors.danger : colors.muted} />
      </Animated.View>
    </Pressable>
  );
}

/** Interruptor simple Sí/No. */
export function Interruptor({ etiqueta, valor, onCambiar }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: !!valor }} onPress={() => onCambiar(!valor)} style={styles.interruptorFila}>
      <Text style={styles.opcionTitulo}>{etiqueta}</Text>
      <View style={[styles.interruptor, valor && { backgroundColor: colors.goldFill, borderColor: colors.gold }]}>
        <View style={[styles.interruptorBola, valor && { transform: [{ translateX: 18 }] }]} />
      </View>
    </Pressable>
  );
}

/**
 * Niveles de elevación (Spatial UI funcional): 0 fondo · 1 tarjetas · 2 destacado/selección · 3 hojas, modales y avisos.
 * En modo oscuro la profundidad la marcan sobre todo las superficies más claras; la sombra acompaña.
 */
export function elevacion(c, nivel) {
  const n = [null, { r: 6, y: 2, e: 2, o: 0.5 }, { r: 12, y: 6, e: 6, o: 0.8 }, { r: 20, y: 10, e: 14, o: 1 }][nivel];
  if (!n) return {};
  return { shadowColor: c.sombra, shadowOffset: { width: 0, height: n.y }, shadowOpacity: c.sombraOpacidad * n.o, shadowRadius: n.r, elevation: n.e };
}

export function crearEstilos(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
    header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, marginTop: 8 },
    brand: { color: c.text, fontSize: 21, fontWeight: '800', letterSpacing: 0.5 },
    brandSub: { color: c.gold, fontSize: 13, fontWeight: '600' },
    iconoBoton: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
    hero: { color: c.text, fontSize: 36, fontWeight: '800', lineHeight: 42, marginBottom: 14 },
    saludo: { color: c.text, fontSize: 28, fontWeight: '800', marginBottom: 4 },
    description: { color: c.muted, fontSize: 15, lineHeight: 22, marginBottom: 12 },
    sectionTitle: { color: c.text, fontSize: 24, fontWeight: '800', marginBottom: 14, marginTop: 4 },
    seccion: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 22 },
    seccionTitulo: { color: c.text, fontSize: 18, fontWeight: '700' },
    seccionAccion: { color: c.gold, fontSize: 14, fontWeight: '600' },
    label: { color: c.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    btn: { alignItems: 'center', borderRadius: 14, justifyContent: 'center', marginBottom: 10, minHeight: 52, paddingHorizontal: 18, paddingVertical: 13 },
    btnChico: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 0, borderRadius: 12 },
    btnPrimario: { backgroundColor: c.goldFill, borderColor: c.gold, borderWidth: c.modo === 'claro' ? 1 : 0, ...elevacion(c, 1) },
    btnSecundario: { borderColor: c.gold, borderWidth: 1.5 },
    btnPeligro: { borderColor: c.danger, borderWidth: 1.5 },
    btnClaro: { backgroundColor: '#FFFFFF', borderColor: '#DADCE0', borderWidth: 1 },
    btnFantasma: { backgroundColor: c.surface2 },
    btnFila: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    btnTexto: { fontSize: 16, fontWeight: '700' },
    card: { backgroundColor: c.surface, borderColor: c.border, borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 16, ...elevacion(c, 1) },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    cardDescription: { color: c.muted, fontSize: 14, lineHeight: 20 },
    price: { color: c.gold, fontSize: 16, fontWeight: '800' },
    fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    centro: { alignItems: 'center', paddingVertical: 48 },
    vacio: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.border, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, marginBottom: 12, paddingHorizontal: 20, paddingVertical: 24 },
    vacioIcono: { alignItems: 'center', backgroundColor: c.goldSuave, borderRadius: 26, height: 52, justifyContent: 'center', marginBottom: 10, width: 52 },
    vacioTitulo: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
    input: { backgroundColor: c.input, borderColor: c.borderInput, borderRadius: 12, borderWidth: 1.5, color: c.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
    campoError: { color: c.danger, fontSize: 13, marginTop: 4 },
    chip: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.borderInput, borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 6, marginBottom: 8, marginRight: 8, minHeight: 44, paddingHorizontal: 14, paddingVertical: 9 },
    chipActivo: { backgroundColor: c.goldFill, borderColor: c.gold },
    chipTexto: { color: c.text, fontSize: 14, fontWeight: '600' },
    chipTextoActivo: { color: c.sobreGold, fontWeight: '800' },
    subTabs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
    segmentado: { backgroundColor: c.surface2, borderRadius: 12, flexDirection: 'row', marginBottom: 16, padding: 4 },
    segmento: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 44, paddingVertical: 9 },
    segmentoActivo: { backgroundColor: c.modo === 'oscuro' ? c.surface3 : c.surface, ...elevacion(c, 1) },
    segmentoTexto: { color: c.muted, fontSize: 14, fontWeight: '600' },
    segmentoTextoActivo: { color: c.text, fontWeight: '800' },
    estado: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 5, marginTop: 8, paddingHorizontal: 10, paddingVertical: 4 },
    estadoPunto: { borderRadius: 4, height: 7, width: 7 },
    estadoTexto: { fontSize: 13, fontWeight: '700' },
    avatar: { alignItems: 'center', backgroundColor: c.surface2, borderColor: c.border, borderWidth: 1.5, justifyContent: 'center' },
    avatarTexto: { color: c.gold, fontWeight: '800' },
    opcion: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.border, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 12, marginBottom: 10, minHeight: 56, padding: 14, ...elevacion(c, 1) },
    opcionActiva: { backgroundColor: c.goldSuave, borderColor: c.gold },
    opcionIcono: { alignItems: 'center', backgroundColor: c.goldSuave, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
    opcionTitulo: { color: c.text, fontSize: 16, fontWeight: '700' },
    opcionSub: { color: c.muted, fontSize: 13, marginTop: 2 },
    opcionDerecha: { color: c.gold, fontSize: 15, fontWeight: '800' },
    ticket: { backgroundColor: c.surface, borderColor: c.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 12, overflow: 'visible', ...elevacion(c, 1) },
    ticketTalon: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 14, width: 78 },
    ticketDow: { color: c.muted, fontSize: 12, fontWeight: '600' },
    ticketDia: { color: c.text, fontSize: 30, fontWeight: '800', lineHeight: 34 },
    ticketMes: { color: c.muted, fontSize: 12, fontWeight: '600' },
    ticketHora: { backgroundColor: c.goldSuave, borderRadius: 8, color: c.gold, fontSize: 14, fontWeight: '800', marginTop: 8, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
    ticketTroquel: { alignItems: 'center', width: 14 },
    ticketMuesca: { backgroundColor: c.bg, borderColor: c.border, borderRadius: 9, borderWidth: 1, height: 18, position: 'absolute', width: 18 },
    ticketLinea: { borderColor: c.border, borderLeftWidth: 1.5, borderStyle: 'dashed', flex: 1, marginVertical: 12 },
    ticketCuerpo: { flex: 1, paddingLeft: 8, paddingRight: 14, paddingVertical: 14 },
    tabBar: { ...elevacion(c, 2), backgroundColor: c.tabBar, borderTopColor: c.border, borderTopWidth: 1, bottom: 0, flexDirection: 'row', left: 0, paddingBottom: Platform.OS === 'ios' ? 26 : 10, paddingTop: 8, position: 'absolute', right: 0 },
    tab: { alignItems: 'center', flex: 1, gap: 2, justifyContent: 'center', minHeight: 48, paddingVertical: 2 },
    tabText: { color: c.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    tabActive: { color: c.gold, fontWeight: '800' },
    tabBadge: { backgroundColor: c.danger, borderRadius: 8, minWidth: 16, paddingHorizontal: 4, position: 'absolute', right: -10, top: -4 },
    tabBadgeTexto: { color: c.modo === 'oscuro' ? '#111111' : '#FFFFFF', fontSize: 11, fontWeight: '800', textAlign: 'center' },
    panel: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, bottom: 0, left: 0, maxHeight: '94%', position: 'absolute', right: 0, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    link: { color: c.gold, fontWeight: '600', padding: 10, textAlign: 'center' },
    close: { color: c.muted, padding: 8, textAlign: 'center' },
    errorContainer: { backgroundColor: c.errorBg, borderColor: c.danger, borderRadius: 12, borderWidth: 1, marginBottom: 16, padding: 16 },
    errorTitle: { color: c.danger, fontSize: 16, fontWeight: '700' },
    errorText: { color: c.text, fontSize: 14, lineHeight: 20, marginBottom: 10, marginTop: 6 },
    aviso: { color: c.faint, fontSize: 13, lineHeight: 18, marginTop: 6 },
    estrellas: { color: c.gold, fontSize: 18, letterSpacing: 2 },
    separador: { backgroundColor: c.border, height: 1, marginVertical: 18 },
    toast: { alignItems: 'center', alignSelf: 'center', backgroundColor: c.surface3, borderColor: c.border, borderRadius: 14, borderWidth: 1, bottom: 96, flexDirection: 'row', gap: 10, left: 20, paddingHorizontal: 16, paddingVertical: 12, position: 'absolute', right: 20, ...elevacion(c, 3) },
    toastTexto: { color: c.text, flex: 1, fontSize: 15, fontWeight: '600' },
    hojaFondo: { backgroundColor: c.modo === 'oscuro' ? 'rgba(0,0,0,0.65)' : 'rgba(22,20,18,0.45)', flex: 1 },
    hoja: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', ...elevacion(c, 3) },
    hojaAsa: { alignSelf: 'center', backgroundColor: c.border, borderRadius: 3, height: 5, marginTop: 10, width: 44 },
    hojaEncabezado: { alignItems: 'center', borderBottomColor: c.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
    hojaTitulo: { color: c.text, fontSize: 19, fontWeight: '800' },
    pasos: { flexDirection: 'row', gap: 6, marginBottom: 18 },
    paso: { backgroundColor: c.surface2, borderRadius: 3, flex: 1, height: 5 },
    pasoHecho: { backgroundColor: c.goldFill },
    dia: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.border, borderRadius: 14, borderWidth: 1.5, marginRight: 8, paddingVertical: 10, width: 58 },
    diaActivo: { backgroundColor: c.goldFill, borderColor: c.gold, ...elevacion(c, 2) },
    diaDow: { color: c.muted, fontSize: 12, fontWeight: '600' },
    diaNum: { color: c.text, fontSize: 22, fontWeight: '800' },
    diaMes: { color: c.muted, fontSize: 12 },
    horaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    hora: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.borderInput, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', minHeight: 46, paddingVertical: 10, width: '22.5%' },
    horaActiva: { backgroundColor: c.goldFill, borderColor: c.gold, ...elevacion(c, 2) },
    horaTexto: { color: c.text, fontSize: 15, fontWeight: '700' },
    resumen: { backgroundColor: c.surface, borderColor: c.gold, borderRadius: 16, borderWidth: 1.5, marginTop: 16, padding: 16 },
    resumenFila: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 8 },
    resumenTexto: { color: c.text, flex: 1, fontSize: 15 },
    accesos: { flexDirection: 'row', gap: 10, marginBottom: 6 },
    acceso: { alignItems: 'flex-start', backgroundColor: c.surface, borderColor: c.border, borderRadius: 16, borderWidth: 1, flex: 1, gap: 8, minHeight: 72, padding: 14, ...elevacion(c, 1) },
    accesoTexto: { color: c.text, fontSize: 14, fontWeight: '700' },
    destacado: { backgroundColor: c.goldFill, borderRadius: 20, marginBottom: 6, padding: 18, ...elevacion(c, 2) },
    destacadoTitulo: { color: c.sobreGold, fontSize: 20, fontWeight: '800', marginBottom: 2 },
    destacadoTexto: { color: c.sobreGold, fontSize: 15, opacity: 0.9 },
    interruptorFila: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    corazon: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
    interruptor: { backgroundColor: c.surface2, borderColor: c.borderInput, borderRadius: 16, borderWidth: 1.5, height: 30, padding: 2, width: 52 },
    interruptorBola: { backgroundColor: c.modo === 'oscuro' ? '#F2EFEA' : '#FFFFFF', borderColor: c.borderInput, borderRadius: 11, borderWidth: 1, height: 22, width: 22 },
    stat: { backgroundColor: c.surface, borderColor: c.border, borderRadius: 16, borderWidth: 1, flex: 1, padding: 14, ...elevacion(c, 1) },
    statNumero: { color: c.text, fontSize: 26, fontWeight: '800' },
    statTexto: { color: c.muted, fontSize: 13 },
    burbuja: { borderRadius: 16, marginBottom: 10, maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10 },
    burbujaIA: { alignSelf: 'flex-start', backgroundColor: c.surface, borderBottomLeftRadius: 4, borderColor: c.border, borderWidth: 1 },
    burbujaYo: { alignSelf: 'flex-end', backgroundColor: c.goldFill, borderBottomRightRadius: 4 },
    burbujaIcono: { marginBottom: 4 },
    burbujaTexto: { color: c.text, fontSize: 15, lineHeight: 21 },
    chatEntrada: { alignItems: 'flex-end', backgroundColor: c.surface, borderColor: c.border, borderRadius: 24, borderWidth: 1.5, flexDirection: 'row', gap: 8, marginTop: 10, padding: 6 },
    chatInput: { color: c.text, flex: 1, fontSize: 16, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 8 },
    chatEnviar: { alignItems: 'center', backgroundColor: c.goldFill, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 }
  });
}
