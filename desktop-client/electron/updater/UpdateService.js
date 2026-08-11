const { autoUpdater } = require('electron-updater');
const { makeState } = require('./UpdateState');
const { sanitizeReleaseNotes } = require('./ReleaseNotesService');
class UpdateService {
  constructor(send, log) { this.send = send; this.log = log; this.state = makeState('IDLE'); this.production = false; }
  configure() {
    this.production = process.env.NODE_ENV === 'production' || require('electron').app.isPackaged;
    if (!this.production) return;
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.allowDowngrade = false;
    autoUpdater.on('checking-for-update', () => this.set(makeState('CHECKING')));
    autoUpdater.on('update-not-available', (info) => this.set(makeState('UP_TO_DATE', { installedVersion: require('electron').app.getVersion(), availableVersion: info?.version || require('electron').app.getVersion() })));
    autoUpdater.on('update-available', (info) => this.set(makeState('AVAILABLE', { availableVersion: info.version, releaseName: info.releaseName, releaseNotes: sanitizeReleaseNotes(info.releaseNotes) })));
    autoUpdater.on('download-progress', (p) => this.set(makeState('DOWNLOADING', { availableVersion: this.state.availableVersion, progress: Math.round(p.percent || 0), bytesPerSecond: p.bytesPerSecond, transferred: p.transferred, total: p.total })));
    autoUpdater.on('update-downloaded', (info) => this.set(makeState('DOWNLOADED', { availableVersion: info.version, releaseName: info.releaseName, releaseNotes: sanitizeReleaseNotes(info.releaseNotes), progress: 100 })));
    autoUpdater.on('error', (error) => this.handleError(error));
  }
  set(state) { this.state = state; this.log?.(`[update] ${state.state} ${state.availableVersion || ''}`); this.send(this.state); }
  handleError(error) { const message = error?.message || String(error); this.log?.(`[update-error] ${message}`); const unavailable = /latest\.yml|404|no published|cannot find/i.test(message); this.set(makeState(unavailable ? 'OFFLINE' : 'ERROR', { errorMessage: unavailable ? 'No GitHub release is published yet. Offline play is available.' : message })); }
  async check() { if (!this.production) return this.set(makeState('OFFLINE', { errorMessage: 'Development mode has no release updater.' })); this.set(makeState('CHECKING')); try { await autoUpdater.checkForUpdates(); } catch (e) { this.handleError(e); } return this.state; }
  async download() { if (!this.production) return this.state; try { await autoUpdater.downloadUpdate(); } catch (e) { this.handleError(e); } return this.state; }
  install() { if (this.state.state !== 'DOWNLOADED') throw new Error('Update is not downloaded yet.'); this.set(makeState('INSTALLING', { availableVersion: this.state.availableVersion })); autoUpdater.quitAndInstall(false, true); }
}
module.exports = { UpdateService };
