// DiscordLogin.js
// Renders the "CONTINUE WITH DISCORD" button and drives the OAuth2 redirect.
// No client-side secrets: the authorize URL is generated server-side.

import { AuthState } from './AuthClient.js';

export function mountDiscordLogin(root, authClient) {
  if (!root) return;
  root.innerHTML = `
    <button id="discord-login-btn" class="sth-discord-btn">
      <span class="sth-discord-icon">&#128274;</span> CONTINUE WITH DISCORD
    </button>
    <p class="sth-discord-note">You must be a member of the Subway-Thots-Hotel Discord server to play.</p>
  `;
  const btn = root.querySelector('#discord-login-btn');
  btn.addEventListener('click', () => authClient.startDiscordLogin());
  return btn;
}

export function showDiscordRequired(root, { inviteUrl, message, onRetry }) {
  if (!root) return;
  root.innerHTML = `
    <div class="sth-modal-card">
      <h2>Discord Membership Required</h2>
      <p>${message || 'You must be a member of the Subway-Thots-Hotel Discord server to play.'}</p>
      ${inviteUrl ? `<a class="sth-discord-btn" href="${inviteUrl}" target="_blank" rel="noopener">JOIN THE DISCORD</a>` : ''}
      <button id="retry-verify" class="sth-secondary-btn">I JOINED — RETRY VERIFICATION</button>
    </div>
  `;
  const retry = root.querySelector('#retry-verify');
  retry?.addEventListener('click', () => onRetry && onRetry());
}
