/*
 * 📘 PARA LA DEFENSA — mobile/App.js — el "esqueleto" de la app.
 * Qué hace:
 *   1. Recupera la sesión guardada en el teléfono (si ya habías iniciado sesión, entrás directo).
 *   2. Pide el perfil a la API (/auth/me) para saber el ROL y muestra las pestañas de ese rol.
 *   3. Escucha los cambios de sesión (iniciar, cerrar, token renovado, recuperar contraseña).
 *   4. Maneja el ingreso con Google, el bloqueo con Face ID / huella, las notificaciones y el teclado.
 *   5. Dibuja el encabezado, el contenido de la pestaña elegida y la barra de pestañas de abajo.
 *
 * Conceptos de React que te pueden preguntar:
 *   - Componente: una función que devuelve lo que se dibuja, escrito en JSX (parecido a HTML). Ej.: App, Principal.
 *   - useState: la "memoria" del componente. Cuando cambia un estado, la pantalla se vuelve a dibujar.
 *   - useEffect: código que se ejecuta cuando algo cambia (al abrir la app, al iniciar sesión, etc.).
 *   - props: datos que un componente le pasa a otro. Ej.: <MisTurnos recargarClave={...} />
 *   - Context: compartir datos con toda la app sin pasarlos uno por uno (lo usa el tema claro/oscuro).
 * React Native convierte estos componentes en pantallas nativas de Android y de iPhone. Expo agrega herramientas listas
 * (notificaciones, cámara, Face ID, navegador para Google) y permite probar la app con Expo Go.
 */
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar as RNStatusBar, Text, View } from 'react-native';
import { supabase, redirectUrl, mensajeError, hostEsIP, enExpoGo } from './src/supabase';
import { api } from './src/api';
import { TemaProvider, useTema } from './src/tema';
import { registrarPush, desregistrarPush, alRecibir } from './src/notificaciones';
import { Avisos, Boton, Cargando, Icono, Texto, Vacio, avisar, colors } from './src/ui';
import { PanelAuth } from './src/pantallas/Auth';
import { Inicio, MisTurnos, Reservar, useCatalogo } from './src/pantallas/Cliente';
import { Perfil } from './src/pantallas/Cuenta';
import { AgendaBarbero, MiFicha } from './src/pantallas/Barbero';
import { PanelAdmin, SolicitudesBarbero } from './src/pantallas/Admin';
import { Asistente } from './src/pantallas/Asistente';
import { CentroAvisos } from './src/pantallas/Avisos';
import { autenticar, biometriaDisponible, bloqueoActivado } from './src/biometria';
import { useFavoritos } from './src/favoritos';

WebBrowser.maybeCompleteAuthSession();

// Pestañas según el rol (los permisos reales los aplican la API y la base de datos)
// 📘 Qué pestañas ve cada rol. OJO: esconder una pestaña NO es la seguridad.
//    Los permisos reales los controlan la API (requireRole) y la base (RLS): si un cliente llamara a una ruta de admin, recibiría 403.
const TABS_POR_ROL = {
  USUARIO: ['Inicio', 'Reservar', 'Asistente', 'Mis turnos', 'Perfil'],
  BARBERO: ['Inicio', 'Agenda', 'Mi ficha', 'Perfil'],
  ADMIN: ['Inicio', 'Admin', 'Perfil']
};

// Ícono [activo, inactivo] de cada pestaña
const ICONOS_TAB = {
  Inicio: ['home', 'home-outline'],
  Reservar: ['add-circle', 'add-circle-outline'],
  'Mis turnos': ['receipt', 'receipt-outline'],
  Asistente: ['chatbubbles', 'chatbubbles-outline'],
  Agenda: ['calendar', 'calendar-outline'],
  'Mi ficha': ['id-card', 'id-card-outline'],
  Admin: ['briefcase', 'briefcase-outline'],
  Perfil: ['person', 'person-outline']
};

