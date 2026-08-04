// ui/DiscordProfileCard.js
// In-game profile panel. All Discord values come from the authenticated backend
// response — never from client input or localStorage as proof of identity.

export function renderProfileCard(root, authClient) {
  if (!root) return;
  const u = authClient.user;
  if (!u) { root.innerHTML = ''; return; }
  const discord = u.discord || {};
  const game = u.game || {};
  const roleLabel = (u.permissions || 'player').toUpperCase();
  root.innerHTML = `
    <aside class="sth-profile-panel" aria-label="Player profile">
      <div class="sth-profile-head">
        <img class="sth-profile-avatar" src="${discord.avatar || ''}" alt="" onerror="this.style.visibility='hidden'"/>
        <div>
          <div class="sth-profile-gametag">${escapeHtml(game.full_game_tag || '—')}</div>
          <div class="sth-profile-sub">${escapeHtml(discord.global_name || discord.username || '')}</div>
        </div>
      </div>
      <dl class="sth-profile-list">
        <dt>GAME NAME</dt><dd>${escapeHtml(game.full_game_tag || '—')}</dd>
        <dt>DISCORD NAME</dt><dd>${escapeHtml(discord.username || '—')}</dd>
        <dt>DISCORD ID</dt><dd>${escapeHtml(discord.id || '—')}</dd>
        <dt>STATUS</dt><dd>${escapeHtml(u.account_status || 'active')}</dd>
        <dt>ROLE</dt><dd>${roleLabel}</dd>
        <dt>ONLINE</dt><dd>${u.permissions ? 'YES' : 'NO'}</dd>
        <dt>JOINED</dt><dd>${formatDate(u.created_at)}</dd>
      </dl>
      <div class="sth-profile-actions">
        <button id="sth-logout-btn" class="sth-secondary-btn">LOG OUT</button>
      </div>
    </aside>
  `;
  root.querySelector('#sth-logout-btn')?.addEventListener('click', () => authClient.logout());
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
