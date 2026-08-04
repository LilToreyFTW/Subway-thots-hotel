import { createHmac, timingSafeEqual } from 'node:crypto';

const PLAYER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;

function sign(encodedPayload, secret) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createJoinToken({ playerId, expiresAt }, secret) {
  if (!PLAYER_ID_PATTERN.test(String(playerId)) || !Number.isInteger(expiresAt) || String(secret).length < 32) {
    throw new TypeError('Invalid voice token input');
  }
  const payload = Buffer.from(JSON.stringify({ playerId, exp: expiresAt })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyJoinToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  try {
    const [payload, signature, extra] = String(token || '').split('.');
    if (!payload || !signature || extra || String(secret).length < 32) return null;
    const expected = sign(payload, secret);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!PLAYER_ID_PATTERN.test(String(decoded.playerId)) || !Number.isInteger(decoded.exp) || decoded.exp <= now) return null;
    return decoded.playerId;
  } catch {
    return null;
  }
}
