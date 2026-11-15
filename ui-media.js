// Media: images, videos (backgrounds or full-screen), and countdown timers.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el;
  let items = [], curId = null;
  const byId = (id) => items.find((m) => m.id === id);
  const save = () => presenter.storeSet('media', items);
  CP.mediaItem = (id) => byId(id);
  const isLive = (id) => { const p = CP.getProgram(); return (p.mode === 'media' || p.mode === 'countdown') && p.mediaId === id; };

  function stateFor(m, live) {
    if (m.kind === 'countdown') {
      let secs = m.seconds || 300;
      if (m.until) { const [h, mi] = m.until.split(':').map(Number), d = new Date(); d.setHours(h, mi, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); secs = Math.max(0, Math.round((d - new Date()) / 1000)); }
      return Object.assign({ mode: 'countdown', kind: 'countdown', mediaId: m.id, label: m.label || '', theme: CP.theme('announce') }, live ? { endsAt: Date.now() + secs * 1000 } : { seconds: secs });
    }
    return { mode: 'media', kind: m.kind, mediaId: m.id, url: m.url, loop: m.loop !== false, muted: m.muted !== false, name: m.name };
  }
  function render() {
    const g = $('mediaGrid'); g.textContent = '';
    if (!items.length) { g.append(el('div', 'empty', 'No media yet. Import images or videos, or make a countdown.')); return; }
    items.forEach((m) => {
      const b = el('button', 'mt'); b.dataset.id = m.id; const th = el('div', 'th');
      if (m.kind === 'image') { const i = el('img'); i.src = m.url; i.alt = ''; th.append(i); }
      else if (m.kind === 'video') { const v = el('video'); v.src = m.url + '#t=0.5'; v.muted = true; v.preload = 'metadata'; th.append(v); }
      else th.textContent = '\u23f1 ' + (m.until ? m.until : Math.round((m.seconds || 300) / 60) + ' min');
      b.append(th, el('small', '', m.name + ' \u00b7 ' + m.kind)); b.onclick = () => select(m.id); b.ondblclick = () => { select(m.id); live(); }; g.append(b);
    });
    mark();
  }
  function mark() { [...$('mediaGrid').children].forEach((b) => { if (!b.dataset.id) return; b.classList.toggle('sel', CP.ctx === 'media' && b.dataset.id === curId); b.classList.toggle('live', isLive(b.dataset.id)); }); if (CP.markQueue) CP.markQueue(); }
  function select(id) { const m = byId(id); if (!m) return; curId = id; CP.ctx = 'media'; CP.slides = { title: m.name, items: [], isSel: () => false, isLive: () => false }; CP.renderSlides(); CP.setPreview(stateFor(m, false)); mark(); CP.saveSoon(); }
  function live() { const m = byId(curId); if (m) CP.setProgram(stateFor(m, true)); }
  CP.on('program', mark);
  CP.types.media = {
    label: (it) => (byId(it.id) || { name: '(deleted media)' }).name, tag: (it) => (byId(it.id) || {}).kind || 'media', sub: () => '',
    isSel: (it) => CP.ctx === 'media' && curId === it.id, isLive: (it) => isLive(it.id),
    open: (it, lv) => { select(it.id); if (lv) live(); }
  };
  CP.addCurrentMedia = () => { if (curId) CP.addToQueue({ t: 'media', id: curId }); };
  CP.parts.media = { snap: () => ({ id: curId }), restore: (p) => { if (p && p.id && byId(p.id)) curId = p.id; } };

  $('mediaImport').onclick = async () => { const got = await presenter.importMedia(); if (!got.length) return; got.forEach((m) => items.push(m)); save(); render(); select(got[got.length - 1].id); CP.toast(got.length + ' file(s) imported.'); };
  $('mediaLive').onclick = () => { if (!curId) { CP.toast('Select something first.'); return; } live(); };
  $('mediaAdd').onclick = () => { if (!curId) { CP.toast('Select something first.'); return; } CP.addCurrentMedia(); };
  $('mediaDel').onclick = () => {
    const m = byId(curId); if (!m) return;
    CP.confirm('Delete media', 'Delete "' + m.name + '"?', () => {
      items = items.filter((x) => x.id !== m.id); if (m.file) presenter.removeMedia(m.file); curId = null;
      ['bible', 'song', 'announce'].forEach((k) => { const t = CP.settings.themes[k]; if (t && t.bg && t.bg.type === 'media' && t.bg.id === m.id) t.bg = { type: 'gradient', from: '#14307a', to: '#0a1a4a' }; });
      CP.saveSettings(); save(); render();
    }, 'Delete');
  };
  $('mediaBg').onclick = () => {
    const m = byId(curId); if (!m || m.kind === 'countdown') { CP.toast('Select an image or video first.'); return; }
    const box = el('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const dlg = CP.modal({ title: 'Use "' + m.name + '" as a background for', body: box, buttons: [{ label: 'Cancel' }] });
    [['Bible slides', ['bible']], ['Song slides', ['song']], ['Announcements', ['announce']], ['Everything', ['bible', 'song', 'announce']]].forEach(([lab, keys]) => {
      const b = el('button', '', lab); b.onclick = () => { keys.forEach((k) => { CP.settings.themes[k].bg = { type: 'media', id: m.id }; }); CP.saveSettings(); CP.emit('themes'); dlg.close(); CP.toast('Background set.'); }; box.append(b);
    });
  };
  $('mediaCount').onclick = () => {
    const name = el('input'); name.type = 'text'; name.value = 'Service starts in'; const lab = el('label', '', 'Message above the clock'); lab.append(name);
    const mode = el('select'); [['dur', 'Count down a number of minutes'], ['until', 'Count down to a time of day']].forEach(([v, t]) => { const o = el('option', '', t); o.value = v; mode.append(o); });
    const mins = el('input'); mins.type = 'number'; mins.min = 1; mins.max = 180; mins.value = 5; const l2 = el('label', '', 'Minutes'); l2.append(mins);
    const tm = el('input'); tm.type = 'text'; tm.value = '09:00'; tm.placeholder = 'HH:MM (24 hour)'; const l3 = el('label', '', 'Time of day (24 hour, like 09:00)'); l3.append(tm); l3.hidden = true;
    mode.onchange = () => { l2.hidden = mode.value !== 'dur'; l3.hidden = mode.value !== 'until'; };
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px'; const l0 = el('label', '', 'How it counts'); l0.append(mode); body.append(lab, l0, l2, l3);
    CP.modal({ title: 'New countdown', body, buttons: [{ label: 'Cancel' }, { label: 'Create', cls: 'go', onClick: () => {
      const m = { id: CP.uid('c'), kind: 'countdown', label: name.value.trim() };
      if (mode.value === 'dur') { m.seconds = Math.max(1, Math.round(+mins.value || 5)) * 60; m.name = 'Countdown ' + Math.round(m.seconds / 60) + ' min'; }
      else { if (!/^\d{1,2}:\d{2}$/.test(tm.value.trim())) { CP.toast('Type the time like 09:00'); return false; } m.until = tm.value.trim().padStart(5, '0'); m.name = 'Countdown to ' + m.until; }
      items.push(m); save(); render(); select(m.id); } }] });
  };
  CP.onInit(async () => { items = (await presenter.storeGet('media', [])) || []; render(); });
  CP.getMedia = () => items;
})();
