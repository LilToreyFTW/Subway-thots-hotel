const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..', '..');
const client = path.resolve(__dirname, '..');
const runtime = path.join(client, 'game-runtime');
if (process.env.STH_SKIP_ROOT_BUILD !== '1') {
  const rootNpm = process.platform === 'win32' ? process.env.ComSpec : 'npm';
  const rootArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build'];
  cp.execFileSync(rootNpm, rootArgs, { cwd: root, stdio: 'inherit' });
} else {
  console.log('[desktop] using prebuilt root Vite dist');
}
fs.rmSync(runtime, { recursive: true, force: true });
fs.cpSync(path.join(root, 'dist'), runtime, { recursive: true });
let commit = 'local'; try { commit = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
let version = require(path.join(client, 'package.json')).version;
const info = { version, buildNumber: process.env.GITHUB_RUN_NUMBER || 'local', commit, shortCommit: commit.slice(0, 7), channel: 'stable', builtAt: new Date().toISOString() };
fs.writeFileSync(path.join(runtime, 'build-info.json'), JSON.stringify(info, null, 2));
console.log(`[desktop] prepared Vite runtime ${version} ${info.shortCommit}`);
