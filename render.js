// Slides are designed on a fixed 1920x1080 canvas and scaled to the real size, so they stay sharp at 1080p and 4K.
window.StageRender = (() => {
  const DEF_BG = { type: 'gradient', from: '#14307a', to: '#0a1a4a' };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };

  function background(c, theme, mini) {
    const bg = el('div', 'bg'), b = (theme && theme.bg) || DEF_BG;
    if (b.type === 'color') bg.style.background = b.color;
    else if (b.type === 'media' && b.url) {
      if (b.kind === 'video') { const v = el('video'); v.src = b.url; v.muted = true; v.loop = b.loop !== false; v.playsInline = true; if (!mini) v.autoplay = true; else v.preload = 'metadata'; bg.append(v); if (!mini) v.play().catch(() => {}); }
      else { const i = el('img'); i.src = b.url; bg.append(i); }
      bg.style.background = '#000';
    } else bg.style.background = 'linear-gradient(180deg,' + (b.from || DEF_BG.from) + ',' + (b.to || DEF_BG.to) + ')';
    c.append(bg);
  }

  function draw(stage, s, opts) {
    const mini = !!(opts && opts.mini), c = stage.querySelector('.canvas');
    if (stage._tick) { clearInterval(stage._tick); stage._tick = null; }
    c.querySelectorAll('video').forEach((v) => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ } });
    const mode = s.mode || 'clear', t = s.theme || { bg: DEF_BG };
    c.className = 'canvas mode-' + mode; c.textContent = '';
    if (mode === 'black') { c.append(el('div', 'bg')); }
    else if (mode === 'media') {
      let m;
      if (s.kind === 'video') { m = el('video', 'media'); m.src = s.url; m.loop = !!s.loop; m.muted = mini || s.muted !== false; if (!mini) { m.autoplay = true; m.play().catch(() => {}); } else m.preload = 'metadata'; }
      else { m = el('img', 'media'); m.src = s.url; }
      c.append(m);
    } else if (mode === 'test') {
      const bars = el('div', 'bars'); ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000'].forEach((x) => { const i = el('i'); i.style.background = x; bars.append(i); }); c.append(bars);
      c.append(el('div', 'tp', 'Test pattern ' + (s.info || '')));
    } else {
      background(c, t, mini);
      const fg = el('div', 'fg'); fg.style.justifyContent = t.pos === 'top' ? 'flex-start' : t.pos === 'bottom' ? 'flex-end' : 'center';
      if (mode === 'text') {
        if (s.ref) { const r = el('div', 'ref', s.ref + (s.version ? ' (' + s.version + ')' : '')); r.style.color = t.refColor || '#f5c542'; if (t.shadow !== false) r.style.textShadow = '0 2px 10px rgba(0,0,0,.55)'; fg.append(r); }
        const x = el('div', 'txt', s.text || ''); const txt = s.text || ''; let size = Math.min(BibleLogic.fitSize(txt), t.maxSize || 100);
        if (txt.includes('\n')) { const ls = txt.split('\n'), longest = Math.max.apply(null, ls.map((l) => l.length)); size = Math.max(40, Math.min(size, Math.floor(1580 / (0.6 * Math.max(longest, 1))), Math.floor(820 / (1.25 * ls.length)))); }   // song lines: keep each line on one row where possible
        x.style.fontSize = size + 'px'; x.style.fontWeight = t.weight || 600; x.style.color = t.color || '#fff';
        if (t.shadow !== false) x.style.textShadow = '0 3px 14px rgba(0,0,0,.6)'; fg.append(x);
      } else if (mode === 'logo') fg.append(el('div', 'logo', s.text || 'Welcome'));
      else if (mode === 'countdown') {
        const num = el('div', 'count'), left = () => s.endsAt ? (s.endsAt - Date.now()) / 1000 : (s.seconds || 0);
        if (s.label) fg.append(el('div', 'clabel', s.label));
        num.textContent = mmss(left()); fg.append(num); if (s.endsAt) stage._tick = setInterval(() => { num.textContent = mmss(left()); }, 250);
        if (t.shadow !== false) fg.style.textShadow = '0 3px 14px rgba(0,0,0,.6)';
      }
      c.append(fg);
    }
    if (s.alert && s.alert.text) c.append(el('div', 'alert ' + (s.alert.pos === 'top' ? 'top' : 'bottom'), s.alert.text));
  }
  function fit(stage) {
    const c = stage.querySelector('.canvas'), k = Math.min(stage.clientWidth / 1920, stage.clientHeight / 1080);
    c.style.transform = 'scale(' + k + ')'; c.style.left = (stage.clientWidth - 1920 * k) / 2 + 'px'; c.style.top = (stage.clientHeight - 1080 * k) / 2 + 'px';
  }
  return { W: 1920, H: 1080, draw, fit, mmss };
})();
