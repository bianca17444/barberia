/*
 * 📘 PARA LA DEFENSA — pantallas/Auth.js — ingresar, crear cuenta, recuperar y cambiar la contraseña.
 *   - Valida en el teléfono (email con formato, contraseña de 8 o más con letras y números, que coincidan) para avisar rápido.
 *     La API vuelve a validar todo igual: nunca se confía solo en la app.
 *   - Al ingresar NO se elige rol: la app abre lo que corresponde a la cuenta (lo decide el servidor).
 *   - Crear cuenta como barbero: con el código de la barbería entra directo con su agenda; sin código se le manda
 *     un pedido al dueño. Mientras tanto, la cuenta es de cliente.
 */
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { supabase, redirectUrl } from '../supabase';
import { api, textoError } from '../api';
import { Boton, Campo, Icono, Pestanas, Seleccionable, Titulo, Texto, avisar, colors, styles } from '../ui';

// Para ingresar no se elige rol: la app abre lo que corresponde a la cuenta (lo decide el servidor).
// Solo al CREAR una cuenta se elige si es de cliente o de barbero.
const ROL_DE = { Cliente: 'USUARIO', Barbero: 'BARBERO' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 📘 Regla de contraseña en el teléfono: mínimo 8 caracteres, con letras y números (la misma que controla la API).
const PASS_OK = (p) => p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
const PASS_MSJ = 'La contraseña debe tener al menos 8 caracteres, con letras y números.';

/** Guarda en el teléfono la sesión que devolvió la API (Supabase la renueva sola). */
// 📘 Guarda en el teléfono la sesión (tokens) que devolvió la API. Desde ahí Supabase la renueva sola.
async function guardarSesion(session) {
  const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error) throw new Error('No se pudo guardar la sesión en el teléfono.');
}

/**
 * Panel de autenticación: ingresar, crear cuenta, recuperar y nueva contraseña.
 * modo: 'login' | 'registro' | 'recuperar' | 'nueva'
 */
