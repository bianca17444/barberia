import { StatusBar } from 'expo-status-bar';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { createClient } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const redirectUrl = Constants.appOwnership === 'expo'
  ? Linking.createURL('auth/callback')
  : AuthSession.makeRedirectUri({
    native: 'barberiaimperial://auth/callback',
    scheme: 'barberiaimperial',
    path: 'auth/callback',
  });
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
}) : null;
const tabs = ['Inicio', 'Servicios', 'Barberos', 'Mis turnos'];
const colors = {
  gold: '#c9a45c',
  muted: '#aaa6a0',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Inicio');
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authVisible, setAuthVisible] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      const [{ data: sessionData }, { data: servicesData }, { data: barbersData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('servicios').select('*').eq('activo', true).order('precio'),
        supabase.from('barberos').select('*').eq('activo', true).order('nombre')
      ]);
      if (mounted) {
        setSession(sessionData.session);
        setServices(servicesData || []);
        setBarbers(barbersData || []);
        setLoading(false);
      }
    };

    load().catch(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    supabase
      .from('turnos')
      .select('*, servicios:servicio_id(nombre, precio), barberos:barbero_id(nombre, apellido)')
      .eq('usuario_id', session.user.id)
      .order('fecha', { ascending: false })
      .then(({ data }) => setAppointments(data || []));
  }, [session]);

  const submitAuth = async () => {
    if (!supabase || !email || !password) return Alert.alert('Datos incompletos', 'Ingresa email y contraseña.');
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) return Alert.alert('No se pudo continuar', result.error.message);
    setAuthVisible(false);
    setEmail('');
    setPassword('');
  };

  const signInWithGoogle = async () => {
    if (!supabase) return Alert.alert('Configuración faltante', 'Configura Supabase antes de iniciar sesión con Google.');

    console.log('OAuth redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return Alert.alert('No se pudo iniciar sesión', error.message);

    if (!data.url) return Alert.alert('No se pudo iniciar sesión', 'Supabase no devolvió la URL de Google.');

    let callbackUrl = null;
    const callbackSubscription = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith(redirectUrl)) return;
      callbackUrl = url;
      if (Platform.OS === 'ios') WebBrowser.dismissBrowser();
    });

    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      const returnedUrl = result.type === 'success' ? result.url : callbackUrl;
      if (!returnedUrl) {
        const message = result.type === 'error'
          ? result.error?.message || 'Google rechazó la autenticación.'
          : 'Google no devolvió la sesión a la app. Verifica las URL permitidas de redirección en Supabase.';
        return Alert.alert('No se pudo completar el acceso', message);
      }

      const { queryParams } = Linking.parse(returnedUrl);
      const authError = queryParams?.error_description || queryParams?.error;
      if (authError) {
        return Alert.alert('Google no pudo iniciar sesión', String(authError));
      }
      const code = queryParams?.code;
      if (!code || Array.isArray(code)) {
        return Alert.alert('No se pudo completar el acceso', 'El callback no incluyó un código de sesión válido.');
      }

      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
      if (sessionError) Alert.alert('No se pudo completar el acceso', sessionError.message);
      else setAuthVisible(false);
    } catch (error) {
      Alert.alert('No se pudo completar el acceso', error.message || 'Ocurrió un error durante la autenticación.');
    } finally {
      callbackSubscription.remove();
    }
  };

  const renderContent = () => {
    if (loading) return <ActivityIndicator size="large" color={colors.gold} style={styles.loader} />;
    if (!supabase) return <ConfigMessage />;
    if (activeTab === 'Servicios') return <Cards items={services} type="service" />;
    if (activeTab === 'Barberos') return <Cards items={barbers} type="barber" />;
    if (activeTab === 'Mis turnos') return session ? <AppointmentList items={appointments} /> : <LoginPrompt onPress={() => setAuthVisible(true)} />;
    return <Home services={services} onBook={() => session ? setActiveTab('Servicios') : setAuthVisible(true)} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>BARBERIA</Text><Text style={styles.brand}>IMPERIAL</Text></View>
          <Pressable style={styles.accountButton} onPress={() => session ? supabase.auth.signOut() : setAuthVisible(true)}>
            <Text style={styles.accountText}>{session ? 'Salir' : 'Ingresar'}</Text>
          </Pressable>
        </View>
        {renderContent()}
      </ScrollView>
      <View style={styles.tabBar}>{tabs.map(tab => <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}><Text style={[styles.tabText, activeTab === tab && styles.tabActive]}>{tab}</Text></Pressable>)}</View>
      {authVisible && <AuthPanel mode={authMode} setMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={submitAuth} onGoogle={signInWithGoogle} onClose={() => setAuthVisible(false)} />}
    </SafeAreaView>
  );
}

function Home({ services, onBook }) {
  return <View><Text style={styles.kicker}>TRADICION Y ESTILO</Text><Text style={styles.hero}>El arte del corte perfecto.</Text><Text style={styles.description}>Cortes de autor, barba y atención de primera línea en Barbería Imperial.</Text><Pressable style={styles.primaryButton} onPress={onBook}><Text style={styles.primaryText}>Reservar turno</Text></Pressable><Text style={styles.sectionTitle}>Servicios destacados</Text><Cards items={services.slice(0, 3)} type="service" /></View>;
}

