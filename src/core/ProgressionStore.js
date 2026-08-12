const STORAGE_KEY = 'sth-progression';

function finiteInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(number)));
}

export function loadProgression(storage, defaults = {}) {
  const fallback = {
    cash: finiteInteger(defaults.cash, 240, 0, 1_000_000_000),
    reputation: finiteInteger(defaults.reputation, 12, 0, 1_000_000),
  };
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    return {
      cash: finiteInteger(parsed?.cash, fallback.cash, 0, 1_000_000_000),
      reputation: finiteInteger(parsed?.reputation, fallback.reputation, 0, 1_000_000),
    };
  } catch {
    return fallback;
  }
}

export function saveProgression(storage, progression) {
  const normalized = loadProgression({ getItem: () => null }, progression);
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export { STORAGE_KEY as PROGRESSION_STORAGE_KEY };
