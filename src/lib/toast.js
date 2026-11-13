/**
 * Sistema de notificaciones amigables tipo Toast
 */
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';

  // textContent: los mensajes pueden traer texto del servidor; nunca se interpretan como HTML
  const iconEl = document.createElement('span');
  iconEl.style.fontWeight = 'bold';
  iconEl.style.fontSize = '1.1rem';
  iconEl.textContent = icon;
  const textEl = document.createElement('span');
  textEl.textContent = String(message ?? '');
  toast.append(iconEl, textEl);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
