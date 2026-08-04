export function calculateProximityGain(distance, maxDistance = 25) {
  if (!Number.isFinite(distance) || !Number.isFinite(maxDistance) || maxDistance <= 0) return 0;
  if (distance <= 0) return 1;
  if (distance >= maxDistance) return 0;
  const normalized = 1 - distance / maxDistance;
  return normalized * normalized;
}

export function isSpeakingLevel(level, threshold = 0.035) {
  return Number.isFinite(level) && level >= threshold;
}

export function canShareAudioSpace(localState, remoteState) {
  if (!localState || !remoteState || localState.zone !== remoteState.zone) return false;
  return localState.zone !== 'room' || String(localState.roomId) === String(remoteState.roomId);
}