/** Extrae ?code=... o el error de una URL de retorno de Supabase. */
// 📘 Lee el "code" que manda Supabase al volver de Google o de un enlace del email.
function leerRetorno(url) {
  const { queryParams } = Linking.parse(url);
  return {
    code: typeof queryParams?.code === 'string' ? queryParams.code : null,
    error: queryParams?.error_description || queryParams?.error || null
  };
}

// 📘 Componente raíz: envuelve todo con TemaProvider para que cualquier pantalla sepa si el tema es claro u oscuro.
export default function App() {
  return (
    <TemaProvider>
      <Principal />
    </TemaProvider>
  );
}

// 📘 Principal: guarda el estado general (sesión, perfil, pestaña actual, avisos sin leer, teclado) y decide qué mostrar.
function Principal() {
  const { styles, modo } = useTema();
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [tab, setTab] = useState('Inicio');
  const [authModo, setAuthModo] = useState(null); // null | login | registro | recuperar | nueva
  const [rolElegido, setRolElegido] = useState('USUARIO'); // con qué rol quiere entrar
  const [recargarTurnos, setRecargarTurnos] = useState(0);
  const [reservaPrevia, setReservaPrevia] = useState(null); // "Reservar de nuevo" desde Mis turnos
  const [tabAnterior, setTabAnterior] = useState('Inicio'); // a dónde vuelve el centro de avisos
  const [turnoInicial, setTurnoInicial] = useState(null); // turno a abrir al venir de un aviso
  const [bloqueada, setBloqueada] = useState(false); // bloqueo con Face ID / huella
  const perfilRef = useRef(null);
  const enSegundoPlano = useRef(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const oauthEnCurso = useRef(false);
  const scrollRef = useRef(null);
  const [tecladoVisible, setTecladoVisible] = useState(false);
  // Cuánto tapa la barra de pestañas la parte de abajo del contenido (se mide en pantalla)
  const [finContenido, setFinContenido] = useState(null);
  const [inicioTabBar, setInicioTabBar] = useState(null);
  const tapaTabBar = finContenido != null && inicioTabBar != null ? Math.max(0, finContenido - inicioTabBar) : (Platform.OS === 'ios' ? 60 : 68);

  // Mientras el teclado está abierto se oculta la barra de pestañas (si no, tapa lo que se escribe)
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTecladoVisible(true));
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTecladoVisible(false));
    return () => { mostrar.remove(); ocultar.remove(); };
  }, []);

  const catalogo = useCatalogo(session, recargarTurnos);
  const rol = session ? perfil?.rol || 'USUARIO' : null;
  const favoritos = useFavoritos(session, perfil?.rol);
  const tabs = rol ? TABS_POR_ROL[rol] : ['Inicio'];

  // 📘 Pide a la API los datos de la persona logueada, incluido el rol. Con eso la app sabe qué pestañas mostrar.
  const cargarPerfil = useCallback(async (user) => {
    if (!user) { setPerfil(null); return; }
    try {
      const r = await api('/auth/me');
      setPerfil(r.usuario);
    } catch (e) {
      console.warn('No se pudo cargar el perfil:', e.message);
      setPerfil(null);
    }
  }, []);

  // Contador de avisos sin leer (se refresca al cambiar de pestaña)
  const actualizarNoLeidas = useCallback(async () => {
    try {
      const r = await api('/notifications');
      setNoLeidas(r.noLeidas);
      if (perfilRef.current?.rol === 'USUARIO' && r.notificaciones?.some((n) => !n.leida && n.tipo === 'BARBERO_APROBADO')) {
        const { data } = await supabase.auth.getSession();
        cargarPerfil(data.session?.user);
      }
    } catch { /* sin conexión: se reintenta en el próximo cambio */ }
  }, []);

  useEffect(() => { if (session) actualizarNoLeidas(); }, [session?.user?.id, tab, recargarTurnos]);

  // Notificaciones push: se registra el teléfono al iniciar sesión (si el usuario da permiso)
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    // 📘 Pide permiso de notificaciones y registra este celular en la API para recibir avisos push.
    //    alRecibir: si llega un aviso con la app abierta, se recargan los turnos.
    registrarPush();
    return alRecibir(() => { setRecargarTurnos((n) => n + 1); });
  }, [session?.user?.id]);

  // Sesión inicial + cambios de sesión (login, logout, token vencido, recuperación)
  useEffect(() => {
    if (!supabase) { setIniciando(false); return; }
    let activo = true;

    // 📘 Al abrir la app: recupera la sesión guardada en el teléfono (AsyncStorage). Si había una, entrás sin escribir la contraseña.
    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!activo) return;
        setSession(data.session);
        // Si la persona activó Face ID / huella, la sesión guardada se abre recién después de verificar.
        if (data.session?.user?.id && await bloqueoActivado(data.session.user.id)) setBloqueada(true);
        await cargarPerfil(data.session?.user);
      })
      .catch((e) => console.warn('No se pudo recuperar la sesión:', e.message))
      .finally(() => { if (activo) setIniciando(false); });

    // 📘 Escucha los cambios de sesión: iniciar, cerrar, cuando el token se renueva solo o cuando se abre el enlace para recuperar la contraseña.
    const { data } = supabase.auth.onAuthStateChange((event, nueva) => {
      setSession(nueva);
      if (event === 'PASSWORD_RECOVERY') setAuthModo('nueva');
      if (event === 'SIGNED_OUT') { setPerfil(null); setTab('Inicio'); setBloqueada(false); }
      // Fuera del callback para no bloquear supabase-js
      setTimeout(() => { if (activo) cargarPerfil(nueva?.user); }, 0);
    });

    return () => { activo = false; data.subscription?.unsubscribe(); };
  }, [cargarPerfil]);

  // Al iniciar sesión o cambiar de rol, abrir la pestaña principal de ese rol
  useEffect(() => {
    setTab(tabs[0]);
  }, [rol]);

  // Si el dueño aprobó el pedido mientras la app estaba abierta, se avisa al pasar a barbero
  useEffect(() => {
    const antes = perfilRef.current;
    if (antes && perfil && antes.id === perfil.id && antes.rol === 'USUARIO' && perfil.rol === 'BARBERO') {
      avisar('¡Te aprobaron! Ya sos barbero: esta es tu agenda.', 'ok');
    }
    perfilRef.current = perfil;
  }, [perfil]);

  // Cuenta desactivada por el administrador
  useEffect(() => {
    if (perfil && perfil.activo === false) {
      Alert.alert('Cuenta desactivada', 'Tu cuenta fue desactivada por el administrador. Podés ver tu información pero no reservar ni modificar datos.');
    }
  }, [perfil?.activo]);

  // Enlaces entrantes: recuperación de contraseña y confirmación de email
  useEffect(() => {
    if (!supabase) return;
    const manejar = async (url) => {
      if (!url || oauthEnCurso.current) return;
      const esReset = url.includes('auth/reset');
      const esCallback = url.includes('auth/callback');
      if (!esReset && !esCallback) return;
      const { code, error } = leerRetorno(url);
      if (error) return Alert.alert('No se pudo completar', String(error));
      if (!code) return;
      const { error: errSesion } = await supabase.auth.exchangeCodeForSession(code);
      if (errSesion) return Alert.alert('Enlace inválido o vencido', 'Pedí un enlace nuevo. ' + mensajeError(errSesion));
      setAuthModo(esReset ? 'nueva' : null);
    };
    Linking.getInitialURL().then(manejar);
    const sub = Linking.addEventListener('url', ({ url }) => manejar(url));
    return () => sub.remove();
  }, []);

  /**
   * Después de ingresar, la app abre la parte que corresponde al rol real de la cuenta
   * (cliente, barbero o administrador). El rol lo decide siempre el servidor: no hay que elegirlo.
   */
  const verificarRol = async () => {
    try {
      await api('/auth/me');
      return true;
    } catch (e) {
      Alert.alert('No se pudo ingresar', e.message);
      await supabase.auth.signOut({ scope: 'local' });
      return false;
    }
  };

  const abrirIngreso = (modo = 'login') => { setRolElegido('USUARIO'); setAuthModo(modo); };

  // 📘 INGRESAR CON GOOGLE (OAuth):
  //      1) Supabase arma la dirección de Google (signInWithOAuth);
  //      2) se abre una ventana del navegador para elegir la cuenta;
  //      3) Google vuelve a la app con un "code";
  //      4) exchangeCodeForSession cambia ese code por la sesión (flujo PKCE: el code solo sirve en este teléfono).
  //    preferEphemeralSession: en iPhone evita el cartel del sistema y no deja guardada la sesión de Google en el navegador.
  const signInWithGoogle = async () => {
    if (!supabase) return Alert.alert('Configuración faltante', 'Configurá Supabase antes de iniciar sesión con Google.');
    let destino = redirectUrl('auth/callback');
    if (enExpoGo && Platform.OS === 'ios') {
      // En iPhone la ventana de Google captura el retorno por su esquema, así que siempre se usa
      // barberiaimperial://auth/callback: está en la lista de Supabase y no depende de si Expo
      // corre por Wi-Fi o por túnel (la dirección exp://….exp.direct cambia y Supabase la rechaza).
      destino = 'barberiaimperial://auth/callback';
    } else if (enExpoGo && hostEsIP(destino)) {
      return Alert.alert(
        'Iniciá Expo con túnel',
        'Supabase no acepta direcciones con IP para volver a la app. En la PC cortá Expo (Ctrl + C) y ejecutá:\n\nnpx expo start --go --tunnel\n\nLuego escaneá el QR nuevo.'
      );
    }
    console.log('Dirección de retorno de Google:', destino);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: destino, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } }
    });
    if (error) return Alert.alert('No se pudo iniciar sesión', mensajeError(error));
    if (!data?.url) return Alert.alert('No se pudo iniciar sesión', 'Supabase no devolvió la URL de Google.');

    oauthEnCurso.current = true;
    let callbackUrl = null;
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith(destino)) return;
      callbackUrl = url;
      if (Platform.OS === 'ios') WebBrowser.dismissBrowser();
    });

    try {
      // preferEphemeralSession: en iPhone abre Google directo, sin el cartel del sistema
      // "… quiere utilizar ….supabase.co para iniciar sesión" (no comparte cookies con Safari).
      const result = await WebBrowser.openAuthSessionAsync(data.url, destino, { preferEphemeralSession: true });
      const vuelta = result.type === 'success' ? result.url : callbackUrl;
      if (!vuelta) {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          // En iPhone, cerrar la ventana de Google también llega como "cancel"
          return;
        }
        return Alert.alert(
          'No se completó el ingreso con Google',
          'Google no devolvió la sesión a la app. Si estás en Expo Go, iniciá Expo con: npx expo start --go --tunnel'
        );
      }
      const { code, error: errRetorno } = leerRetorno(vuelta);
      if (errRetorno) return Alert.alert('Google no pudo iniciar sesión', String(errRetorno));
      if (!code) return Alert.alert('No se pudo completar el acceso', 'El retorno no incluyó un código de sesión válido.');
      const { error: errSesion } = await supabase.auth.exchangeCodeForSession(code);
      if (errSesion) Alert.alert('No se pudo completar el acceso', mensajeError(errSesion));
      else if (await verificarRol(rolElegido)) setAuthModo(null);
    } catch (e) {
      Alert.alert('No se pudo completar el acceso', e.message || 'Ocurrió un error durante la autenticación.');
    } finally {
      oauthEnCurso.current = false;
      sub.remove();
    }
  };

  // 📘 CERRAR SESIÓN: primero se desregistra el celular (no le llegan más avisos de esa cuenta) y después se borra la sesión del teléfono.
  const salir = async () => {
    await desregistrarPush();
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* igual se cierra en el teléfono */ }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) Alert.alert('No se pudo cerrar sesión', mensajeError(error));
  };

  // Cambiar de cuenta (por ejemplo, de cliente a barbero): cierra sesión y abre el ingreso
  const cambiarCuenta = async () => {
    await salir(); // vuelve a la pantalla "¿Cómo querés entrar?" (cliente, barbero o administrador)
  };

  const confirmarSalir = () => Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta?', [
    { text: 'No', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: salir }
  ]);

  const refrescar = () => {
    setRefrescando(true);
    setRecargarTurnos((n) => n + 1);
    if (session) cargarPerfil(session.user);
    setTimeout(() => setRefrescando(false), 700);
  };

  // Volver a bloquear si la app estuvo más de 1 minuto en segundo plano
  useEffect(() => {
    const sub = AppState.addEventListener?.('change', async (estado) => {
      if (estado === 'background') { enSegundoPlano.current = Date.now(); return; }
      if (estado !== 'active' || !enSegundoPlano.current) return;
      setRecargarTurnos((n) => n + 1); // al volver a la app se actualizan avisos y turnos
      const fuera = Date.now() - enSegundoPlano.current;
      enSegundoPlano.current = null;
      if (fuera > 60000 && session?.user?.id && await bloqueoActivado(session.user.id)) setBloqueada(true);
    });
    return () => sub?.remove?.();
  }, [session?.user?.id]);

  /** Abre Reservar con servicio y/o barbero ya elegidos (Reservar de nuevo, favoritos, catálogo). */
  const reservarCon = (inicial) => { setReservaPrevia(inicial); ir('Reservar'); };

  const ir = (t) => { setTab(t); scrollRef.current?.scrollTo?.({ y: 0, animated: false }); };
  /** Abre el centro de avisos (campana) recordando de dónde se vino. */
  const abrirAvisos = () => { if (tab !== 'Avisos') setTabAnterior(tab); ir('Avisos'); };
  /** Desde un aviso: va a la pestaña que corresponde y, si es un turno, lo abre. */
  const irDesdeAviso = (destino) => { setTurnoInicial(destino.turnoId || null); ir(destino.tab); };
  const recargar = () => setRecargarTurnos((n) => n + 1);

  // 📘 Decide qué se ve: falta de configuración, cargando, la portada (sin sesión), el bloqueo con Face ID o la pestaña elegida según el rol.
  const renderContenido = () => {
    if (!supabase) {
      return <Vacio icono="settings-outline" titulo="Falta configurar Supabase" texto="Agregá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en mobile/.env." />;
    }
    if (iniciando) return <Cargando />;

    if (!session) {
      return (
        <View style={{ paddingTop: 24 }}>
          <View style={[styles.vacioIcono, { height: 64, width: 64, borderRadius: 32, marginBottom: 20 }]}><Icono nombre="cut" tam={30} color={colors.gold} /></View>
          <Text style={styles.hero}>Tu turno en la barbería, sin llamar.</Text>
          <Texto>Reservá en segundos y te avisamos antes de ir.</Texto>
          <Boton titulo="Ingresar" icono="log-in-outline" onPress={() => abrirIngreso('login')} style={{ marginTop: 16 }} />
          <Boton titulo="Crear cuenta nueva" variante="secundario" onPress={() => abrirIngreso('registro')} />
        </View>
      );
    }

    switch (tab) {
      case 'Reservar':
        return <Reservar catalogo={catalogo} favoritos={favoritos} inicial={reservaPrevia} onInicialUsado={() => setReservaPrevia(null)} onReservado={() => { recargar(); ir('Mis turnos'); }} />;
      case 'Asistente':
        return <Asistente session={session} recargarClave={recargarTurnos} tecladoVisible={tecladoVisible} />;
      case 'Mis turnos':
        return <MisTurnos recargarClave={recargarTurnos} onCambio={recargar} onIr={ir} onReservarDeNuevo={reservarCon} turnoInicial={turnoInicial} onTurnoInicialUsado={() => setTurnoInicial(null)} />;
      case 'Avisos':
        return <CentroAvisos rol={rol} recargarClave={recargarTurnos} onIr={irDesdeAviso} onVolver={() => ir(tabAnterior || 'Inicio')} onLeidas={actualizarNoLeidas} />;
      case 'Perfil':
        return <Perfil session={session} perfil={perfil} onGuardado={() => cargarPerfil(session.user)} onSalir={confirmarSalir} onCambiarCuenta={cambiarCuenta} favoritos={favoritos} onReservarCon={reservarCon} recargarClave={recargarTurnos} />;
      case 'Agenda':
        return <AgendaBarbero onCambio={recargar} recargarClave={recargarTurnos} />;
      case 'Mi ficha':
        return <MiFicha recargarClave={recargarTurnos} />;
      case 'Admin':
        return <PanelAdmin perfil={perfil} recargarClave={recargarTurnos} />;
      default:
        return (
          <View>
            {rol === 'ADMIN' && <SolicitudesBarbero recarga={recargarTurnos} destacado />}
            <Inicio session={session} rol={rol} perfil={perfil} catalogo={catalogo} onIr={(t) => (t === 'Avisos' ? abrirAvisos() : ir(t))} onIrAviso={irDesdeAviso} recargarClave={recargarTurnos} onLeidas={actualizarNoLeidas} favoritos={favoritos} onReservarCon={reservarCon} />
          </View>
        );
    }
  };

  const encabezado = (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>BELABARBERÍA</Text>
        <Text style={styles.brandSub}>Turnos de barbería</Text>
      </View>
      {session ? (
        <Pressable style={[styles.iconoBoton, tab === 'Avisos' && { borderColor: colors.gold }]} onPress={() => (tab === 'Avisos' ? ir(tabAnterior || 'Inicio') : abrirAvisos())} accessibilityRole="button" accessibilityState={{ selected: tab === 'Avisos' }} accessibilityLabel={`Avisos${noLeidas ? `, ${noLeidas} sin leer` : ''}. Abrir el centro de avisos`}>
          <Icono nombre={noLeidas || tab === 'Avisos' ? 'notifications' : 'notifications-outline'} tam={22} color={noLeidas || tab === 'Avisos' ? colors.gold : colors.text} />
          {noLeidas > 0 && <View style={[styles.tabBadge, { right: 4, top: 4 }]}><Text style={styles.tabBadgeTexto}>{noLeidas > 9 ? '9+' : noLeidas}</Text></View>}
        </Pressable>
      ) : (
        <Pressable style={styles.iconoBoton} onPress={() => abrirIngreso('login')} accessibilityRole="button" accessibilityLabel="Ingresar">
          <Icono nombre="person-outline" tam={22} />
        </Pressable>
      )}
    </View>
  );

  // El Asistente es un chat: ocupa toda la pantalla con la caja de texto fija abajo (no va dentro del desplazamiento general)
  // 📘 El Asistente ocupa toda la pantalla con su propia lista de mensajes, así la caja de texto queda siempre arriba del teclado.
  const chatCompleto = Boolean(supabase && !iniciando && session && !bloqueada && tab === 'Asistente');
  const conTabBar = Boolean(session && !bloqueada && tabs.length > 1);

  // 📘 Lo que se dibuja. KeyboardAvoidingView acomoda el contenido cuando aparece el teclado
  //    (en iPhone con "padding" y en Android con "height"), así lo que escribís no queda tapado.
  //    La barra de pestañas de abajo se oculta mientras el teclado está abierto.
  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'android' && { paddingTop: RNStatusBar.currentHeight || 0 }]}>
      <StatusBar style={modo === 'claro' ? 'dark' : 'light'} />
      {/* Cuando aparece el teclado, el contenido se achica para que lo que se escribe quede a la vista */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        onLayout={(e) => { if (!tecladoVisible) { const { y, height } = e.nativeEvent.layout; setFinContenido(Math.round(y + height)); } }}
      >
        {chatCompleto ? (
          <View style={{ flex: 1, paddingTop: 12 }}>
            <View style={{ paddingHorizontal: 20 }}>{encabezado}</View>
            <Asistente session={session} recargarClave={recargarTurnos} espacioInferior={conTabBar ? tapaTabBar : 0} tecladoVisible={tecladoVisible} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            refreshControl={session ? <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.gold} colors={[colors.gold]} /> : undefined}
          >
            {encabezado}
            {session && bloqueada
              ? <PantallaBloqueo onDesbloquear={() => setBloqueada(false)} onSalir={salir} />
              : renderContenido()}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {conTabBar && !tecladoVisible && (
        <View style={styles.tabBar} onLayout={(e) => setInicioTabBar(Math.round(e.nativeEvent.layout.y))}>
          {tabs.map((t) => {
            const activo = tab === t;
            return (
              <Pressable key={t} style={styles.tab} onPress={() => ir(t)} accessibilityRole="button" accessibilityLabel={t} accessibilityState={{ selected: activo }}>
                <View>
                  <Icono nombre={ICONOS_TAB[t][activo ? 0 : 1]} tam={23} color={activo ? colors.gold : colors.faint} />
                  {t === 'Inicio' && noLeidas > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeTexto}>{noLeidas > 9 ? '9+' : noLeidas}</Text></View>}
                </View>
                <Text style={[styles.tabText, activo && styles.tabActive]}>{t === 'Perfil' ? 'Cuenta' : t}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Avisos />

      {authModo && (
        <PanelAuth
          modo={authModo}
          setModo={setAuthModo}
          rol={rolElegido}
          setRol={setRolElegido}
          verificarRol={verificarRol}
          onGoogle={signInWithGoogle}
          onCerrar={() => setAuthModo(null)}
          onListo={() => setAuthModo(null)}
        />
      )}
    </SafeAreaView>
  );
}

/** Pantalla de bloqueo: la app se abre recién cuando el teléfono verifica la cara o la huella. */
// 📘 Si la persona activó Face ID / huella, la sesión guardada se abre recién después de verificar.
//    La verificación la hace el sistema del teléfono: la app nunca ve la cara ni la huella.
function PantallaBloqueo({ onDesbloquear, onSalir }) {
  const { styles } = useTema();
  const [nombre, setNombre] = useState('Face ID / huella');
  const [error, setError] = useState(null);
  const [verificando, setVerificando] = useState(false);

  const intentar = useCallback(async () => {
    setVerificando(true);
    setError(null);
    const r = await autenticar('Desbloquear BELABARBERÍA');
    setVerificando(false);
    if (r.ok) onDesbloquear();
    else setError(r.error === 'user_cancel' || r.error === 'system_cancel' ? 'Cancelaste la verificación. Tocá el botón para intentar de nuevo.' : 'No pudimos verificar que seas vos. Probá de nuevo o usá el código del teléfono.');
  }, [onDesbloquear]);

  useEffect(() => {
    biometriaDisponible().then((d) => { if (d.nombre) setNombre(d.nombre); });
    intentar();
  }, []);

  return (
    <View style={{ alignItems: 'center', paddingTop: 48 }} accessibilityLiveRegion="polite">
      <View style={[styles.vacioIcono, { height: 76, width: 76, borderRadius: 38, marginBottom: 20 }]}>
        <Icono nombre="lock-closed" tam={34} color={colors.gold} />
      </View>
      <Text style={[styles.hero, { textAlign: 'center' }]} accessibilityRole="header">BELABARBERÍA está bloqueada</Text>
      <Texto style={{ textAlign: 'center' }}>Para abrir tu cuenta, verificá que sos vos con {nombre}.</Texto>
      {error ? <Text style={[styles.campoError, { textAlign: 'center', marginBottom: 12 }]} accessibilityRole="alert">{error}</Text> : null}
      <Boton titulo={`Desbloquear con ${nombre}`} icono="finger-print" onPress={intentar} cargando={verificando} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      <Boton titulo="Cerrar sesión" icono="log-out-outline" variante="fantasma" onPress={onSalir} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
