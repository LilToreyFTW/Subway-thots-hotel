// ui/MembershipRequiredModal.js
// Shown when a player's Discord membership cannot be verified (on login, on
// reconnect, periodically, or after leaving the server).

export function showMembershipRequiredModal(root, { inviteUrl, message, onRetry }) {
  if (!root) return;
  root.hidden = false;
  root.innerHTML = `
    <div class="sth-modal-backdrop">
      <div class="sth-modal-card sth-error-card">
        <h2>Discord Membership Required</h2>
        <p>${message || 'Your Discord membership could not be verified. You must be a member of the Subway-Thots-Hotel Discord server to play.'}</p>
        ${inviteUrl ? `<a class="sth-discord-btn" href="${inviteUrl}" target="_blank" rel="noopener">JOIN THE DISCORD</a>` : ''}
        <button id="sth-membership-retry" class="sth-secondary-btn">I REJOINED — RETRY</button>
      </div>
    </div>
  `;
  root.querySelector('#sth-membership-retry')?.addEventListener('click', () => {
    root.hidden = true;
    root.innerHTML = '';
    onRetry && onRetry();
  });
}

export function hideMembershipRequiredModal(root) {
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}
