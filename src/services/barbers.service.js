import { supabase } from '../lib/supabase.js';

export const barbersService = {
  /**
   * Obtener barberos de la barbería
   */
  async getBarberos(onlyActive = true) {
    let query = supabase
      .from('barberos')
      .select('*')
      .order('nombre', { ascending: true });

    if (onlyActive) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Crear barbero (Admin)
   */
  async createBarbero(barberData) {
    const { data, error } = await supabase
      .from('barberos')
      .insert([barberData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar barbero (Admin)
   */
  async updateBarbero(id, updates) {
    const { data, error } = await supabase
      .from('barberos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar barbero (Admin)
   */
  async deleteBarbero(id) {
    const { error } = await supabase
      .from('barberos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
