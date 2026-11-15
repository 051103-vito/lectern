// Small, safe file storage for settings, songs, queue and so on.
// Every write goes to a temp file first, then replaces the real file, and the previous
// version is kept as .bak, so a power cut or forced close never leaves a half-written file.
const fs = require('fs');
const path = require('path');

function decodeText(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString('utf8');
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) { const b = Buffer.from(buf.slice(2)); b.swap16(); return b.toString('utf16le'); }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }       // old Windows text files
}

function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (k) => path.join(dir, k.replace(/[^a-z0-9_-]/gi, '_') + '.json');
  const readJson = (f) => JSON.parse(decodeText(fs.readFileSync(f)));
  function get(k, dflt) {
    const f = file(k);
    for (const p of [f, f + '.bak']) {
      try { if (fs.existsSync(p)) return readJson(p); } catch (e) { /* damaged: try the backup */ }
    }
    return dflt === undefined ? null : dflt;
  }
  function set(k, v) {
    const f = file(k), tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(v));
    if (fs.existsSync(f)) { try { fs.copyFileSync(f, f + '.bak'); } catch (e) { /* ignore */ } }
    fs.renameSync(tmp, f);
    return true;
  }
  const keys = () => fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));

  // Unexpected-close detection: a flag file exists while the app runs and is removed on a clean exit.
  const flag = path.join(dir, 'running.flag');
  function begin() {
    const crashed = fs.existsSync(flag);
    fs.writeFileSync(flag, String(Date.now()));
    return { crashed, snapshot: get('session', null) };
  }
  function end() { try { fs.unlinkSync(flag); } catch (e) { /* already gone */ } }
  return { get, set, keys, begin, end, dir };
}
module.exports = { createStore, decodeText };
