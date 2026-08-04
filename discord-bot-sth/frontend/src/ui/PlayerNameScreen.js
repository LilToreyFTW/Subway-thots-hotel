// ui/PlayerNameScreen.js
// Lightweight wrapper that mounts AccountSetup into a container.

import { mountAccountSetup } from '../auth/AccountSetup.js';

export function mountPlayerNameScreen(root, authClient, { onComplete }) {
  return mountAccountSetup(root, authClient, { onComplete });
}
