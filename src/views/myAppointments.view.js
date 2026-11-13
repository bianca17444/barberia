import { appointmentsService } from '../services/appointments.service.js';
import { showToast } from '../lib/toast.js';
import { escapeHtml } from '../lib/html.js';
import { faltanAlMenos24h, horaCorta, fechaLarga } from '../lib/time.js';

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function badgeClass(estado) {
  switch (estado) {
    case 'CONFIRMADO': return 'badge-confirmed';
    case 'CANCELADO': return 'badge-cancelled';
    case 'FINALIZADO': return 'badge-finished';
    default: return 'badge-pending';
  }
}

export function setupMyAppointments(getCurrentUser, openAuthModal, onCancelled) {
  const container = document.getElementById('my-appointments-list');
  const emptyState = document.getElementById('my-appointments-empty');
  const filterButtons = document.querySelectorAll('.filter-appointment-btn');

  let currentFilter = 'ALL';
  let cachedAppointments = [];

  function renderList() {
    if (!container) return;

    const filtered = cachedAppointments.filter((app) => currentFilter === 'ALL' || app.estado === currentFilter);

    if (!filtered.length) {
      container.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }
    emptyState?.classList.add('hidden');

    container.innerHTML = filtered.map((app) => {
      const servicio = app.servicios?.nombre || 'Servicio';
      const precio = app.servicios?.precio != null ? formatoPrecio.format(app.servicios.precio) : '';
      const barbero = app.barberos ? `${app.barberos.nombre} ${app.barberos.apellido}` : 'Barbero asignado';
      const cancelable = app.estado === 'PENDIENTE' || app.estado === 'CONFIRMADO';
      const enPlazo = cancelable && faltanAlMenos24h(app.fecha, app.hora);

      let accion = '';
      if (cancelable && enPlazo) {
        accion = `<button class="btn btn-danger btn-sm btn-cancel-appointment" data-appointment-id="${app.id}">Cancelar Turno</button>`;
      } else if (cancelable) {
        accion = '<span style="font-size: 0.8rem; color: var(--text-muted);">Ya no se puede cancelar (faltan menos de 24 h)</span>';
      }

      return `
        <div class="card" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="badge ${badgeClass(app.estado)}">${escapeHtml(app.estado)}</span>
              <h3 style="margin-top: 0.5rem; font-size: 1.25rem;">${escapeHtml(servicio)}</h3>
              <p style="color: var(--text-secondary); font-size: 0.9rem;">Barbero: <strong style="color: var(--text-primary);">${escapeHtml(barbero)}</strong></p>
            </div>
            <div style="text-align: right;">
              <span style="font-family: var(--font-serif); font-size: 1.3rem; color: var(--gold-primary); font-weight: 700;">${precio}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">
              <span>📅 ${escapeHtml(fechaLarga(app.fecha))}</span>
              <span>⏰ ${escapeHtml(horaCorta(app.hora))} hs</span>
            </div>
            ${accion}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-cancel-appointment').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const boton = e.currentTarget;
        const id = boton.getAttribute('data-appointment-id');
        if (!confirm('¿Seguro que querés cancelar este turno?')) return;

        try {
          boton.disabled = true;
          boton.textContent = 'Cancelando...';
          await appointmentsService.cancelTurno(id);
          showToast('Turno cancelado correctamente', 'info');
          if (onCancelled) onCancelled();
        } catch (err) {
          // Supabase rechaza fuera de plazo, estados no cancelables o turnos ajenos
          showToast(err.message || 'No se pudo cancelar el turno', 'error', 6000);
        } finally {
          loadAppointments();
        }
      });
    });
  }

  async function loadAppointments() {
    const user = getCurrentUser();
    if (!user) {
      cachedAppointments = [];
      emptyState?.classList.add('hidden');
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-md);">
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">Iniciá sesión para consultar tus turnos.</p>
            <button id="btn-login-to-view-appointments" class="btn btn-gold btn-sm">Iniciar Sesión</button>
          </div>
        `;
        document.getElementById('btn-login-to-view-appointments')?.addEventListener('click', () => openAuthModal && openAuthModal());
      }
      return;
    }

    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div class="spinner"></div>
          <p style="margin-top: 0.5rem; color: var(--text-secondary);">Cargando tus turnos...</p>
        </div>
      `;
    }

    try {
      cachedAppointments = await appointmentsService.getMisTurnos(user.id);
      renderList();
    } catch (err) {
      console.error('Error al cargar mis turnos:', err);
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md);">
            <p style="color: #f87171;">No se pudieron cargar tus turnos.</p>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(err.message)}</p>
          </div>
        `;
      }
    }
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = e.currentTarget.getAttribute('data-filter') || 'ALL';
      renderList();
    });
  });

  return {
    reload: loadAppointments,
    onRealtimeUpdate: () => loadAppointments()
  };
}
