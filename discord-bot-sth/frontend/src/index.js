// index.js — Auth bootstrap for Subway-Thots-Hotel.
// Mounts the login gate, drives the Discord OAuth flow, and only resolves a
// WebSocket ticket (and lets the world start) once the backend confirms a valid
// session. The existing game code subscribes to onReady(ticket) to start.

import { authClient } from './auth/AuthClient.js';
import { mountLoginScreen } from './ui/LoginScreen.js';
import { mountPlayerNameScreen } from './ui/PlayerNameScreen.js';
import { SessionManager } from './auth/SessionManager.js';
import { AuthState, canStartWorld } from './auth/AuthGuard.js';
import { renderProfileCard } from './ui/DiscordProfileCard.js';
import { showMembershipRequiredModal, hideMembershipRequiredModal } from './ui/MembershipRequiredModal.js';
import { showAccountStatusModal } from './ui/AccountStatusModal.js';

// Exported so the main game bundle can require auth before launching the world.
export async function bootstrapAuth({ gateRoot, nameRoot, profileRoot, statusRoot, onReady }) {
  // Create containers if not present.
  if (!gateRoot) {
    gateRoot = document.createElement('div');
    gateRoot.id = 'sth-auth-gate';
    document.body.appendChild(gateRoot);
  }
  if (!nameRoot) {
    nameRoot = document.createElement('div');
    nameRoot.id = 'sth-name-screen';
    nameRoot.hidden = true;
    document.body.appendChild(nameRoot);
  }
  if (!profileRoot) {
    profileRoot = document.createElement('aside');
    profileRoot.id = 'sth-profile';
    document.body.appendChild(profileRoot);
  }
  if (!statusRoot) {
    statusRoot = document.createElement('div');
    statusRoot.id = 'sth-status-modal';
    statusRoot.hidden = true;
    document.body.appendChild(statusRoot);
  }

  const session = new SessionManager(authClient, {
    ticketHandler: (ticket) => { onReady && onReady(ticket); },
  });

  // Show the login gate until authenticated.
  mountLoginScreen(gateRoot, authClient, {
    onAuthenticated: async (client) => {
      if (client.state === AuthState.CREATING_NAME) {
        gateRoot.hidden = true;
        mountPlayerNameScreen(nameRoot, client, {
          onComplete: async () => {
            nameRoot.hidden = true;
            await session.issueTicket();
            session.startPolling();
            renderProfileCard(profileRoot, client);
          },
        });
      } else {
        await session.begin();
        session.startPolling();
        renderProfileCard(profileRoot, client);
        gateRoot.hidden = true;
      }
    },
  });

  // React to state transitions for modals.
  authClient.subscribe((state) => {
    if (state === AuthState.MEMBERSHIP_LOST || state === AuthState.MEMBERSHIP_REQUIRED) {
      showMembershipRequiredModal(statusRoot, {
        inviteUrl: authClient.inviteUrl,
        message: authClient.message,
        onRetry: () => authClient.refreshSession(),
      });
    } else if (state === AuthState.SUSPENDED) {
      showAccountStatusModal(statusRoot, { title: 'Account Suspended', message: 'Your account is currently suspended.' });
    } else if (state === AuthState.BANNED) {
      showAccountStatusModal(statusRoot, { title: 'Account Banned', message: 'Your account has been banned.' });
    } else if (state === AuthState.SESSION_EXPIRED) {
      showAccountStatusModal(statusRoot, { title: 'Session Expired', message: 'Please sign in again.',
        actionLabel: 'SIGN IN', onAction: () => authClient.startDiscordLogin() });
    } else {
      hideMembershipRequiredModal(statusRoot);
      hideAccountStatusModal(statusRoot);
    }
    if (state === AuthState.ACCOUNT_READY) renderProfileCard(profileRoot, authClient);
  });

  // Kick off initial session check (handles OAuth callback return).
  await authClient.handleCallback();
  return { authClient, session };
}

// Auto-bootstrap if loaded directly in the page.
if (typeof window !== 'undefined' && document.getElementById('sth-auth-gate') === null) {
  // The existing game injects its own gate; only auto-run when present.
}
