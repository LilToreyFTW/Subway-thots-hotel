const PUBLIC_VOICE_GATEWAY = 'http://147.189.172.104:7077';

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

export function resolveVoiceServerUrl({ protocol, hostname, configuredUrl = null, queryOverride = null }) {
  const configured = safeUrl(configuredUrl);
  if (configured) return configured;
  const local = ['localhost', '127.0.0.1'].includes(hostname);
  const override = local ? safeUrl(queryOverride) : null;
  if (override) return override;
  if (protocol === 'https:') return null;
  return PUBLIC_VOICE_GATEWAY;
}