export function PanelAuth({ modo, setModo, rol, setRol, onGoogle, onCerrar, onListo, verificarRol }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [conCodigo, setConCodigo] = useState(true); // barbero: con código (entra ya) o pedido al dueño
  const [enviando, setEnviando] = useState(false);
  const esBarbero = modo === 'registro' && rol === 'BARBERO';

  // 📘 Botón principal: según el modo llama a /auth/login, /auth/register, /auth/forgot-password o /auth/reset-password.
  const enviar = async () => {
    if (!supabase) return Alert.alert('Configuración faltante', 'Falta configurar Supabase en mobile/.env.');
    const correo = email.trim().toLowerCase();

    try {
      setEnviando(true);

      if (modo === 'login') {
        if (!EMAIL_RE.test(correo) || !password) return Alert.alert('Datos incompletos', 'Ingresá un email válido y tu contraseña.');
        const r = await api('/auth/login', { method: 'POST', auth: false, body: { email: correo, password } });
        await guardarSesion(r.session);
        if (await verificarRol()) onListo();
      }

      if (modo === 'registro') {
        if (!nombre.trim() || !apellido.trim()) return Alert.alert('Datos incompletos', 'Nombre y apellido son obligatorios.');
        if (!EMAIL_RE.test(correo)) return Alert.alert('Email inválido', 'Revisá el email ingresado.');
        if (!PASS_OK(password)) return Alert.alert('Contraseña débil', PASS_MSJ);
        if (password !== password2) return Alert.alert('Contraseñas distintas', 'Las contraseñas no coinciden.');
        if (esBarbero && conCodigo && codigo.trim().length < 6) return Alert.alert('Falta el código', 'Escribí el código de la barbería que te pasó el dueño (mínimo 6 caracteres). Si no lo tenés, elegí "No tengo código" y le mandamos tu pedido.');
        // El rol NO se envía: la base siempre crea el perfil como USUARIO.
        const r = await api('/auth/register', {
          method: 'POST',
          auth: false,
          body: { email: correo, password, nombre: nombre.trim(), apellido: apellido.trim(), telefono: telefono.trim() || undefined, redirectTo: redirectUrl('auth/callback') }
        });
        if (r.session) {
          // Barbero: el servidor valida el código ANTES de abrir la app, así entra directo con su agenda.
          if (esBarbero && !conCodigo) {
            // Sin código: se crea la cuenta y le llega el pedido al dueño (notificación en la app y push).
            try {
              await api('/users/me/barber-request', { method: 'POST', token: r.session.access_token });
              Alert.alert('Pedido enviado al dueño', 'Tu cuenta ya está creada. Al dueño le llegó un aviso con tu pedido para trabajar como barbero. Cuando lo apruebe, entrás con tu agenda. Mientras tanto podés usar la app como cliente.');
            } catch (e) {
              Alert.alert('Tu cuenta se creó como cliente', `No se pudo enviar el pedido: ${textoError(e)}\n\nPedile al dueño que te cambie el rol desde Administración → Usuarios.`);
            }
          } else if (esBarbero) {
            try {
              const c = await api('/users/me/barber-code', { method: 'POST', token: r.session.access_token, body: { codigo: codigo.trim() } });
              avisar(c.mensaje, 'ok');
            } catch (e) {
              // Código incorrecto: igual le llega el pedido al dueño para que lo apruebe
              let pedido = false;
              try { await api('/users/me/barber-request', { method: 'POST', token: r.session.access_token }); pedido = true; } catch { /* sin pedido */ }
              Alert.alert('Tu cuenta se creó como cliente', `${textoError(e)}\n\n${pedido ? 'Igual le mandamos tu pedido al dueño: cuando lo apruebe, entrás con tu agenda.' : 'Pedile al dueño que te cambie el rol desde Administración → Usuarios.'}`);
            }
          }
          await guardarSesion(r.session);
          setRol('USUARIO');
          onListo();
        }
        else {
          Alert.alert('Revisá tu email', 'Te enviamos un enlace para confirmar la cuenta. Después iniciá sesión.');
          setModo('login');
        }
      }

      if (modo === 'recuperar') {
        if (!EMAIL_RE.test(correo)) return Alert.alert('Email inválido', 'Ingresá el email de tu cuenta.');
        const r = await api('/auth/forgot-password', { method: 'POST', auth: false, body: { email: correo, redirectTo: redirectUrl('auth/reset') } });
        Alert.alert('Revisá tu email', `${r.mensaje} Abrilo desde este mismo teléfono.`);
        setModo('login');
      }

      if (modo === 'nueva') {
        if (!PASS_OK(password)) return Alert.alert('Contraseña débil', PASS_MSJ);
        if (password !== password2) return Alert.alert('Contraseñas distintas', 'Las contraseñas no coinciden.');
        await api('/auth/reset-password', { method: 'POST', body: { password } });
        Alert.alert('Listo', 'Tu contraseña fue actualizada.');
        onListo();
      }
    } catch (e) {
      Alert.alert({ login: 'No se pudo ingresar', registro: 'No se pudo crear la cuenta', recuperar: 'No se pudo enviar', nueva: 'No se pudo actualizar' }[modo], textoError(e));
    } finally {
      setEnviando(false);
    }
  };

  const titulos = { login: 'Ingresar', registro: 'Crear cuenta', recuperar: 'Recuperar contraseña', nueva: 'Nueva contraseña' };
  const acciones = { login: 'Ingresar', registro: esBarbero && !conCodigo ? 'Crear cuenta y enviar pedido' : 'Crear cuenta', recuperar: 'Enviar enlace', nueva: 'Guardar contraseña' };
  const subtitulos = {
    login: null,
    registro: null,
    recuperar: 'Te mandamos un enlace para elegir una contraseña nueva.',
    nueva: 'Elegí tu nueva contraseña.'
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.panel}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Titulo style={{ marginBottom: 4 }}>{titulos[modo]}</Titulo>
          {modo !== 'nueva' && (
            <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Icono nombre="close" tam={26} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {subtitulos[modo] ? <Texto>{subtitulos[modo]}</Texto> : <View style={{ height: 12 }} />}

        {modo === 'registro' && (
          <View>
            <Text style={styles.label}>Me registro como</Text>
            <Pestanas opciones={['Cliente', 'Barbero']} activa={esBarbero ? 'Barbero' : 'Cliente'} onCambiar={(o) => setRol(ROL_DE[o])} />
            {esBarbero && (
              <View style={{ marginBottom: 6 }}>
                <Seleccionable
                  titulo="Tengo el código de la barbería"
                  subtitulo="Entro directo con mi agenda."
                  icono="key-outline"
                  activo={conCodigo}
                  onPress={() => setConCodigo(true)}
                />
                <Seleccionable
                  titulo="No tengo código"
                  subtitulo="Le mandamos tu pedido al dueño."
                  icono="paper-plane-outline"
                  activo={!conCodigo}
                  onPress={() => setConCodigo(false)}
                />
              </View>
            )}
          </View>
        )}

        {(modo === 'login' || (modo === 'registro' && rol === 'USUARIO')) && (
          <View>
            <Boton titulo="Continuar con Google" icono="logo-google" variante="claro" onPress={onGoogle} />
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 10 }}>
              <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
              <Text style={styles.aviso}>o</Text>
              <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
            </View>
          </View>
        )}

        {modo === 'registro' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="words" /></View>
            <View style={{ flex: 1 }}><Campo etiqueta="Apellido" value={apellido} onChangeText={setApellido} autoCapitalize="words" /></View>
          </View>
        )}
        {modo === 'registro' && <Campo etiqueta="Teléfono (opcional)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />}
        {modo === 'registro' && esBarbero && conCodigo && (
          <Campo
            etiqueta="Código de la barbería"
            value={codigo}
            onChangeText={setCodigo}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            placeholder="Te lo pasa el dueño"
            accessibilityHint="Código que te da el dueño para entrar como barbero"
          />
        )}

        {modo !== 'nueva' && (
          <Campo etiqueta="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="tu@email.com" />
        )}

        {modo !== 'recuperar' && (
          <Campo etiqueta={modo === 'nueva' ? 'Nueva contraseña' : 'Contraseña'} secureTextEntry value={password} onChangeText={setPassword} />
        )}
        {(modo === 'registro' || modo === 'nueva') && (
          <Campo etiqueta="Repetir contraseña" secureTextEntry value={password2} onChangeText={setPassword2} />
        )}
        {(modo === 'registro' || modo === 'nueva') && (
          <Text style={[styles.aviso, { marginBottom: 12, marginTop: -6 }]}>Mínimo 8 caracteres, con letras y números.</Text>
        )}

        <Boton titulo={acciones[modo]} onPress={enviar} cargando={enviando} />

        {modo === 'login' && (
          <>
            <Pressable onPress={() => setModo('recuperar')}><Text style={styles.link}>¿Olvidaste tu contraseña?</Text></Pressable>
            <Pressable onPress={() => setModo('registro')}><Text style={styles.link}>Crear cuenta</Text></Pressable>
          </>
        )}
        {(modo === 'registro' || modo === 'recuperar') && (
          <Pressable onPress={() => setModo('login')}><Text style={styles.link}>Ya tengo una cuenta</Text></Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
