const { app, BrowserWindow, screen, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const info = require('./app-info.json');
const { createStore, decodeText } = require('./store.js');

// The data folder name never changes, even if the app is renamed, so renaming never loses anyone's songs.
app.setPath('userData', path.join(app.getPath('appData'), info.dataFolder || 'lectern'));
const userDir = app.getPath('userData');
const store = createStore(path.join(userDir, 'data'));
const mediaDir = path.join(userDir, 'media'), bibleDir = path.join(userDir, 'bibles'), logFile = path.join(userDir, 'log.txt');
[mediaDir, bibleDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));
const log = (m) => { try { fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n'); } catch (e) { /* no log */ } };
process.on('uncaughtException', (e) => log('uncaught ' + (e && e.stack || e)));

let control = null, output = null, state = { mode: 'black' }, rebuildTimer = null, autoUpdater = null;
const settings = () => store.get('settings', {}) || {};

// ---------- displays ----------
function displays() { const p = screen.getPrimaryDisplay(); return screen.getAllDisplays().map((d) => ({ id: String(d.id), primary: d.id === p.id, w: Math.round(d.size.width * d.scaleFactor), h: Math.round(d.size.height * d.scaleFactor), label: (d.id === p.id ? 'Main screen' : 'Screen') + ' ' + Math.round(d.size.width * d.scaleFactor) + ' \u00d7 ' + Math.round(d.size.height * d.scaleFactor) })); }
function findOutputDisplay() {
  const all = screen.getAllDisplays(), primary = screen.getPrimaryDisplay(), want = settings().outputDisplay;
  if (want && want !== 'auto') { const d = all.find((x) => String(x.id) === String(want)); if (d && d.id !== primary.id) return d; }
  return all.find((d) => d.id !== primary.id) || null;      // the HDMI splitter shows up as one extra screen
}
function outputInfo() { const d = findOutputDisplay(); return d ? { external: true, width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) } : { external: false, width: 960, height: 540 }; }
function send(ch, payload) { if (control && !control.isDestroyed()) control.webContents.send(ch, payload); }

function createOutput() {
  if (output && !output.isDestroyed()) output.destroy();
  const d = findOutputDisplay();
  output = new BrowserWindow({ width: 960, height: 540, backgroundColor: '#000000', autoHideMenuBar: true, title: info.name + ' output', frame: !d, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  if (d) { output.setBounds(d.bounds); output.setFullScreen(true); }
  output.loadFile('output.html');
  output.webContents.on('did-finish-load', () => output.webContents.send('state', state));
  output.webContents.on('render-process-gone', () => { log('output process gone'); setTimeout(createOutput, 500); });
  send('output-info', outputInfo());
}
// Cables get unplugged and splitters power on late: rebuild the output whenever the screens change.
function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(createOutput, 600); }

function createControl() {
  control = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 680, backgroundColor: '#0c0c0e', autoHideMenuBar: true, title: info.name, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  control.loadFile('control.html');
  control.webContents.on('did-finish-load', () => send('output-info', outputInfo()));
  control.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F12') control.webContents.toggleDevTools(); });   // F12 shows the developer tools if something needs investigating
  control.webContents.on('render-process-gone', (_e, d) => { log('control process gone: ' + d.reason); setTimeout(() => { if (control && !control.isDestroyed()) control.reload(); }, 400); });
  control.on('closed', () => app.quit());
}

// ---------- updates (GitHub Releases) ----------
function setupUpdater() {
  try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { return; }
  autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = true; autoUpdater.logger = null;
  autoUpdater.on('update-available', (i) => send('update', { state: 'available', version: i.version }));
  autoUpdater.on('update-not-available', () => send('update', { state: 'none' }));
  autoUpdater.on('download-progress', (p) => send('update', { state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => send('update', { state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => { log('updater ' + e); send('update', { state: 'error' }); });
}
const canUpdate = () => !!autoUpdater && app.isPackaged;

// ---------- IPC ----------
ipcMain.on('set-state', (_e, next) => { state = next; if (output && !output.isDestroyed()) output.webContents.send('state', state); });
ipcMain.handle('get-info', () => outputInfo());
ipcMain.handle('app:info', () => ({ name: info.name, tagline: info.tagline, version: app.getVersion(), packaged: app.isPackaged, repo: info.owner + '/' + info.repo }));
ipcMain.handle('displays:list', () => displays());
ipcMain.handle('output:rebuild', () => { createOutput(); return outputInfo(); });
ipcMain.handle('store:get', (_e, k, d) => store.get(k, d));
ipcMain.handle('store:set', (_e, k, v) => store.set(k, v));
ipcMain.handle('session:begin', () => store.begin());
ipcMain.handle('bible:load', () => {
  const read = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(decodeText(fs.readFileSync(path.join(dir, f)))); } catch (e) { log('bible ' + f + ' ' + e); return null; } }).filter(Boolean) : [];
  const bundled = read(path.join(__dirname, 'data')).sort((a, b) => (a.version === 'KJV' ? -1 : b.version === 'KJV' ? 1 : a.version.localeCompare(b.version)));
  const mine = read(bibleDir).map((b) => Object.assign(b, { user: true }));
  return bundled.concat(mine);
});
ipcMain.handle('lang:load', () => JSON.parse(fs.readFileSync(path.join(__dirname, 'lang', 'thesaurus.json'), 'utf8')));

ipcMain.handle('songs:pickFiles', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Import songs', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Text files', extensions: ['txt'] }, { name: 'All files', extensions: ['*'] }] });
  if (r.canceled) return [];
  return r.filePaths.map((p) => ({ name: path.basename(p), text: decodeText(fs.readFileSync(p)) }));
});
ipcMain.handle('songs:pickFolder', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Import every .txt in a folder', properties: ['openDirectory'] });
  if (r.canceled) return [];
  return fs.readdirSync(r.filePaths[0]).filter((f) => /\.txt$/i.test(f)).map((f) => ({ name: f, text: decodeText(fs.readFileSync(path.join(r.filePaths[0], f))) }));
});
const KIND = { '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image', '.bmp': 'image', '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.m4v': 'video', '.ogv': 'video' };
ipcMain.handle('media:import', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Import images and videos', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images and videos', extensions: Object.keys(KIND).map((k) => k.slice(1)) }] });
  if (r.canceled) return [];
  return r.filePaths.filter((p) => KIND[path.extname(p).toLowerCase()]).map((p) => {
    const ext = path.extname(p).toLowerCase(), id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), dest = path.join(mediaDir, id + ext);
    fs.copyFileSync(p, dest);
    return { id, name: path.basename(p, path.extname(p)), kind: KIND[ext], url: pathToFileURL(dest).href, file: dest };
  });
});
ipcMain.handle('media:remove', (_e, file) => { try { if (file && path.dirname(file) === mediaDir) fs.unlinkSync(file); } catch (e) { /* already gone */ } return true; });
// Adding a Bible: the system file window opens, the chosen file is read here and parsed on screen (XML or JSON).
ipcMain.handle('bible:pick', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Import a Bible', properties: ['openFile'], filters: [{ name: 'Bible files (XML or JSON)', extensions: ['xml', 'json'] }, { name: 'All files', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  try { return { name: path.basename(r.filePaths[0]), text: decodeText(fs.readFileSync(r.filePaths[0])) }; } catch (e) { return { name: path.basename(r.filePaths[0]), error: String(e.message || e) }; }
});
ipcMain.handle('bible:save', (_e, b) => {
  try {
    if (!b || !/^[A-Z0-9]{2,8}$/.test(b.version || '') || !Array.isArray(b.books) || b.books.length !== 66) return { ok: false, error: 'That Bible could not be saved.' };
    const bundled = fs.readdirSync(path.join(__dirname, 'data')).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', f), 'utf8')).version; } catch (e) { return ''; } });
    if (bundled.includes(b.version)) return { ok: false, error: b.version + ' is already included. Choose another short name.' };
    fs.writeFileSync(path.join(bibleDir, b.version + '.json'), JSON.stringify({ version: b.version, name: b.name, books: b.books }));
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('bible:remove', (_e, version) => { try { if (/^[A-Z0-9]{2,8}$/.test(version || '')) fs.unlinkSync(path.join(bibleDir, version + '.json')); return true; } catch (e) { return false; } });
ipcMain.handle('backup:export', async () => {
  const r = await dialog.showSaveDialog(control, { title: 'Save a backup', defaultPath: info.name + '-backup-' + new Date().toISOString().slice(0, 10) + '.json', filters: [{ name: 'Backup', extensions: ['json'] }] });
  if (r.canceled) return { ok: false, canceled: true };
  const bundle = { app: info.name, made: new Date().toISOString(), data: {} };
  store.keys().filter((k) => k !== 'session').forEach((k) => { bundle.data[k] = store.get(k); });
  fs.writeFileSync(r.filePath, JSON.stringify(bundle));
  return { ok: true, path: r.filePath };
});
ipcMain.handle('backup:import', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Restore a backup', properties: ['openFile'], filters: [{ name: 'Backup', extensions: ['json'] }] });
  if (r.canceled) return { ok: false, canceled: true };
  try {
    const b = JSON.parse(decodeText(fs.readFileSync(r.filePaths[0])));
    if (!b || !b.data || typeof b.data !== 'object') throw new Error('This is not a backup file.');
    Object.keys(b.data).forEach((k) => store.set(k, b.data[k]));
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('update:check', () => { if (!canUpdate()) return { ok: false }; autoUpdater.checkForUpdates().catch((e) => log('check ' + e)); return { ok: true }; });
ipcMain.handle('update:download', () => { if (canUpdate()) autoUpdater.downloadUpdate().catch((e) => log('download ' + e)); return true; });
ipcMain.handle('update:install', () => { if (canUpdate()) autoUpdater.quitAndInstall(false, true); return true; });
ipcMain.handle('app:reload', () => { if (control) control.reload(); return true; });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);          // no built-in menu: keeps its zoom keys from fighting the size slider
  createControl(); createOutput(); setupUpdater();
  screen.on('display-added', scheduleRebuild); screen.on('display-removed', scheduleRebuild); screen.on('display-metrics-changed', scheduleRebuild);
  if (settings().updates !== false) setTimeout(() => { if (canUpdate()) autoUpdater.checkForUpdates().catch((e) => log('check ' + e)); }, 8000);
});
app.on('before-quit', () => store.end());          // a clean exit removes the "running" flag
app.on('window-all-closed', () => app.quit());
