import { authService } from '../services/auth.service.js';
import { showToast } from '../lib/toast.js';

export function setupAuthModals(onAuthSuccess) {
  const modalOverlay = document.getElementById('auth-modal-overlay');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-form');
  const updatePasswordForm = document.getElementById('update-password-form');

  const tabLogin = document.getElementById('tab-to-login');
  const tabRegister = document.getElementById('tab-to-register');
  const linkForgot = document.getElementById('link-forgot-password');
  const linkBackToLogin = document.getElementById('link-back-to-login');
  const modalClose = document.getElementById('auth-modal-close');

  const btnGoogleLogin = document.getElementById('btn-google-login');
  const btnGoogleRegister = document.getElementById('btn-google-register');

  // Modal switching helpers
  function showTab(tab) {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.add('hidden');
    if (updatePasswordForm) updatePasswordForm.classList.add('hidden');

    tabLogin.classList.remove('active');
    tabRegister.classList.remove('active');

    if (tab === 'login') {
      loginForm.classList.remove('hidden');
      tabLogin.classList.add('active');
    } else if (tab === 'register') {
      registerForm.classList.remove('hidden');
      tabRegister.classList.add('active');
    } else if (tab === 'forgot') {
      forgotForm.classList.remove('hidden');
    } else if (tab === 'update-password') {
      if (updatePasswordForm) updatePasswordForm.classList.remove('hidden');
    }
  }

  function openModal(initialTab = 'login') {
    showTab(initialTab);
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  // Event Listeners
  if (tabLogin) tabLogin.addEventListener('click', () => showTab('login'));
  if (tabRegister) tabRegister.addEventListener('click', () => showTab('register'));
  if (linkForgot) linkForgot.addEventListener('click', (e) => { e.preventDefault(); showTab('forgot'); });
  if (linkBackToLogin) linkBackToLogin.addEventListener('click', (e) => { e.preventDefault(); showTab('login'); });
  if (modalClose) modalClose.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Google Login
  const handleGoogleAuth = async () => {
    try {
      await authService.signInWithGoogle();
    } catch (err) {
      showToast('Error al conectar con Google: ' + (err.message || 'Intente nuevamente'), 'error');
    }
  };

  if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', handleGoogleAuth);
  if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', handleGoogleAuth);

  // Submit Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showToast('Por favor completa todos los campos', 'warning');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Iniciando...';

      await authService.signInWithPassword({ email, password });
      showToast('¡Bienvenido a la Barbería!', 'success');
      closeModal();
      loginForm.reset();
      if (onAuthSuccess) onAuthSuccess();
    } catch (err) {
      let msg = 'No se pudo iniciar sesión.';
      if (err.message?.includes('Invalid login credentials')) {
        msg = 'Email o contraseña incorrectos.';
      } else if (err.message) {
        msg = err.message;
      }
      showToast(msg, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar Sesión';
    }
  });

  // Submit Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-confirm-password').value;

    if (!nombre || !apellido || !email || !password) {
      showToast('Por favor completa los campos obligatorios', 'warning');
      return;
    }

    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }

    if (password !== confirmPass) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Registrando...';

      const data = await authService.signUp({ email, password, nombre, apellido, telefono });
      
      if (data.session) {
        showToast('¡Cuenta creada exitosamente! Bienvenido.', 'success');
      } else {
        showToast('Registro exitoso. Revisa tu email para confirmar tu cuenta si es necesario.', 'success', 6000);
      }

      closeModal();
      registerForm.reset();
      if (onAuthSuccess) onAuthSuccess();
    } catch (err) {
      showToast(err.message || 'Error al crear la cuenta', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear Cuenta';
    }
  });

  // Submit Forgot Password
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    const email = document.getElementById('forgot-email').value.trim();

    if (!email) {
      showToast('Ingresa tu correo electrónico', 'warning');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Enviando...';

      await authService.resetPasswordForEmail(email);
      showToast('Enlace de recuperación enviado. Revisa tu casilla de correo.', 'success', 6000);
      closeModal();
      forgotForm.reset();
    } catch (err) {
      showToast(err.message || 'Error al solicitar recuperación', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Enlace';
    }
  });

  // Submit Update Password
  if (updatePasswordForm) {
    updatePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = updatePasswordForm.querySelector('button[type="submit"]');
      const newPassword = document.getElementById('update-new-password').value;

      if (!newPassword || newPassword.length < 6) {
        showToast('La nueva contraseña debe tener al menos 6 caracteres', 'warning');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Actualizando...';

        await authService.updatePassword(newPassword);
        showToast('Contraseña actualizada con éxito.', 'success');
        closeModal();
        updatePasswordForm.reset();
      } catch (err) {
        showToast(err.message || 'Error al actualizar la contraseña', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Contraseña';
      }
    });
  }

  return {
    openLogin: () => openModal('login'),
    openRegister: () => openModal('register'),
    openForgot: () => openModal('forgot'),
    openUpdatePassword: () => openModal('update-password'),
    close: closeModal
  };
}
