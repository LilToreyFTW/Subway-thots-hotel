// AuthGuard.js
// Decides whether the game world is allowed to start. The world MUST NOT start
// until the backend confirms a valid session + issued WS ticket.

import { AuthState } from './AuthClient.js';

export function canStartWorld(state) {
  return state === AuthState.ACCOUNT_READY;
}

export function describeState(state) {
  switch (state) {
    case AuthState.LOADING: return 'Loading authentication status…';
    case AuthState.LOGGED_OUT: return 'Sign in with Discord to continue.';
    case AuthState.OAUTH_IN_PROGRESS: return 'Redirecting to Discord…';
    case AuthState.MEMBERSHIP_REQUIRED: return 'Discord membership is required to play.';
    case AuthState.ROLE_REQUIRED: return 'You are missing the required Discord role.';
    case AuthState.CREATING_NAME: return 'Create your in-game name to continue.';
    case AuthState.ACCOUNT_READY: return 'Authenticated. Launching world…';
    case AuthState.SUSPENDED: return 'Your account is suspended.';
    case AuthState.BANNED: return 'Your account is banned.';
    case AuthState.SESSION_EXPIRED: return 'Your session expired. Please sign in again.';
    case AuthState.MEMBERSHIP_LOST: return 'Your Discord membership could not be verified. You must be a member of the Subway-Thots-Hotel Discord server to play.';
    case AuthState.BACKEND_UNAVAILABLE: return 'Authentication service unavailable. Try again later.';
    case AuthState.DISCORD_API_UNAVAILABLE: return 'Discord is temporarily unavailable. Please retry.';
    default: return 'Authenticating…';
  }
}
