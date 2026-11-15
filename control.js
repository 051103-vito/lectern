// Core: state, Bible search box, Preview/Program, queue, keyboard. Other files (ui-*.js) add Songs, Media, themes and so on.
(() => {
  'use strict';
  const B = BibleLogic, $ = (id) => document.getElementById(id), clamp = B.clamp;
  const CP = window.CP = { B, $, clamp, ev: {}, types: {}, ctx: 'bible', studio: false, settings: {}, bibles: {}, order: [], cur: 'KJV', tab: 'bible' };
  CP.initFns = []; CP.onInit = (f) => CP.initFns.push(f);
  CP.on = (n, f) => { (CP.ev[n] = CP.ev[n] || []).push(f); };
  CP.emit = (n, ...a) => { (CP.ev[n] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(n, e); } }); };
  const el = CP.el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  // ---------- settings ----------
  const baseTheme = () => ({ bg: { type: 'gradient', from: '#14307a', to: '#0a1a4a' }, color: '#ffffff', refColor: '#f5c542', weight: 600, shadow: true, pos: 'center', maxSize: 100 });
  CP.defaults = () => ({ uiScale: 1, firstRun: true, mode: 'direct', clicker: true, lowPerf: false, outputDisplay: 'auto', updates: true, locked: true, layoutName: 'Default', layouts: {}, linesPerSlide: 4, version: 'KJV', themes: { bible: baseTheme(), song: baseTheme(), announce: baseTheme() } });
  CP.saveSettings = () => presenter.storeSet('settings', CP.settings);
  CP.theme = (key) => {
    const t = JSON.parse(JSON.stringify((CP.settings.themes && CP.settings.themes[key]) || baseTheme()));
    if (t.bg && t.bg.type === 'media') { const m = CP.mediaItem && CP.mediaItem(t.bg.id); t.bg = m ? { type: 'media', kind: m.kind, url: m.url, loop: true } : baseTheme().bg; }
    return t;
  };

  // ---------- small helpers: modal and toast ----------
  CP.modal = ({ title, body, buttons, wide }) => {
    const back = el('div', 'mback'), box = el('div', 'modal' + (wide ? ' wide' : ''));
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
    const mb = el('div', 'mb'); if (typeof body === 'string') mb.textContent = body; else if (body) mb.append(body);
    const mf = el('div', 'mf');
    const close = () => { back.remove(); const q0 = $('q'); if (q0 && CP.tab === 'bible') q0.focus(); };
    (buttons || [{ label: 'Close' }]).forEach((b) => { const x = el('button', b.cls || '', b.label); x.onclick = () => { if (b.onClick && b.onClick(box) === false) return; close(); }; mf.append(x); });
    box.append(el('h2', '', title), mb, mf); back.append(box); $('modalRoot').append(back);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    const f = box.querySelector('input,textarea,select'); if (f) f.focus(); else { const b0 = mf.querySelector('button:last-child'); if (b0) b0.focus(); }
    return { close, box };
  };
  CP.modalOpen = () => $('modalRoot').children.length > 0;
  let toastT = null;
  CP.toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); };
  CP.ask = (title, label, value, cb, okLabel) => {
    const inp = el('input'); inp.type = 'text'; inp.value = value || ''; const lab = el('label', '', label); lab.append(inp);
    const m = CP.modal({ title, body: lab, buttons: [{ label: 'Cancel' }, { label: okLabel || 'OK', cls: 'go', onClick: () => { const v = inp.value.trim(); if (!v) return false; cb(v); } }] });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = inp.value.trim(); if (v) { cb(v); m.close(); } } });
  };
  CP.confirm = (title, text, cb, okLabel) => CP.modal({ title, body: text, buttons: [{ label: 'Cancel' }, { label: okLabel || 'OK', cls: 'go', onClick: () => { cb(); } }] });
  CP.uid = (p) => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Preview and Program ----------
  const prog = $('prog'), prev = $('prev');
  let program = { mode: 'black' }, preview = null, alertState = null;
  const outState = () => (alertState ? Object.assign({}, program, { alert: alertState }) : program);
  function updateLiveInd() {
    const li = $('liveInd'), on = ['text', 'media', 'countdown', 'logo'].includes(program.mode);
    li.classList.toggle('on', on); li.querySelector('b').textContent = on ? 'LIVE' : program.mode === 'black' ? 'BLACK' : 'STANDBY';
  }
  // Make Preview and Live as big as the panel allows while keeping the 16:9 shape.
  function sizeMonitors() {
    const m = document.querySelector('.mons'); if (!m || !m.clientWidth) return;
    const availW = (m.clientWidth - 28 - 14) / 2, availH = m.clientHeight - 24 - 26;
    m.style.setProperty('--mw', Math.max(90, Math.floor(Math.min(availW, availH * 16 / 9))) + 'px');
  }
  function drawMonitors() {
    sizeMonitors();
    StageRender.draw(prog, outState(), { mini: true }); StageRender.fit(prog);
    StageRender.draw(prev, preview || { mode: 'clear', theme: CP.theme('bible') }, { mini: true }); StageRender.fit(prev);
    updateLiveInd();
  }
  CP.drawMonitors = drawMonitors;
  CP.getProgram = () => program; CP.getPreview = () => preview;
  CP.setProgram = (s) => {
    program = s; presenter.setState(outState()); drawMonitors(); markRows(); CP.emit('program', program);
    if (s.mode === 'text' && s.kind === 'verse') pushRecent(s);
    CP.saveSoon();
  };
  CP.setPreview = (s) => { preview = s; drawMonitors(); CP.emit('preview', s); };
  CP.setAlert = (a) => { alertState = a; presenter.setState(outState()); drawMonitors(); };
  CP.take = () => { if (preview) CP.setProgram(preview); };
  CP.show = (s, live) => { CP.setPreview(s); if (live) CP.setProgram(s); };

  // ---------- Bible: versions, selection, the Book/Chapter/Verse box ----------
  const q = $('q'), list = $('list'), sugg = $('sugg'), hint = $('hint'), where = $('where'), steps = $('steps').children;
  const sIn = $('s'), sinfo = $('sinfo'), res = $('res'), vers = $('vers'), verTabs = $('verTabs'), addQ = $('addQ');
  let bible = null, seg = 0, fresh = true, bookTyped = 'gen', ci = 0, cands = [];
  let ch = 1, v1 = 1, v2 = null, chTyped = '', vTyped = '', v2Typed = '';
  let sel = null, listKey = '', rows = [], recent = [];
  CP.getSel = () => sel && { v: CP.cur, bi: sel.bi, ch: sel.ch, v1: sel.v1, v2: sel.v2 };
  const chaptersOf = (bi) => bible.books[bi].chapters, maxV = (bi, c) => chaptersOf(bi)[c - 1].length;
  const verseText = (it) => { const b = CP.bibles[it.v]; const c = b && b.books[it.bi].chapters[it.ch - 1]; return (c && c.slice(it.v1 - 1, it.v2).join(' ')) || ''; };

  function verseSlide(it) {
    return { mode: 'text', kind: 'verse', ref: B.formatRef(B.NAMES[it.bi], it.ch, it.v1, it.v2), text: verseText(it), version: it.v, ver: it.v, bi: it.bi, ch: it.ch, v1: it.v1, v2: it.v2, theme: CP.theme('bible') };
  }
  const slide = () => (sel ? verseSlide(CP.getSel()) : { mode: 'clear', theme: CP.theme('bible') });
  CP.verseSlide = verseSlide;

  function renderVerTabs() {
    verTabs.textContent = '';
    CP.order.forEach((id) => { const t = el('span', id === CP.cur ? 'on' : '', id); t.title = CP.bibles[id].name || id; t.onclick = () => { switchVersion(id); q.focus(); }; verTabs.append(t); });
    const imp = el('span', 'imp', '+ Import'); imp.title = 'Import a Bible from a file (XML or JSON)'; imp.onclick = () => CP.emit('importbible'); verTabs.append(imp);
    $('ver').textContent = CP.bibles[CP.cur] ? (CP.bibles[CP.cur].name || CP.cur) : '';
  }
  function switchVersion(id) { if (!CP.bibles[id]) return; CP.cur = id; bible = CP.bibles[id]; CP.settings.version = id; renderVerTabs(); if (sel) commit(); }
  CP.renderVerTabs = renderVerTabs; CP.switchVersion = switchVersion;
  CP.addBible = (b) => { if (!CP.bibles[b.version]) CP.order.push(b.version); CP.bibles[b.version] = b; CP.resetEngine(); switchVersion(b.version); renderVerTabs(); };
  CP.removeBible = (v) => {
    if (!CP.bibles[v]) return; if (CP.cur === v) switchVersion(CP.order.find((x) => x !== v));
    delete CP.bibles[v]; CP.order = CP.order.filter((x) => x !== v); CP.resetEngine(); renderVerTabs();
    queue = queue.filter((it) => it.v !== v); renderQueue(); recent = recent.filter((r) => r.v !== v); renderRecent(); CP.saveSoon();
  };
  // Interface size: a slider in Settings (and Ctrl+minus, Ctrl+plus, Ctrl+0) makes the whole layout smaller or bigger.
  CP.setScale = (f, persist) => {
    f = Math.max(0.6, Math.min(1.2, Math.round(f * 20) / 20)); CP.settings.uiScale = f;
    if (presenter.setZoom) presenter.setZoom(f); else document.documentElement.style.zoom = f;
    if (persist !== false) CP.saveSettings(); CP.emit('scale', f);
  };

  function markRows() {
    if (!sel) return;
    const pl = program.mode === 'text' && program.kind === 'verse' && program.ver === CP.cur && program.bi === sel.bi && program.ch === sel.ch;
    rows.forEach((b, i) => {
      const n = i + 1, isSel = n >= sel.v1 && n <= sel.v2, isLive = pl && n >= program.v1 && n <= program.v2;
      b.classList.toggle('sel', isSel); b.classList.toggle('live', isLive);
      const old = b.querySelector('.badge'); if (old) old.remove();
      if (isLive || (isSel && !isLive)) { const bd = el('span', 'badge ' + (isLive ? 'live' : 'sel'), isLive ? 'LIVE' : 'SELECTED'); b.insertBefore(bd, b.firstChild.nextSibling); }
    });
    markQueue(); if (CP.markSlides) CP.markSlides();
  }
  function renderList() {
    const lk = sel ? CP.cur + ':' + sel.bi + ':' + sel.ch : '';
    if (lk !== listKey) {
      listKey = lk; list.textContent = ''; rows = [];
      if (sel) chaptersOf(sel.bi)[sel.ch - 1].forEach((t, i) => {
        const b = el('button', 'v'); b.dataset.n = i + 1;
        b.append(el('b', '', sel.ch + ':' + (i + 1)), document.createTextNode(' ' + (t || '(this verse is not in this version)'))); if (!t) b.classList.add('gap'); list.append(b); rows.push(b);
      });
    }
    if (!sel) { where.textContent = ''; return; }
    markRows();
    const r = rows[sel.v1 - 1]; if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
    where.textContent = B.NAMES[sel.bi] + ' ' + sel.ch + ', verse ' + sel.v1 + (sel.v2 !== sel.v1 ? '-' + sel.v2 : '') + ' of ' + maxV(sel.bi, sel.ch);
  }
  function renderSugg() {
    sugg.textContent = '';
    if (seg !== 0 || cands.length < 2) return;
    cands.forEach((n, i) => { const b = el('button', i === ci ? 'on' : '', n); b.onclick = () => { ci = i; next(); q.focus(); }; sugg.append(b); });
  }
  function status() {
    for (let i = 0; i < 3; i++) { const on = i === Math.min(seg, 2); steps[i].classList.toggle('on', on); steps[i].classList.toggle('done', i < Math.min(seg, 2)); }
    if (!sel) { hint.textContent = bookTyped ? '' : 'Type a book'; return; }
    const name = B.NAMES[sel.bi], nCh = chaptersOf(sel.bi).length;
    hint.textContent = seg === 0 ? (cands.length > 1 ? cands.length + ' books match' : 'Right Arrow or Space for chapter') : seg === 1 ? name + ' has ' + nCh + ' chapters' : name + ' ' + sel.ch + ' has ' + maxV(sel.bi, sel.ch) + ' verses';
  }
  function resolveBook() { const r = B.parse(bookTyped); cands = r.ok ? r.candidates : []; if (ci >= cands.length) ci = 0; return cands.length ? B.bookIndex(cands[ci]) : -1; }
  function layout() {
    const name = B.NAMES[sel.bi], c = String(sel.ch), v = String(sel.v1), a = name.length + 1, b = a + c.length + 1, d = b + v.length + 1;
    return { text: name + ' ' + c + ':' + v + (v2 !== null ? '-' + sel.v2 : ''), ranges: [[0, name.length], [a, a + c.length], [b, b + v.length], [d, d + String(sel.v2).length]] };
  }
  function commit() {
    const bi = resolveBook();
    if (bi < 0) { sel = null; q.value = bookTyped; q.setSelectionRange(q.value.length, q.value.length); renderSugg(); renderList(); status(); return; }
    if (!chaptersOf(bi).length) {      // a part-Bible (for example New Testament only) has no such book
      sel = null; seg = 0; q.value = B.NAMES[bi]; q.setSelectionRange(0, q.value.length); renderSugg(); renderList(); status(); hint.textContent = CP.cur + ' does not include ' + B.NAMES[bi]; return;
    }
    ch = clamp(ch, 1, chaptersOf(bi).length); v1 = clamp(v1, 1, maxV(bi, ch));
    if (v2 !== null) v2 = clamp(v2, v1, maxV(bi, ch));
    sel = { bi, ch, v1, v2: v2 === null ? v1 : v2 };
    const L = layout(); q.value = L.text; const r = L.ranges[seg]; q.setSelectionRange(r[0], r[1]);
    renderSugg(); renderList(); status(); markQueue();
    if (CP.ctx === 'bible') bibleSlides();
    if (!CP.studio && CP.ctx === 'bible') CP.setPreview(slide());
    CP.saveSoon();
  }
  function enterSeg(s) { seg = s; fresh = true; chTyped = vTyped = v2Typed = ''; commit(); }
  function resetNumbers() { ch = 1; v1 = 1; v2 = null; chTyped = vTyped = v2Typed = ''; }
  function next() {
    if (seg === 0) { if (resolveBook() < 0) return; bookTyped = cands[ci].toLowerCase().replace(/\s+/g, ''); ci = 0; enterSeg(1); }
    else if (seg === 1) enterSeg(2);
  }
  const prevSeg = () => enterSeg(seg > 0 ? seg - 1 : 0);
  function typeLetter(c) {
    const valid = (x) => B.parse(x).ok || /^[1-3]$/.test(x);
    let t = (fresh ? '' : bookTyped) + c;
    if (!valid(t)) { if (!sel && resolveBook() >= 0 && valid(c)) t = c; else return; }       // after "does not include", a new letter starts over
    bookTyped = t; fresh = false; ci = 0; seg = 0; resetNumbers(); CP.ctx = 'bible'; commit();
  }
  function typeDigit(d) {
    if (seg === 0) {
      if (fresh && /^[1-3]$/.test(d)) { typeLetter(d); return; }
      if (bookTyped && resolveBook() >= 0 && !/^[1-3]$/.test(bookTyped)) { next(); typeDigit(d); }
      return;
    }
    if (!sel) return;
    const bi = sel.bi;
    if (seg === 1) { const t = (fresh ? '' : chTyped) + d, n = +t; if (n < 1 || n > chaptersOf(bi).length) return; chTyped = t; ch = n; v1 = 1; v2 = null; fresh = false; commit(); }
    else if (seg === 2) { const t = (fresh ? '' : vTyped) + d, n = +t; if (n < 1 || n > maxV(bi, sel.ch)) return; vTyped = t; v1 = n; v2 = null; fresh = false; commit(); }
    else { const t = (fresh ? '' : v2Typed) + d, n = +t; if (n < 1 || n > maxV(bi, sel.ch)) return; v2Typed = t; v2 = n; fresh = false; commit(); }
  }
  function back() {
    if (seg === 0) { bookTyped = fresh ? '' : bookTyped.slice(0, -1); fresh = false; ci = 0; resetNumbers(); commit(); return; }
    const typed = seg === 1 ? chTyped : seg === 2 ? vTyped : v2Typed;
    if (!fresh && typed.length > 1) { const t = typed.slice(0, -1); if (seg === 1) { chTyped = t; ch = +t; v1 = 1; v2 = null; } else if (seg === 2) { vTyped = t; v1 = +t; v2 = null; } else { v2Typed = t; v2 = +t; } commit(); }
    else if (!fresh && typed.length === 1) { if (seg === 1) { chTyped = ''; ch = 1; v1 = 1; v2 = null; } else if (seg === 2) { vTyped = ''; v1 = 1; v2 = null; } else { v2Typed = ''; v2 = null; } fresh = true; if (seg === 3) seg = 2; commit(); }
    else { if (seg === 3) v2 = null; enterSeg(seg - 1); }
  }
  function moveVerse(d, noLive) {
    if (!sel) return;
    CP.ctx = 'bible';
    const n = maxV(sel.bi, sel.ch); let v = sel.v1 + d, c = sel.ch;
    if (v > n && c < chaptersOf(sel.bi).length) { c++; v = 1; } else if (v < 1 && c > 1) { c--; v = maxV(sel.bi, c); }
    ch = c; v1 = clamp(v, 1, maxV(sel.bi, c)); v2 = null; chTyped = vTyped = ''; fresh = true; commit();
    if (!CP.studio && !noLive) CP.setProgram(slide());
  }
  function moveChapter(d) { if (!sel) return; CP.ctx = 'bible'; ch = clamp(sel.ch + d, 1, chaptersOf(sel.bi).length); v1 = 1; v2 = null; chTyped = vTyped = ''; fresh = true; commit(); }
  CP.moveChapter = moveChapter;
  CP.stepFns = { bible: moveVerse };
  CP.step = (d) => { const f = CP.stepFns[CP.ctx]; if (f) f(d); };

  // Select a stored reference (from search, the queue or the recent list).
  function applyRef(it) {
    if (it.v !== CP.cur) switchVersion(it.v);
    bookTyped = B.NAMES[it.bi].toLowerCase().replace(/\s+/g, ''); ci = 0; ch = it.ch; v1 = it.v1; v2 = it.v2 && it.v2 !== it.v1 ? it.v2 : null;
    seg = 2; fresh = true; chTyped = vTyped = v2Typed = ''; CP.ctx = 'bible'; commit();
  }
  CP.applyRef = applyRef;

  // Recent verses
  function pushRecent(s) {
    const it = { v: s.ver, bi: s.bi, ch: s.ch, v1: s.v1, v2: s.v2 };
    recent = recent.filter((r) => !(r.v === it.v && r.bi === it.bi && r.ch === it.ch && r.v1 === it.v1 && r.v2 === it.v2)); recent.unshift(it); recent = recent.slice(0, 12); renderRecent();
  }
  function renderRecent() {
    const box = $('recent'); box.textContent = ''; box.hidden = !recent.length; if (!recent.length) return;
    box.append(el('small', '', 'Recent'));
    recent.forEach((it) => { const b = el('button', '', B.formatRef(B.NAMES[it.bi], it.ch, it.v1, it.v2)); b.title = 'Select (double-click to go live)'; b.onclick = () => { applyRef(it); q.focus(); }; b.ondblclick = () => { applyRef(it); CP.setProgram(slide()); }; box.append(b); });
  }
  CP.getRecent = () => recent; CP.setRecent = (r) => { recent = r || []; renderRecent(); };

  // Live slides panel (bottom left): the slides of whatever is selected
  CP.slides = { items: [], isSel: () => false, isLive: () => false, pick() {}, live() {} };
  function renderSlides() {
    const box = $('slides'); box.textContent = '';
    const S = CP.slides; $('liveTitle').textContent = S.title || '';
    if (!S.items.length) { box.append(el('div', 'empty', S.title ? 'This item is one full-screen slide. Use Go live.' : 'Select a verse or a song and its slides appear here.')); $('slInfo').textContent = ''; return; }
    S.items.forEach((it, i) => {
      const b = el('button', 'sl'); b.dataset.i = i; b.append(el('small', '', it.label), el('div', 'tx', it.text));
      b.onclick = () => S.pick(i); b.ondblclick = () => S.live(i); box.append(b);
    });
    CP.markSlides();
  }
  CP.renderSlides = renderSlides;
  CP.markSlides = () => {
    const S = CP.slides; let at = -1;
    [...$('slides').children].forEach((b) => {
      if (b.dataset.i === undefined) return; const i = +b.dataset.i, s1 = S.isSel(i), l1 = S.isLive(i);
      b.classList.toggle('sel', s1); b.classList.toggle('live', l1); if (s1) at = i;
      const old = b.querySelector('.badge'); if (old) old.remove();
      if (l1 || s1) b.insertBefore(el('span', 'badge ' + (l1 ? 'live' : 'sel'), l1 ? 'LIVE' : 'SELECTED'), b.firstChild);
    });
    $('slInfo').textContent = at >= 0 ? 'Slide ' + (at + 1) + ' of ' + S.items.length : '';
  };
  function bibleSlides() {
    if (!sel) return;
    const items = []; let n = sel.v1; const total = maxV(sel.bi, sel.ch);
    for (let k = 0; k < 8 && n + k <= total; k++) items.push({ label: B.NAMES[sel.bi] + ' ' + sel.ch + ':' + (n + k), text: chaptersOf(sel.bi)[sel.ch - 1][n + k - 1], verse: n + k });
    CP.slides = {
      title: B.formatRef(B.NAMES[sel.bi], sel.ch, sel.v1, sel.v2), items,
      isSel: (i) => i === 0,
      isLive: (i) => program.mode === 'text' && program.kind === 'verse' && program.ver === CP.cur && program.bi === sel.bi && program.ch === sel.ch && items[i].verse >= program.v1 && items[i].verse <= program.v2,
      pick: (i) => { seg = 2; v1 = items[i].verse; v2 = null; fresh = true; commit(); },
      live: (i) => { seg = 2; v1 = items[i].verse; v2 = null; fresh = true; commit(); CP.setProgram(slide()); }
    };
    renderSlides();
  }
  CP.bibleSlides = bibleSlides;

  // ---------- Search by meaning ----------
  let engine = null, results = [], hiMap = new Map(), ri = 0, vfilter = 'All', stimer = null;
  CP.thes = null;
  const ensureEngine = () => (engine = engine || SearchLib.create(CP.bibles, CP.order, CP.thes));
  CP.buildSearch = () => ensureEngine().build();
  function highlightInto(e, text) {
    let last = 0;
    for (const m of text.matchAll(/[A-Za-z]+/g)) {
      const w = hiMap.get(SearchLib.stem(m[0])); if (!w) continue;
      if (m.index > last) e.append(text.slice(last, m.index));
      const mk = el('mark', w < 1 ? 'syn' : '', m[0]); e.append(mk); last = m.index + m[0].length;
    }
    if (last < text.length) e.append(text.slice(last));
  }
  function showSearch(on) { list.hidden = on; res.hidden = !on; vers.hidden = !on; $('steps').hidden = on; sugg.hidden = on; $('recent').hidden = on || !recent.length; if (!on) sinfo.textContent = ''; }
  function runSearch() {
    const term = sIn.value.trim();
    if (term.length < 2) { results = []; showSearch(false); return; }
    const out = ensureEngine().search(term, vfilter, 60); results = out.results; hiMap = out.hi; ri = 0; showSearch(true);
    sinfo.textContent = out.total ? out.total + (out.total === 1 ? ' verse' : ' verses') + ', best first' : 'No results';
    vers.textContent = ''; ['All'].concat(CP.order).forEach((id) => { const b = el('button', id === vfilter ? 'on' : '', id); b.onclick = () => { vfilter = id; runSearch(); sIn.focus(); }; vers.append(b); });
    res.textContent = '';
    if (!results.length) { res.append(el('div', 'none', 'No verse matches those words, or words with a similar meaning.')); return; }
    results.forEach((r, i) => {
      const row = el('div', 'r' + (i === 0 ? ' on' : '')); row.dataset.i = i;
      row.append(el('b', '', B.formatRef(B.NAMES[r.bi], r.ch, r.vs, r.vs)), el('i', 'vt', r.v));
      if (!r.exact) row.append(el('i', 'vt sim', 'similar meaning'));
      const tx = el('span', 't'); highlightInto(tx, r.t);
      const add = el('button', 'add', '+'); add.title = 'Add to queue'; add.setAttribute('aria-label', 'Add to queue'); row.append(tx, add); res.append(row);
    });
  }
  function clearSearch() { sIn.value = ''; results = []; vfilter = 'All'; showSearch(false); }
  function openResult(r, live) { applyRef({ v: r.v, bi: r.bi, ch: r.ch, v1: r.vs, v2: r.vs }); clearSearch(); q.focus(); CP.setPreview(slide()); if (live) CP.setProgram(slide()); }
  function moveResult(d) { if (!results.length) return; ri = clamp(ri + d, 0, results.length - 1); [...res.children].forEach((r, i) => r.classList.toggle('on', i === ri)); const r = res.children[ri]; if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); }
  sIn.addEventListener('input', () => { clearTimeout(stimer); stimer = setTimeout(runSearch, 150); });
  sIn.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveResult(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); moveResult(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); clearTimeout(stimer); if (!results.length) runSearch(); if (results[ri]) openResult(results[ri], true); }
  });
  res.addEventListener('click', (e) => { const row = e.target.closest('.r'); if (!row) return; const r = results[+row.dataset.i]; if (e.target.closest('.add')) { CP.addToQueue({ t: 'verse', v: r.v, bi: r.bi, ch: r.ch, v1: r.vs, v2: r.vs }); return; } openResult(r, false); });
  res.addEventListener('dblclick', (e) => { const row = e.target.closest('.r'); if (row && !e.target.closest('.add')) openResult(results[+row.dataset.i], true); });
  CP.focusSearch = () => { CP.showTab('bible'); sIn.focus(); };

  // ---------- Queue (verses, songs, media, announcements) ----------
  let queue = [];
  const qlist = $('qlist'), qn = $('qn');
  CP.getQueue = () => queue; CP.setQueue = (a) => { queue = a || []; renderQueue(); CP.saveSoon(); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  CP.types.verse = {
    label: (it) => B.formatRef(B.NAMES[it.bi], it.ch, it.v1, it.v2), tag: (it) => it.v, sub: (it) => verseText(it),
    isSel: (it) => CP.ctx === 'bible' && !!sel && it.v === CP.cur && it.bi === sel.bi && it.ch === sel.ch && it.v1 === sel.v1 && it.v2 === sel.v2,
    isLive: (it) => program.mode === 'text' && program.kind === 'verse' && program.ver === it.v && program.bi === it.bi && program.ch === it.ch && program.v1 === it.v1 && program.v2 === it.v2,
    open: (it, live) => { applyRef(it); CP.setPreview(slide()); if (live) CP.setProgram(slide()); }
  };
  function markQueue() {
    [...qlist.children].forEach((row) => {
      const it = queue[+row.dataset.i]; const T = it && CP.types[it.t]; if (!T) return;
      row.classList.toggle('sel', !!T.isSel(it)); row.classList.toggle('live', !!T.isLive(it));
    });
  }
  CP.markQueue = markQueue;
  function renderQueue() {
    qlist.textContent = ''; qn.textContent = queue.length;
    if (!queue.length) { qlist.append(el('div', 'qempty', 'The queue is empty. Press Add to queue (Ctrl+Enter) on a verse, song or media item, or the + on a search result.')); return; }
    queue.forEach((it, i) => {
      const T = CP.types[it.t]; if (!T) return;
      const row = el('div', 'qi'); row.dataset.i = i; const t = el('div', 't');
      t.append(el('b', '', T.label(it)), el('i', 'vt', T.tag(it)), el('span', '', T.sub(it) || ''));
      const mk = (txt, act, label, cls) => { const b = el('button', cls || '', txt); b.dataset.act = act; b.title = label; b.setAttribute('aria-label', label); return b; };
      row.append(t, mk('Go live', 'live', 'Put this on screen', 'go'), mk('\u2191', 'up', 'Move up'), mk('\u2193', 'down', 'Move down'), mk('\u2715', 'del', 'Remove')); qlist.append(row);
    });
    markQueue();
  }
  CP.renderQueue = renderQueue;
  CP.addToQueue = (it) => {
    it = it || (CP.ctx === 'bible' && sel ? Object.assign({ t: 'verse' }, CP.getSel()) : null); if (!it) return;
    const last = queue[queue.length - 1];
    if (!last || !same(last, it)) { queue.push(it); renderQueue(); qlist.scrollTop = qlist.scrollHeight; CP.saveSoon(); }
    addQ.classList.add('flash'); $('addT').textContent = 'Added \u2713'; setTimeout(() => { addQ.classList.remove('flash'); $('addT').textContent = 'Add to queue'; }, 900);
  };
  // Clicking an item only SELECTS it (blue, shown in Preview). Only the Go live button puts it on screen (green).
  function openItem(i, live) { if (!queue.length) return; const it = queue[clamp(i, 0, queue.length - 1)], T = CP.types[it.t]; if (T) T.open(it, live); }
  function qStep(d) { if (!queue.length) return; const at = queue.findIndex((it) => CP.types[it.t] && CP.types[it.t].isSel(it)); openItem(at < 0 ? (d > 0 ? 0 : queue.length - 1) : at + d, false); }
  CP.qStep = qStep;
  qlist.addEventListener('click', (e) => {
    const row = e.target.closest('.qi'); if (!row) return;
    const i = +row.dataset.i, btn = e.target.closest('button'), act = btn && btn.dataset.act;
    if (act === 'del') { queue.splice(i, 1); renderQueue(); CP.saveSoon(); }
    else if (act === 'up' && i > 0) { [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]]; renderQueue(); CP.saveSoon(); }
    else if (act === 'down' && i < queue.length - 1) { [queue[i + 1], queue[i]] = [queue[i], queue[i + 1]]; renderQueue(); CP.saveSoon(); }
    else if (act === 'live') openItem(i, true);
    else if (!act) openItem(i, false);
    if (!act || act === 'live') { if (CP.tab === 'bible') q.focus(); }
  });
  addQ.onclick = () => { CP.addToQueue(); q.focus(); };
  $('qNext').onclick = () => qStep(1); $('qPrev').onclick = () => qStep(-1);
  $('qClear').onclick = () => { queue = []; renderQueue(); CP.saveSoon(); };

  // ---------- Tabs, mode, top buttons ----------
  CP.showTab = (name) => {
    CP.tab = name;
    document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== 'tab-' + name; });
    document.querySelectorAll('#libTabs span').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
    document.querySelectorAll('#nav button').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
    if (name === 'bible') { CP.ctx = 'bible'; if (sel) bibleSlides(); q.focus(); }
    CP.emit('tab', name); CP.saveSoon();
  };
  document.querySelectorAll('#libTabs span,#nav button').forEach((x) => x.addEventListener('click', () => CP.showTab(x.dataset.tab)));
  CP.setMode = (studio) => {
    CP.studio = studio; $('mStudio').classList.toggle('on', studio); $('mDirect').classList.toggle('on', !studio);
    $('mode').textContent = studio ? 'Studio: Enter previews, Enter again goes live' : 'Direct: Enter and the verse arrows go live';
    $('pvLabel').textContent = studio ? 'Preview (ready to take)' : 'Selected (preview)'; CP.settings.mode = studio ? 'studio' : 'direct';
    if (!studio && sel && CP.ctx === 'bible') CP.setPreview(slide());
    CP.saveSoon();
  };
  $('mStudio').onclick = () => CP.setMode(true); $('mDirect').onclick = () => CP.setMode(false);
  $('btnTake').onclick = () => CP.take();
  function black() { if (program.mode === 'black') CP.setProgram(CP.beforeBlack || { mode: 'clear', theme: CP.theme('bible') }); else { CP.beforeBlack = program; CP.setProgram({ mode: 'black' }); } }
  CP.black = black; CP.clear = () => CP.setProgram({ mode: 'clear', theme: CP.theme('bible') }); CP.logo = () => CP.setProgram({ mode: 'logo', text: CP.appName || 'Welcome', theme: CP.theme('bible') });
  $('btnBlack').onclick = $('btnBlack2').onclick = black; $('btnClear').onclick = CP.clear; $('btnLogo').onclick = CP.logo;
  $('bibNext').onclick = () => moveVerse(1); $('bibPrev').onclick = () => moveVerse(-1);
  $('slNext').onclick = () => CP.step(1); $('slPrev').onclick = () => CP.step(-1);

  // ---------- Keyboard ----------
  function pasteRef(e) {
    e.preventDefault(); const r = B.parse((e.clipboardData && e.clipboardData.getData('text')) || ''); if (!r.ok) return;
    bookTyped = r.candidates[0].toLowerCase().replace(/\s+/g, ''); ci = 0; resetNumbers(); ch = r.chapter || 1; v1 = r.verse || 1; v2 = r.verseEnd || null; fresh = true; seg = r.verse ? 2 : r.chapter ? 1 : 0; CP.ctx = 'bible'; commit();
  }
  q.addEventListener('paste', pasteRef);
  q.addEventListener('input', () => commit());
  q.addEventListener('mouseup', () => { if (!sel) return; const p = q.selectionStart, R = layout().ranges; enterSeg(p <= R[0][1] ? 0 : p <= R[1][1] ? 1 : p <= R[2][1] || v2 === null ? 2 : 3); });
  function enter() {
    if (seg === 0 && cands.length > 1) { next(); return; }
    if (!sel) return;
    const s = slide();
    if (!CP.studio) { CP.setPreview(s); CP.setProgram(s); return; }
    if (!preview || preview.kind !== 'verse' || preview.bi !== s.bi || preview.ch !== s.ch || preview.v1 !== s.v1 || preview.v2 !== s.v2 || preview.ver !== s.ver) CP.setPreview(s); else CP.setProgram(preview);
  }
  q.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Enter') { e.preventDefault(); enter(); }
    else if (k === 'ArrowRight' || k === ' ' || k === ':') { e.preventDefault(); next(); }
    else if (k === 'Tab') { if (seg < 2) { e.preventDefault(); next(); } }
    else if (k === 'ArrowLeft') { e.preventDefault(); prevSeg(); }
    else if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); const d = k === 'ArrowDown' ? 1 : -1; if (seg === 0 && cands.length > 1) { ci = (ci + d + cands.length) % cands.length; resetNumbers(); commit(); } else moveVerse(d); }
    else if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); const d = k === 'PageDown' ? 1 : -1; if (CP.settings.clicker !== false) CP.step(d); else moveChapter(d); }
    else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); back(); }
    else if (k === '-') { e.preventDefault(); if (seg === 2) { v2 = v1; seg = 3; fresh = true; v2Typed = ''; commit(); } }
    else if (/^[a-z]$/i.test(k)) { e.preventDefault(); if (seg !== 0) { seg = 0; fresh = true; } typeLetter(k.toLowerCase()); }
    else if (/^\d$/.test(k)) { e.preventDefault(); typeDigit(k); }
    else if (k === '/') { e.preventDefault(); sIn.focus(); }
    else if (k.length === 1) e.preventDefault();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.v'); if (!b || !sel) return; const n = +b.dataset.n; CP.ctx = 'bible';
    if (e.shiftKey) { v2 = Math.max(n, sel.v1); v1 = Math.min(n, sel.v1); if (v2 === v1) v2 = null; } else { v1 = n; v2 = null; }
    seg = 2; fresh = true; vTyped = ''; commit();
  });
  list.addEventListener('dblclick', (e) => { if (!e.target.closest('.v') || !sel) return; const s = slide(); CP.setPreview(s); CP.setProgram(s); });

  addEventListener('keydown', (e) => {
    if (CP.modalOpen()) { if (e.key === 'Escape') { const m = $('modalRoot').lastElementChild; if (m) m.remove(); } return; }
    const tgt = e.target, typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT');
    if (e.ctrlKey) {
      if (e.key === 'Enter') { e.preventDefault(); CP.emit('addcurrent'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); qStep(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); qStep(-1); }
      else if (e.key === 'PageDown') { e.preventDefault(); moveChapter(1); } else if (e.key === 'PageUp') { e.preventDefault(); moveChapter(-1); }
      else if (e.key.toLowerCase() === 'f') { e.preventDefault(); CP.focusSearch(); }
      else if (e.key.toLowerCase() === 'l') { e.preventDefault(); CP.emit('togglelock'); }
      else if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); CP.showTab(['songs', 'media', 'bible'][+e.key - 1]); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); CP.setScale((CP.settings.uiScale || 1) - 0.05); }
      else if (e.key === '=' || e.key === '+') { e.preventDefault(); CP.setScale((CP.settings.uiScale || 1) + 0.05); }
      else if (e.key === '0') { e.preventDefault(); CP.setScale(1); }
      return;
    }
    if (!typing && e.key === '/') { e.preventDefault(); CP.focusSearch(); return; }
    if (e.key === 'F2' || (!typing && e.key.toLowerCase() === 'b')) { e.preventDefault(); black(); }
    else if (e.key === 'F3' || (!typing && e.key.toLowerCase() === 'c')) { e.preventDefault(); CP.clear(); }
    else if (e.key === 'F4' || (!typing && e.key.toLowerCase() === 'l')) { e.preventDefault(); CP.logo(); }
    else if (e.key === 'Escape') { if (sIn.value) clearSearch(); if (CP.tab === 'bible') { q.focus(); enterSeg(0); } }
    else if (!typing && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) { e.preventDefault(); CP.step(1); }
    else if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); CP.step(-1); }
    else if (!typing && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); const d = e.key === 'PageDown' ? 1 : -1; if (CP.settings.clicker !== false) CP.step(d); else moveChapter(d); }
    else if (!typing && e.key === 'Enter') { e.preventDefault(); CP.emit('enter'); }
  });
  CP.on('addcurrent', () => { if (CP.ctx === 'bible') CP.addToQueue(); else CP.emit('addcurrent2'); });
  CP.on('enter', () => { if (CP.ctx === 'bible') enter(); else CP.take(); });

  addEventListener('resize', drawMonitors);
  if (window.ResizeObserver) new ResizeObserver(() => drawMonitors()).observe(document.querySelector('.mons'));
  window.addEventListener('beforeunload', () => { try { presenter.storeSet('session', CP.snapshot()); } catch (e) { /* closing */ } });
  const showInfo = (i) => { $('out').textContent = i.external ? 'Output: external screen ' + i.width + ' \u00d7 ' + i.height : 'Output: no second screen, showing in a window'; CP.outputInfo = i; };
  presenter.onInfo(showInfo); presenter.getInfo().then(showInfo);

  // ---------- Saving what is going on (for recovery after a forced close) ----------
  let saveT = null;
  CP.parts = {};   // other files add { snap(), restore(s) } here
  CP.snapshot = () => {
    const s = { t: Date.now(), queue, ctx: CP.ctx, tab: CP.tab, program, recent, sel: CP.getSel(), parts: {} };
    Object.keys(CP.parts).forEach((k) => { try { s.parts[k] = CP.parts[k].snap(); } catch (e) { /* skip */ } });
    return s;
  };
  CP.saveSoon = () => { if (!CP.ready) return; clearTimeout(saveT); saveT = setTimeout(() => { presenter.storeSet('session', CP.snapshot()); }, 350); };
  CP.restoreBasics = (s) => {
    queue = Array.isArray(s.queue) ? s.queue.filter((it) => CP.types[it.t]) : []; renderQueue();
    CP.setRecent(s.recent || []);
    if (s.sel && CP.bibles[s.sel.v]) { applyRef(s.sel); } 
    Object.keys(CP.parts).forEach((k) => { if (s.parts && s.parts[k] !== undefined) { try { CP.parts[k].restore(s.parts[k]); } catch (e) { console.error(k, e); } } });
    if (s.tab) CP.showTab(s.tab);
  };
  CP.initBible = (bibles, order) => {
    CP.bibles = {}; CP.order = []; bibles.forEach((b) => { CP.bibles[b.version] = b; CP.order.push(b.version); });
    CP.cur = CP.bibles[CP.settings.version] ? CP.settings.version : CP.order[0]; bible = CP.bibles[CP.cur]; renderVerTabs();
    bookTyped = 'gen'; resetNumbers(); seg = 0; fresh = true; CP.ctx = 'bible'; commit(); drawMonitors(); q.focus();
  };
  CP.resetEngine = () => { engine = null; };
  CP.clearSearch = clearSearch;
  renderQueue(); renderSlides();
})();
