// Announcements: quick text, alerts over the current slide, and saved announcement slides.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el;
  let anns = [], curId = null, alertT = null;
  const byId = (id) => anns.find((a) => a.id === id);
  const save = () => presenter.storeSet('announcements', anns);
  const stateFor = (a) => ({ mode: 'text', kind: 'ann', annId: a.id, ref: a.title || '', text: a.text, theme: CP.theme('announce') });
  const isLive = (id) => { const p = CP.getProgram(); return p.mode === 'text' && p.kind === 'ann' && p.annId === id; };

  // quick text
  $('quickShow').onclick = () => { const t = $('quickText').value.trim(); if (!t) return; const s = { mode: 'text', kind: 'quick', text: t, theme: CP.theme('announce') }; CP.setPreview(s); CP.setProgram(s); };
  $('quickClear').onclick = () => { CP.clear(); };
  $('quickText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('quickShow').click(); } });
  // alerts
  function hideAlert() { clearTimeout(alertT); CP.setAlert(null); }
  $('alertSend').onclick = () => {
    const t = $('alertText').value.trim(); if (!t) return; clearTimeout(alertT);
    CP.setAlert({ text: t, pos: $('alertPos').value }); const secs = +$('alertSecs').value; if (secs > 0) alertT = setTimeout(hideAlert, secs * 1000);
  };
  $('alertHide').onclick = hideAlert;
  $('alertText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('alertSend').click(); } });
  // slides
  function render() {
    const box = $('annList'); box.textContent = '';
    if (!anns.length) { box.append(el('div', 'empty', 'No announcement slides yet. Use New slide.')); return; }
    anns.forEach((a) => { const b = el('button', 'song'); b.dataset.id = a.id; const t = el('div', 't'); t.append(el('b', '', a.title || a.text.split('\n')[0]), el('small', '', a.text.replace(/\n/g, ' ').slice(0, 80))); b.append(t); b.onclick = () => select(a.id); b.ondblclick = () => { select(a.id); live(); }; box.append(b); });
    mark();
  }
  function mark() { [...$('annList').children].forEach((b) => { if (!b.dataset.id) return; b.classList.toggle('sel', CP.ctx === 'ann' && b.dataset.id === curId); b.classList.toggle('live', isLive(b.dataset.id)); }); if (CP.markQueue) CP.markQueue(); }
  function select(id) { const a = byId(id); if (!a) return; curId = id; CP.ctx = 'ann'; CP.slides = { title: a.title || 'Announcement', items: [], isSel: () => false, isLive: () => false }; CP.renderSlides(); CP.setPreview(stateFor(a)); mark(); CP.saveSoon(); }
  function live() { const a = byId(curId); if (a) CP.setProgram(stateFor(a)); }
  CP.on('program', mark);
  CP.types.ann = { label: (it) => { const a = byId(it.id); return a ? (a.title || a.text.split('\n')[0]) : '(deleted)'; }, tag: () => 'Announcement', sub: (it) => (byId(it.id) || { text: '' }).text.replace(/\n/g, ' '),
    isSel: (it) => CP.ctx === 'ann' && curId === it.id, isLive: (it) => isLive(it.id), open: (it, lv) => { select(it.id); if (lv) live(); } };
  CP.addCurrentAnn = () => { if (curId) CP.addToQueue({ t: 'ann', id: curId }); };
  CP.parts.ann = { snap: () => ({ id: curId }), restore: (p) => { if (p && p.id && byId(p.id)) curId = p.id; } };
  function editor(a) {
    const title = el('input'); title.type = 'text'; title.value = a ? a.title : ''; const l1 = el('label', '', 'Heading (optional)'); l1.append(title);
    const text = el('textarea'); text.value = a ? a.text : ''; text.style.minHeight = '140px'; const l2 = el('label', '', 'Text'); l2.append(text);
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px'; body.append(l1, l2);
    CP.modal({ title: a ? 'Edit announcement' : 'New announcement', body, buttons: [{ label: 'Cancel' }, { label: 'Save', cls: 'go', onClick: () => {
      if (!text.value.trim()) { CP.toast('Type the announcement text.'); return false; }
      if (a) { a.title = title.value.trim(); a.text = text.value.trim(); } else { const n = { id: CP.uid('a'), title: title.value.trim(), text: text.value.trim() }; anns.push(n); curId = n.id; }
      save(); render(); if (curId) select(curId); } }] });
  }
  $('annNew').onclick = () => editor(null);
  $('annEdit').onclick = () => { const a = byId(curId); if (a) editor(a); else CP.toast('Select a slide first.'); };
  $('annDel').onclick = () => { const a = byId(curId); if (!a) return; CP.confirm('Delete announcement', 'Delete this announcement slide?', () => { anns = anns.filter((x) => x.id !== a.id); curId = null; save(); render(); }, 'Delete'); };
  $('annLive').onclick = () => { if (!curId) { CP.toast('Select a slide first.'); return; } live(); };
  $('annAdd').onclick = () => { if (!curId) { CP.toast('Select a slide first.'); return; } CP.addCurrentAnn(); };
  CP.onInit(async () => { anns = (await presenter.storeGet('announcements', [])) || []; render(); });
})();
