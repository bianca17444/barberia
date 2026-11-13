import { supabase } from '../lib/supabase.js';

export const edgeService = {
  /**
   * Invocar Edge Function para calcular el precio del turno si está disponible
   */
  async calcularPrecioTurno({ servicioId, barberoId, fecha, basePrecio }) {
    try {
      const { data, error } = await supabase.functions.invoke('calcular-precio', {
        body: {
          servicio_id: servicioId,
          barbero_id: barberoId,
          fecha: fecha
        }
      });

      if (error) {
        // Si la Edge function aún no ha sido desplegada en Supabase, usamos el precio base
        console.warn('Edge function no disponible o con error, usando precio base:', error.message);
        return basePrecio;
      }

      return data?.precioFinal ?? basePrecio;
    } catch (err) {
      console.warn('Fallo al invocar Edge function calcular-precio:', err);
      return basePrecio;
    }
  }
};
