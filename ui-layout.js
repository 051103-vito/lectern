// Layout: drag the panel edges to resize, lock so nothing moves by accident, save and switch layouts.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el, clamp = CP.clamp, grid = $('grid');
  const PRESETS = { 'Default': { cw: 50, rl: 56, rr: 50 }, 'Worship (big slides)': { cw: 42, rl: 52, rr: 62 }, 'Sermon (big Bible)': { cw: 56, rl: 66, rr: 52 }, 'Compact (small laptop)': { cw: 46, rl: 64, rr: 46 } };
  let dims = Object.assign({}, PRESETS.Default), locked = true;
  const LOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.5"/></svg>';
  const lim = (d) => ({ cw: clamp(Math.round(d.cw), 25, 75), rl: clamp(Math.round(d.rl), 25, 78), rr: clamp(Math.round(d.rr), 25, 78) });
  function apply(d, persist) {
    dims = lim(d); grid.style.setProperty('--cw', dims.cw); grid.style.setProperty('--rl', dims.rl); grid.style.setProperty('--rr', dims.rr);
    CP.layoutNow = dims; if (persist) { CP.settings.layoutNow = dims; CP.saveSettings(); }
    if (CP.drawMonitors) setTimeout(CP.drawMonitors, 0);
  }
  function setLock(v, persist) {
    locked = v; grid.classList.toggle('locked', v); const b = $('btnLock'); b.innerHTML = v ? LOCK : OPEN; b.classList.toggle('open', !v);
    b.setAttribute('aria-label', v ? 'Layout locked' : 'Layout unlocked'); b.title = v ? 'Layout is locked. Click to unlock and resize the panels.' : 'Layout is unlocked: drag the orange handles. Click to lock.';
    ['splitV', 'splitL', 'splitR'].forEach((id) => $(id).setAttribute('tabindex', v ? '-1' : '0'));
    CP.settings.locked = v; if (persist) CP.saveSettings();
  }
  CP.isLocked = () => locked; CP.setLock = setLock; CP.applyLayout = (name) => { const l = PRESETS[name] || (CP.settings.layouts || {})[name]; if (l) { apply(l, true); CP.settings.layoutName = name; CP.saveSettings(); } };
  $('btnLock').onclick = () => setLock(!locked, true); CP.on('togglelock', () => setLock(!locked, true));

  function drag(id, move) {
    const h = $(id);
    h.addEventListener('mousedown', (e) => { if (locked) return; e.preventDefault(); const mv = (ev) => { move(ev); }, up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); apply(dims, true); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); });
    h.addEventListener('dblclick', () => { if (locked) return; const d = Object.assign({}, dims); if (id === 'splitV') d.cw = 50; else if (id === 'splitL') d.rl = 50; else d.rr = 50; apply(d, true); });
    h.addEventListener('keydown', (e) => {
      if (locked) return; const k = e.key, d = Object.assign({}, dims), step = 2;
      const dir = id === 'splitV' ? (k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0) : (k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0);
      if (!dir) return; e.preventDefault(); if (id === 'splitV') d.cw += dir; else if (id === 'splitL') d.rl += dir; else d.rr += dir; apply(d, true);
    });
  }
  drag('splitV', (e) => { const r = grid.getBoundingClientRect(); apply({ cw: ((e.clientX - r.left) / r.width) * 100, rl: dims.rl, rr: dims.rr }); });
  drag('splitL', (e) => { const r = $('colL').getBoundingClientRect(); apply({ cw: dims.cw, rl: ((e.clientY - r.top) / r.height) * 100, rr: dims.rr }); });
  drag('splitR', (e) => { const r = $('colR').getBoundingClientRect(); apply({ cw: dims.cw, rl: dims.rl, rr: ((e.clientY - r.top) / r.height) * 100 }); });

  function menu() {
    const old = document.querySelector('.menu'); if (old) { old.remove(); return; }
    const m = el('div', 'menu'), b = $('btnLayout').getBoundingClientRect(); m.style.top = (b.bottom + 6) + 'px'; m.style.left = Math.max(8, b.right - 240) + 'px';
    const close = () => { m.remove(); removeEventListener('mousedown', out, true); };
    const out = (e) => { if (!m.contains(e.target) && e.target !== $('btnLayout')) close(); };
    const item = (name, d, del) => { const row = el('div'); row.style.cssText = 'display:flex;align-items:center'; const x = el('button', CP.settings.layoutName === name ? 'on' : '', name); x.onclick = () => { CP.applyLayout(name); close(); }; row.append(x); if (del) { const dx = el('button', '', '\u2715'); dx.style.width = '40px'; dx.setAttribute('aria-label', 'Delete layout ' + name); dx.onclick = () => { delete CP.settings.layouts[name]; CP.saveSettings(); close(); menu(); }; row.append(dx); } m.append(row); };
    Object.keys(PRESETS).forEach((n) => item(n));
    const saved = Object.keys(CP.settings.layouts || {}); if (saved.length) { m.append(el('hr')); saved.forEach((n) => item(n, null, true)); }
    m.append(el('hr'));
    const sv = el('button', '', 'Save this layout\u2026'); sv.onclick = () => { close(); CP.ask('Save layout', 'Name for this layout', '', (name) => { CP.settings.layouts = CP.settings.layouts || {}; CP.settings.layouts[name] = Object.assign({}, dims); CP.settings.layoutName = name; CP.saveSettings(); CP.toast('Layout "' + name + '" saved.'); }, 'Save'); };
    const rs = el('button', '', 'Reset to default'); rs.onclick = () => { CP.applyLayout('Default'); close(); };
    m.append(sv, rs); document.body.append(m); addEventListener('mousedown', out, true);
  }
  $('btnLayout').onclick = menu;
  CP.onInit(async () => { apply(CP.settings.layoutNow || (window.innerHeight < 800 ? PRESETS['Compact (small laptop)'] : PRESETS.Default), false); setLock(CP.settings.locked !== false, false); });
})();
