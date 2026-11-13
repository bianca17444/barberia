import { supabase } from '../lib/supabase.js';

/**
 * Horarios laborales de los barberos y horarios libres para reservar.
 * Los horarios los carga el ADMIN; no hay horarios predefinidos.
 */
export const horariosService = {
  /**
   * Franjas laborales (ADMIN ve todas; el resto, las activas de barberos activos).
   */
  async getHorarios(barberoId = null) {
    let query = supabase
      .from('horarios_barberos')
      .select('*, barberos:barbero_id (id, nombre, apellido)')
      .order('barbero_id', { ascending: true })
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (barberoId) query = query.eq('barbero_id', Number(barberoId));

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * ¿El barbero tiene alguna franja activa para ese día de la semana?
   * Sirve para distinguir "sin horarios configurados" de "todo ocupado".
   */
  async tieneHorariosEseDia(barberoId, diaSemana) {
    const { count, error } = await supabase
      .from('horarios_barberos')
      .select('id', { count: 'exact', head: true })
      .eq('barbero_id', Number(barberoId))
      .eq('dia_semana', diaSemana)
      .eq('activo', true);
    if (error) throw error;
    return (count || 0) > 0;
  },

  /**
   * Horarios libres. RPC: horarios_disponibles(p_barbero_id bigint, p_servicio_id bigint, p_fecha date)
   * Devuelve solo horas; nunca datos de otros clientes.
   */
  async getDisponibles({ barberoId, servicioId, fecha }) {
    const { data, error } = await supabase.rpc('horarios_disponibles', {
      p_barbero_id: Number(barberoId),
      p_servicio_id: Number(servicioId),
      p_fecha: fecha
    });
    if (error) throw error;
    return (data || []).map((row) => String(row.hora).slice(0, 5));
  },

  async createHorario({ barbero_id, dia_semana, hora_inicio, hora_fin, activo = true }) {
    const { data, error } = await supabase
      .from('horarios_barberos')
      .insert([{ barbero_id: Number(barbero_id), dia_semana: Number(dia_semana), hora_inicio, hora_fin, activo }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateHorario(id, updates) {
    const { data, error } = await supabase
      .from('horarios_barberos')
      .update(updates)
      .eq('id', Number(id))
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteHorario(id) {
    const { error } = await supabase.from('horarios_barberos').delete().eq('id', Number(id));
    if (error) throw error;
  }
};
