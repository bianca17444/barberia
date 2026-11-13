import { supabase } from '../lib/supabase.js';

/**
 * Turnos. Las reglas (dueño, estados, 24 h, solapamientos, horarios)
 * las aplica Supabase; acá solo se llaman las operaciones permitidas.
 */
export const appointmentsService = {
  /**
   * Todos los turnos (solo ADMIN: RLS devuelve únicamente lo permitido)
   */
  async getAllTurnos() {
    const { data, error } = await supabase
      .from('turnos')
      .select(`
        *,
        profiles:usuario_id (id, nombre, apellido, telefono),
        servicios:servicio_id (id, nombre, precio, duracion),
        barberos:barbero_id (id, nombre, apellido, especialidad)
      `)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Turnos del usuario autenticado ("Mis turnos")
   */
  async getMisTurnos(userId) {
    const { data, error } = await supabase
      .from('turnos')
      .select(`
        *,
        servicios:servicio_id (id, nombre, precio, duracion),
        barberos:barbero_id (id, nombre, apellido, especialidad, foto_url)
      `)
      .eq('usuario_id', userId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Turnos asignados al barbero autenticado, con datos mínimos del cliente.
   * RPC: turnos_del_barbero(p_desde date, p_hasta date)
   */
  async getTurnosBarbero({ desde = null, hasta = null } = {}) {
    const { data, error } = await supabase.rpc('turnos_del_barbero', {
      p_desde: desde,
      p_hasta: hasta
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Crear un turno. Supabase valida horario laboral, solapamientos,
   * fecha pasada y que barbero/servicio estén activos.
   */
  async createTurno({ usuario_id, barbero_id, servicio_id, fecha, hora }) {
    const { data, error } = await supabase
      .from('turnos')
      .insert([
        {
          usuario_id,
          barbero_id: Number(barbero_id),
          servicio_id: Number(servicio_id),
          fecha,
          hora
        }
      ])
      .select(`
        *,
        servicios:servicio_id (id, nombre, precio),
        barberos:barbero_id (id, nombre, apellido)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cambiar estado (barbero sobre sus turnos o ADMIN).
   * RPC: cambiar_estado_turno(p_turno_id bigint, p_estado text)
   */
  async cambiarEstado(turnoId, nuevoEstado) {
    const { data, error } = await supabase.rpc('cambiar_estado_turno', {
      p_turno_id: Number(turnoId),
      p_estado: nuevoEstado
    });
    if (error) throw error;
    return data;
  },

  /**
   * Cancelar un turno. Para el cliente, Supabase exige al menos 24 h de anticipación.
   * RPC: cancelar_turno(p_turno_id bigint)
   */
  async cancelTurno(turnoId) {
    const { data, error } = await supabase.rpc('cancelar_turno', {
      p_turno_id: Number(turnoId)
    });
    if (error) throw error;
    return data;
  },

  /**
   * Suscribirse a cambios en tiempo real en la tabla turnos.
   * Nota: solo emite eventos si la tabla está agregada a la publicación
   * supabase_realtime; si no, la app sigue funcionando con recargas manuales.
   */
  subscribeToTurnos(onEventCallback) {
    const channel = supabase
      .channel('realtime:turnos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        (payload) => onEventCallback(payload)
      )
      .subscribe();

    return channel;
  }
};
