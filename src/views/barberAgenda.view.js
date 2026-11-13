import { appointmentsService } from '../services/appointments.service.js';
import { showToast } from '../lib/toast.js';
import { escapeHtml } from '../lib/html.js';
import { hoyNegocio, horaCorta, fechaLarga } from '../lib/time.js';

function badgeClass(estado) {
  switch (estado) {
    case 'CONFIRMADO': return 'badge-confirmed';
    case 'CANCELADO': return 'badge-cancelled';
    case 'FINALIZADO': return 'badge-finished';
    default: return 'badge-pending';
  }
}

// Acciones que el barbero puede hacer sobre SUS turnos (Supabase las vuelve a validar)
const ACCIONES = {
  PENDIENTE: [['CONFIRMADO', 'Confirmar', 'btn-gold'], ['CANCELADO', 'Cancelar', 'btn-danger']],
  CONFIRMADO: [['FINALIZADO', 'Finalizar', 'btn-gold'], ['CANCELADO', 'Cancelar', 'btn-danger']]
};

/**
 * Agenda del barbero: solo sus turnos asignados (RPC turnos_del_barbero).
 */
export function setupBarberAgenda(getCurrentProfile) {
  const section = document.getElementById('barber-agenda');
  const list = document.getElementById('barber-agenda-list');
  const filterButtons = document.querySelectorAll('.filter-agenda-btn');
  if (!section || !list) return null;

  let filtro = 'PROXIMOS';

  async function load() {
    const profile = getCurrentProfile();
    if (profile?.rol !== 'BARBERO') {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');

    list.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div></div>';

    try {
      const desde = filtro === 'PROXIMOS' ? hoyNegocio() : null;
      const turnos = await appointmentsService.getTurnosBarbero({ desde });
      const visibles = filtro === 'PROXIMOS'
        ? turnos.filter((t) => t.estado === 'PENDIENTE' || t.estado === 'CONFIRMADO')
        : turnos;

      if (!visibles.length) {
        list.innerHTML = `
          <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-md);">
            <p style="color: var(--text-secondary);">${filtro === 'PROXIMOS'
              ? 'No tenés turnos próximos asignados.'
              : 'Todavía no tenés turnos asignados. Si esperabas verlos, pedile al administrador que vincule tu cuenta con tu ficha de barbero.'}</p>
          </div>
        `;
        return;
      }

      list.innerHTML = visibles.map((t) => {
        const cliente = `${t.cliente_nombre || ''} ${t.cliente_apellido || ''}`.trim() || 'Cliente sin nombre cargado';
        const botones = (ACCIONES[t.estado] || []).map(([estado, texto, clase]) =>
          `<button class="btn ${clase} btn-sm js-estado" data-id="${t.id}" data-estado="${estado}">${texto}</button>`
        ).join('');
        return `
          <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <div>
              <span class="badge ${badgeClass(t.estado)}">${escapeHtml(t.estado)}</span>
              <h3 style="margin-top: 0.5rem; font-size: 1.15rem;">${escapeHtml(t.servicio_nombre)} · ${Number(t.servicio_duracion)} min</h3>
              <p style="color: var(--text-secondary); font-size: 0.9rem;">Cliente: <strong style="color: var(--text-primary);">${escapeHtml(cliente)}</strong></p>
              <p style="color: var(--text-muted); font-size: 0.85rem;">📅 ${escapeHtml(fechaLarga(t.fecha))} · ⏰ ${escapeHtml(horaCorta(t.hora))} hs</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">${botones}</div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.js-estado').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const boton = e.currentTarget;
          const estado = boton.getAttribute('data-estado');
          if (estado === 'CANCELADO' && !confirm('¿Cancelar este turno? El cliente lo verá como cancelado.')) return;
          try {
            boton.disabled = true;
            await appointmentsService.cambiarEstado(boton.getAttribute('data-id'), estado);
            showToast(`Turno ${estado.toLowerCase()}`, 'success');
          } catch (err) {
            showToast(err.message || 'No se pudo actualizar el turno', 'error');
          } finally {
            load();
          }
        });
      });
    } catch (err) {
      console.error('Error al cargar la agenda:', err);
      list.innerHTML = `<p style="color: #f87171; text-align: center;">No se pudo cargar tu agenda: ${escapeHtml(err.message)}</p>`;
    }
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      filtro = e.currentTarget.getAttribute('data-filter') || 'PROXIMOS';
      load();
    });
  });

  return { reload: load };
}
