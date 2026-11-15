// Importing a Bible: the + Import tab next to the version tabs opens the system file window.
// XML (Zefania, OpenSong, OSIS, USFX, Holy Bible XML) and JSON files are understood.
(() => {
  const CP = window.CP, el = CP.el;
  const field = (label, input) => { const l = el('label', '', label); l.append(input); return l; };
  async function start() {
    const f = await presenter.pickBible(); if (!f) return;
    if (f.error) { CP.toast('That file could not be read.'); return; }
    CP.toast('Reading ' + f.name + '...');
    await new Promise((r) => setTimeout(r, 40));                    // let the message show before the longer read
    let r; try { r = BibleImport.fromText(f.text, f.name); } catch (e) { CP.modal({ title: 'This file could not be imported', body: String(e.message || e) }); return; }
    show(r);
  }
  function show(r) {
    const code = el('input'); code.type = 'text'; code.value = r.version; code.maxLength = 6;
    const nm = el('input'); nm.type = 'text'; nm.value = r.name;
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    body.append(el('div', '', r.format + ': ' + r.stats.books + ' books, ' + r.stats.verses.toLocaleString() + ' verses.'));
    if (r.stats.missing.length) { const w = el('div', 'dim', 'Not in this file: ' + r.stats.missing.slice(0, 6).join(', ') + (r.stats.missing.length > 6 ? ' and ' + (r.stats.missing.length - 6) + ' more' : '') + '. You can still use it; those books show a message.'); body.append(w); }
    const note = el('div', 'warn'); body.append(field('Short name (2 to 6 letters or numbers)', code), field('Full name', nm), note);
    const check = () => { const c = code.value.trim().toUpperCase(); const ex = CP.bibles[c]; note.textContent = ex ? (ex.user ? 'This replaces the ' + c + ' you added earlier.' : c + ' is already included. Choose another short name.') : ''; };
    code.addEventListener('input', check); check();
    const m = CP.modal({ title: 'Import Bible', body, buttons: [{ label: 'Cancel' }, { label: 'Import', cls: 'go', onClick: () => {
      const c = code.value.trim().toUpperCase(), n = nm.value.trim();
      if (!/^[A-Z0-9]{2,6}$/.test(c)) { CP.toast('The short name needs 2 to 6 letters or numbers.'); return false; }
      if (CP.bibles[c] && !CP.bibles[c].user) { CP.toast(c + ' is already included. Choose another short name.'); return false; }
      if (!n) { CP.toast('Type the full name.'); return false; }
      const obj = { version: c, name: n, books: r.books };
      presenter.saveBible(obj).then((res) => { if (!res.ok) { CP.toast(res.error || 'That Bible could not be saved.'); return; } obj.user = true; CP.addBible(obj); m.close(); CP.toast(c + ' added.'); });
      return false;
    } }] });
  }
  CP.on('importbible', start); CP.importBibleFlow = start;
})();
