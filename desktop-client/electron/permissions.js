const { app } = require('electron');
function setupPermissions() { app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer'); }
module.exports = { setupPermissions };
