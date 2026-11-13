import { supabase } from '../lib/supabase.js';

export const authService = {
  /**
   * Registro con Supabase Auth y metadata para trigger
   */
  async signUp({ email, password, nombre, apellido, telefono }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // El rol NO se envía: Supabase siempre crea el perfil como USUARIO.
        data: {
          nombre,
          apellido,
          telefono
        },
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Iniciar sesión con email y contraseña
   */
  async signInWithPassword({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  /**
   * Iniciar sesión con Google OAuth
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Cerrar sesión
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Enviar correo de recuperación de contraseña
   */
  async resetPasswordForEmail(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      // Sin "#" propio: Supabase agrega sus parámetros a esta URL.
      // Al volver se dispara el evento PASSWORD_RECOVERY (ver main.js).
      redirectTo: `${window.location.origin}/?recuperar=1`
    });

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar contraseña del usuario actual
   */
  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener la sesión actual
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Obtener usuario actual
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  /**
   * Escuchar cambios en la autenticación
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
};
