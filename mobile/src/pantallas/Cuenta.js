/*
 * 📘 PARA LA DEFENSA — pantallas/Cuenta.js — Perfil: datos personales, foto, tema, Face ID / huella, notificaciones,
 * favoritos, cambiar contraseña y cerrar sesión.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { api, textoError } from '../api';
import { useTema } from '../tema';
import { registrarPush } from '../notificaciones';
import { elegirYSubirFoto } from '../fotos';
import { autenticar, biometriaDisponible, bloqueoActivado, guardarBloqueo } from '../biometria';
import { ClubCliente } from './Club';
import { Avatar, Boton, Campo, Corazon, Hoja, Icono, Interruptor, Pestanas, Seccion, Tarjeta, Texto, Vacio, avisar, colors, styles } from '../ui';

const PASS_OK = (p) => p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
const TEL_RE = /^[+\d][\d\s-]{5,19}$/;
const NOMBRE_ROL = { USUARIO: 'Cliente', BARBERO: 'Barbero', ADMIN: 'Administrador' };
const TEMAS = { Automático: 'sistema', Claro: 'claro', Oscuro: 'oscuro' };

/** Mi cuenta: datos personales, apariencia, notificaciones, contraseña y salir. */
export function Perfil({ session, perfil, onGuardado, onSalir, onCambiarCuenta, favoritos, onReservarCon, recargarClave }) {
  const { preferencia, cambiarPreferencia } = useTema();
  const [nombre, setNombre] = useState(perfil?.nombre || '');
  const [apellido, setApellido] = useState(perfil?.apellido || '');
  const [telefono, setTelefono] = useState(perfil?.telefono || '');
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [verPassword, setVerPassword] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [nueva2, setNueva2] = useState('');
  const [erroresPass, setErroresPass] = useState({});
  const [cambiando, setCambiando] = useState(false);
  const [push, setPush] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [bio, setBio] = useState({ ok: false, nombre: 'Face ID / huella', activo: false, motivo: null });

  useEffect(() => {
    let vivo = true;
    (async () => {
      const d = await biometriaDisponible();
      const activo = await bloqueoActivado(session.user.id);
      if (vivo) setBio({ ok: d.ok, nombre: d.nombre || 'Face ID / huella', motivo: d.motivo || null, activo });
    })();
    return () => { vivo = false; };
  }, [session.user.id]);

  /** Activa o desactiva el bloqueo con Face ID / huella (se guarda solo en este teléfono). */
  const cambiarBio = async (activar) => {
    if (!activar) {
      await guardarBloqueo(session.user.id, false);
      setBio((b) => ({ ...b, activo: false }));
      return avisar(`${bio.nombre} desactivado en este teléfono`, 'info');
    }
    const d = await biometriaDisponible();
    if (!d.ok) return Alert.alert('No se puede activar', d.motivo);
    const r = await autenticar(`Confirmá para activar ${d.nombre}`);
    if (!r.ok) return avisar('No se activó: la verificación no se completó', 'error');
    await guardarBloqueo(session.user.id, true);
    setBio({ ok: true, nombre: d.nombre, motivo: null, activo: true });
    avisar(`Listo: la app te va a pedir ${d.nombre} al abrirla`, 'ok');
  };

  /** Guarda la URL de la foto en el perfil (y en la ficha si es barbero). */
  const guardarFoto = async (url) => {
    await api(`/users/${session.user.id}`, { method: 'PUT', body: { avatar_url: url } });
    if (perfil?.rol === 'BARBERO') {
      try {
        const f = await api('/barbers/me');
        await api('/barbers/me', { method: 'PUT', body: { especialidad: f.barbero.especialidad, foto_url: url } });
      } catch { /* sin ficha vinculada: solo se actualiza el perfil */ }
    }
    onGuardado?.();
  };

  const cambiarFoto = (camara) => async () => {
    try {
      setSubiendo(true);
      const url = await elegirYSubirFoto(session.user.id, { camara });
      if (!url) return;
      await guardarFoto(url);
      avisar('Foto de perfil actualizada');
    } catch (e) {
      Alert.alert('No se pudo cambiar la foto', textoError(e));
    } finally {
      setSubiendo(false);
    }
  };

  const opcionesFoto = () => Alert.alert('Foto de perfil', 'Elegí de dónde sacar la foto.', [
    { text: 'Cancelar', style: 'cancel' },
    ...(perfil?.avatar_url ? [{ text: 'Quitar foto', style: 'destructive', onPress: async () => {
      try { await guardarFoto(null); avisar('Foto quitada'); } catch (e) { Alert.alert('No se pudo quitar', textoError(e)); }
    } }] : []),
    { text: 'Sacar foto', onPress: cambiarFoto(true) },
    { text: 'Elegir de la galería', onPress: cambiarFoto(false) }
  ]);

  useEffect(() => {
    setNombre(perfil?.nombre || '');
    setApellido(perfil?.apellido || '');
    setTelefono(perfil?.telefono || '');
  }, [perfil?.id]);

  const cambios = nombre !== (perfil?.nombre || '') || apellido !== (perfil?.apellido || '') || telefono !== (perfil?.telefono || '');

  const guardar = async () => {
    const e = {};
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (telefono.trim() && !TEL_RE.test(telefono.trim())) e.telefono = 'Usá solo números, espacios o guiones.';
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      await api(`/users/${session.user.id}`, { method: 'PUT', body: { nombre: nombre.trim(), apellido: apellido.trim(), telefono: telefono.trim() || null } });
      avisar('Datos guardados');
      onGuardado?.();
    } catch (err) {
      Alert.alert('No se pudo guardar', textoError(err));
    } finally {
      setGuardando(false);
    }
  };

  // 📘 Cambiar contraseña: pide la actual y la nueva (POST /auth/change-password). Sin la actual, no se puede cambiar.
  const cambiarPassword = async () => {
    const e = {};
    if (!actual) e.actual = 'Ingresá tu contraseña actual.';
    if (!PASS_OK(nueva)) e.nueva = 'Mínimo 8 caracteres, con letras y números.';
    else if (nueva === actual) e.nueva = 'Tiene que ser distinta de la actual.';
    if (nueva2 !== nueva) e.nueva2 = 'No coincide con la nueva contraseña.';
    setErroresPass(e);
    if (Object.keys(e).length) return;
    setCambiando(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { actual, nueva } });
      avisar('Contraseña cambiada');
      setActual(''); setNueva(''); setNueva2('');
      setVerPassword(false);
    } catch (err) {
      setErroresPass({ actual: textoError(err) });
    } finally {
      setCambiando(false);
    }
  };

  const activarPush = async () => {
    const r = await registrarPush();
    setPush(r);
    if (r.ok) avisar('Notificaciones activadas en este teléfono');
    else Alert.alert('Notificaciones', r.motivo);
  };

  const nombreCompleto = `${perfil?.nombre || ''} ${perfil?.apellido || ''}`.trim();

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Pressable onPress={opcionesFoto} disabled={subiendo} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil">
          <Avatar nombre={nombreCompleto || session.user.email} tam={92} foto={perfil?.avatar_url} />
          <View style={{ alignItems: 'center', backgroundColor: colors.goldFill, borderColor: colors.bg, borderRadius: 16, borderWidth: 3, bottom: -2, height: 32, justifyContent: 'center', position: 'absolute', right: -2, width: 32 }}>
            {subiendo ? <ActivityIndicator size="small" color={colors.sobreGold} /> : <Icono nombre="camera" tam={16} color={colors.sobreGold} />}
          </View>
        </Pressable>
        <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 10 }]}>{nombreCompleto || 'Mi cuenta'}</Text>
        <Texto style={{ marginBottom: 0 }}>{session.user.email}</Texto>
        <Text style={[styles.seccionAccion, { marginTop: 4 }]}>{NOMBRE_ROL[perfil?.rol] || 'Cliente'}</Text>
      </View>

      {perfil?.rol === 'USUARIO' && <ClubCliente recarga={recargarClave} onReservarCon={onReservarCon} />}

      <Seccion titulo="Datos personales" />
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={60} error={errores.nombre} />
      <Campo etiqueta="Apellido" value={apellido} onChangeText={setApellido} maxLength={60} />
      <Campo etiqueta="Teléfono (opcional)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" maxLength={20} error={errores.telefono} placeholder="Ej.: 11 5555 0000" />
      <Boton titulo="Guardar cambios" icono="save-outline" onPress={guardar} cargando={guardando} deshabilitado={!cambios} />

      <Seccion titulo="Apariencia" />
      <Pestanas opciones={Object.keys(TEMAS)} activa={Object.keys(TEMAS).find((k) => TEMAS[k] === preferencia)} onCambiar={(k) => cambiarPreferencia(TEMAS[k])} />

      <Seccion titulo="Notificaciones" />
      <Tarjeta>
        <Text style={styles.cardDescription}>Te avisamos cuando se confirma, cancela o completa un turno, y 2 horas antes.</Text>
        <Boton titulo={push?.ok ? 'Activadas en este teléfono' : 'Activar en este teléfono'} icono={push?.ok ? 'notifications' : 'notifications-outline'} variante="secundario" onPress={activarPush} style={{ marginTop: 12, marginBottom: 0 }} />
      </Tarjeta>

      {favoritos?.habilitado && <MisFavoritos favoritos={favoritos} onReservarCon={onReservarCon} />}

      <Seccion titulo="Seguridad" />
      <Tarjeta>
        <Interruptor etiqueta={`Entrar con ${bio.nombre}`} valor={bio.activo} onCambiar={cambiarBio} />
        <Text style={[styles.cardDescription, { marginTop: 6 }]}>
          {bio.ok || bio.activo
            ? `Al abrir la app (o volver después de 1 minuto) te pedimos ${bio.nombre}. Tu cara o tu huella nunca salen del teléfono.`
            : bio.motivo || 'Consultando el sensor del teléfono…'}
        </Text>
      </Tarjeta>
      <Boton titulo="Cambiar contraseña" icono="key-outline" variante="fantasma" onPress={() => setVerPassword(true)} />
      {/* La sección "¿Trabajás en la barbería?" ya no se muestra al cliente: los barberos se suman al crear la cuenta (con el código) o el dueño les cambia el rol. */}
      <Boton titulo="Entrar con otra cuenta" icono="swap-horizontal" variante="fantasma" onPress={onCambiarCuenta} />
      <Boton titulo="Cerrar sesión" icono="log-out-outline" variante="peligro" onPress={onSalir} />

      <Hoja visible={verPassword} titulo="Cambiar contraseña" onCerrar={() => setVerPassword(false)}>
        <Campo etiqueta="Contraseña actual" secureTextEntry value={actual} onChangeText={setActual} error={erroresPass.actual} />
        <Campo etiqueta="Nueva contraseña" secureTextEntry value={nueva} onChangeText={setNueva} error={erroresPass.nueva} />
        <Campo etiqueta="Repetir nueva contraseña" secureTextEntry value={nueva2} onChangeText={setNueva2} error={erroresPass.nueva2} />
        <Text style={[styles.aviso, { marginBottom: 14 }]}>Si entraste con Google y nunca creaste una contraseña, usá "¿Olvidaste tu contraseña?" en la pantalla de ingreso.</Text>
        <Boton titulo="Cambiar contraseña" icono="checkmark" onPress={cambiarPassword} cargando={cambiando} />
      </Hoja>
    </View>
  );
}

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const nombreDe = (p) => `${p?.nombre || ''} ${p?.apellido || ''}`.trim();

