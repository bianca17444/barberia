import { servicesService } from '../services/services.service.js';
import { escapeHtml } from '../lib/html.js';

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

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
 * Catálogo de servicios (privado: solo con sesión iniciada).
 * @param {(id:string)=>void} onSelectService
 * @param {{ isLoggedIn: boolean, onLogin?: () => void }} opciones
 */
export async function renderServices(onSelectService, { isLoggedIn = false, onLogin } = {}) {
  const container = document.getElementById('services-list-container');
  if (!container) return;

  if (!isLoggedIn) {
    mensaje(container, `
      <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1rem;">Iniciá sesión para ver los servicios y precios.</p>
      <button type="button" class="btn btn-gold btn-sm js-login-catalogo">Iniciar sesión</button>
    `);
    container.querySelector('.js-login-catalogo')?.addEventListener('click', () => onLogin && onLogin());
    return;
  }

  mensaje(container, `
    <div class="spinner"></div>
    <p style="margin-top: 1rem; color: var(--text-secondary);">Cargando catálogo de servicios...</p>
  `);

  try {
    const servicios = await servicesService.getServicios(true);

    if (!servicios.length) {
      mensaje(container, '<p style="font-size: 1.1rem; color: var(--text-secondary);">Todavía no hay servicios disponibles.</p>');
      return;
    }

    const imagenTematica = (nombre = '') => {
      const lower = nombre.toLowerCase();
      if (lower.includes('barba')) return 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80';
      if (lower.includes('vip') || lower.includes('completo')) return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80';
      if (lower.includes('color') || lower.includes('cana')) return 'https://images.unsplash.com/photo-1517832606589-7629c3395907?auto=format&fit=crop&w=600&q=80';
      return 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=80';
    };

    container.innerHTML = servicios.map((s) => `
      <div class="service-card" data-service-id="${s.id}">
        <div class="service-img-wrap">
          <img src="${imagenTematica(s.nombre)}" alt="${escapeHtml(s.nombre)}" loading="lazy">
          <span class="service-badge-duration">${Number(s.duracion)} min</span>
        </div>
        <div class="service-content">
          <h3 class="service-name">${escapeHtml(s.nombre)}</h3>
          <p class="service-desc">${escapeHtml(s.descripcion || 'Servicio profesional de barbería.')}</p>
          <div class="service-footer">
            <span class="service-price">${formatoPrecio.format(s.precio || 0)}</span>
            <button class="btn btn-outline-gold btn-sm btn-book-service" data-service-id="${s.id}">Reservar</button>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-book-service').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-service-id');
        if (onSelectService) onSelectService(id);
      });
    });
  } catch (error) {
    console.error('Error al cargar servicios:', error);
    mensaje(container, `
      <p style="color: #f87171; font-weight: 600;">No se pudieron cargar los servicios.</p>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">${escapeHtml(error.message || 'Verificá tu conexión.')}</p>
    `, 'error');
  }
}
