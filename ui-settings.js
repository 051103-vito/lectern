// Settings, first-run set-up, backup, adding Bible versions, and the update banner.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el;
  let info = { name: 'Lectern', version: '', packaged: false };
  CP.setInfo = (i) => { info = i; };
  const isLive = () => ['text', 'media', 'countdown', 'logo'].includes(CP.getProgram().mode);
  const field = (label, input) => { const l = el('label', '', label); l.append(input); return l; };
  const check = (label, val, cb) => { const l = el('label', 'chk'), c = el('input'); c.type = 'checkbox'; c.checked = !!val; c.onchange = () => cb(c.checked); l.append(c, document.createTextNode(label)); return l; };
  const h = (t) => { const x = el('b', '', t); x.style.cssText = 'margin-top:8px;font-size:14px'; return x; };

  async function displaySelect(cb) {
    const list = await presenter.displays(), s = el('select'); const a = el('option', '', 'Automatic (the second screen)'); a.value = 'auto'; s.append(a);
    list.filter((d) => !d.primary).forEach((d) => { const o = el('option', '', d.label); o.value = d.id; s.append(o); });
    s.value = CP.settings.outputDisplay || 'auto'; s.onchange = () => cb(s.value); return { select: s, count: list.filter((d) => !d.primary).length };
  }
  async function openSettings() {
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    body.append(h('Output screen'));
    const ds = await displaySelect(async (v) => { CP.settings.outputDisplay = v; CP.saveSettings(); await presenter.rebuildOutput(); CP.toast('Output moved.'); });
    body.append(field('Which screen is the projector or splitter?', ds.select));
    const tp = el('button', '', 'Show test pattern'); let on = false;
    tp.onclick = () => { on = !on; if (on) { CP.setProgram({ mode: 'test', info: CP.outputInfo ? CP.outputInfo.width + ' \u00d7 ' + CP.outputInfo.height : '' }); tp.textContent = 'Hide test pattern'; } else { CP.setProgram({ mode: 'black' }); tp.textContent = 'Show test pattern'; } };
    const row1 = el('div', 'row-btns'); row1.style.padding = '0'; row1.append(tp); body.append(row1, el('div', 'dim', ds.count ? ds.count + ' extra screen(s) found.' : 'No second screen found. The output shows in a window.'));
    body.append(h('Interface size'));
    const sw = el('div', 'slider'), rng = el('input'), val = el('b', '', Math.round((CP.settings.uiScale || 1) * 100) + '%'); rng.type = 'range'; rng.min = 60; rng.max = 120; rng.step = 5; rng.value = Math.round((CP.settings.uiScale || 1) * 100); rng.setAttribute('aria-label', 'Interface size');
    rng.oninput = () => { val.textContent = rng.value + '%'; CP.setScale(+rng.value / 100, false); }; rng.onchange = () => CP.setScale(+rng.value / 100, true);
    sw.append(rng, val); body.append(el('div', 'dim', 'Smaller fits more on a small screen. You can also press Ctrl+minus, Ctrl+plus and Ctrl+0.'), sw);
    body.append(h('Slides'));
    const lps = el('input'); lps.type = 'number'; lps.min = 1; lps.max = 8; lps.value = CP.settings.linesPerSlide || 4; lps.onchange = () => { CP.settings.linesPerSlide = Math.max(1, Math.min(8, +lps.value || 4)); CP.saveSettings(); };
    body.append(field('Most lines on one song slide (applies to songs without their own setting)', lps));
    body.append(h('Keys'), check('Clicker keys: PageDown and PageUp move one verse or slide and go live (chapters move to Ctrl+PageUp and Ctrl+PageDown)', CP.settings.clicker !== false, (v) => { CP.settings.clicker = v; CP.saveSettings(); }));
    body.append(check('Low performance mode (no glow or animation, for slow computers)', CP.settings.lowPerf, (v) => { CP.settings.lowPerf = v; document.body.classList.toggle('low', v); CP.saveSettings(); }));
    body.append(h('Bible versions'));
    CP.order.slice().forEach((id) => {
      const bb = CP.bibles[id], li = el('div', 'li'), t = el('div', 't'); t.append(el('b', '', id), el('small', '', bb.name || id));
      li.append(t);
      if (bb.user) { const rm = el('button', 'mini', 'Remove'); rm.onclick = () => CP.confirm('Remove ' + id, 'Remove ' + id + ' from this computer? Verses of it in the queue are removed too.', async () => { await presenter.removeBible(id); CP.removeBible(id); li.remove(); }, 'Remove'); li.append(rm); } else li.append(el('small', 'dim', 'included'));
      body.append(li);
    });
    body.append(el('div', 'dim', 'To add a Bible, click + Import next to the version tabs in the Bible tab.'));
    body.append(h('Updates'));
    const ust = el('div', 'dim', 'Version ' + info.version + (info.packaged ? '' : ' (development copy, updates are off)'));
    const uc = el('button', '', 'Check for updates'); uc.onclick = async () => { const r = await presenter.updateCheck(); ust.textContent = r.ok ? 'Checking...' : 'Updates only work in the installed app.'; };
    body.append(ust, check('Check for updates when the app starts', CP.settings.updates !== false, (v) => { CP.settings.updates = v; CP.saveSettings(); })); const row3 = el('div', 'row-btns'); row3.style.padding = '0'; row3.append(uc); body.append(row3);
    body.append(h('Backup'));
    const ex = el('button', '', 'Save a backup file'), im = el('button', '', 'Restore from a backup file');
    ex.onclick = async () => { const r = await presenter.backupExport(); if (r.ok) CP.toast('Backup saved.'); };
    im.onclick = async () => { const r = await presenter.backupImport(); if (r.ok) CP.confirm('Backup restored', 'Reload the app to use the restored songs and settings?', () => presenter.reload(), 'Reload'); else if (!r.canceled) CP.toast(r.error || 'That backup could not be read.'); };
    const row4 = el('div', 'row-btns'); row4.style.padding = '0'; row4.append(ex, im); body.append(row4, el('div', 'dim', 'A backup holds songs, the queue, saved services, themes, layouts and settings. Image and video files are not inside it.'));
    body.append(h('Keyboard'));
    const keys = [['Enter', 'Go live'], ['Right Arrow / Space', 'Next part of the reference'], ['Up / Down', 'Previous / next verse (goes live)'], ['PageDown / PageUp', 'Next / previous verse or slide (clicker)'], ['Ctrl+PageDown / PageUp', 'Next / previous chapter'], ['Ctrl+Enter', 'Add to queue'], ['Ctrl+Left / Right', 'Previous / next queue item (selects only)'], ['/ or Ctrl+F', 'Search by words'], ['F2 / F3 / F4', 'Black / Clear / Logo'], ['Ctrl+L', 'Lock or unlock the layout'], ['Ctrl+minus / plus / 0', 'Smaller / bigger / normal interface size'], ['Ctrl+1 / 2 / 3', 'Songs / Media / Bible'], ['Esc', 'Start a new reference']];
    const kt = el('div'); kt.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 16px'; keys.forEach(([k, d]) => { const kb = el('kbd', '', k); kb.style.cssText = 'margin:0;opacity:1;color:#fff'; kt.append(kb, el('span', 'dim', d)); }); body.append(kt);
    CP.modal({ title: 'Settings', body, wide: true, buttons: [{ label: 'Close', cls: 'go' }] });
  }
  $('btnSettings').onclick = openSettings; CP.openSettings = openSettings;

  // ---- first start ----
  CP.firstRun = async () => {
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    body.append(el('div', 'dim', 'Three quick choices. You can change any of them later in Settings.'), h('1. Which screen is the projector?'));
    const ds = await displaySelect((v) => { CP.settings.outputDisplay = v; }); body.append(ds.select, el('div', 'dim', ds.count ? 'A second screen was found.' : 'No second screen found yet. Plug it in any time, the output moves there by itself.'));
    body.append(h('2. Choose a layout'));
    const lr = el('div', 'row-btns'); lr.style.padding = '0'; ['Default', 'Worship (big slides)', 'Compact (small laptop)'].forEach((n) => { const b = el('button', '', n); b.onclick = () => { CP.applyLayout(n); [...lr.children].forEach((x) => { x.style.borderColor = ''; }); b.style.borderColor = 'var(--accent)'; }; lr.append(b); }); body.append(lr);
    body.append(h('3. Bible version'));
    const vr = el('div', 'row-btns'); vr.style.padding = '0'; CP.order.forEach((id) => { const b = el('button', '', id); b.title = CP.bibles[id].name; b.onclick = () => { CP.switchVersion(id); [...vr.children].forEach((x) => { x.style.borderColor = ''; }); b.style.borderColor = 'var(--accent)'; }; vr.append(b); }); body.append(vr);
    body.append(el('div', 'dim', 'Tip: the layout starts locked so nothing moves by accident. Click the padlock at the top to change it.'));
    CP.modal({ title: 'Welcome to ' + (info.name || 'the app'), body, buttons: [{ label: 'Start', cls: 'go', onClick: async () => { CP.settings.firstRun = false; CP.saveSettings(); if (CP.settings.outputDisplay !== 'auto') await presenter.rebuildOutput(); } }] });
  };

  // ---- update banner ----
  const banner = $('banner');
  function paint(parts) { banner.textContent = ''; parts.forEach((p) => banner.append(p)); banner.hidden = !parts.length; }
  presenter.onUpdate((u) => {
    const tag = el('b', 'tag', 'UPDATE AVAILABLE'), msg = el('span'), sp = el('span', 'sp'), x = el('button', 'mini', '\u2715'); x.setAttribute('aria-label', 'Hide'); x.onclick = () => { banner.hidden = true; };
    if (u.state === 'available') { msg.textContent = 'A new version ' + u.version + ' is ready.'; const d = el('button', 'go mini', 'Download update'); d.onclick = () => { presenter.updateDownload(); msg.textContent = 'Downloading...'; d.remove(); }; paint([tag, msg, sp, d, x]); }
    else if (u.state === 'downloading') { msg.textContent = 'Downloading the update... ' + u.percent + '%'; paint([tag, msg, sp]); }
    else if (u.state === 'ready') {
      msg.textContent = 'Version ' + u.version + ' is ready. It installs when you close the app.'; const r = el('button', 'go mini', 'Restart now'); r.disabled = isLive(); r.title = r.disabled ? 'Not while something is on screen' : '';
      const unlock = () => { r.disabled = isLive(); r.title = r.disabled ? 'Not while something is on screen' : ''; }; CP.on('program', unlock); r.onclick = () => presenter.updateInstall(); paint([tag, msg, sp, r, x]);
    } else if (u.state === 'none') { if (!banner.hidden) banner.hidden = true; CP.toast('You have the latest version.'); }
    else paint([]);
  });
})();
