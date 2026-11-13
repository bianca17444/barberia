/*
 * 📘 PARA LA DEFENSA — pantallas/Admin.js — panel del ADMINISTRADOR (el dueño).
 * Secciones: Turnos, Pagos, Servicios, Equipo (barberos y horarios), Galería, Recompensas, Usuarios, Reseñas y Barbería.
 * Todo pasa por la API con rol ADMIN: si alguien que no es admin usara estas rutas, recibiría 403.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { api, textoError } from '../api';
import { supabase } from '../supabase';
import {
  Avatar, Boton, Campo, Cargando, Chip, ErrorCaja, Estado, Etiqueta, Hoja, Icono, Interruptor, Pestanas,
  Seccion, Seleccionable, SelectorHora, Tarjeta, Texto, Ticket, Titulo, Vacio, avisar, colors, styles
} from '../ui';
import { DIAS, MESES, fechaCorta, horaCorta, hoyNegocio, proximosDias } from '../tiempo';
import { DetalleFila, Reservar, useCatalogo } from './Cliente';
import { ESTILOS, ValidarCanje, nombreEstilo } from './Club';
import { elegirFotoGaleria } from '../fotos';

const ROLES = ['USUARIO', 'BARBERO', 'ADMIN'];
const NOMBRE_ROL = { USUARIO: 'Cliente', BARBERO: 'Barbero', ADMIN: 'Admin' };
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'];
const nombre = (p) => `${p?.nombre || ''} ${p?.apellido || ''}`.trim() || '(sin nombre)';
const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const estrellas = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const capital = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

/** Texto listo para mandar por WhatsApp, SMS o mail con el código para sumarse como barbero. */
const mensajeCodigo = (codigo, quien) => `Hola${quien ? ` ${quien}` : ''}! Tu código para sumarte como barbero en BELABARBERÍA es: ${codigo}

Si ya tenés cuenta: abrí la app → Cuenta → "¿Trabajás en la barbería?" y escribilo.
Si no tenés cuenta: Crear cuenta → Barbero → "Tengo el código de la barbería".`;

async function compartirCodigo(codigo, quien) {
  try {
    await Share.share({ message: mensajeCodigo(codigo, quien) });
  } catch (e) {
    Alert.alert('No se pudo abrir el menú para compartir', textoError(e));
  }
}

function confirmar(titulo, mensaje, onSi, textoSi = 'Sí') {
  Alert.alert(titulo, mensaje, [{ text: 'No', style: 'cancel' }, { text: textoSi, onPress: onSi }]);
}

/** Ejecuta una escritura: aviso breve si sale bien, alerta si falla. */
// 📘 Ejecuta una acción y muestra "Listo" o el error. Así todas las secciones responden igual.
async function operar(fn, tituloError = 'No se pudo completar') {
  try {
    const r = await fn();
    avisar(r?.mensaje || 'Listo');
    return true;
  } catch (e) {
    Alert.alert(tituloError, textoError(e));
    return false;
  }
}

// 📘 Hook para cargar datos de la API con estado de carga y error, y volver a cargar cuando algo cambia.
function useApi(fn, recarga) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await fn()); } catch (e) { setError(textoError(e)); }
  }, [fn]);
  useEffect(() => { cargar(); }, [cargar, recarga]);
  return { datos, error, cargar };
}

function Lista({ estado, children }) {
  if (estado.error) return <ErrorCaja texto={estado.error} onReintentar={estado.cargar} />;
  if (!estado.datos) return <Cargando />;
  return children(estado.datos);
}

function BotonNuevo({ titulo, onPress }) {
  return <Boton titulo={titulo} icono="add" onPress={onPress} />;
}

// ======================================================================
// TURNOS
// ======================================================================
const cargarTurnos = () => api('/appointments').then((r) => r.turnos);
const TRANSICIONES = { PENDIENTE: [['CONFIRMADO', 'Confirmar', 'checkmark'], ['CANCELADO', 'Cancelar', 'close']], CONFIRMADO: [['FINALIZADO', 'Completar', 'checkmark-done'], ['CANCELADO', 'Cancelar', 'close']] };

