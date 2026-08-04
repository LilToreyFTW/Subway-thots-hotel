// ui/AccountStatusModal.js
// Displays account status states: suspended, banned, session expired, backend
// unavailable. Non-dismissable informational modal for restricted players.

export function showAccountStatusModal(root, { title, message, kind = 'error', actionLabel, onAction }) {
  if (!root) return;
  root.hidden = false;
  root.innerHTML = `
    <div class="sth-modal-backdrop">
      <div class="sth-modal-card ${kind === 'error' ? 'sth-error-card' : ''}">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        ${actionLabel ? `<button id="sth-status-action" class="sth-secondary-btn">${escapeHtml(actionLabel)}</button>` : ''}
      </div>
    </div>
  `;
  if (actionLabel) {
    root.querySelector('#sth-status-action')?.addEventListener('click', () => {
      root.hidden = true; root.innerHTML = '';
      onAction && onAction();
    });
  }
}

export function hideAccountStatusModal(root) {
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
