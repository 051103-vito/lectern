// Runs the real screens in a simulated browser so keystrokes and clicks can be tested.
const { JSDOM } = require('jsdom'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const kjv = JSON.parse(read('data/kjv.json')), asv = JSON.parse(read('data/asv.json')), th = JSON.parse(read('lang/thesaurus.json'));
const FILES = ['bible.js', 'bible-import.js', 'search.js', 'songparse.js', 'sample-songs.js', 'render.js', 'control.js', 'ui-songs.js', 'ui-media.js', 'ui-announce.js', 'ui-themes.js', 'ui-layout.js', 'ui-services.js', 'ui-bibleimport.js', 'ui-settings.js', 'ui-boot.js'];
process.on('unhandledRejection', (e) => console.log('UNHANDLED:', e && e.stack || e));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t = Date.now(); while (Date.now() - t < (ms || 15000)) { if (fn()) return true; await wait(10); } throw new Error('timed out waiting'); }

const openDoms = [];
async function boot(opts) {
  opts = opts || {};
  openDoms.splice(0).forEach((d) => { try { d.window.close(); } catch (e) { /* closed */ } });   // stop the previous page's timers
  const html = read('control.html').replace(/<script src="[^"]+"><\/script>/g, '').replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true }), w = dom.window;
  openDoms.push(dom);
  w.Element.prototype.scrollIntoView = () => {};
  ['play', 'pause', 'load'].forEach((m) => { w.HTMLMediaElement.prototype[m] = function () { return Promise.resolve(); }; });
  const data = opts.data || {}; if (!('settings' in data) && opts.firstRun !== true) data.settings = { firstRun: false };
  const sent = [], calls = [], zooms = [];
  w.presenter = {
    setState: (s) => sent.push(JSON.parse(JSON.stringify(s))), getInfo: async () => ({ external: true, width: 3840, height: 2160 }), onInfo() {}, onState() {}, onUpdate: (f) => { w._upd = f; },
    appInfo: async () => ({ name: 'Lectern', version: '1.0.0', packaged: false }), displays: async () => [{ id: '1', primary: true, label: 'Main 1920x1080' }, { id: '2', primary: false, label: 'Screen 3840 x 2160' }], rebuildOutput: async () => { calls.push('rebuild'); return {}; },
    storeGet: async (k, d) => (k in data ? JSON.parse(JSON.stringify(data[k])) : d), storeSet: async (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); return true; },
    sessionBegin: async () => ({ crashed: !!opts.crashed, snapshot: data.session || null }),
    loadBible: async () => [kjv, asv], loadThesaurus: async () => th, pickBible: async () => opts.bibleFile || null, saveBible: async (b) => { calls.push('saveBible:' + b.version); return { ok: true }; }, removeBible: async (v) => { calls.push('removeBible:' + v); return true; }, setZoom: (f) => { zooms.push(f); },
    pickSongFiles: async () => opts.files || [], pickSongFolder: async () => opts.files || [], importMedia: async () => opts.media || [], removeMedia: async () => true,
    backupExport: async () => ({ ok: true }), backupImport: async () => ({ ok: true }), reload: async () => { calls.push('reload'); },
    updateCheck: async () => ({ ok: false }), updateDownload: async () => { calls.push('download'); }, updateInstall: async () => { calls.push('install'); }
  };
  w.addEventListener('error', (e) => console.log('PAGE ERROR:', e.message));
  FILES.forEach((f) => w.eval(read(f)));
  await until(() => w.CP && w.CP.ready);
  const $ = (id) => w.document.getElementById(id), CP = w.CP;
  const key = (k, o, el) => { const t = el || w.document.activeElement || w.document.body; const e = new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o || {})); t.dispatchEvent(e); return e; };
  const typeStr = (s) => [...s].forEach((c) => key(c));
  const btn = (text, scope) => [...(scope || w.document).querySelectorAll('button')].find((b) => b.textContent.trim().includes(text));
  const modalBtn = (text) => { const m = $('modalRoot').lastElementChild; const all = m ? [...m.querySelectorAll('button')] : []; return all.find((b) => b.textContent.trim() === text) || all.find((b) => b.textContent.includes(text)); };
  const modals = () => $('modalRoot').children.length;
  const last = () => sent[sent.length - 1];
  const hi = () => { const q = $('q'); return q.value.slice(q.selectionStart, q.selectionEnd); };
  const step = () => [...$('steps').children].findIndex((s) => s.classList.contains('on'));
  return { w, dom, CP, $, data, sent, calls, zooms, key, typeStr, btn, modalBtn, modals, last, hi, step, wait, until };
}
module.exports = { boot, wait, until, kjv, asv };
