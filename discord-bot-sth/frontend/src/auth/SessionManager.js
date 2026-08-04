// SessionManager.js
// Periodically validates the backend session, requests WS tickets, and handles
// expiry / membership loss. The world host must NOT start until a valid session
// ticket is obtained.

import { AuthState } from './AuthClient.js';

export class SessionManager {
  constructor(authClient, { ticketHandler, pollInterval = 30000 } = {}) {
    this.auth = authClient;
    this.ticketHandler = ticketHandler;
    this.pollInterval = pollInterval;
    this.timer = null;
    this.ready = false;
  }

  async begin() {
    const ok = await this.auth.refreshSession();
    if (!ok) return false;
    if (this.auth.state === AuthState.ACCOUNT_READY) {
      await this.issueTicket();
      return this.ready;
    }
    return false;
  }

  async issueTicket() {
    const ticket = await this.auth.getWsTicket();
    if (ticket) {
      this.ready = true;
      this.ticketHandler && this.ticketHandler(ticket);
      return ticket;
    }
    return null;
  }

  startPolling() {
    this.stopPolling();
    this.timer = setInterval(async () => {
      const membership = await this.auth.checkMembership();
      if (membership && !membership.ok && !membership.pending) {
        this.ready = false;
        this.auth.setState(AuthState.MEMBERSHIP_LOST, membership);
      } else if (this.auth.state === AuthState.ACCOUNT_READY) {
        await this.issueTicket();
      }
    }, this.pollInterval);
  }

  stopPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
