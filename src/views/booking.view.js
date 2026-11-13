import { servicesService } from '../services/services.service.js';
import { barbersService } from '../services/barbers.service.js';
import { appointmentsService } from '../services/appointments.service.js';
import { horariosService } from '../services/horarios.service.js';
import { showToast } from '../lib/toast.js';
import { escapeHtml } from '../lib/html.js';
import { hoyNegocio, diaSemana } from '../lib/time.js';

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** Traduce errores de Supabase a mensajes claros para el cliente. */
export function mensajeErrorReserva(err) {
  if (err?.code === '23P01' || err?.code === '23505') return 'Ese horario acaba de ocuparse. Elegí otro.';
  if (err?.code === '42501') return 'No tenés permiso para realizar esta operación.';
  return err?.message || 'No se pudo reservar el turno. Intentá nuevamente.';
}

export function setupBookingSection(getCurrentUser, openAuthModal, onAppointmentBooked) {
  const form = document.getElementById('booking-form');
  const selectBarber = document.getElementById('book-barbero');
  const selectService = document.getElementById('book-servicio');
  const inputDate = document.getElementById('book-fecha');
  const timeSlotsContainer = document.getElementById('book-time-slots');
  const priceDisplay = document.getElementById('booking-price-display');
  const durationDisplay = document.getElementById('booking-duration-display');
  const submitBtn = form?.querySelector('button[type="submit"]');

  let selectedTime = null;
  let consultaActual = 0;
  const servicesMap = new Map();

  function setFechaMinima() {
    const hoy = hoyNegocio();
    if (inputDate) {
      inputDate.min = hoy;
      if (!inputDate.value || inputDate.value < hoy) inputDate.value = hoy;
    }
  }

  function slotsMensaje(texto, tipo = 'muted') {
    if (!timeSlotsContainer) return;
    const color = tipo === 'error' ? '#f87171' : 'var(--text-muted)';
    timeSlotsContainer.innerHTML = `<p style="grid-column: 1 / -1; color: ${color}; font-size: 0.9rem;">${escapeHtml(texto)}</p>`;
  }

  function setFormHabilitado(habilitado) {
    [selectBarber, selectService, inputDate, submitBtn].forEach((el) => { if (el) el.disabled = !habilitado; });
  }

  function renderSlots(horas) {
    timeSlotsContainer.innerHTML = horas.map((hora) => `
      <button type="button" class="btn btn-dark btn-sm btn-time-slot" data-time="${hora}" style="border-radius: var(--radius-sm); padding: 0.6rem 0.5rem; font-size: 0.85rem;">
        ${hora}
      </button>
    `).join('');

    timeSlotsContainer.querySelectorAll('.btn-time-slot').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        timeSlotsContainer.querySelectorAll('.btn-time-slot').forEach((b) => {
          b.classList.remove('btn-gold');
          b.classList.add('btn-dark');
        });
        e.currentTarget.classList.remove('btn-dark');
        e.currentTarget.classList.add('btn-gold');
        selectedTime = e.currentTarget.getAttribute('data-time');
      });
    });
  }

  /** Consulta a Supabase los horarios realmente libres. */
  async function cargarHorarios() {
    selectedTime = null;
    if (!timeSlotsContainer) return;

    if (!getCurrentUser()) {
      slotsMensaje('Iniciá sesión para ver los horarios disponibles.');
      return;
    }

    const barberoId = selectBarber?.value;
    const servicioId = selectService?.value;
    const fecha = inputDate?.value;

    if (!barberoId || !servicioId || !fecha) {
      slotsMensaje('Elegí barbero, servicio y fecha para ver los horarios libres.');
      return;
    }

    const consulta = ++consultaActual;
    slotsMensaje('Buscando horarios disponibles...');

    try {
      const [horas, tieneHorarios] = await Promise.all([
        horariosService.getDisponibles({ barberoId, servicioId, fecha }),
        horariosService.tieneHorariosEseDia(barberoId, diaSemana(fecha))
      ]);
      if (consulta !== consultaActual) return; // llegó una consulta más nueva

      if (horas.length) {
        renderSlots(horas);
      } else if (!tieneHorarios) {
        slotsMensaje('Todavía no hay horarios de atención configurados para este barbero en ese día.');
      } else {
        slotsMensaje('No quedan horarios libres para esa fecha. Probá con otro día o barbero.');
      }
    } catch (err) {
      if (consulta !== consultaActual) return;
      console.error('Error al consultar horarios:', err);
      slotsMensaje(err.message || 'No se pudieron consultar los horarios.', 'error');
    }
  }

  function actualizarResumen() {
    const service = servicesMap.get(String(selectService?.value || ''));
    if (durationDisplay) durationDisplay.textContent = service ? `${service.duracion} min` : '0 min';
    if (priceDisplay) priceDisplay.textContent = formatoPrecio.format(service ? Number(service.precio) : 0);
  }

  /** Carga servicios y barberos (solo con sesión: el catálogo es privado). */
  async function loadOptions() {
    setFechaMinima();
    servicesMap.clear();

    if (!getCurrentUser()) {
      if (selectService) selectService.innerHTML = '<option value="">Iniciá sesión para reservar</option>';
      if (selectBarber) selectBarber.innerHTML = '<option value="">Iniciá sesión para reservar</option>';
      setFormHabilitado(false);
      if (submitBtn) submitBtn.disabled = false; // permite abrir el login
      actualizarResumen();
      slotsMensaje('Iniciá sesión para ver los horarios disponibles.');
      return;
    }

    setFormHabilitado(true);
    if (selectService) selectService.innerHTML = '<option value="">Cargando servicios...</option>';
    if (selectBarber) selectBarber.innerHTML = '<option value="">Cargando barberos...</option>';

    try {
      const [servicios, barberos] = await Promise.all([
        servicesService.getServicios(true),
        barbersService.getBarberos(true)
      ]);

      servicios.forEach((s) => servicesMap.set(String(s.id), s));

      if (selectService) {
        selectService.innerHTML = servicios.length
          ? '<option value="">-- Seleccioná un servicio --</option>' + servicios.map((s) =>
              `<option value="${s.id}">${escapeHtml(s.nombre)} - ${formatoPrecio.format(Number(s.precio))} (${Number(s.duracion)} min)</option>`
            ).join('')
          : '<option value="">No hay servicios disponibles</option>';
      }

      if (selectBarber) {
        selectBarber.innerHTML = barberos.length
          ? '<option value="">-- Seleccioná un barbero --</option>' + barberos.map((b) =>
              `<option value="${b.id}">${escapeHtml(`${b.nombre} ${b.apellido}`)}${b.especialidad ? ` (${escapeHtml(b.especialidad)})` : ''}</option>`
            ).join('')
          : '<option value="">No hay barberos disponibles</option>';
      }
    } catch (err) {
      console.error('Error al cargar opciones de reserva:', err);
      showToast('No se pudieron cargar servicios y barberos.', 'error');
    }

    actualizarResumen();
    cargarHorarios();
  }

  selectService?.addEventListener('change', () => { actualizarResumen(); cargarHorarios(); });
  selectBarber?.addEventListener('change', cargarHorarios);
  inputDate?.addEventListener('change', cargarHorarios);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = getCurrentUser();
    if (!user) {
      showToast('Tenés que iniciar sesión para reservar tu turno', 'warning');
      if (openAuthModal) openAuthModal();
      return;
    }

    const servicio_id = selectService.value;
    const barbero_id = selectBarber.value;
    const fecha = inputDate.value;
    const hora = selectedTime;

    if (!servicio_id || !barbero_id || !fecha || !hora) {
      showToast('Seleccioná barbero, servicio, fecha y un horario disponible', 'warning');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Confirmando turno...';

      await appointmentsService.createTurno({ usuario_id: user.id, barbero_id, servicio_id, fecha, hora });

      showToast('¡Turno reservado! Queda PENDIENTE hasta que el barbero lo confirme.', 'success', 6000);
      selectedTime = null;
      if (onAppointmentBooked) onAppointmentBooked();
    } catch (err) {
      console.error('Error al reservar turno:', err);
      showToast(mensajeErrorReserva(err), 'error', 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar Reserva';
      cargarHorarios(); // refleja el estado real después de reservar o fallar
    }
  });

  setFechaMinima();
  slotsMensaje('Iniciá sesión para ver los horarios disponibles.');

  return {
    selectServiceById: (id) => {
      if (!selectService) return;
      selectService.value = String(id);
      actualizarResumen();
      cargarHorarios();
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    },
    selectBarberById: (id) => {
      if (!selectBarber) return;
      selectBarber.value = String(id);
      cargarHorarios();
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    },
    refreshOptions: loadOptions,
    refreshSlots: cargarHorarios
  };
}
