// ui/LoginScreen.js
// Full-screen auth gate. Replaces the local "age gate" flow when auth is enabled.

import { AuthState } from '../auth/AuthClient.js';
import { mountDiscordLogin, showDiscordRequired } from '../auth/DiscordLogin.js';
import { describeState } from '../auth/AuthGuard.js';

export function mountLoginScreen(root, authClient, { onAuthenticated }) {
  if (!root) return;
  root.classList.add('sth-auth-gate');
  render(root, authClient, { onAuthenticated });

  authClient.subscribe((state) => {
    // Once ready, hand off to the game.
    if (state === AuthState.ACCOUNT_READY) {
      onAuthenticated && onAuthenticated(authClient);
      return;
    }
    render(root, authClient, { onAuthenticated });
  });
}

function render(root, authClient, { onAuthenticated }) {
  const state = authClient.state;
  root.innerHTML = `
    <div class="sth-gate-scene"></div>
    <main class="sth-gate-card">
      <div class="sth-kicker"><span></span> PRIVATE NIGHTLIFE NETWORK</div>
      <h1>SUBWAY<br/><em>THOTS</em> HOTEL</h1>
      <p class="sth-gate-copy">All characters are fictional adults aged 21+.</p>
      <div id="sth-auth-body"></div>
      <small class="sth-age-copy">By entering, you confirm you are 21 or older.</small>
    </main>
  `;
  const body = root.querySelector('#sth-auth-body');

  switch (state) {
    case AuthState.LOADING:
      body.innerHTML = `<div class="sth-spinner"></div><p>${describeState(state)}</p>`;
      break;
    case AuthState.LOGGED_OUT:
    case AuthState.OAUTH_IN_PROGRESS:
    case AuthState.BACKEND_UNAVAILABLE:
    case AuthState.DISCORD_API_UNAVAILABLE:
      mountDiscordLogin(body, authClient);
      if (state === AuthState.BACKEND_UNAVAILABLE || state === AuthState.DISCORD_API_UNAVAILABLE) {
        body.insertAdjacentHTML('beforeend', `<p class="sth-error">${describeState(state)}</p>`);
      }
      break;
    case AuthState.MEMBERSHIP_REQUIRED:
      showDiscordRequired(body, {
        inviteUrl: authClient.inviteUrl,
        message: authClient.message,
        onRetry: () => authClient.refreshSession(),
      });
      break;
    case AuthState.ROLE_REQUIRED:
      body.innerHTML = `<div class="sth-modal-card"><h2>Role Required</h2><p>${describeState(state)}</p></div>`;
      break;
    case AuthState.CREATING_NAME:
      body.innerHTML = `<div class="sth-modal-card"><h2>Welcome</h2><p>Verified. Now create your game name.</p></div>`;
      break;
    case AuthState.SUSPENDED:
    case AuthState.BANNED:
    case AuthState.MEMBERSHIP_LOST:
    case AuthState.SESSION_EXPIRED:
      body.innerHTML = `<div class="sth-modal-card sth-error-card"><h2>Access Denied</h2><p>${describeState(state)}</p>
        ${authClient.inviteUrl ? `<a class="sth-discord-btn" href="${authClient.inviteUrl}" target="_blank" rel="noopener">JOIN THE DISCORD</a>` : ''}
        <button id="sth-reauth" class="sth-secondary-btn">SIGN IN AGAIN</button></div>`;
      body.querySelector('#sth-reauth')?.addEventListener('click', () => authClient.startDiscordLogin());
      break;
    default:
      body.innerHTML = `<p>${describeState(state)}</p>`;
  }
}
