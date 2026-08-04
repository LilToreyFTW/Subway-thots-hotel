const LOBBY_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,23}$/;
const ZONES = new Set(['city', 'hotel', 'room']);

export function normalizeLobbyCode(value) {
  const normalized = String(value || 'PUBLIC').trim().toUpperCase();
  if (!LOBBY_PATTERN.test(normalized)) throw new TypeError('Invalid lobby code');
  return normalized;
}

export function validatePlayerState(value) {
  if (!value || typeof value !== 'object') return null;
  const position = value.position;
  const values = [position?.x, position?.y, position?.z, value.rotation];
  if (!values.every(Number.isFinite)) return null;
  const zone = ZONES.has(value.zone) ? value.zone : 'city';
  const roomId = zone === 'room' && /^([1-9]|[1-4][0-9]|50)$/.test(String(value.roomId)) ? String(value.roomId) : null;
  return {
    position: {
      x: Math.max(-110, Math.min(110, position.x)),
      y: Math.max(0, Math.min(12, position.y)),
      z: Math.max(-110, Math.min(110, position.z)),
    },
    rotation: Math.max(-Math.PI * 8, Math.min(Math.PI * 8, value.rotation)),
    zone,
    roomId,
  };
}

export function validateSignal(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.description) {
    const { type, sdp } = value.description;
    return ['offer', 'answer', 'rollback'].includes(type) && typeof sdp === 'string' && sdp.length <= 65_536;
  }
  if (value.candidate) {
    const candidate = value.candidate;
    return typeof candidate.candidate === 'string' && candidate.candidate.length <= 4096;
  }
  return false;
}