/** "Mis favoritos": barberos y servicios guardados por el cliente, con atajo para reservar. */
function MisFavoritos({ favoritos, onReservarCon }) {
  const { barberos, servicios, cargando, error, cargar, alternar } = favoritos;
  const total = barberos.length + servicios.length;
  return (
    <View>
      <Seccion titulo={`Mis favoritos${total ? ` (${total})` : ''}`} />
      {error && !total ? (
        <Tarjeta>
          <Text style={styles.cardDescription}>No pudimos cargar tus favoritos. {error}</Text>
          <Boton titulo="Reintentar" variante="secundario" chico onPress={cargar} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
        </Tarjeta>
      ) : !total ? (
        <Vacio icono="heart-outline" titulo={cargando ? 'Cargando…' : 'Todavía no tenés favoritos'} texto="Tocá el corazón de un barbero o servicio en Inicio y aparece acá." />
      ) : (
        <View>
          {barberos.map((b) => (
            <Tarjeta key={`b${b.id}`} style={{ alignItems: 'center', flexDirection: 'row', gap: 10, paddingRight: 6 }}>
              <Avatar nombre={nombreDe(b)} foto={b.foto_url} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{nombreDe(b)}</Text>
                <Text style={styles.cardDescription}>{b.activo === false ? 'No está tomando turnos' : b.especialidad || 'Barbero'}</Text>
              </View>
              {b.activo !== false && <Boton titulo="Reservar" variante="secundario" chico onPress={() => onReservarCon?.({ barberoId: b.id })} style={{ marginBottom: 0 }} />}
              <Corazon activo nombre={nombreDe(b)} onPress={() => alternar('barbero', b)} />
            </Tarjeta>
          ))}
          {servicios.map((sv) => (
            <Tarjeta key={`s${sv.id}`} style={{ alignItems: 'center', flexDirection: 'row', gap: 10, paddingRight: 6 }}>
              <View style={styles.opcionIcono}><Icono nombre="cut-outline" tam={18} color={colors.gold} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{sv.nombre}</Text>
                <Text style={styles.cardDescription}>{sv.activo === false ? 'Ya no se ofrece' : `${sv.duracion} min · ${pesos(sv.precio)}`}</Text>
              </View>
              {sv.activo !== false && <Boton titulo="Reservar" variante="secundario" chico onPress={() => onReservarCon?.({ servicioId: sv.id })} style={{ marginBottom: 0 }} />}
              <Corazon activo nombre={sv.nombre} onPress={() => alternar('servicio', sv)} />
            </Tarjeta>
          ))}
        </View>
      )}
    </View>
  );
}
