// Songs: library, smart .txt import, editor, slides.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el, P = SongParse, clamp = CP.clamp;
  let songs = [], curId = null, ix = 0, slides = [];
  const byId = (id) => songs.find((s) => s.id === id);
  const lines = (s) => s.linesPerSlide || CP.settings.linesPerSlide || 4;
  const slidesFor = (s) => P.slidesOf(s, { lines: lines(s) });
  const save = () => presenter.storeSet('songs', songs);
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s]/g, ' ').split(/\s+/).filter(Boolean);
  const lyricText = (s) => s.sections.map((x) => x.lines.join(' ')).join(' ');

  function slideState(s, i) {
    const sl = slides[i];
    return { mode: 'text', kind: 'song', songId: s.id, slideIx: i, text: sl.text, label: sl.label, theme: CP.theme('song') };
  }
  const isLiveSong = (id) => { const p = CP.getProgram(); return p.mode === 'text' && p.kind === 'song' && p.songId === id; };

  // ----- list -----
  function renderList() {
    const box = $('songList'), terms = words($('songQ').value); box.textContent = '';
    const shown = songs.filter((s) => { const hay = (s.title + ' ' + (s.author || '') + ' ' + lyricText(s)).toLowerCase(); return terms.every((t) => hay.includes(t)); })
      .sort((a, b) => a.title.localeCompare(b.title));
    $('songInfo').textContent = songs.length ? shown.length + ' of ' + songs.length : '';
    if (!songs.length) { box.append(el('div', 'empty', 'No songs yet. Use Import .txt files, or New song.')); return; }
    if (!shown.length) { box.append(el('div', 'empty', 'No song matches that.')); return; }
    shown.forEach((s) => {
      const b = el('button', 'song'); b.dataset.id = s.id; const t = el('div', 't'); t.append(el('b', '', s.title), el('small', '', (s.author ? s.author + ' \u00b7 ' : '') + slidesFor(s).length + ' slides'));
      b.append(t); b.onclick = () => { selectSong(s.id); }; b.ondblclick = () => { selectSong(s.id); goLive(); }; box.append(b);
    });
    mark();
  }
  function mark() {
    [...$('songList').children].forEach((b) => { if (!b.dataset.id) return; b.classList.toggle('sel', CP.ctx === 'song' && b.dataset.id === curId); b.classList.toggle('live', isLiveSong(b.dataset.id)); });
    if (CP.markSlides) CP.markSlides(); if (CP.markQueue) CP.markQueue();
  }
  function showSlides() {
    const s = byId(curId); if (!s) return;
    CP.slides = {
      title: s.title, items: slides.map((x) => ({ label: x.label + (x.of > 1 ? ' (' + x.n + '/' + x.of + ')' : ''), text: x.text })),
      isSel: (i) => i === ix && CP.ctx === 'song', isLive: (i) => { const p = CP.getProgram(); return isLiveSong(s.id) && p.slideIx === i; },
      pick: (i) => selectSlide(i), live: (i) => { selectSlide(i); goLive(); }
    };
    CP.renderSlides();
  }
  function selectSong(id, at) {
    const s = byId(id); if (!s) return;
    curId = id; CP.ctx = 'song'; slides = slidesFor(s); ix = clamp(at || 0, 0, Math.max(0, slides.length - 1));
    showSlides(); if (slides.length) CP.setPreview(slideState(s, ix)); mark(); CP.saveSoon();
  }
  function selectSlide(i) { const s = byId(curId); if (!s || !slides.length) return; CP.ctx = 'song'; ix = clamp(i, 0, slides.length - 1); CP.setPreview(slideState(s, ix)); CP.markSlides(); mark(); CP.saveSoon(); }
  function goLive() { const s = byId(curId); if (!s || !slides.length) return; CP.setProgram(slideState(s, ix)); }
  CP.stepFns.song = (d) => { const s = byId(curId); if (!s) return; selectSlide(ix + d); if (!CP.studio) goLive(); };
  CP.on('program', mark); CP.on('tab', (t) => { if (t === 'songs' && curId) { CP.ctx = 'song'; showSlides(); mark(); } });

  CP.types.song = {
    label: (it) => (byId(it.id) || { title: '(deleted song)' }).title, tag: () => 'Song', sub: (it) => { const s = byId(it.id); return s ? slidesFor(s).length + ' slides' : ''; },
    isSel: (it) => CP.ctx === 'song' && curId === it.id, isLive: (it) => isLiveSong(it.id),
    open: (it, live) => { selectSong(it.id); if (live) goLive(); }
  };
  CP.parts.songs = { snap: () => ({ id: curId, ix }), restore: (p) => { if (p && p.id && byId(p.id)) { curId = p.id; slides = slidesFor(byId(p.id)); ix = clamp(p.ix || 0, 0, Math.max(0, slides.length - 1)); } } };

  // ----- editor -----
  function openEditor(song, onSave) {
    const isNew = !song;
    const base = song || { title: '', author: '', copyright: '', sections: [{ id: 's1', label: 'Verse 1', type: 'verse', lines: [] }], order: ['s1'], linesPerSlide: 0 };
    const ta = el('textarea'); ta.value = song ? P.format(song) : 'Title: \nAuthor: \n\n[Verse 1]\n\n\n[Chorus]\n\n\nOrder: Verse 1, Chorus';
    ta.spellcheck = false;
    const lps = el('input'); lps.type = 'number'; lps.min = 1; lps.max = 8; lps.value = base.linesPerSlide || CP.settings.linesPerSlide || 4;
    const info = el('div', 'dim'), pre = el('div', 'slides'); pre.style.maxHeight = '190px'; pre.style.padding = '0';
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const help = el('div', 'dim', 'Sections are marked like [Verse 1] or [Chorus]. The Order line says how they are sung.');
    const rep = el('button', '', 'Repeat the chorus after every verse');
    const row = el('div', 'row-btns'); row.style.padding = '0'; const l1 = el('label', '', 'Lines per slide'); l1.append(lps); l1.style.width = '140px'; row.append(l1, rep);
    body.append(help, ta, row, info, pre);
    function current() { const r = P.parse(ta.value, { filename: base.title })[0] || null; if (r) { r.id = base.id; r.linesPerSlide = clamp(+lps.value || 4, 1, 8); } return r; }
    function refresh() {
      const r = current(); pre.textContent = ''; if (!r || !r.sections.length) { info.textContent = 'No lyrics yet.'; return; }
      const sl = P.slidesOf(r, { lines: r.linesPerSlide }); info.textContent = r.sections.length + ' sections, ' + sl.length + ' slides.' + (r.warnings.length ? ' ' + r.warnings.join(' ') : '');
      sl.slice(0, 12).forEach((x) => { const b = el('div', 'sl'); b.append(el('small', '', x.label), el('div', 'tx', x.text)); pre.append(b); });
    }
    ta.addEventListener('input', refresh); lps.addEventListener('input', refresh);
    rep.onclick = () => { const r = current(); if (!r) return; const ch = r.sections.find((s) => s.type === 'chorus'); if (!ch) { CP.toast('This song has no chorus section.'); return; }
      const o = []; r.order.forEach((id, i) => { const s = r.sections.find((x) => x.id === id); if (s.type === 'chorus') return; o.push(s.label); if (s.type === 'verse') o.push(ch.label); });
      ta.value = ta.value.replace(/^\s*order\s*[:=].*$/im, 'Order: ' + o.join(', ')); refresh(); };
    refresh();
    CP.modal({ title: isNew ? 'New song' : 'Edit song', body, wide: true, buttons: [{ label: 'Cancel' }, { label: 'Save song', cls: 'go', onClick: () => {
      const r = current(); if (!r || !r.sections.some((s) => s.lines.length)) { CP.toast('Add some lyrics first.'); return false; }
      onSave(r); } }] });
  }
  function saveEdited(orig, r) {
    if (orig) { const i = songs.findIndex((s) => s.id === orig.id); r.id = orig.id; songs[i] = r; } else { r.id = CP.uid('s'); songs.push(r); }
    r.title = r.title || 'Untitled song'; save(); renderList(); selectSong(r.id); CP.toast('Saved "' + r.title + '"');
  }
  $('songNew').onclick = () => openEditor(null, (r) => saveEdited(null, r));
  $('songEdit').onclick = () => { const s = byId(curId); if (!s) { CP.toast('Select a song first.'); return; } openEditor(s, (r) => saveEdited(s, r)); };
  $('songDel').onclick = () => { const s = byId(curId); if (!s) return; CP.confirm('Delete song', 'Delete "' + s.title + '"? This cannot be undone.', () => { songs = songs.filter((x) => x.id !== s.id); curId = null; slides = []; save(); renderList(); CP.slides = { items: [], isSel: () => false, isLive: () => false }; CP.renderSlides(); }, 'Delete'); };
  $('songLive').onclick = () => { if (!curId) { CP.toast('Select a song first.'); return; } selectSlide(ix); goLive(); };
  $('songAdd').onclick = () => { if (!curId) { CP.toast('Select a song first.'); return; } CP.addToQueue({ t: 'song', id: curId }); };
  CP.on('addcurrent2', () => { if (CP.ctx === 'song' && curId) CP.addToQueue({ t: 'song', id: curId }); else if (CP.ctx === 'media' && CP.addCurrentMedia) CP.addCurrentMedia(); else if (CP.ctx === 'ann' && CP.addCurrentAnn) CP.addCurrentAnn(); });
  $('songQ').addEventListener('input', renderList);
  $('songQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = $('songList').querySelector('.song'); if (b) { selectSong(b.dataset.id); } } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const bs = [...$('songList').querySelectorAll('.song')]; if (!bs.length) return; let k = bs.findIndex((b) => b.dataset.id === curId); k = clamp(k + (e.key === 'ArrowDown' ? 1 : -1), 0, bs.length - 1); selectSong(bs[k].dataset.id); } });

  // ----- importing .txt files -----
  function norm(t) { return t.toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function importFiles(files) {
    if (!files.length) return;
    const found = []; files.forEach((f) => P.parse(f.text, { filename: f.name }).forEach((s) => found.push({ song: s, file: f.name })));
    found.forEach((x) => { x.dup = songs.find((s) => norm(s.title) === norm(x.song.title)); x.on = !x.dup; });
    if (!found.length) { CP.toast('No songs found in those files.'); return; }
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    body.append(el('div', 'dim', 'Here is what the program worked out. Untick any you do not want. Use Review to correct a song before it is saved.'));
    const listBox = el('div'); listBox.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto'; body.append(listBox);
    function draw() {
      listBox.textContent = '';
      found.forEach((x) => {
        const li = el('div', 'li'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = x.on; cb.setAttribute('aria-label', 'Import ' + x.song.title); cb.onchange = () => { x.on = cb.checked; count(); };
        const t = el('div', 't'); const n = P.slidesOf(x.song, { lines: CP.settings.linesPerSlide }).length;
        t.append(el('b', '', x.song.title + (x.song.author ? ' \u2014 ' + x.song.author : '')), el('small', '', x.song.sections.map((s) => s.label).join(', ') + ' \u00b7 ' + n + ' slides \u00b7 ' + x.file));
        if (x.dup) t.append(el('small', 'warn', 'A song with this title already exists. It will be skipped unless you tick it (then it is added as a copy).'));
        x.song.warnings.forEach((w) => t.append(el('small', 'warn', w)));
        const rv = el('button', 'mini', 'Review'); rv.onclick = () => openEditor(x.song, (r) => { r.title = r.title || x.song.title; x.song = r; draw(); });
        li.append(cb, t, rv); listBox.append(li);
      });
    }
    let btn = null; const count = () => { if (btn) btn.textContent = 'Import ' + found.filter((x) => x.on).length + ' song(s)'; };
    draw();
    const m = CP.modal({ title: 'Import songs', body, wide: true, buttons: [{ label: 'Cancel' }, { label: 'Import', cls: 'go', onClick: () => {
      const chosen = found.filter((x) => x.on); chosen.forEach((x) => { x.song.id = CP.uid('s'); songs.push(x.song); });
      save(); renderList(); if (chosen.length) selectSong(chosen[chosen.length - 1].song.id); CP.toast(chosen.length + ' song(s) imported.'); } }] });
    btn = m.box.querySelector('.mf .go'); count();
  }
  $('songImport').onclick = async () => importFiles(await presenter.pickSongFiles());
  $('songFolder').onclick = async () => importFiles(await presenter.pickSongFolder());
  CP.importSongs = importFiles;

  CP.onInit(async () => {
    songs = (await presenter.storeGet('songs', [])) || [];
    if (!songs.length && CP.settings.firstRun && window.SAMPLE_SONGS) {
      window.SAMPLE_SONGS.forEach((f) => P.parse(f.text, { filename: f.name }).forEach((s) => { s.id = CP.uid('s'); songs.push(s); })); save();
    }
    renderList();
  });
  CP.getSongs = () => songs;
})();
