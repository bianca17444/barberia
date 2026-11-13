import { supabase } from '../lib/supabase.js';

export const profileService = {
  /**
   * Obtener perfil del usuario por ID
   */
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data;
  },

  /**
   * Actualizar perfil
   */
  async updateProfile(userId, updates) {
    // Solo los campos que la base permite editar al usuario
    const permitidos = {};
    for (const campo of ['nombre', 'apellido', 'telefono', 'avatar_url']) {
      if (campo in updates) permitidos[campo] = updates[campo];
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(permitidos)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Subir avatar a Supabase Storage (Bucket 'avatars')
   */
  async uploadAvatar(userId, file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

    // 1. Subir archivo al bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 2. Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const avatarUrl = publicUrlData.publicUrl;

    // 3. Actualizar la columna avatar_url en la tabla profiles
    await this.updateProfile(userId, { avatar_url: avatarUrl });

    return avatarUrl;
  },

  /**
   * Eliminar avatar de Supabase Storage
   */
  async deleteAvatar(userId, filePath) {
    if (filePath) {
      await supabase.storage.from('avatars').remove([filePath]);
    }
    await this.updateProfile(userId, { avatar_url: null });
  },

  /**
   * Listar todos los perfiles (Solo para Administrador)
   */
  async getAllProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Cambiar el rol de un usuario (solo ADMIN, verificado en Supabase).
   * RPC: admin_cambiar_rol(p_usuario_id uuid, p_rol text)
   */
  async cambiarRol(userId, rol) {
    const { data, error } = await supabase.rpc('admin_cambiar_rol', {
      p_usuario_id: userId,
      p_rol: rol
    });
    if (error) throw error;
    return data;
  }
};
