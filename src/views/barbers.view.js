import { barbersService } from '../services/barbers.service.js';
import { escapeHtml, safeUrl } from '../lib/html.js';

const FOTO_POR_DEFECTO = 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80';

function mensaje(container, html, tipo = 'info') {
  const estilos = tipo === 'error'
    ? 'background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);'
    : 'background: var(--bg-card);';
  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; ${estilos} border-radius: var(--radius-md);">
      ${html}
    </div>
  `;
}

/**
 * Equipo de barberos (privado: solo con sesión iniciada).
 */
export async function renderBarbers(onSelectBarber, { isLoggedIn = false, onLogin } = {}) {
  const container = document.getElementById('barbers-list-container');
  if (!container) return;

  if (!isLoggedIn) {
    mensaje(container, `
      <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1rem;">Iniciá sesión para conocer a nuestro equipo.</p>
      <button type="button" class="btn btn-gold btn-sm js-login-barberos">Iniciar sesión</button>
    `);
    container.querySelector('.js-login-barberos')?.addEventListener('click', () => onLogin && onLogin());
    return;
  }

  mensaje(container, `
    <div class="spinner"></div>
    <p style="margin-top: 1rem; color: var(--text-secondary);">Cargando equipo de barberos...</p>
  `);

  try {
    const barberos = await barbersService.getBarberos(true);

    if (!barberos.length) {
      mensaje(container, '<p style="font-size: 1.1rem; color: var(--text-secondary);">Todavía no hay barberos disponibles.</p>');
      return;
    }

    container.innerHTML = barberos.map((b) => `
      <div class="barber-card" data-barber-id="${b.id}">
        <div class="barber-avatar-wrap">
          <img src="${safeUrl(b.foto_url, FOTO_POR_DEFECTO)}" alt="${escapeHtml(`${b.nombre} ${b.apellido}`)}" loading="lazy">
        </div>
        <div class="barber-info">
          <h3 class="barber-name">${escapeHtml(b.nombre)} ${escapeHtml(b.apellido)}</h3>
          <p class="barber-role">${escapeHtml(b.especialidad || 'Barbero')}</p>
          <button class="btn btn-outline-gold btn-sm btn-select-barber" data-barber-id="${b.id}" style="margin-top: 1rem; width: 100%;">
            Elegir para Turno
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-select-barber').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-barber-id');
        if (onSelectBarber) onSelectBarber(id);
      });
    });
  } catch (error) {
    console.error('Error al cargar barberos:', error);
    mensaje(container, `
      <p style="color: #f87171; font-weight: 600;">No se pudieron cargar los barberos.</p>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">${escapeHtml(error.message || 'Verificá tu conexión.')}</p>
    `, 'error');
  }
}
