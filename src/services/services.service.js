import { supabase } from '../lib/supabase.js';

export const servicesService = {
  /**
   * Obtener servicios de la barbería
   */
  async getServicios(onlyActive = true) {
    let query = supabase
      .from('servicios')
      .select('*')
      .order('precio', { ascending: true });

    if (onlyActive) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Obtener un servicio por ID
   */
  async getServicioById(id) {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Crear nuevo servicio (Admin)
   */
  async createServicio(serviceData) {
    const { data, error } = await supabase
      .from('servicios')
      .insert([serviceData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Modificar servicio existente (Admin)
   */
  async updateServicio(id, updates) {
    const { data, error } = await supabase
      .from('servicios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar servicio (Admin)
   */
  async deleteServicio(id) {
    const { error } = await supabase
      .from('servicios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
