// AccountSetup.js
// Drives the player-name creation screen. Talks to the backend; the 6-digit
// number is generated server-side and is never client-controlled.

import { AuthState } from './AuthClient.js';

export function mountAccountSetup(root, authClient, { onComplete }) {
  if (!root) return;
  root.innerHTML = `
    <div class="sth-modal-card">
      <small class="online-kicker">SUBWAYTHOTSHOTEL ONLINE · ACCOUNT SETUP</small>
      <h2>CREATE YOUR GAME NAME</h2>
      <div id="verified-identity"></div>
      <label for="sth-name-input">DISPLAY NAME (3–16 chars: letters, numbers, _ . -)</label>
      <input id="sth-name-input" maxlength="16" autocomplete="off" placeholder="Slizzy" />
      <div id="sth-name-preview">Your tag: <strong>—</strong></div>
      <div id="sth-name-error" role="alert"></div>
      <button id="sth-name-submit" class="sth-discord-btn">CREATE ACCOUNT →</button>
    </div>
  `;

  const input = root.querySelector('#sth-name-input');
  const preview = root.querySelector('#sth-name-preview');
  const error = root.querySelector('#sth-name-error');
  const submit = root.querySelector('#sth-name-submit');
  const identity = root.querySelector('#verified-identity');

  // Show verified Discord identity beside the form.
  const u = authClient.user;
  if (u && u.discord) {
    identity.innerHTML = `
      <div class="sth-verified">
        <img class="sth-avatar" src="${u.discord.avatar || ''}" alt="" onerror="this.style.display='none'"/>
        <div>
          <div><b>${escapeHtml(u.discord.global_name || u.discord.username || 'Unknown')}</b></div>
          <div class="sth-muted">@${escapeHtml(u.discord.username || '')} · ${escapeHtml(u.discord.id || '')}</div>
        </div>
      </div>`;
  }

  let checking = false;
  input.addEventListener('input', async () => {
    const name = input.value.trim();
    preview.innerHTML = `Your tag: <strong>${/^[A-Za-z0-9._-]{3,16}$/.test(name) ? `${name}#••••••` : '—'}</strong>`;
    if (name.length >= 3 && /^[A-Za-z0-9._-]{3,16}$/.test(name)) {
      const res = await authClient.checkName(name);
      if (!res.available) {
        error.textContent = reasonText(res.reason);
      } else {
        error.textContent = '';
      }
    } else {
      error.textContent = '';
    }
  });

  submit.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!/^[A-Za-z0-9._-]{3,16}$/.test(name)) {
      error.textContent = 'Use 3–16 letters, numbers, underscores, periods, or hyphens.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'CREATING…';
    const res = await authClient.createName(name);
    if (res.ok) {
      authClient.setState(AuthState.ACCOUNT_READY);
      onComplete && onComplete(res.tag);
    } else {
      error.textContent = res.message || reasonText(res.error) || 'Could not create account.';
      submit.disabled = false;
      submit.textContent = 'CREATE ACCOUNT →';
    }
  });
}

function reasonText(reason) {
  return ({
    invalid_name: 'Invalid characters in name.',
    reserved_name: 'This name is reserved for staff.',
    blocked_name: 'This name is not allowed.',
    duplicate_name: 'That name is already taken.',
    too_short: 'Name is too short.',
    too_long: 'Name is too long.',
  })[reason] || 'Name unavailable.';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
