const fs = require('node:fs');
const path = require('node:path');
function readBuildInfo(root) { return JSON.parse(fs.readFileSync(path.join(root, 'build-info.json'), 'utf8')); }
function compareVersions(a, b) { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1; } return 0; }
module.exports = { readBuildInfo, compareVersions };
