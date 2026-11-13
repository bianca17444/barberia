import { isSupabaseConfigured } from './lib/supabase.js';
import { authService } from './services/auth.service.js';
import { profileService } from './services/profile.service.js';
import { appointmentsService } from './services/appointments.service.js';
import { showToast } from './lib/toast.js';

import { setupAuthModals } from './views/authModals.view.js';
import { renderServices } from './views/services.view.js';
import { renderBarbers } from './views/barbers.view.js';
import { setupBookingSection } from './views/booking.view.js';
import { setupMyAppointments } from './views/myAppointments.view.js';
import { setupProfileView } from './views/profile.view.js';
import { setupAdminPanel } from './views/admin.view.js';
import { setupBarberAgenda } from './views/barberAgenda.view.js';

// Estado global
let currentUser = null;
let currentProfile = null;
let ultimoUsuarioCargado = undefined;

// Controladores
let authModalsCtrl = null;
let bookingCtrl = null;
let myAppointmentsCtrl = null;
let profileCtrl = null;
let adminCtrl = null;
let barberCtrl = null;

const abrirLogin = () => authModalsCtrl?.openLogin();

/** El catálogo es privado: se consulta solo después de autenticarse. */
function cargarCatalogo() {
  const opciones = { isLoggedIn: Boolean(currentUser), onLogin: abrirLogin };
  renderServices((id) => bookingCtrl?.selectServiceById(id), opciones);
  renderBarbers((id) => bookingCtrl?.selectBarberById(id), opciones);
  bookingCtrl?.refreshOptions();
}

async function initApp() {
  const warningBanner = document.getElementById('env-warning-banner');
  warningBanner?.classList.toggle('hidden', isSupabaseConfigured());
  if (!isSupabaseConfigured()) {
    console.warn('Supabase no está configurado. Editá el archivo .env con la URL y la clave pública.');
  }

  authModalsCtrl = setupAuthModals(() => handleSessionChange());

  document.getElementById('btn-open-login')?.addEventListener('click', () => authModalsCtrl.openLogin());
  document.getElementById('btn-open-register')?.addEventListener('click', () => authModalsCtrl.openRegister());
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    try {
      await authService.signOut();
      showToast('Sesión cerrada correctamente', 'info');
    } catch (err) {
      showToast('Error al cerrar sesión', 'error');
    }
  });

  bookingCtrl = setupBookingSection(
    () => currentUser,
    abrirLogin,
    () => {
      myAppointmentsCtrl?.reload();
      adminCtrl?.onRealtimeUpdate();
    }
  );

  myAppointmentsCtrl = setupMyAppointments(
    () => currentUser,
    abrirLogin,
    () => bookingCtrl?.refreshSlots() // una cancelación libera el horario
  );

  profileCtrl = setupProfileView(
    () => currentUser,
    async () => {
      await refreshProfile();
      updateNavbarUser();
    }
  );

  adminCtrl = setupAdminPanel(
    () => currentProfile,
    () => cargarCatalogo()
  );

  barberCtrl = setupBarberAgenda(() => currentProfile);

  try {
    appointmentsService.subscribeToTurnos(() => {
      myAppointmentsCtrl?.onRealtimeUpdate();
      adminCtrl?.onRealtimeUpdate();
      barberCtrl?.reload();
    });
  } catch (err) {
    console.warn('Realtime no inicializado:', err);
  }

  // Sesión inicial
  try {
    const session = await authService.getSession();
    currentUser = session?.user || null;
  } catch (err) {
    console.warn('Error comprobando la sesión inicial:', err);
  }
  await handleSessionChange();

  // Cambios de sesión (login, logout, refresco de token, recuperación)
  authService.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    if (event === 'PASSWORD_RECOVERY') {
      authModalsCtrl?.openUpdatePassword();
    }

    if (event === 'INITIAL_SESSION') return; // ya se cargó arriba

    // Evita llamadas a Supabase dentro del callback de auth (recomendación de supabase-js)
    setTimeout(() => {
      if (event === 'TOKEN_REFRESHED' && ultimoUsuarioCargado === (currentUser?.id || null)) return;
      handleSessionChange();
    }, 0);
  });

  // Enlace de recuperación de contraseña
  const params = new URLSearchParams(window.location.search);
  if (params.has('recuperar') || window.location.hash.includes('type=recovery')) {
    setTimeout(() => authModalsCtrl?.openUpdatePassword(), 500);
  }
}

async function refreshProfile() {
  if (!currentUser) {
    currentProfile = null;
    return;
  }
  try {
    currentProfile = await profileService.getProfile(currentUser.id);
  } catch (err) {
    console.warn('No se pudo cargar el perfil del usuario:', err);
    currentProfile = null;
  }
}

function updateNavbarUser() {
  const logged = Boolean(currentUser);
  const rol = currentProfile?.rol;

  document.getElementById('nav-guest-actions')?.classList.toggle('hidden', logged);
  document.getElementById('nav-user-actions')?.classList.toggle('hidden', !logged);
  document.getElementById('nav-item-appointments')?.classList.toggle('hidden', !logged);
  document.getElementById('nav-item-agenda')?.classList.toggle('hidden', rol !== 'BARBERO');
  document.getElementById('nav-item-admin')?.classList.toggle('hidden', rol !== 'ADMIN');
  document.getElementById('my-appointments')?.classList.toggle('hidden', !logged);
  document.getElementById('profile')?.classList.toggle('hidden', !logged);

  if (logged) {
    const displayName = currentProfile?.nombre
      ? `${currentProfile.nombre} ${currentProfile.apellido || ''}`.trim()
      : (currentUser.user_metadata?.nombre || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0]);

    const navUserName = document.getElementById('nav-user-name');
    if (navUserName) navUserName.textContent = displayName;

    const navUserAvatar = document.getElementById('nav-user-avatar');
    if (navUserAvatar && /^https?:\/\//i.test(currentProfile?.avatar_url || '')) {
      navUserAvatar.src = currentProfile.avatar_url;
    }
  }
}

async function handleSessionChange() {
  await refreshProfile();
  ultimoUsuarioCargado = currentUser?.id || null;
  updateNavbarUser();
  cargarCatalogo();
  myAppointmentsCtrl?.reload();
  profileCtrl?.reload();
  adminCtrl?.init();
  barberCtrl?.reload();
}

document.addEventListener('DOMContentLoaded', initApp);
