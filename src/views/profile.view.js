import { profileService } from '../services/profile.service.js';
import { showToast } from '../lib/toast.js';

export function setupProfileView(getCurrentUser, onProfileUpdated) {
  const form = document.getElementById('profile-form');
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarInput = document.getElementById('profile-avatar-input');
  const btnUploadAvatar = document.getElementById('btn-trigger-avatar-upload');
  const roleBadge = document.getElementById('profile-role-badge');
  const userEmailDisplay = document.getElementById('profile-email-display');

  const inputNombre = document.getElementById('profile-nombre');
  const inputApellido = document.getElementById('profile-apellido');
  const inputTelefono = document.getElementById('profile-telefono');

  async function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;

    if (userEmailDisplay) userEmailDisplay.textContent = user.email;

    try {
      const profile = await profileService.getProfile(user.id);
      if (profile) {
        if (inputNombre) inputNombre.value = profile.nombre || '';
        if (inputApellido) inputApellido.value = profile.apellido || '';
        if (inputTelefono) inputTelefono.value = profile.telefono || '';

        if (roleBadge) {
          roleBadge.textContent = profile.rol || 'USUARIO';
          roleBadge.className = `badge ${profile.rol === 'ADMIN' ? 'badge-role' : 'badge-confirmed'}`;
        }

        if (avatarImg) {
          const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';
          avatarImg.src = profile.avatar_url || defaultAvatar;
        }
      }
    } catch (err) {
      console.warn('Error cargando perfil:', err);
    }
  }

  // Trigger file input
  if (btnUploadAvatar && avatarInput) {
    btnUploadAvatar.addEventListener('click', () => {
      avatarInput.click();
    });

    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const user = getCurrentUser();
      if (!user) return;

      // Validate image type
      if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona un archivo de imagen válido', 'warning');
        return;
      }

      // Validate size (max 3MB)
      if (file.size > 3 * 1024 * 1024) {
        showToast('La imagen no puede pesar más de 3MB', 'warning');
        return;
      }

      btnUploadAvatar.disabled = true;
      btnUploadAvatar.textContent = 'Subiendo...';

      try {
        const newAvatarUrl = await profileService.uploadAvatar(user.id, file);
        if (avatarImg) avatarImg.src = newAvatarUrl;
        showToast('Foto de perfil actualizada en Supabase Storage', 'success');
        if (onProfileUpdated) onProfileUpdated();
      } catch (err) {
        console.error('Error al subir avatar a Storage:', err);
        showToast(err.message || 'Error al subir la imagen al bucket avatars', 'error');
      } finally {
        btnUploadAvatar.disabled = false;
        btnUploadAvatar.textContent = 'Cambiar Foto';
      }
    });
  }

  // Submit Profile Form
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      if (!user) return;

      const submitBtn = form.querySelector('button[type="submit"]');

      const updates = {
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        telefono: inputTelefono.value.trim()
      };

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Guardando...';

        await profileService.updateProfile(user.id, updates);
        showToast('Perfil actualizado correctamente', 'success');

        if (onProfileUpdated) onProfileUpdated();
      } catch (err) {
        console.error('Error al actualizar perfil:', err);
        showToast(err.message || 'No se pudo actualizar el perfil', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Cambios';
      }
    });
  }

  return {
    reload: loadProfile
  };
}
