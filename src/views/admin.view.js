import { appointmentsService } from '../services/appointments.service.js';
import { servicesService } from '../services/services.service.js';
import { barbersService } from '../services/barbers.service.js';
import { profileService } from '../services/profile.service.js';
import { horariosService } from '../services/horarios.service.js';
import { showToast } from '../lib/toast.js';
import { escapeHtml, safeUrl } from '../lib/html.js';
import { DIAS_SEMANA, horaCorta } from '../lib/time.js';

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const ROLES = ['USUARIO', 'BARBERO', 'ADMIN'];
const ESTADOS = ['PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'FINALIZADO'];

function statusBadge(estado) {
  switch (estado) {
    case 'CONFIRMADO': return 'badge-confirmed';
    case 'CANCELADO': return 'badge-cancelled';
    case 'FINALIZADO': return 'badge-finished';
    default: return 'badge-pending';
  }
}

function filaMensaje(tbody, columnas, texto, color = 'var(--text-muted)') {
  tbody.innerHTML = `<tr><td colspan="${columnas}" class="text-center" style="padding: 2rem; color: ${color};">${texto}</td></tr>`;
}

function nombreCompleto(p) {
  return `${p?.nombre || ''} ${p?.apellido || ''}`.trim() || '(sin nombre)';
}

export function setupAdminPanel(getCurrentProfile, onEntityChanged) {
  const container = document.getElementById('admin');
  if (!container) return null;

  const tabButtons = container.querySelectorAll('.admin-tab-btn');
  const panels = {
    turnos: document.getElementById('admin-panel-turnos'),
    servicios: document.getElementById('admin-panel-servicios'),
    barberos: document.getElementById('admin-panel-barberos'),
    horarios: document.getElementById('admin-panel-horarios'),
    usuarios: document.getElementById('admin-panel-usuarios')
  };

  const crudModal = document.getElementById('admin-crud-modal');
  const crudModalTitle = document.getElementById('admin-crud-modal-title');
  const crudModalForm = document.getElementById('admin-crud-modal-form');
  const crudModalFields = document.getElementById('admin-crud-modal-fields');
  const crudModalClose = document.getElementById('admin-crud-modal-close');

  let activeTab = 'turnos';
  let activeEntityType = null; // 'servicio' | 'barbero' | 'horario'
  let editingEntityId = null;

  const isAdmin = () => getCurrentProfile()?.rol === 'ADMIN';

  function switchTab(tab) {
    activeTab = tab;
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-tab') === tab));
    Object.entries(panels).forEach(([nombre, panel]) => panel?.classList.toggle('hidden', nombre !== tab));
    loadTabData();
  }

  tabButtons.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab'))));
  crudModalClose?.addEventListener('click', () => crudModal.classList.remove('active'));
  crudModal?.addEventListener('click', (e) => { if (e.target === crudModal) crudModal.classList.remove('active'); });

  // ---------------- 1. TURNOS ----------------
  async function loadTurnos() {
    const tbody = document.getElementById('admin-turnos-table-body');
    if (!tbody) return;
    filaMensaje(tbody, 6, '<div class="spinner"></div>');

    try {
      const turnos = await appointmentsService.getAllTurnos();
      if (!turnos.length) return filaMensaje(tbody, 6, 'No hay turnos registrados.');

      tbody.innerHTML = turnos.map((t) => {
        const cliente = t.profiles ? `${nombreCompleto(t.profiles)} (${t.profiles.telefono || 'sin tel.'})` : 'Usuario desconocido';
        const servicio = t.servicios?.nombre || 'Servicio eliminado';
        const barbero = t.barberos ? `${t.barberos.nombre} ${t.barberos.apellido}` : 'Sin asignar';
        return `
          <tr>
            <td><strong>${escapeHtml(cliente)}</strong></td>
            <td>${escapeHtml(servicio)}</td>
            <td>${escapeHtml(barbero)}</td>
            <td><div>${escapeHtml(t.fecha)}</div><small style="color: var(--text-muted);">${escapeHtml(horaCorta(t.hora))} hs</small></td>
            <td>
              <select class="form-select form-select-sm select-change-status" data-turno-id="${t.id}" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                ${ESTADOS.map((e) => `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </td>
            <td><span class="badge ${statusBadge(t.estado)}">${escapeHtml(t.estado)}</span></td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.select-change-status').forEach((select) => {
        select.addEventListener('change', async (e) => {
          try {
            e.target.disabled = true;
            await appointmentsService.cambiarEstado(e.target.getAttribute('data-turno-id'), e.target.value);
            showToast(`Turno actualizado a ${e.target.value}`, 'success');
          } catch (err) {
            showToast(err.message || 'Error al cambiar el estado del turno', 'error');
          } finally {
            loadTurnos();
          }
        });
      });
    } catch (err) {
      console.error('Error al cargar turnos para admin:', err);
      filaMensaje(tbody, 6, `Error al cargar turnos: ${escapeHtml(err.message)}`, '#f87171');
    }
  }

  // ---------------- 2. SERVICIOS ----------------
  async function loadServicios() {
    const tbody = document.getElementById('admin-servicios-table-body');
    if (!tbody) return;
    filaMensaje(tbody, 5, '<div class="spinner"></div>');

    try {
      const servicios = await servicesService.getServicios(false);
      if (!servicios.length) return filaMensaje(tbody, 5, 'No hay servicios cargados.');

      tbody.innerHTML = servicios.map((s) => `
        <tr>
          <td><strong>${escapeHtml(s.nombre)}</strong></td>
          <td>${formatoPrecio.format(Number(s.precio))}</td>
          <td>${Number(s.duracion)} min</td>
          <td><span class="badge ${s.activo ? 'badge-confirmed' : 'badge-cancelled'}">${s.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-dark btn-sm btn-edit-service" data-id="${s.id}">Editar</button>
              <button class="btn btn-danger btn-sm btn-delete-service" data-id="${s.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-edit-service').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = servicios.find((x) => String(x.id) === btn.getAttribute('data-id'));
          if (s) openServiceModal(s);
        });
      });

      tbody.querySelectorAll('.btn-delete-service').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este servicio? Si tiene turnos, desactivalo en lugar de eliminarlo.')) return;
          try {
            await servicesService.deleteServicio(btn.getAttribute('data-id'));
            showToast('Servicio eliminado', 'info');
            loadServicios();
            onEntityChanged?.();
          } catch (err) {
            showToast(err.code === '23503'
              ? 'No se puede eliminar: el servicio tiene turnos. Desactivalo en su lugar.'
              : (err.message || 'Error al eliminar el servicio'), 'error', 6000);
          }
        });
      });
    } catch (err) {
      filaMensaje(tbody, 5, escapeHtml(err.message), '#f87171');
    }
  }

  // ---------------- 3. BARBEROS ----------------
  async function loadBarberos() {
    const tbody = document.getElementById('admin-barberos-table-body');
    if (!tbody) return;
    filaMensaje(tbody, 5, '<div class="spinner"></div>');

    try {
      const [barberos, perfiles] = await Promise.all([
        barbersService.getBarberos(false),
        profileService.getAllProfiles()
      ]);
      const perfilPorId = new Map(perfiles.map((p) => [p.id, p]));
      if (!barberos.length) return filaMensaje(tbody, 5, 'No hay barberos cargados.');

      tbody.innerHTML = barberos.map((b) => {
        const cuenta = b.usuario_id ? nombreCompleto(perfilPorId.get(b.usuario_id)) : 'Sin cuenta vinculada';
        return `
          <tr>
            <td><strong>${escapeHtml(b.nombre)} ${escapeHtml(b.apellido)}</strong></td>
            <td>${escapeHtml(b.especialidad || 'General')}</td>
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(cuenta)}</td>
            <td><span class="badge ${b.activo ? 'badge-confirmed' : 'badge-cancelled'}">${b.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
            <td>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-dark btn-sm btn-edit-barber" data-id="${b.id}">Editar</button>
                <button class="btn btn-danger btn-sm btn-delete-barber" data-id="${b.id}">Eliminar</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-edit-barber').forEach((btn) => {
        btn.addEventListener('click', () => {
          const b = barberos.find((x) => String(x.id) === btn.getAttribute('data-id'));
          if (b) openBarberModal(b, perfiles, barberos);
        });
      });

      tbody.querySelectorAll('.btn-delete-barber').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este barbero? Si tiene turnos, desactivalo en lugar de eliminarlo.')) return;
          try {
            await barbersService.deleteBarbero(btn.getAttribute('data-id'));
            showToast('Barbero eliminado', 'info');
            loadBarberos();
            onEntityChanged?.();
          } catch (err) {
            showToast(err.code === '23503'
              ? 'No se puede eliminar: el barbero tiene turnos. Desactivalo en su lugar.'
              : (err.message || 'Error al eliminar el barbero'), 'error', 6000);
          }
        });
      });
    } catch (err) {
      filaMensaje(tbody, 5, escapeHtml(err.message), '#f87171');
    }
  }

  // ---------------- 4. HORARIOS ----------------
  async function loadHorarios() {
    const tbody = document.getElementById('admin-horarios-table-body');
    if (!tbody) return;
    filaMensaje(tbody, 5, '<div class="spinner"></div>');

    try {
      const horarios = await horariosService.getHorarios();
      if (!horarios.length) {
        return filaMensaje(tbody, 5, 'Todavía no hay horarios de atención configurados. Los clientes no podrán reservar hasta que cargues al menos una franja por barbero.');
      }

      tbody.innerHTML = horarios.map((h) => `
        <tr>
          <td><strong>${escapeHtml(h.barberos ? `${h.barberos.nombre} ${h.barberos.apellido}` : `#${h.barbero_id}`)}</strong></td>
          <td>${DIAS_SEMANA[h.dia_semana] || h.dia_semana}</td>
          <td>${escapeHtml(horaCorta(h.hora_inicio))} – ${escapeHtml(horaCorta(h.hora_fin))}</td>
          <td><span class="badge ${h.activo ? 'badge-confirmed' : 'badge-cancelled'}">${h.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-dark btn-sm btn-edit-horario" data-id="${h.id}">Editar</button>
              <button class="btn btn-danger btn-sm btn-delete-horario" data-id="${h.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-edit-horario').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const h = horarios.find((x) => String(x.id) === btn.getAttribute('data-id'));
          if (h) openHorarioModal(h, await barbersService.getBarberos(false));
        });
      });

      tbody.querySelectorAll('.btn-delete-horario').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar esta franja horaria?')) return;
          try {
            await horariosService.deleteHorario(btn.getAttribute('data-id'));
            showToast('Franja eliminada', 'info');
            loadHorarios();
          } catch (err) {
            showToast(err.message || 'Error al eliminar la franja', 'error');
          }
        });
      });
    } catch (err) {
      filaMensaje(tbody, 5, escapeHtml(err.message), '#f87171');
    }
  }

  // ---------------- 5. USUARIOS ----------------
  async function loadUsuarios() {
    const tbody = document.getElementById('admin-usuarios-table-body');
    if (!tbody) return;
    filaMensaje(tbody, 4, '<div class="spinner"></div>');

    try {
      const perfiles = await profileService.getAllProfiles();
      if (!perfiles.length) return filaMensaje(tbody, 4, 'No hay perfiles registrados.');
      const yo = getCurrentProfile()?.id;

      tbody.innerHTML = perfiles.map((p) => `
        <tr>
          <td><strong>${escapeHtml(nombreCompleto(p))}</strong>${p.id === yo ? ' <small style="color: var(--text-muted);">(vos)</small>' : ''}</td>
          <td>${escapeHtml(p.telefono || 'Sin teléfono')}</td>
          <td>
            <select class="form-select form-select-sm select-change-role" data-user-id="${escapeHtml(p.id)}" data-rol-actual="${escapeHtml(p.rol)}" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem;">
              ${ROLES.map((r) => `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </td>
          <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '-'}</td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.select-change-role').forEach((select) => {
        select.addEventListener('change', async (e) => {
          const nuevo = e.target.value;
          const anterior = e.target.getAttribute('data-rol-actual');
          if (!confirm(`¿Cambiar el rol de ${anterior} a ${nuevo}?`)) {
            e.target.value = anterior;
            return;
          }
          try {
            e.target.disabled = true;
            await profileService.cambiarRol(e.target.getAttribute('data-user-id'), nuevo);
            showToast(`Rol actualizado a ${nuevo}`, 'success');
          } catch (err) {
            showToast(err.message || 'No se pudo cambiar el rol', 'error', 6000);
          } finally {
            loadUsuarios();
          }
        });
      });
    } catch (err) {
      filaMensaje(tbody, 4, escapeHtml(err.message), '#f87171');
    }
  }

  function loadTabData() {
    if (!isAdmin()) return;
    ({ turnos: loadTurnos, servicios: loadServicios, barberos: loadBarberos, horarios: loadHorarios, usuarios: loadUsuarios }[activeTab] || loadTurnos)();
  }

  // ---------------- MODALES ----------------
  function openServiceModal(s = null) {
    activeEntityType = 'servicio';
    editingEntityId = s?.id ?? null;
    crudModalTitle.textContent = s ? 'Editar Servicio' : 'Nuevo Servicio';
    crudModalFields.innerHTML = `
      <div class="form-group">
        <label class="form-label">Nombre del Servicio *</label>
        <input type="text" id="crud-s-nombre" class="form-input" required maxlength="120" value="${escapeHtml(s?.nombre || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea id="crud-s-desc" class="form-textarea" rows="2" maxlength="500">${escapeHtml(s?.descripcion || '')}</textarea>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Precio ($ ARS) *</label>
          <input type="number" id="crud-s-precio" class="form-input" required min="0" step="0.01" value="${s ? Number(s.precio) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Duración (min) *</label>
          <input type="number" id="crud-s-duracion" class="form-input" required min="1" step="1" value="${s ? Number(s.duracion) : ''}">
        </div>
      </div>
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
        <input type="checkbox" id="crud-s-activo" ${!s || s.activo ? 'checked' : ''} style="accent-color: var(--gold-primary); width: 18px; height: 18px;">
        <label for="crud-s-activo" style="font-size: 0.9rem; cursor: pointer;">Servicio activo (visible para reservar)</label>
      </div>
    `;
    crudModal.classList.add('active');
  }

  function openBarberModal(b = null, perfiles = [], barberos = []) {
    activeEntityType = 'barbero';
    editingEntityId = b?.id ?? null;
    // Solo cuentas con rol BARBERO que no estén vinculadas a otra ficha
    const ocupados = new Set(barberos.filter((x) => x.usuario_id && x.id !== b?.id).map((x) => x.usuario_id));
    const candidatos = perfiles.filter((p) => p.rol === 'BARBERO' && !ocupados.has(p.id));

    crudModalTitle.textContent = b ? 'Editar Barbero' : 'Nuevo Barbero';
    crudModalFields.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" id="crud-b-nombre" class="form-input" required maxlength="80" value="${escapeHtml(b?.nombre || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Apellido *</label>
          <input type="text" id="crud-b-apellido" class="form-input" required maxlength="80" value="${escapeHtml(b?.apellido || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Especialidad</label>
        <input type="text" id="crud-b-especialidad" class="form-input" maxlength="120" value="${escapeHtml(b?.especialidad || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">URL de Foto</label>
        <input type="url" id="crud-b-foto" class="form-input" placeholder="https://..." value="${safeUrl(b?.foto_url)}">
      </div>
      <div class="form-group">
        <label class="form-label">Cuenta de usuario vinculada</label>
        <select id="crud-b-usuario" class="form-select">
          <option value="">Sin cuenta vinculada</option>
          ${candidatos.map((p) => `<option value="${escapeHtml(p.id)}" ${b?.usuario_id === p.id ? 'selected' : ''}>${escapeHtml(nombreCompleto(p))}</option>`).join('')}
        </select>
        <small style="color: var(--text-muted);">Primero asigná el rol BARBERO a la cuenta en la pestaña Usuarios.</small>
      </div>
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
        <input type="checkbox" id="crud-b-activo" ${!b || b.activo ? 'checked' : ''} style="accent-color: var(--gold-primary); width: 18px; height: 18px;">
        <label for="crud-b-activo" style="font-size: 0.9rem; cursor: pointer;">Barbero activo (recibe reservas)</label>
      </div>
    `;
    crudModal.classList.add('active');
  }

  function openHorarioModal(h = null, barberos = []) {
    activeEntityType = 'horario';
    editingEntityId = h?.id ?? null;
    crudModalTitle.textContent = h ? 'Editar Franja Horaria' : 'Nueva Franja Horaria';
    crudModalFields.innerHTML = `
      <div class="form-group">
        <label class="form-label">Barbero *</label>
        <select id="crud-h-barbero" class="form-select" required>
          <option value="">-- Seleccioná --</option>
          ${barberos.map((b) => `<option value="${b.id}" ${h?.barbero_id === b.id ? 'selected' : ''}>${escapeHtml(`${b.nombre} ${b.apellido}`)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Día de la semana *</label>
        <select id="crud-h-dia" class="form-select" required>
          ${DIAS_SEMANA.map((d, i) => `<option value="${i}" ${h?.dia_semana === i ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Desde *</label>
          <input type="time" id="crud-h-inicio" class="form-input" required value="${escapeHtml(horaCorta(h?.hora_inicio || ''))}">
        </div>
        <div class="form-group">
          <label class="form-label">Hasta *</label>
          <input type="time" id="crud-h-fin" class="form-input" required value="${escapeHtml(horaCorta(h?.hora_fin || ''))}">
        </div>
      </div>
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
        <input type="checkbox" id="crud-h-activo" ${!h || h.activo ? 'checked' : ''} style="accent-color: var(--gold-primary); width: 18px; height: 18px;">
        <label for="crud-h-activo" style="font-size: 0.9rem; cursor: pointer;">Franja activa</label>
      </div>
    `;
    crudModal.classList.add('active');
  }

  document.getElementById('btn-admin-new-service')?.addEventListener('click', () => openServiceModal());
  document.getElementById('btn-admin-new-barber')?.addEventListener('click', async () => {
    try {
      const [perfiles, barberos] = await Promise.all([profileService.getAllProfiles(), barbersService.getBarberos(false)]);
      openBarberModal(null, perfiles, barberos);
    } catch (err) {
      showToast(err.message || 'No se pudieron cargar las cuentas', 'error');
    }
  });
  document.getElementById('btn-admin-new-horario')?.addEventListener('click', async () => {
    try {
      const barberos = await barbersService.getBarberos(false);
      if (!barberos.length) return showToast('Primero cargá al menos un barbero.', 'warning');
      openHorarioModal(null, barberos);
    } catch (err) {
      showToast(err.message || 'No se pudieron cargar los barberos', 'error');
    }
  });

  crudModalForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = crudModalForm.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Guardando...';

      if (activeEntityType === 'servicio') {
        const precio = Number(document.getElementById('crud-s-precio').value);
        const duracion = Number(document.getElementById('crud-s-duracion').value);
        if (!Number.isFinite(precio) || precio < 0) throw new Error('El precio debe ser un número mayor o igual a 0.');
        if (!Number.isInteger(duracion) || duracion <= 0) throw new Error('La duración debe ser un número entero de minutos mayor a 0.');
        const datos = {
          nombre: document.getElementById('crud-s-nombre').value.trim(),
          descripcion: document.getElementById('crud-s-desc').value.trim() || null,
          precio,
          duracion,
          activo: document.getElementById('crud-s-activo').checked
        };
        if (!datos.nombre) throw new Error('El nombre es obligatorio.');
        if (editingEntityId) await servicesService.updateServicio(editingEntityId, datos);
        else await servicesService.createServicio(datos);
        showToast('Servicio guardado', 'success');
        loadServicios();
      } else if (activeEntityType === 'barbero') {
        const datos = {
          nombre: document.getElementById('crud-b-nombre').value.trim(),
          apellido: document.getElementById('crud-b-apellido').value.trim(),
          especialidad: document.getElementById('crud-b-especialidad').value.trim() || null,
          foto_url: document.getElementById('crud-b-foto').value.trim() || null,
          usuario_id: document.getElementById('crud-b-usuario').value || null,
          activo: document.getElementById('crud-b-activo').checked
        };
        if (!datos.nombre || !datos.apellido) throw new Error('Nombre y apellido son obligatorios.');
        if (editingEntityId) await barbersService.updateBarbero(editingEntityId, datos);
        else await barbersService.createBarbero(datos);
        showToast('Barbero guardado', 'success');
        loadBarberos();
      } else if (activeEntityType === 'horario') {
        const datos = {
          barbero_id: document.getElementById('crud-h-barbero').value,
          dia_semana: document.getElementById('crud-h-dia').value,
          hora_inicio: document.getElementById('crud-h-inicio').value,
          hora_fin: document.getElementById('crud-h-fin').value,
          activo: document.getElementById('crud-h-activo').checked
        };
        if (!datos.barbero_id || !datos.hora_inicio || !datos.hora_fin) throw new Error('Completá barbero, desde y hasta.');
        if (datos.hora_fin <= datos.hora_inicio) throw new Error('La hora de fin debe ser posterior a la de inicio.');
        if (editingEntityId) {
          await horariosService.updateHorario(editingEntityId, {
            barbero_id: Number(datos.barbero_id), dia_semana: Number(datos.dia_semana),
            hora_inicio: datos.hora_inicio, hora_fin: datos.hora_fin, activo: datos.activo
          });
        } else {
          await horariosService.createHorario(datos);
        }
        showToast('Franja horaria guardada', 'success');
        loadHorarios();
      }

      crudModal.classList.remove('active');
      onEntityChanged?.();
    } catch (err) {
      console.error('Error al guardar en Admin:', err);
      showToast(err.message || 'Error al procesar la solicitud', 'error', 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  });

  return {
    init: () => {
      if (isAdmin()) {
        container.classList.remove('hidden');
        switchTab(activeTab);
      } else {
        container.classList.add('hidden');
      }
    },
    onRealtimeUpdate: () => {
      if (isAdmin() && activeTab === 'turnos') loadTurnos();
    }
  };
}
