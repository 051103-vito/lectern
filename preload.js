const { contextBridge, ipcRenderer, webFrame } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('presenter', {
  setState: (s) => ipcRenderer.send('set-state', s),
  getInfo: inv('get-info'), appInfo: inv('app:info'), displays: inv('displays:list'), rebuildOutput: inv('output:rebuild'),
  storeGet: inv('store:get'), storeSet: inv('store:set'), sessionBegin: inv('session:begin'),
  loadBible: inv('bible:load'), loadThesaurus: inv('lang:load'), pickBible: inv('bible:pick'), saveBible: inv('bible:save'), removeBible: inv('bible:remove'),
  setZoom: (f) => webFrame.setZoomFactor(f),
  pickSongFiles: inv('songs:pickFiles'), pickSongFolder: inv('songs:pickFolder'),
  importMedia: inv('media:import'), removeMedia: inv('media:remove'),
  backupExport: inv('backup:export'), backupImport: inv('backup:import'), reload: inv('app:reload'),
  updateCheck: inv('update:check'), updateDownload: inv('update:download'), updateInstall: inv('update:install'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onInfo: (fn) => ipcRenderer.on('output-info', (_e, i) => fn(i)),
  onUpdate: (fn) => ipcRenderer.on('update', (_e, u) => fn(u))
});
