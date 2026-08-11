const fs = require('node:fs');
const path = require('node:path');
const runtime = path.resolve(__dirname, '..', 'game-runtime');
for (const file of ['index.html', 'build-info.json']) if (!fs.existsSync(path.join(runtime, file))) throw new Error(`Missing packaged game file: ${file}`);
const info = JSON.parse(fs.readFileSync(path.join(runtime, 'build-info.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('build-info version is not semantic versioning');
console.log(`[desktop] verified game runtime ${info.version} ${info.shortCommit}`);