// 📘 Turnos: ver todos, cambiar el estado y cargar un turno para un cliente (por ejemplo, si llamó por teléfono).
function AdminTurnos({ recarga }) {
  const estado = useApi(cargarTurnos, recarga);
  const dias = useMemo(() => [{ iso: null }, ...proximosDias(14)], []);
  const [dia, setDia] = useState(hoyNegocio());
  const [filtro, setFiltro] = useState('Activos');
  const [nuevo, setNuevo] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [usuarios, setUsuarios] = useState(null);
  const catalogo = useCatalogo({ user: { id: 'admin' } }, nuevo);

  useEffect(() => {
    if (nuevo && !usuarios) api('/users?activo=true').then((r) => setUsuarios(r.usuarios)).catch((e) => avisar(textoError(e), 'error'));
  }, [nuevo]);

  const cambiar = (t, nuevoEstado) => confirmar('Cambiar estado', `¿${{ CONFIRMADO: 'Confirmar', FINALIZADO: 'Completar', CANCELADO: 'Cancelar' }[nuevoEstado]} el turno de ${nombre(t.cliente)}?`, async () => {
    await operar(() => api(`/appointments/${t.id}`, { method: 'PUT', body: { estado: nuevoEstado } }), 'No se pudo actualizar');
    estado.cargar();
  });

  const cerrarNuevo = () => { setNuevo(false); setCliente(null); setBuscar(''); };

  return (
    <View>
      <BotonNuevo titulo="Cargar turno para un cliente" onPress={() => setNuevo(true)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {dias.map((d) => {
          const activo = d.iso === dia;
          if (!d.iso) {
            return (
              <Pressable key="todos" onPress={() => setDia(null)} style={[styles.dia, activo && styles.diaActivo, { justifyContent: 'center' }]} accessibilityRole="button" accessibilityState={{ selected: activo }}>
                <Icono nombre="list" color={activo ? colors.sobreGold : colors.text} />
                <Text style={[styles.diaMes, activo && { color: colors.sobreGold }]}>Todos</Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={d.iso} onPress={() => setDia(d.iso)} style={[styles.dia, activo && styles.diaActivo]} accessibilityRole="button" accessibilityLabel={`${DIAS[d.dow]} ${d.dia}`} accessibilityState={{ selected: activo }}>
              <Text style={[styles.diaDow, activo && { color: colors.sobreGold }]}>{DIAS[d.dow].slice(0, 3)}</Text>
              <Text style={[styles.diaNum, activo && { color: colors.sobreGold }]}>{d.dia}</Text>
              <Text style={[styles.diaMes, activo && { color: colors.sobreGold }]}>{MESES[d.mes - 1]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pestanas opciones={['Activos', 'Completados', 'Cancelados']} activa={filtro} onCambiar={setFiltro} />
      <Lista estado={estado}>{(turnos) => {
        const ok = { Activos: ['PENDIENTE', 'CONFIRMADO'], Completados: ['FINALIZADO'], Cancelados: ['CANCELADO'] }[filtro];
        const lista = turnos.filter((t) => ok.includes(t.estado) && (!dia || t.fecha === dia))
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        if (!lista.length) return <Vacio icono="calendar-outline" texto={dia ? `No hay turnos ${filtro.toLowerCase()} el ${fechaCorta(dia)}.` : 'No hay turnos en este estado.'} />;
        return lista.map((t) => (
          <Ticket key={t.id} fecha={t.fecha} hora={t.hora} apagado={t.estado === 'CANCELADO'}>
            <Text style={styles.cardTitle}>{nombre(t.cliente)}</Text>
            <Text style={styles.cardDescription}>{t.servicio?.nombre} · {nombre(t.barbero)}</Text>
            {t.cliente?.telefono ? <Text style={styles.cardDescription}>Tel. {t.cliente.telefono}</Text> : null}
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Estado estado={t.estado} />
              <Text style={[styles.price, { marginTop: 8 }]}>{pesos(t.precio)}</Text>
            </View>
            {t.pago && t.estado !== 'CANCELADO' && (
              <Text style={[styles.aviso, t.pago.estado === 'PAGADO' && { color: colors.ok }]}>
                {t.pago.estado === 'PAGADO' ? 'Pagado' : t.pago.informado_at ? (t.pago.metodo === 'TRANSFERENCIA' ? 'El cliente avisó que transfirió' : `Paga en el local (${(t.pago.metodo || '').toLowerCase()})`) : 'Pago pendiente'}
              </Text>
            )}
            {(TRANSICIONES[t.estado] || []).length > 0 && (
              <View style={styles.fila}>
                {TRANSICIONES[t.estado].map(([e, txt, ic]) => (
                  <Boton key={e} chico titulo={txt} icono={ic} variante={e === 'CANCELADO' ? 'peligro' : 'secundario'} onPress={() => cambiar(t, e)} />
                ))}
              </View>
            )}
          </Ticket>
        ));
      }}</Lista>

      <Hoja visible={nuevo} titulo="Nuevo turno" onCerrar={cerrarNuevo}>
        {!cliente ? (
          <View>
            <Campo etiqueta="Buscar cliente" value={buscar} onChangeText={setBuscar} placeholder="Nombre o email" autoCapitalize="none" />
            {!usuarios && <Cargando />}
            {usuarios && usuarios
              .filter((u) => u.rol === 'USUARIO' && `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(buscar.toLowerCase()))
              .slice(0, 30)
              .map((u) => (
                <Pressable key={u.id} onPress={() => setCliente(u)} style={styles.opcion} accessibilityRole="button" accessibilityLabel={nombre(u)}>
                  <Avatar nombre={nombre(u)} tam={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opcionTitulo}>{nombre(u)}</Text>
                    <Text style={styles.opcionSub}>{u.email}</Text>
                  </View>
                  <Icono nombre="chevron-forward" color={colors.faint} />
                </Pressable>
              ))}
          </View>
        ) : (
          <View>
            <Pressable onPress={() => setCliente(null)}><Text style={[styles.seccionAccion, { marginBottom: 10 }]}>Cambiar cliente</Text></Pressable>
            <Reservar catalogo={catalogo} cliente={cliente} onReservado={() => { cerrarNuevo(); estado.cargar(); }} />
          </View>
        )}
      </Hoja>
    </View>
  );
}

// ======================================================================
// PAGOS
// ======================================================================
const cargarPagos = () => api('/payments').then((r) => r.pagos);

// 📘 Pagos: registrar cobros (efectivo, transferencia, tarjeta) o volver un pago a pendiente.
function AdminPagos({ recarga }) {
  const estado = useApi(cargarPagos, recarga);
  const [filtro, setFiltro] = useState('Pendientes');
  const [cobrando, setCobrando] = useState(null);
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [guardando, setGuardando] = useState(false);

  const cobrar = async () => {
    setGuardando(true);
    const ok = await operar(() => api('/payments', { method: 'POST', body: { turno_id: cobrando.turno_id, metodo } }), 'No se pudo registrar');
    setGuardando(false);
    if (ok) { setCobrando(null); estado.cargar(); }
  };
  const anular = (p) => confirmar('Volver a pendiente', '¿Marcar este pago como pendiente otra vez?', async () => {
    await operar(() => api(`/payments/${p.id}`, { method: 'PUT', body: { estado: 'PENDIENTE' } }));
    estado.cargar();
  });

  return (
    <View>
      <Texto>Los cobros se hacen en el local. Cada reserva crea un pago pendiente; acá lo marcás como pagado.</Texto>
      <Pestanas opciones={['Pendientes', 'Pagados', 'Cancelados']} activa={filtro} onCambiar={setFiltro} />
      <Lista estado={estado}>{(pagos) => {
        const clave = { Pendientes: 'PENDIENTE', Pagados: 'PAGADO', Cancelados: 'CANCELADO' }[filtro];
        const lista = pagos.filter((p) => p.estado === clave);
        const total = lista.reduce((s, p) => s + p.monto, 0);
        return (
          <View>
            <View style={[styles.accesos, { marginBottom: 12 }]}>
              <View style={styles.stat}><Text style={styles.statNumero}>{pesos(total)}</Text><Text style={styles.statTexto}>{filtro.toLowerCase()}</Text></View>
              <View style={styles.stat}><Text style={styles.statNumero}>{lista.length}</Text><Text style={styles.statTexto}>pagos</Text></View>
            </View>
            {!lista.length && <Vacio icono="cash-outline" texto="No hay pagos en este estado." />}
            {lista.map((p) => (
              <Tarjeta key={p.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.cardTitle}>{p.turno?.servicio?.nombre || 'Servicio'}</Text>
                  <Text style={styles.price}>{pesos(p.monto)}</Text>
                </View>
                <Text style={styles.cardDescription}>{p.turno ? `${fechaCorta(p.turno.fecha)} ${horaCorta(p.turno.hora)} · ${nombre(p.turno.barbero)}` : ''}</Text>
                <Text style={styles.cardDescription}>Turno {p.turno ? capital(p.turno.estado === 'FINALIZADO' ? 'COMPLETADO' : p.turno.estado) : ''}{p.metodo ? ` · ${capital(p.metodo)}` : ''}</Text>
                <View style={styles.fila}>
                  {p.estado === 'PENDIENTE' && p.turno?.estado !== 'CANCELADO' && <Boton chico titulo="Registrar cobro" icono="cash-outline" onPress={() => { setMetodo('EFECTIVO'); setCobrando(p); }} />}
                  {p.estado === 'PAGADO' && <Boton chico variante="fantasma" titulo="Volver a pendiente" icono="arrow-undo" onPress={() => anular(p)} />}
                </View>
              </Tarjeta>
            ))}
          </View>
        );
      }}</Lista>

      <Hoja visible={!!cobrando} titulo="Registrar cobro" onCerrar={() => setCobrando(null)}>
        {cobrando && (
          <View>
            <Tarjeta>
              <DetalleFila etiqueta="Servicio" valor={cobrando.turno?.servicio?.nombre || '-'} />
              <DetalleFila etiqueta="Turno" valor={cobrando.turno ? `${fechaCorta(cobrando.turno.fecha)} ${horaCorta(cobrando.turno.hora)}` : '-'} />
              <DetalleFila etiqueta="Monto" valor={pesos(cobrando.monto)} />
            </Tarjeta>
            <Etiqueta>Método de pago</Etiqueta>
            <View style={styles.subTabs}>
              {METODOS.map((m) => <Chip key={m} texto={capital(m)} activo={metodo === m} onPress={() => setMetodo(m)} />)}
            </View>
            <Boton titulo={`Marcar como pagado`} icono="checkmark" onPress={cobrar} cargando={guardando} style={{ marginTop: 8 }} />
          </View>
        )}
      </Hoja>
    </View>
  );
}

// ======================================================================
// SERVICIOS Y CATEGORÍAS
// ======================================================================
const cargarServicios = async () => {
  const [s, c] = await Promise.all([api('/services?todos=true'), api('/categories?todas=true')]);
  return { servicios: s.servicios, categorias: c.categorias };
};

// 📘 Servicios y categorías: crear, editar y eliminar. Si un servicio tiene turnos, se desactiva en vez de borrarse.
function AdminServicios({ recarga }) {
  const estado = useApi(cargarServicios, recarga);
  const [form, setForm] = useState(null);
  const [cat, setCat] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const precio = Number(String(form.precio).replace(',', '.'));
    const duracion = Number(form.duracion);
    const e = {};
    if (form.nombre.trim().length < 2) e.nombre = 'Escribí al menos 2 caracteres.';
    if (!Number.isFinite(precio) || precio <= 0) e.precio = 'Ingresá un precio mayor a 0.';
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) e.duracion = 'Elegí una duración entre 5 y 480 minutos.';
    setErrores(e);
    if (Object.keys(e).length) return;
    const puntos = String(form.puntos ?? '').trim() === '' ? null : Number(form.puntos);
    if (puntos !== null && (!Number.isInteger(puntos) || puntos < 0 || puntos > 10000)) return setErrores({ puntos: 'Entre 0 y 10.000, o vacío para el cálculo automático.' });
    const body = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, precio, duracion, activo: form.activo, categoria_id: form.categoria_id || null, estilos: form.estilos || [], puntos };
    setGuardando(true);
    const ok = await operar(() => (form.id ? api(`/services/${form.id}`, { method: 'PUT', body }) : api('/services', { method: 'POST', body })), 'No se pudo guardar');
    setGuardando(false);
    if (ok) { setForm(null); estado.cargar(); }
  };

  const eliminar = (s) => confirmar('Eliminar servicio', `¿Eliminar "${s.nombre}"? Si tiene turnos, se desactiva para conservar el historial.`, async () => {
    const ok = await operar(() => api(`/services/${s.id}`, { method: 'DELETE' }), 'No se pudo eliminar');
    if (ok) { setForm(null); estado.cargar(); }
  }, 'Eliminar');

  const guardarCat = async () => {
    if (cat.nombre.trim().length < 2) return avisar('El nombre de la categoría es muy corto', 'error');
    const body = { nombre: cat.nombre.trim(), descripcion: cat.descripcion?.trim() || null, activo: cat.activo };
    const ok = await operar(() => (cat.id ? api(`/categories/${cat.id}`, { method: 'PUT', body }) : api('/categories', { method: 'POST', body })), 'No se pudo guardar');
    if (ok) { setCat(null); estado.cargar(); }
  };
  const eliminarCat = (c) => confirmar('Eliminar categoría', `¿Eliminar "${c.nombre}"? Sus servicios quedan sin categoría.`, async () => {
    const ok = await operar(() => api(`/categories/${c.id}`, { method: 'DELETE' }), 'No se pudo eliminar');
    if (ok) { setCat(null); estado.cargar(); }
  }, 'Eliminar');

  const abrir = (s) => { setErrores({}); setForm(s ? { ...s, descripcion: s.descripcion || '', precio: String(s.precio), duracion: String(s.duracion), estilos: s.estilos || [], puntos: s.puntos === null || s.puntos === undefined ? '' : String(s.puntos) } : { nombre: '', descripcion: '', precio: '', duracion: '30', activo: true, categoria_id: null, estilos: [], puntos: '' }); };

  return (
    <Lista estado={estado}>{({ servicios, categorias }) => (
      <View>
        <BotonNuevo titulo="Nuevo servicio" onPress={() => abrir(null)} />
        {!servicios.length && <Vacio icono="cut-outline" titulo="No hay servicios" texto="Cargá los servicios de la barbería con su precio y duración." />}
        {servicios.map((s) => (
          <Tarjeta key={s.id} onPress={() => abrir(s)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, !s.activo && { opacity: 0.55 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.nombre}</Text>
              <Text style={styles.cardDescription}>{s.duracion} min · {s.categoria?.nombre || 'Sin categoría'}{s.activo ? '' : ' · Inactivo'}</Text>
              {s.estilos?.length ? <Text style={styles.aviso}>{s.estilos.map(nombreEstilo).join(' · ')}</Text> : null}
            </View>
            <Text style={styles.price}>{pesos(s.precio)}</Text>
            <Icono nombre="create-outline" color={colors.faint} />
          </Tarjeta>
        ))}

        <Seccion titulo="Categorías" accion="Nueva" onAccion={() => setCat({ nombre: '', descripcion: '', activo: true })} />
        <View style={styles.subTabs}>
          {categorias.map((c) => <Chip key={c.id} texto={c.activo ? c.nombre : `${c.nombre} (inactiva)`} icono="pricetag-outline" onPress={() => setCat({ ...c })} />)}
          {!categorias.length && <Texto>Opcionales: sirven para agrupar los servicios.</Texto>}
        </View>

        <Hoja visible={!!form} titulo={form?.id ? 'Editar servicio' : 'Nuevo servicio'} onCerrar={() => setForm(null)}>
          {form && (
            <View>
              <Campo etiqueta="Nombre" value={form.nombre} onChangeText={(v) => setForm({ ...form, nombre: v })} maxLength={120} error={errores.nombre} placeholder="Ej.: Corte y barba" />
              <Campo etiqueta="Descripción (opcional)" value={form.descripcion} onChangeText={(v) => setForm({ ...form, descripcion: v })} multiline maxLength={500} />
              <Campo etiqueta="Precio ($)" value={form.precio} onChangeText={(v) => setForm({ ...form, precio: v.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" error={errores.precio} placeholder="0" />
              <Etiqueta>Duración</Etiqueta>
              <View style={styles.subTabs}>
                {['15', '20', '30', '45', '60', '90'].map((d) => <Chip key={d} texto={`${d} min`} activo={form.duracion === d} onPress={() => setForm({ ...form, duracion: d })} />)}
              </View>
              {errores.duracion ? <Text style={styles.campoError}>{errores.duracion}</Text> : null}
              <Etiqueta>Categoría</Etiqueta>
              <View style={styles.subTabs}>
                <Chip texto="Sin categoría" activo={!form.categoria_id} onPress={() => setForm({ ...form, categoria_id: null })} />
                {categorias.filter((c) => c.activo).map((c) => <Chip key={c.id} texto={c.nombre} activo={form.categoria_id === c.id} onPress={() => setForm({ ...form, categoria_id: c.id })} />)}
              </View>
              <SelectorEstilos valor={form.estilos} onCambiar={(v) => setForm({ ...form, estilos: v })} />
              <Campo etiqueta="Puntos que da (vacío = automático)" value={form.puntos} onChangeText={(v) => setForm({ ...form, puntos: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={5} error={errores.puntos} placeholder="Automático: corte y barba 150 · barba 70 · resto 100" />
              <Interruptor etiqueta="Visible para reservar" valor={form.activo} onCambiar={(v) => setForm({ ...form, activo: v })} />
              <Boton titulo="Guardar" icono="save-outline" onPress={guardar} cargando={guardando} />
              {form.id && <Boton titulo="Eliminar servicio" icono="trash-outline" variante="peligro" onPress={() => eliminar(form)} />}
            </View>
          )}
        </Hoja>

        <Hoja visible={!!cat} titulo={cat?.id ? 'Editar categoría' : 'Nueva categoría'} onCerrar={() => setCat(null)}>
          {cat && (
            <View>
              <Campo etiqueta="Nombre" value={cat.nombre} onChangeText={(v) => setCat({ ...cat, nombre: v })} maxLength={60} />
              <Campo etiqueta="Descripción (opcional)" value={cat.descripcion || ''} onChangeText={(v) => setCat({ ...cat, descripcion: v })} maxLength={300} />
              <Interruptor etiqueta="Activa" valor={cat.activo} onCambiar={(v) => setCat({ ...cat, activo: v })} />
              <Boton titulo="Guardar" icono="save-outline" onPress={guardarCat} />
              {cat.id && <Boton titulo="Eliminar categoría" icono="trash-outline" variante="peligro" onPress={() => eliminarCat(cat)} />}
            </View>
          )}
        </Hoja>
      </View>
    )}</Lista>
  );
}

// ======================================================================
// BARBEROS Y HORARIOS
// ======================================================================
const cargarEquipo = async () => {
  const [b, u, h] = await Promise.all([api('/barbers?todos=true'), api('/users'), api('/schedules')]);
  return { barberos: b.barberos, usuarios: u.usuarios, horarios: h.horarios };
};

// 📘 Equipo: barberos y sus franjas de horario. Sin franjas, un barbero no tiene horarios para reservar.
function AdminEquipo({ recarga }) {
  const estado = useApi(cargarEquipo, recarga);
  const [form, setForm] = useState(null);
  const [franja, setFranja] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) return avisar('Nombre y apellido son obligatorios', 'error');
    if (form.foto_url.trim() && !/^https?:\/\/\S+$/i.test(form.foto_url.trim())) return avisar('La foto debe ser un enlace https://', 'error');
    const body = { nombre: form.nombre.trim(), apellido: form.apellido.trim(), especialidad: form.especialidad.trim() || null, foto_url: form.foto_url.trim() || null, usuario_id: form.usuario_id || null, activo: form.activo, estilos: form.estilos || [] };
    setGuardando(true);
    const ok = await operar(() => (form.id ? api(`/barbers/${form.id}`, { method: 'PUT', body }) : api('/barbers', { method: 'POST', body })), 'No se pudo guardar');
    setGuardando(false);
    if (ok) { setForm(null); estado.cargar(); }
  };

  const guardarFranja = async () => {
    if (!franja.hora_inicio || !franja.hora_fin) return avisar('Elegí la hora de inicio y de fin', 'error');
    if (franja.hora_fin <= franja.hora_inicio) return avisar('La hora de fin debe ser posterior a la de inicio', 'error');
    const dias = franja.id ? [franja.dia_semana] : franja.dias;
    if (!dias.length) return avisar('Elegí al menos un día', 'error');
    setGuardando(true);
    try {
      if (franja.id) {
        await api(`/schedules/${franja.id}`, { method: 'PUT', body: { dia_semana: franja.dia_semana, hora_inicio: franja.hora_inicio, hora_fin: franja.hora_fin, activo: franja.activo } });
      } else {
        for (const d of dias) {
          await api('/schedules', { method: 'POST', body: { barbero_id: franja.barbero_id, dia_semana: d, hora_inicio: franja.hora_inicio, hora_fin: franja.hora_fin, activo: true } });
        }
      }
      avisar(franja.id ? 'Franja actualizada' : `Franja cargada en ${dias.length} día${dias.length > 1 ? 's' : ''}`);
      setFranja(null);
    } catch (e) {
      Alert.alert('No se pudo guardar', textoError(e));
    } finally {
      setGuardando(false);
      estado.cargar();
    }
  };

  const eliminarFranja = (h) => confirmar('Eliminar franja', `¿Eliminar ${DIAS[h.dia_semana]} ${horaCorta(h.hora_inicio)} a ${horaCorta(h.hora_fin)}?`, async () => {
    const ok = await operar(() => api(`/schedules/${h.id}`, { method: 'DELETE' }), 'No se pudo eliminar');
    if (ok) { setFranja(null); estado.cargar(); }
  }, 'Eliminar');

  return (
    <Lista estado={estado}>{({ barberos, usuarios, horarios }) => {
      const porId = new Map(usuarios.map((u) => [u.id, u]));
      const ocupados = new Set(barberos.filter((b) => b.usuario_id && b.id !== form?.id).map((b) => b.usuario_id));
      const candidatos = usuarios.filter((p) => p.rol === 'BARBERO' && !ocupados.has(p.id));
      return (
        <View>
          <BotonNuevo titulo="Nuevo barbero" onPress={() => setForm({ nombre: '', apellido: '', especialidad: '', foto_url: '', usuario_id: null, activo: true })} />
          {!barberos.length && <Vacio icono="people-outline" titulo="No hay barberos" texto="Cargá al menos un barbero y sus horarios para que los clientes puedan reservar." />}
          {barberos.map((b) => {
            const suyos = horarios.filter((h) => h.barbero_id === b.id).sort((x, y) => x.dia_semana - y.dia_semana || x.hora_inicio.localeCompare(y.hora_inicio));
            return (
              <Tarjeta key={b.id} style={!b.activo && { opacity: 0.6 }}>
                <Pressable onPress={() => setForm({ ...b, especialidad: b.especialidad || '', foto_url: b.foto_url || '' })} style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }} accessibilityRole="button" accessibilityLabel={`Editar ${nombre(b)}`}>
                  <Avatar nombre={nombre(b)} foto={b.foto_url} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{nombre(b)}</Text>
                    <Text style={styles.cardDescription}>{b.especialidad || 'General'}{b.activo ? '' : ' · Inactivo'}</Text>
                    <Text style={styles.aviso}>{b.usuario_id ? `Cuenta: ${porId.get(b.usuario_id)?.email || 'vinculada'}` : 'Sin cuenta vinculada'}</Text>
                  </View>
                  <Icono nombre="create-outline" color={colors.faint} />
                </Pressable>
                <View style={styles.separador} />
                <Etiqueta>Horarios de atención</Etiqueta>
                <View style={styles.subTabs}>
                  {suyos.map((h) => <Chip key={h.id} texto={`${DIAS[h.dia_semana].slice(0, 3)} ${horaCorta(h.hora_inicio)}–${horaCorta(h.hora_fin)}`} activo={false} deshabilitado={false} onPress={() => setFranja({ ...h, hora_inicio: horaCorta(h.hora_inicio), hora_fin: horaCorta(h.hora_fin) })} />)}
                  {!suyos.length && <Text style={styles.aviso}>Sin horarios: no se le pueden reservar turnos.</Text>}
                </View>
                {b.activo && <Boton chico variante="secundario" icono="time-outline" titulo="Agregar horario" onPress={() => setFranja({ barbero_id: b.id, dias: [1, 2, 3, 4, 5], hora_inicio: '09:00', hora_fin: '13:00' })} style={{ alignSelf: 'flex-start' }} />}
              </Tarjeta>
            );
          })}

          <Hoja visible={!!form} titulo={form?.id ? 'Editar barbero' : 'Nuevo barbero'} onCerrar={() => setForm(null)}>
            {form && (
              <View>
                <Campo etiqueta="Nombre" value={form.nombre} onChangeText={(v) => setForm({ ...form, nombre: v })} maxLength={60} />
                <Campo etiqueta="Apellido" value={form.apellido} onChangeText={(v) => setForm({ ...form, apellido: v })} maxLength={60} />
                <Campo etiqueta="Especialidad (opcional)" value={form.especialidad} onChangeText={(v) => setForm({ ...form, especialidad: v })} maxLength={120} />
                <Campo etiqueta="Enlace de foto (opcional)" value={form.foto_url} onChangeText={(v) => setForm({ ...form, foto_url: v })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
                <Etiqueta>Cuenta para entrar a la app</Etiqueta>
                <View style={styles.subTabs}>
                  <Chip texto="Sin cuenta" activo={!form.usuario_id} onPress={() => setForm({ ...form, usuario_id: null })} />
                  {candidatos.map((p) => <Chip key={p.id} texto={nombre(p)} activo={form.usuario_id === p.id} onPress={() => setForm({ ...form, usuario_id: p.id })} />)}
                </View>
                {!candidatos.length && <Text style={[styles.aviso, { marginBottom: 12 }]}>Para vincular una cuenta, primero cambiale el rol a Barbero en Usuarios.</Text>}
                <SelectorEstilos valor={form.estilos || []} onCambiar={(v) => setForm({ ...form, estilos: v })} />
                <Interruptor etiqueta="Recibe reservas" valor={form.activo} onCambiar={(v) => setForm({ ...form, activo: v })} />
                <Boton titulo="Guardar" icono="save-outline" onPress={guardar} cargando={guardando} />
              </View>
            )}
          </Hoja>

          <Hoja visible={!!franja} titulo={franja?.id ? 'Editar horario' : 'Agregar horario'} onCerrar={() => setFranja(null)}>
            {franja && (
              <View>
                <Etiqueta>{franja.id ? 'Día' : 'Días (podés elegir varios)'}</Etiqueta>
                <View style={styles.subTabs}>
                  {DIAS.map((d, i) => {
                    const activo = franja.id ? franja.dia_semana === i : franja.dias.includes(i);
                    return <Chip key={d} texto={d.slice(0, 3)} activo={activo} onPress={() => setFranja(franja.id ? { ...franja, dia_semana: i } : { ...franja, dias: activo ? franja.dias.filter((x) => x !== i) : [...franja.dias, i] })} />;
                  })}
                </View>
                <Etiqueta>Desde</Etiqueta>
                <SelectorHora valor={franja.hora_inicio} onCambiar={(v) => setFranja({ ...franja, hora_inicio: v })} />
                <Etiqueta>Hasta</Etiqueta>
                <SelectorHora valor={franja.hora_fin} onCambiar={(v) => setFranja({ ...franja, hora_fin: v })} />
                <Texto>{franja.hora_inicio || '--:--'} a {franja.hora_fin || '--:--'}</Texto>
                {franja.id && <Interruptor etiqueta="Activa" valor={franja.activo} onCambiar={(v) => setFranja({ ...franja, activo: v })} />}
                <Boton titulo="Guardar" icono="save-outline" onPress={guardarFranja} cargando={guardando} />
                {franja.id && <Boton titulo="Eliminar horario" icono="trash-outline" variante="peligro" onPress={() => eliminarFranja(franja)} />}
              </View>
            )}
          </Hoja>
        </View>
      );
    }}</Lista>
  );
}

// ======================================================================
// USUARIOS
// ======================================================================
const cargarUsuarios = () => api('/users').then((r) => r.usuarios);
const cargarSolicitudes = () => api('/users/barber-requests').then((r) => r.solicitudes);

/** Pedidos de clientes que quieren trabajar como barberos. Aprobar = rol BARBERO + ficha vinculada. */
// 📘 Pedidos para ser barbero: aprobar (pasa a BARBERO y se le crea la ficha) o rechazar.
export function SolicitudesBarbero({ recarga, onCambio, destacado }) {
  const estado = useApi(cargarSolicitudes, recarga);
  const [ocupado, setOcupado] = useState(null);
  const [mandarA, setMandarA] = useState(null); // persona a la que se le manda el código
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  if (estado.error || !estado.datos?.length) return null;

  // Guarda el código (cifrado en el servidor) y abre el menú del teléfono para mandarlo
  const guardarYCompartir = async () => {
    const c = codigo.trim();
    if (c.length < 6) return setErrorCodigo('Usá al menos 6 caracteres. Mejor si mezcla letras y números.');
    setErrorCodigo(null);
    setGuardando(true);
    try {
      await api('/barbershop/barber-code', { method: 'PUT', body: { codigo: c } });
      const quien = mandarA?.nombre || '';
      setMandarA(null); setCodigo('');
      await compartirCodigo(c, quien);
    } catch (e) {
      setErrorCodigo(textoError(e));
    } finally {
      setGuardando(false);
    }
  };

  const aprobar = (u) => confirmar('Aprobar barbero', `¿Aprobar a ${nombre(u)} como barbero? Se le crea su ficha y le llega un aviso: al abrir la app ve su Agenda.`, async () => {
    setOcupado(u.id);
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: { rol: 'BARBERO' } });
      await api('/barbers', { method: 'POST', body: { nombre: u.nombre || 'Barbero', apellido: u.apellido || '-', usuario_id: u.id, foto_url: u.avatar_url || null, activo: true } });
      avisar(`${nombre(u)} ya es barbero y le avisamos. Cargale los horarios en Equipo.`);
    } catch (e) {
      Alert.alert('No se pudo aprobar', textoError(e));
    } finally {
      setOcupado(null);
      estado.cargar();
      onCambio?.();
    }
  }, 'Aprobar');

  const rechazar = (u) => confirmar('Rechazar pedido', `¿Rechazar el pedido de ${nombre(u)}? Sigue siendo cliente.`, async () => {
    await operar(() => api(`/users/${u.id}/barber-request`, { method: 'DELETE' }), 'No se pudo rechazar');
    estado.cargar();
  }, 'Rechazar');

  return (
    <View style={{ marginBottom: 8 }} accessibilityLiveRegion="polite">
      <Seccion titulo={`${destacado ? '🔔 ' : ''}Quieren ser barberos (${estado.datos.length})`} />
      {destacado && <Text style={[styles.aviso, { marginBottom: 10, marginTop: -4 }]}>Aprobá con un toque (le llega un aviso y entra con su agenda) o mandale el código de la barbería.</Text>}
      {estado.datos.map((u) => (
        <Tarjeta key={u.id} style={{ borderColor: colors.gold }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
            <Avatar nombre={nombre(u)} foto={u.avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{nombre(u)}</Text>
              <Text style={styles.cardDescription} numberOfLines={1}>{u.email}</Text>
              {u.telefono ? <Text style={styles.cardDescription}>Tel.: {u.telefono}</Text> : null}
              {u.solicitado_at ? <Text style={styles.aviso}>Pidió el {fechaCorta(String(u.solicitado_at).slice(0, 10))}</Text> : null}
            </View>
          </View>
          <Boton titulo="Aprobar como barbero" icono="checkmark-circle-outline" cargando={ocupado === u.id} onPress={() => aprobar(u)} style={{ marginTop: 12 }} />
          <View style={styles.fila}>
            <Boton chico titulo="Mandar código" icono="share-outline" variante="secundario" onPress={() => { setMandarA(u); setCodigo(''); setErrorCodigo(null); }} />
            <Boton chico titulo="Rechazar" icono="close" variante="peligro" onPress={() => rechazar(u)} />
          </View>
        </Tarjeta>
      ))}

      <Hoja visible={!!mandarA} titulo={mandarA ? `Mandarle el código a ${nombre(mandarA)}` : ''} onCerrar={() => setMandarA(null)}>
        <Texto>Escribí el código de la barbería. Se guarda cifrado y se abre el menú del teléfono para mandarlo por WhatsApp, SMS o mail.</Texto>
        <Text style={[styles.aviso, { marginBottom: 12 }]}>Si ya habías creado uno, escribilo de nuevo (por seguridad no se puede ver). Si escribís otro, reemplaza al anterior.</Text>
        <Campo etiqueta="Código de la barbería" value={codigo} onChangeText={(v) => { setCodigo(v); setErrorCodigo(null); }} autoCapitalize="none" autoCorrect={false} maxLength={32} error={errorCodigo} />
        <Boton titulo="Guardar y compartir" icono="share-social-outline" onPress={guardarYCompartir} cargando={guardando} />
        <Text style={styles.aviso}>¿Más rápido? Tocá "Aprobar como barbero": no hace falta código.</Text>
      </Hoja>
    </View>
  );
}

// 📘 Usuarios: cambiar el rol y activar o desactivar cuentas (con funciones de la base que solo puede usar el admin).
function AdminUsuarios({ miId, recarga }) {
  const estado = useApi(cargarUsuarios, recarga);
  const [buscar, setBuscar] = useState('');
  const [rolFiltro, setRolFiltro] = useState('Todos');
  const [abierto, setAbierto] = useState(null);

  const cambiarRol = (u, rol) => confirmar('Cambiar rol', `¿Cambiar a ${nombre(u)} de ${NOMBRE_ROL[u.rol]} a ${NOMBRE_ROL[rol]}?`, async () => {
    const ok = await operar(() => api(`/users/${u.id}`, { method: 'PUT', body: { rol } }), 'No se pudo cambiar el rol');
    if (ok) { setAbierto(null); estado.cargar(); }
  });
  const cambiarActivo = (u) => confirmar(u.activo ? 'Desactivar cuenta' : 'Reactivar cuenta',
    u.activo ? `¿Desactivar a ${nombre(u)}? No podrá reservar; su historial se conserva.` : `¿Reactivar a ${nombre(u)}?`,
    async () => {
      const ok = await operar(() => api(`/users/${u.id}`, { method: 'PUT', body: { activo: !u.activo } }), 'No se pudo actualizar');
      if (ok) { setAbierto(null); estado.cargar(); }
    });

  return (
    <Lista estado={estado}>{(usuarios) => {
      const filtrados = usuarios.filter((u) => (rolFiltro === 'Todos' || NOMBRE_ROL[u.rol] === rolFiltro)
        && `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(buscar.toLowerCase()));
      const u = usuarios.find((x) => x.id === abierto);
      return (
        <View>
          <SolicitudesBarbero recarga={recarga} onCambio={estado.cargar} />
          <Campo value={buscar} onChangeText={setBuscar} placeholder="Buscar por nombre o email" autoCapitalize="none" />
          <View style={styles.subTabs}>
            {['Todos', 'Cliente', 'Barbero', 'Admin'].map((r) => <Chip key={r} texto={r} activo={rolFiltro === r} onPress={() => setRolFiltro(r)} />)}
          </View>
          {!filtrados.length && <Vacio icono="search-outline" texto="Nadie coincide con la búsqueda." />}
          {filtrados.map((x) => (
            <Pressable key={x.id} onPress={() => setAbierto(x.id)} style={[styles.opcion, !x.activo && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={nombre(x)}>
              <Avatar nombre={nombre(x)} tam={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.opcionTitulo}>{nombre(x)}{x.id === miId ? ' (vos)' : ''}</Text>
                <Text style={styles.opcionSub} numberOfLines={1}>{x.email}</Text>
              </View>
              <Text style={[styles.opcionSub, { color: colors.gold, fontWeight: '700' }]}>{NOMBRE_ROL[x.rol]}{x.activo ? '' : ' · off'}</Text>
            </Pressable>
          ))}

          <Hoja visible={!!u} titulo={u ? nombre(u) : ''} onCerrar={() => setAbierto(null)}>
            {u && (
              <View>
                <Tarjeta>
                  <DetalleFila etiqueta="Email" valor={u.email} />
                  <DetalleFila etiqueta="Teléfono" valor={u.telefono || '-'} />
                  <DetalleFila etiqueta="Estado" valor={u.activo ? 'Activa' : 'Desactivada'} />
                </Tarjeta>
                {u.id === miId ? <Texto>No podés cambiar tu propio rol ni desactivarte.</Texto> : (
                  <View>
                    <Etiqueta>Rol</Etiqueta>
                    <View style={styles.subTabs}>
                      {ROLES.map((r) => <Chip key={r} texto={NOMBRE_ROL[r]} activo={u.rol === r} onPress={() => u.rol !== r && cambiarRol(u, r)} />)}
                    </View>
                    <Boton titulo={u.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'} icono={u.activo ? 'ban-outline' : 'checkmark-circle-outline'} variante={u.activo ? 'peligro' : 'secundario'} onPress={() => cambiarActivo(u)} style={{ marginTop: 10 }} />
                  </View>
                )}
              </View>
            )}
          </Hoja>
        </View>
      );
    }}</Lista>
  );
}

// ======================================================================
// RESEÑAS Y BARBERÍA
// ======================================================================
const cargarResenas = () => api('/reviews');

function AdminResenas({ recarga }) {
  const estado = useApi(cargarResenas, recarga);
  const eliminar = (r) => confirmar('Eliminar reseña', '¿Eliminar esta reseña? Usalo solo si es ofensiva o un error.', async () => {
    await operar(() => api(`/reviews/${r.id}`, { method: 'DELETE' }), 'No se pudo eliminar');
    estado.cargar();
  }, 'Eliminar');
  return (
    <Lista estado={estado}>{({ resenas, promedio, total }) => (
      <View>
        <View style={[styles.accesos, { marginBottom: 12 }]}>
          <View style={styles.stat}><Text style={styles.statNumero}>{promedio ?? '-'} ★</Text><Text style={styles.statTexto}>promedio</Text></View>
          <View style={styles.stat}><Text style={styles.statNumero}>{total}</Text><Text style={styles.statTexto}>reseñas</Text></View>
        </View>
        {!resenas.length && <Vacio icono="star-outline" texto="Todavía no hay reseñas." />}
        {resenas.map((r) => (
          <Tarjeta key={r.id}>
            <Text style={styles.estrellas}>{estrellas(r.calificacion)}</Text>
            <Text style={[styles.cardDescription, { marginTop: 4 }]}>{r.turno?.servicio?.nombre} · {nombre(r.turno?.barbero)} · {r.turno ? fechaCorta(r.turno.fecha) : ''}</Text>
            {r.comentario ? <Text style={[styles.cardTitle, { fontWeight: '500', marginTop: 6 }]}>“{r.comentario}”</Text> : null}
            <Boton chico variante="fantasma" icono="trash-outline" titulo="Eliminar" onPress={() => eliminar(r)} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
          </Tarjeta>
        ))}
      </View>
    )}</Lista>
  );
}

const cargarBarberia = () => api('/barbershop').then((r) => r.barberia);

function AdminBarberia({ recarga }) {
  const estado = useApi(cargarBarberia, recarga);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (estado.datos) {
      const b = estado.datos;
      setForm({ nombre: b.nombre || '', direccion: b.direccion || '', telefono: b.telefono || '', email: b.email || '', descripcion: b.descripcion || '', alias_transferencia: b.alias_transferencia || '', cbu: b.cbu || '', titular_cuenta: b.titular_cuenta || '' });
    }
  }, [estado.datos]);

  const guardar = async () => {
    if (!form.nombre.trim()) return avisar('El nombre es obligatorio', 'error');
    setGuardando(true);
    await operar(() => api('/barbershop', {
      method: 'PUT',
      body: { nombre: form.nombre.trim(), direccion: form.direccion.trim() || null, telefono: form.telefono.trim() || null, email: form.email.trim() || null, descripcion: form.descripcion.trim() || null, alias_transferencia: form.alias_transferencia.trim() || null, cbu: form.cbu.replace(/\s/g, '') || null, titular_cuenta: form.titular_cuenta.trim() || null }
    }), 'No se pudo guardar');
    setGuardando(false);
    estado.cargar();
  };

  if (estado.error) return <ErrorCaja texto={estado.error} onReintentar={estado.cargar} />;
  if (!form) return <Cargando />;
  return (
    <View>
      <Texto>Datos del local que ven los clientes.</Texto>
      <Campo etiqueta="Nombre" value={form.nombre} onChangeText={(v) => setForm({ ...form, nombre: v })} maxLength={80} />
      <Campo etiqueta="Dirección" value={form.direccion} onChangeText={(v) => setForm({ ...form, direccion: v })} maxLength={200} />
      <Campo etiqueta="Teléfono" value={form.telefono} onChangeText={(v) => setForm({ ...form, telefono: v })} keyboardType="phone-pad" maxLength={20} />
      <Campo etiqueta="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
      <Campo etiqueta="Descripción" value={form.descripcion} onChangeText={(v) => setForm({ ...form, descripcion: v })} multiline maxLength={1000} />
      <Seccion titulo="Datos para transferencias" />
      <Text style={[styles.aviso, { marginBottom: 12, marginTop: -4 }]}>Los ven los clientes cuando eligen pagar por transferencia.</Text>
      <Campo etiqueta="Alias" value={form.alias_transferencia} onChangeText={(v) => setForm({ ...form, alias_transferencia: v })} autoCapitalize="none" maxLength={60} />
      <Campo etiqueta="CBU o CVU (22 números)" value={form.cbu} onChangeText={(v) => setForm({ ...form, cbu: v.replace(/[^\d]/g, '') })} keyboardType="number-pad" maxLength={22} />
      <Campo etiqueta="Titular de la cuenta" value={form.titular_cuenta} onChangeText={(v) => setForm({ ...form, titular_cuenta: v })} maxLength={100} />
      <Boton titulo="Guardar" icono="save-outline" onPress={guardar} cargando={guardando} />
      <AdminCodigoBarbero recarga={recarga} />
    </View>
  );
}

const cargarCodigo = () => api('/barbershop/barber-code');

/** Código que los barberos usan para registrarse sin esperar aprobación. Se guarda cifrado: nunca se muestra. */
// 📘 Código para barberos: se guarda cifrado (bcrypt), por eso después no se puede volver a ver; solo cambiarlo o desactivarlo.
function AdminCodigoBarbero({ recarga }) {
  const estado = useApi(cargarCodigo, recarga);
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [recienGuardado, setRecienGuardado] = useState(null); // para compartirlo enseguida
  const activo = !!estado.datos?.activo;

  const guardar = async (valor) => {
    if (valor !== null && valor.trim().length < 6) return setError('Usá al menos 6 caracteres. Mejor si mezcla letras y números.');
    setError(null);
    setGuardando(true);
    const ok = await operar(() => api('/barbershop/barber-code', { method: 'PUT', body: { codigo: valor === null ? null : valor.trim() } }), 'No se pudo guardar el código');
    setGuardando(false);
    if (ok) { setRecienGuardado(valor === null ? null : valor.trim()); setNuevo(''); estado.cargar(); }
  };

  const desactivar = () => Alert.alert('Desactivar código', 'Nadie va a poder sumarse como barbero con código hasta que crees uno nuevo. Los barberos que ya entraron siguen igual.', [
    { text: 'Volver', style: 'cancel' },
    { text: 'Desactivar', style: 'destructive', onPress: () => guardar(null) }
  ]);

  return (
    <View>
      <Seccion titulo="Código para barberos" />
      <Tarjeta>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Icono nombre={activo ? 'checkmark-circle' : 'close-circle'} color={activo ? colors.ok : colors.muted} />
          <Text style={styles.cardTitle}>{estado.error ? 'No se pudo consultar' : !estado.datos ? 'Consultando…' : activo ? 'Código activo' : 'Sin código activo'}</Text>
        </View>
        <Text style={styles.cardDescription}>
          Quien se registre como barbero con este código entra directo con su agenda; después le cargás los horarios en Equipo. Por seguridad el código se guarda cifrado y no se puede volver a ver: si lo olvidás, creá uno nuevo.
        </Text>
      </Tarjeta>
      <Campo etiqueta={activo ? 'Nuevo código (reemplaza al actual)' : 'Código'} value={nuevo} onChangeText={(v) => { setNuevo(v); setError(null); }} autoCapitalize="none" autoCorrect={false} maxLength={32} error={error} placeholder="Ej.: una frase que solo sepa tu equipo" />
      <Boton titulo="Guardar código" icono="key-outline" onPress={() => guardar(nuevo)} cargando={guardando} />
      {recienGuardado && activo && <Boton titulo="Compartir el código (WhatsApp, SMS…)" icono="share-social-outline" variante="secundario" onPress={() => compartirCodigo(recienGuardado)} />}
      {activo && <Boton titulo="Desactivar código" icono="close-circle-outline" variante="peligro" onPress={desactivar} />}
    </View>
  );
}

const SECCIONES = [
  ['Turnos', 'calendar-outline'], ['Pagos', 'cash-outline'], ['Servicios', 'cut-outline'], ['Equipo', 'people-outline'],
  ['Galería', 'images-outline'], ['Recompensas', 'gift-outline'],
  ['Usuarios', 'person-circle-outline'], ['Reseñas', 'star-outline'], ['Barbería', 'storefront-outline']
];

// 📘 Pantalla del admin: las secciones aparecen como botones (chips) arriba.
export function PanelAdmin({ perfil, recargarClave }) {
  const [tab, setTab] = useState('Turnos');
  return (
    <View>
      <Titulo>Administración</Titulo>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {SECCIONES.map(([s, ic]) => <Chip key={s} texto={s} icono={ic} activo={tab === s} onPress={() => setTab(s)} />)}
      </ScrollView>
      {tab === 'Turnos' && <AdminTurnos recarga={recargarClave} />}
      {tab === 'Pagos' && <AdminPagos recarga={recargarClave} />}
      {tab === 'Servicios' && <AdminServicios recarga={recargarClave} />}
      {tab === 'Equipo' && <AdminEquipo recarga={recargarClave} />}
      {tab === 'Galería' && <AdminGaleria recarga={recargarClave} />}
      {tab === 'Recompensas' && <AdminRecompensas recarga={recargarClave} />}
      {tab === 'Usuarios' && <AdminUsuarios miId={perfil?.id} recarga={recargarClave} />}
      {tab === 'Reseñas' && <AdminResenas recarga={recargarClave} />}
      {tab === 'Barbería' && <AdminBarberia recarga={recargarClave} />}
    </View>
  );
}

// ======================================================================
// ESTILOS, GALERÍA Y RECOMPENSAS
// ======================================================================
function SelectorEstilos({ valor, onCambiar }) {
  return (
    <View>
      <Etiqueta>Estilos (para "Elegí tu estilo")</Etiqueta>
      <View style={styles.subTabs}>
        {ESTILOS.map(([k, t]) => {
          const activo = valor.includes(k);
          return <Chip key={k} texto={t} activo={activo} onPress={() => onCambiar(activo ? valor.filter((x) => x !== k) : [...valor, k])} />;
        })}
      </View>
    </View>
  );
}

const cargarGaleria = async () => {
  const [g, b] = await Promise.all([api('/gallery'), api('/barbers')]);
  return { fotos: g.fotos, barberos: b.barberos };
};

// 📘 Galería: subir fotos de trabajos a Storage (bucket "galeria") con su barbero y estilo.
function AdminGaleria({ recarga }) {
  const estado = useApi(cargarGaleria, recarga);
  const [barberoId, setBarberoId] = useState(null);
  const [estilo, setEstilo] = useState('FADE');
  const [descripcion, setDescripcion] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const subir = (camara) => async () => {
    if (!barberoId) return avisar('Elegí de qué barbero es el trabajo', 'error');
    setSubiendo(true);
    try {
      const foto = await elegirFotoGaleria(barberoId, { camara });
      if (!foto) return;
      const r = await api('/gallery', { method: 'POST', body: { barbero_id: barberoId, estilo, descripcion: descripcion.trim() || null, url: foto.url, path: foto.path } });
      avisar(r.mensaje);
      setDescripcion('');
      estado.cargar();
    } catch (e) {
      Alert.alert('No se pudo subir la foto', textoError(e));
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = (f) => confirmar('Eliminar foto', `¿Eliminar esta foto de ${nombre(f.barbero)}? Se borra también el archivo.`, async () => {
    if (await operar(() => api(`/gallery/${f.id}`, { method: 'DELETE' }), 'No se pudo eliminar')) estado.cargar();
  }, 'Eliminar');

  return (
    <Lista estado={estado}>{({ fotos, barberos }) => (
      <View>
        <Tarjeta>
          <Text style={styles.cardTitle}>Subir un trabajo</Text>
          <Text style={[styles.cardDescription, { marginBottom: 10 }]}>Los clientes ven estas fotos en Inicio y en "Elegí tu estilo". Subí solo fotos con permiso de la persona.</Text>
          <Etiqueta>Barbero</Etiqueta>
          <View style={styles.subTabs}>
            {barberos.map((b) => <Chip key={b.id} texto={nombre(b)} activo={barberoId === b.id} onPress={() => setBarberoId(b.id)} />)}
          </View>
          <Etiqueta>Estilo</Etiqueta>
          <View style={styles.subTabs}>
            {ESTILOS.map(([k, t]) => <Chip key={k} texto={t} activo={estilo === k} onPress={() => setEstilo(k)} />)}
          </View>
          <Campo etiqueta="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} maxLength={200} placeholder="Ej.: degradé bajo con raya" />
          <View style={styles.btnFila}>
            <Boton titulo="Elegir foto" icono="images-outline" onPress={subir(false)} cargando={subiendo} style={{ flex: 1, marginBottom: 0 }} />
            <Boton titulo="Sacar foto" icono="camera-outline" variante="secundario" onPress={subir(true)} deshabilitado={subiendo} style={{ flex: 1, marginBottom: 0 }} />
          </View>
        </Tarjeta>
        <Seccion titulo={`Fotos (${fotos.length})`} />
        {!fotos.length && <Vacio icono="images-outline" titulo="Todavía no hay fotos" texto="Subí trabajos reales del equipo para que los clientes elijan su estilo." />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {fotos.map((f) => (
            <View key={f.id} style={{ width: '47%' }}>
              <Image source={{ uri: f.url }} style={{ aspectRatio: 4 / 5, backgroundColor: colors.surface2, borderRadius: 14, width: '100%' }} accessible accessibilityLabel={`${nombreEstilo(f.estilo)} de ${nombre(f.barbero)}`} />
              <Text style={[styles.aviso, { marginTop: 4 }]} numberOfLines={1}>{nombreEstilo(f.estilo)} · {nombre(f.barbero)}</Text>
              <Pressable onPress={() => eliminar(f)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Eliminar foto de ${nombre(f.barbero)}`} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[styles.seccionAccion, { color: colors.danger }]}>Eliminar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    )}</Lista>
  );
}

const cargarRecompensas = () => api('/rewards?todas=true').then((r) => r.recompensas);
const TIPOS_RECOMPENSA = [['DESCUENTO', 'Descuento %'], ['SERVICIO', 'Servicio'], ['OTRO', 'Otro']];

/**
 * El dueño crea un código de recompensa para un cliente (sin descontarle puntos).
 * Usa la función regalar_recompensa de la base: solo la puede ejecutar una cuenta ADMIN activa;
 * le llega un aviso al cliente y lo ve en Cuenta → Recompensas → Mis recompensas.
 */
function RegalarRecompensa({ recompensas, onRegalado }) {
  const [usuarios, setUsuarios] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [cliente, setCliente] = useState(null);
  const [recompensa, setRecompensa] = useState(null);
  const [creando, setCreando] = useState(false);
  const [creado, setCreado] = useState(null); // { codigo, nombre, cliente }
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/users?activo=true&rol=USUARIO').then((r) => setUsuarios(r.usuarios || [])).catch((e) => { setUsuarios([]); setError(textoError(e)); });
  }, []);

  const nombreDe = (u) => [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email || 'Cliente';
  const coinciden = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!usuarios || t.length < 2) return [];
    return usuarios.filter((u) => `${u.nombre || ''} ${u.apellido || ''} ${u.email || ''}`.toLowerCase().includes(t)).slice(0, 5);
  }, [usuarios, busqueda]);

  // 📘 Regalar: llama a la función regalar_recompensa de Supabase. Solo funciona si quien la llama es ADMIN (lo controla la base).
  //    Crea un código con costo 0 puntos y le manda un aviso al cliente.
  const crear = async () => {
    if (!cliente) return setError('Elegí a qué cliente se la regalás.');
    if (!recompensa) return setError('Elegí qué recompensa le regalás.');
    setError(null); setCreando(true);
    try {
      const { data, error: e } = await supabase.rpc('regalar_recompensa', { p_usuario: cliente.id, p_recompensa_id: recompensa.id });
      if (e) throw new Error(e.message || 'No se pudo crear el código.');
      setCreado({ codigo: data.codigo, nombre: data.nombre, cliente: nombreDe(cliente) });
      avisar('Código creado y enviado', 'ok');
      setCliente(null); setRecompensa(null); setBusqueda('');
      onRegalado?.();
    } catch (e) { setError(e.message || textoError(e)); } finally { setCreando(false); }
  };

  const compartir = () => Share.share({ message: `¡Hola ${creado.cliente}! Te regalamos "${creado.nombre}" en BELABARBERÍA. Tu código es ${creado.codigo}: mostralo cuando vengas. También lo ves en la app, en Cuenta → Recompensas.` }).catch(() => {});

  return (
    <Tarjeta>
      <Text style={styles.cardTitle}>Regalar una recompensa</Text>
      <Text style={[styles.cardDescription, { marginBottom: 10 }]}>Creá un código para un cliente. No le descuenta puntos y le llega un aviso.</Text>

      {creado ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.label}>Código para {creado.cliente}</Text>
          <Text style={[styles.hero, { fontSize: 28, marginBottom: 4 }]} selectable accessibilityLabel={`Código ${creado.codigo.split('').join(' ')}`}>{creado.codigo}</Text>
          <Text style={[styles.cardDescription, { marginBottom: 12 }]}>{creado.nombre}. Ya lo ve en su app (Cuenta → Recompensas).</Text>
          <Boton titulo="Mandárselo por WhatsApp u otra app" icono="share-social-outline" variante="secundario" onPress={compartir} />
          <Boton titulo="Regalar otra" variante="fantasma" onPress={() => setCreado(null)} style={{ marginBottom: 0 }} />
        </View>
      ) : (
        <View>
          {cliente ? (
            <Seleccionable titulo={nombreDe(cliente)} subtitulo="Cliente elegido · tocá para cambiar" icono="person-outline" activo onPress={() => setCliente(null)} />
          ) : (
            <View>
              <Campo etiqueta="Cliente" value={busqueda} onChangeText={(v) => { setBusqueda(v); setError(null); }} placeholder="Buscá por nombre o email" autoCorrect={false} />
              {usuarios === null ? <Cargando /> : busqueda.trim().length >= 2 && !coinciden.length
                ? <Text style={[styles.aviso, { marginBottom: 10, marginTop: -6 }]}>No hay clientes con ese nombre.</Text>
                : coinciden.map((u) => <Seleccionable key={u.id} titulo={nombreDe(u)} subtitulo={u.email} icono="person-outline" onPress={() => { setCliente(u); setError(null); }} />)}
            </View>
          )}
          <Text style={[styles.label, { marginTop: 4 }]}>Recompensa</Text>
          {recompensas.length ? (
            <View style={[styles.subTabs, { marginBottom: 8 }]}>
              {recompensas.map((r) => <Chip key={r.id} texto={r.nombre} icono="gift-outline" activo={recompensa?.id === r.id} onPress={() => { setRecompensa(r); setError(null); }} />)}
            </View>
          ) : <Text style={[styles.aviso, { marginBottom: 10 }]}>Primero creá una recompensa en "Recompensas del club", más abajo.</Text>}
          {error ? <Text style={[styles.campoError, { marginBottom: 10 }]} accessibilityRole="alert">{error}</Text> : null}
          <Boton titulo="Crear código y avisarle" icono="gift-outline" onPress={crear} cargando={creando} deshabilitado={!recompensas.length} style={{ marginBottom: 0 }} />
        </View>
      )}
    </Tarjeta>
  );
}

// 📘 Recompensas: crear y editar las que se canjean con puntos, regalar una a un cliente y validar los códigos entregados.
function AdminRecompensas({ recarga }) {
  const estado = useApi(cargarRecompensas, recarga);
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const costo = Number(form.costo);
    const valor = String(form.valor ?? '').trim() === '' ? null : Number(form.valor);
    const e = {};
    if (form.nombre.trim().length < 2) e.nombre = 'Escribí al menos 2 caracteres.';
    if (!Number.isInteger(costo) || costo < 1) e.costo = 'Poné cuántos puntos cuesta (número entero).';
    if (form.tipo === 'DESCUENTO' && (!Number.isInteger(valor) || valor < 1 || valor > 100)) e.valor = 'El descuento va de 1 a 100 %.';
    setErrores(e);
    if (Object.keys(e).length) return;
    const body = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, costo, tipo: form.tipo, valor: form.tipo === 'DESCUENTO' ? valor : null, activo: form.activo };
    setGuardando(true);
    const ok = await operar(() => (form.id ? api(`/rewards/${form.id}`, { method: 'PUT', body }) : api('/rewards', { method: 'POST', body })), 'No se pudo guardar');
    setGuardando(false);
    if (ok) { setForm(null); estado.cargar(); }
  };

  const [regalados, setRegalados] = useState(0);
  return (
    <View>
      <RegalarRecompensa recompensas={(estado.datos || []).filter((r) => r.activo)} onRegalado={() => setRegalados((n) => n + 1)} />
      <ValidarCanje conLista recarga={regalados} />
      <Seccion titulo="Recompensas del club" accion="Nueva" onAccion={() => { setErrores({}); setForm({ nombre: '', descripcion: '', costo: '', tipo: 'DESCUENTO', valor: '10', activo: true }); }} />
      <Text style={[styles.aviso, { marginBottom: 10, marginTop: 0 }]}>Niveles: Bronze 0 · Silver 500 · Gold 1500 · VIP 3000 puntos ganados. Los puntos se suman solos al completar un turno.</Text>
      <Lista estado={estado}>{(lista) => (
        <View>
          {!lista.length && <Vacio icono="gift-outline" titulo="Sin recompensas" texto="Creá recompensas para que los clientes canjeen sus puntos." />}
          {lista.map((r) => (
            <Tarjeta key={r.id} onPress={() => { setErrores({}); setForm({ ...r, descripcion: r.descripcion || '', costo: String(r.costo), valor: r.valor === null ? '' : String(r.valor) }); }} style={[{ alignItems: 'center', flexDirection: 'row', gap: 12 }, !r.activo && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.nombre}</Text>
                <Text style={styles.cardDescription}>{r.descripcion || capital(r.tipo)}{r.activo ? '' : ' · Inactiva'}</Text>
              </View>
              <Text style={styles.price}>{Number(r.costo).toLocaleString('es-AR')} pts</Text>
              <Icono nombre="create-outline" color={colors.faint} />
            </Tarjeta>
          ))}
        </View>
      )}</Lista>
      <Hoja visible={!!form} titulo={form?.id ? 'Editar recompensa' : 'Nueva recompensa'} onCerrar={() => setForm(null)}>
        {form && (
          <View>
            <Campo etiqueta="Nombre" value={form.nombre} onChangeText={(v) => setForm({ ...form, nombre: v })} maxLength={80} error={errores.nombre} />
            <Campo etiqueta="Descripción (opcional)" value={form.descripcion} onChangeText={(v) => setForm({ ...form, descripcion: v })} maxLength={300} multiline />
            <Campo etiqueta="Costo en puntos" value={form.costo} onChangeText={(v) => setForm({ ...form, costo: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} error={errores.costo} />
            <Etiqueta>Tipo</Etiqueta>
            <View style={styles.subTabs}>
              {TIPOS_RECOMPENSA.map(([k, t]) => <Chip key={k} texto={t} activo={form.tipo === k} onPress={() => setForm({ ...form, tipo: k })} />)}
            </View>
            {form.tipo === 'DESCUENTO' && <Campo etiqueta="Descuento (%)" value={form.valor} onChangeText={(v) => setForm({ ...form, valor: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} error={errores.valor} />}
            <Interruptor etiqueta="Disponible para canjear" valor={form.activo} onCambiar={(v) => setForm({ ...form, activo: v })} />
            <Boton titulo="Guardar" icono="save-outline" onPress={guardar} cargando={guardando} />
          </View>
        )}
      </Hoja>
    </View>
  );
}
