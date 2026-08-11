const { app, session, shell } = require('electron');
function installSecurity(gameScheme, log) {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => { const url = webContents.getURL(); callback(permission === 'media' && url.startsWith(`${gameScheme}://game/`)); });
  app.on('web-contents-created', (_event, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\/(github\.com|discord\.com)\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${gameScheme}://`) && !url.startsWith('file://') && !url.startsWith('http://127.0.0.1:')) event.preventDefault(); });
  });
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => { if (details.url.startsWith(`${gameScheme}://`) || details.url.startsWith('https://') || details.url.startsWith('http://127.0.0.1:') || details.url.startsWith('ws://127.0.0.1:') || details.url.startsWith('wss://127.0.0.1:')) return callback({}); log?.(`[security] blocked ${details.url}`); callback({ cancel: true }); });
}
module.exports = { installSecurity };
