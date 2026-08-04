// AuthClient.js
// Central frontend auth controller. Talks to the backend auth/account API.
// It holds the session token + CSRF token (in memory only — never localStorage),
// exposes the current auth state, and renders the appropriate UI state. The
// backend is the single source of truth for authentication.

export const AuthState = {
  LOADING: 'loading',
  LOGGED_OUT: 'logged_out',
  OAUTH_IN_PROGRESS: 'oauth_in_progress',
  MEMBERSHIP_REQUIRED: 'membership_required',
  ROLE_REQUIRED: 'role_required',
  CREATING_NAME: 'creating_name',
  ACCOUNT_READY: 'account_ready',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  SESSION_EXPIRED: 'session_expired',
  MEMBERSHIP_LOST: 'membership_lost',
  BACKEND_UNAVAILABLE: 'backend_unavailable',
  DISCORD_API_UNAVAILABLE: 'discord_api_unavailable',
};

export class AuthClient {
  constructor({ backendUrl = '/api', onStateChange = () => {} } = {}) {
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.onStateChange = onStateChange;
    this.state = AuthState.LOADING;
    this.sessionToken = null;
    this.csrfToken = null;
    this.user = null;
    this.listeners = new Set();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  setState(state, extra = {}) {
    this.state = state;
    this.lastError = extra.error || null;
    this.inviteUrl = extra.inviteUrl || null;
    this.message = extra.message || null;
    this.onStateChange(state, this);
    this.listeners.forEach((fn) => fn(state, this));
  }

  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.sessionToken) headers['Authorization'] = `Bearer ${this.sessionToken}`;
    if (auth && this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;
    const res = await fetch(`${this.backendUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (res.status === 401) {
      this.sessionToken = null;
      this.csrfToken = null;
      this.user = null;
    }
    return { ok: res.ok, status: res.status, data };
  }

  // ---- OAuth ----
  async startDiscordLogin() {
    this.setState(AuthState.OAUTH_IN_PROGRESS);
    try {
      const { ok, data } = await this.request('/auth/discord/login', { auth: false });
      if (!ok || !data?.authorize_url) {
        this.setState(AuthState.BACKEND_UNAVAILABLE);
        return;
      }
      window.location.href = data.authorize_url;
    } catch {
      this.setState(AuthState.BACKEND_UNAVAILABLE);
    }
  }

  // Called by the OAuth callback page (or pop-up) after redirect.
  async handleCallback() {
    try {
      const { ok, status, data } = await this.request('/auth/session', { auth: false });
      if (ok && data?.authenticated) {
        this.applySession(data);
        return;
      }
      // The callback sets cookies; re-read session.
      const s = await this.request('/auth/session');
      if (s.ok && s.data?.authenticated) { this.applySession(s.data); return; }
      this.setState(AuthState.LOGGED_OUT);
    } catch {
      this.setState(AuthState.BACKEND_UNAVAILABLE);
    }
  }

  applySession(data) {
    const u = data.user;
    this.user = u;
    this.csrfToken = data.csrf_token;
    this.sessionToken = data.session_token;
    if (!u || !u.game) {
      this.setState(AuthState.CREATING_NAME);
    } else if (u.account_status === 'banned') {
      this.setState(AuthState.BANNED);
    } else if (u.account_status === 'suspended') {
      this.setState(AuthState.SUSPENDED);
    } else if (u.account_status === 'discord_membership_missing') {
      this.setState(AuthState.MEMBERSHIP_LOST);
    } else {
      this.setState(AuthState.ACCOUNT_READY);
    }
  }

  async refresh() {
    const { ok, data } = await this.request('/auth/refresh', { method: 'POST' });
    if (ok) { this.csrfToken = data.csrf_token; this.sessionToken = data.session_token; return true; }
    this.setState(AuthState.SESSION_EXPIRED);
    return false;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.sessionToken = null;
    this.csrfToken = null;
    this.user = null;
    this.setState(AuthState.LOGGED_OUT);
  }

  // ---- Player name ----
  async checkName(name) {
    const { ok, data } = await this.request('/account/check-player-name', {
      method: 'POST', body: { display_name: name },
    });
    return ok ? data : { available: false, reason: 'error' };
  }

  async createName(name) {
    const { ok, status, data } = await this.request('/account/create-player-name', {
      method: 'POST', body: { display_name: name },
    });
    if (ok) {
      await this.refreshSession();
      return { ok: true, tag: data.full_game_tag };
    }
    if (status === 403) { this.setState(AuthState.MEMBERSHIP_REQUIRED, data); return { ok: false, ...data }; }
    return { ok: false, error: data?.error || 'error' };
  }

  async refreshSession() {
    const { ok, data } = await this.request('/auth/session');
    if (ok && data?.authenticated) this.applySession(data);
    return ok;
  }

  async getWsTicket() {
    const { ok, data } = await this.request('/account/ws-ticket', { method: 'POST' });
    if (ok) return data.ticket;
    if (data?.error === 'membership_required') this.setState(AuthState.MEMBERSHIP_REQUIRED, data);
    return null;
  }

  async checkMembership() {
    const { ok, data } = await this.request('/account/membership');
    if (!ok) return null;
    if (!data.ok) {
      this.setState(data.pending ? AuthState.MEMBERSHIP_REQUIRED : AuthState.MEMBERSHIP_LOST, data);
    }
    return data;
  }
}

export const authClient = new AuthClient({ backendUrl: import.meta.env.VITE_AUTH_API || '/api' });
