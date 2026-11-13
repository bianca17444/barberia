import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseKey) &&
    !supabaseUrl.includes('tu-proyecto') &&
    !supabaseKey.includes('pega_aqui_tu_clave') &&
    !supabaseKey.includes('placeholder')
  );
};

// Si no está configurado, usamos valores seguros para que la aplicación cargue sin romper
const activeUrl = supabaseUrl || 'https://iznytpilnjbqtctfbvnf.supabase.co';
const activeKey = supabaseKey || 'placeholder-publishable-key';

export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