function Cards({ items, type }) {
  if (!items.length) return <Text style={styles.description}>No hay información disponible.</Text>;
  return <View>{items.map(item => <View style={styles.card} key={item.id}><Text style={styles.cardTitle}>{type === 'barber' ? `${item.nombre} ${item.apellido || ''}` : item.nombre}</Text><Text style={styles.cardDescription}>{type === 'barber' ? item.especialidad || 'Maestro barbero' : item.descripcion || 'Servicio profesional de barbería'}</Text>{type === 'service' && <Text style={styles.price}>${item.precio}</Text>}</View>)}</View>;
}

function AppointmentList({ items }) { return <View><Text style={styles.sectionTitle}>Mis turnos</Text>{items.length ? items.map(item => <View style={styles.card} key={item.id}><Text style={styles.cardTitle}>{item.servicios?.nombre || 'Servicio'}</Text><Text style={styles.cardDescription}>{item.fecha} - {item.hora}</Text><Text style={styles.status}>{item.estado}</Text></View>) : <Text style={styles.description}>Todavia no tenes turnos.</Text>}</View>; }
function LoginPrompt({ onPress }) { return <View style={styles.empty}><Text style={styles.sectionTitle}>Inicia sesion para ver tus turnos</Text><Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryText}>Ingresar</Text></Pressable></View>; }
function ConfigMessage() { return <View style={styles.empty}><Text style={styles.sectionTitle}>Configura Supabase</Text><Text style={styles.description}>Agrega EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en mobile/.env.</Text></View>; }
function AuthPanel({ mode, setMode, email, setEmail, password, setPassword, onSubmit, onGoogle, onClose }) { return <View style={styles.authPanel}><Text style={styles.sectionTitle}>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</Text><Pressable style={styles.googleButton} onPress={onGoogle}><Text style={styles.googleText}>Continuar con Google</Text></Pressable><TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} onChangeText={setEmail} /><TextInput secureTextEntry placeholder="Contraseña" placeholderTextColor={colors.muted} style={styles.input} value={password} onChangeText={setPassword} /><Pressable style={styles.primaryButton} onPress={onSubmit}><Text style={styles.primaryText}>Continuar</Text></Pressable><Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}><Text style={styles.link}>{mode === 'login' ? 'Crear cuenta' : 'Ya tengo una cuenta'}</Text></Pressable><Pressable onPress={onClose}><Text style={styles.close}>Cerrar</Text></Pressable></View>; }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0e12',
  },
  content: {
    padding: 24,
    paddingBottom: 110,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 54,
  },
  eyebrow: { color: '#c9a45c', fontSize: 11, letterSpacing: 3 },
  brand: { color: '#f4f1ea', fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  accountButton: { borderColor: '#c9a45c', borderRadius: 4, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  accountText: { color: '#c9a45c', fontWeight: '700' },
  kicker: { color: '#c9a45c', fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  hero: { color: '#f4f1ea', fontSize: 42, fontWeight: '800', lineHeight: 48, marginBottom: 18 },
  description: { color: '#aaa6a0', fontSize: 16, lineHeight: 24, marginBottom: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: '#c9a45c', borderRadius: 4, marginBottom: 30, padding: 15 },
  primaryText: { color: '#0c0e12', fontSize: 16, fontWeight: '800' },
  googleButton: { alignItems: 'center', backgroundColor: '#f4f1ea', borderRadius: 4, marginBottom: 18, padding: 15 },
  googleText: { color: '#0c0e12', fontSize: 16, fontWeight: '800' },
  sectionTitle: { color: '#f4f1ea', fontSize: 24, fontWeight: '700', marginBottom: 18, marginTop: 16 },
  card: { backgroundColor: '#171a20', borderLeftColor: '#c9a45c', borderLeftWidth: 3, marginBottom: 12, padding: 18 },
  cardTitle: { color: '#f4f1ea', fontSize: 18, fontWeight: '700', marginBottom: 7 },
  cardDescription: { color: '#aaa6a0', fontSize: 14, lineHeight: 20 },
  price: { color: '#c9a45c', fontSize: 17, fontWeight: '700', marginTop: 12 },
  status: { color: '#c9a45c', fontSize: 12, fontWeight: '700', marginTop: 10 },
  loader: { marginTop: 80 },
  empty: { alignItems: 'center', paddingTop: 40 },
  tabBar: { backgroundColor: '#111318', borderTopColor: '#292d35', borderTopWidth: 1, bottom: 0, flexDirection: 'row', left: 0, paddingBottom: 12, paddingTop: 12, position: 'absolute', right: 0 },
  tab: { alignItems: 'center', flex: 1 },
  tabText: { color: '#77736d', fontSize: 11, textAlign: 'center' },
  tabActive: { color: '#c9a45c', fontWeight: '700' },
  authPanel: { backgroundColor: '#20242c', borderTopLeftRadius: 18, borderTopRightRadius: 18, bottom: 0, left: 0, padding: 24, position: 'absolute', right: 0 },
  input: { backgroundColor: '#111318', borderColor: '#3a3e47', borderRadius: 4, borderWidth: 1, color: '#f4f1ea', marginBottom: 12, padding: 14 },
  link: { color: '#c9a45c', padding: 10, textAlign: 'center' },
  close: { color: '#aaa6a0', padding: 8, textAlign: 'center' },
});
