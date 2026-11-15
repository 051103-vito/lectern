// Slide themes: how Bible, song and announcement slides look.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el;
  const KEYS = [['bible', 'Bible'], ['song', 'Songs'], ['announce', 'Announcements']];
  const SAMPLE = {
    bible: { mode: 'text', ref: 'John 3:16', version: 'KJV', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
    song: { mode: 'text', text: 'Amazing grace, how sweet the sound\nThat saved a wretch like me' },
    announce: { mode: 'text', ref: 'Welcome', text: 'Please silence your phones' }
  };
  const resolve = (t) => { const c = JSON.parse(JSON.stringify(t)); if (c.bg.type === 'media') { const m = CP.mediaItem(c.bg.id); c.bg = m ? { type: 'media', kind: m.kind, url: m.url, loop: true } : { type: 'gradient', from: '#14307a', to: '#0a1a4a' }; } return c; };
  const kindToKey = { verse: 'bible', song: 'song', ann: 'announce', quick: 'announce', countdown: 'announce' };

  function open() {
    let key = 'bible'; const work = JSON.parse(JSON.stringify(CP.settings.themes));
    const body = el('div'); body.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:18px';
    const form = el('div'); form.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const right = el('div'); right.style.cssText = 'display:flex;flex-direction:column;gap:10px'; const stage = el('div', 'stage'); stage.style.cssText = 'width:100%;aspect-ratio:16/9;border-radius:8px'; stage.append(el('div', 'canvas'));
    right.append(el('div', 'dim', 'Preview of the selected theme'), stage);
    const tabs = el('div', 'row-btns'); tabs.style.padding = '0';
    body.append(form, right);
    const draw = () => { const s = Object.assign({}, SAMPLE[key], { theme: resolve(work[key]) }); StageRender.draw(stage, s, { mini: true }); StageRender.fit(stage); };
    const field = (label, input) => { const l = el('label', '', label); l.append(input); return l; };
    const sel = (opts, val, cb) => { const s = el('select'); opts.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; s.append(o); }); s.value = val; s.onchange = () => cb(s.value); return s; };
    const col = (val, cb) => { const i = el('input'); i.type = 'color'; i.value = val; i.style.cssText = 'height:42px;padding:2px'; i.oninput = () => cb(i.value); return i; };
    function build() {
      form.textContent = ''; tabs.textContent = '';
      KEYS.forEach(([k, n]) => { const b = el('button', k === key ? 'on' : '', n); b.style.minHeight = '36px'; if (k === key) b.style.borderColor = 'var(--accent)'; b.onclick = () => { key = k; build(); }; tabs.append(b); });
      const t = work[key]; form.append(tabs);
      const media = CP.getMedia().filter((m) => m.kind !== 'countdown');
      const bgType = sel([['gradient', 'Colour fade'], ['color', 'One colour'], ['media', 'Image or video']], t.bg.type, (v) => { t.bg = v === 'gradient' ? { type: 'gradient', from: '#14307a', to: '#0a1a4a' } : v === 'color' ? { type: 'color', color: '#0a1a4a' } : { type: 'media', id: media[0] && media[0].id }; if (v === 'media' && !media.length) { CP.toast('Import an image or video in Media first.'); t.bg = { type: 'gradient', from: '#14307a', to: '#0a1a4a' }; } build(); draw(); });
      form.append(field('Background', bgType));
      if (t.bg.type === 'gradient') { const two = el('div', 'two'); two.append(field('Top', col(t.bg.from, (v) => { t.bg.from = v; draw(); })), field('Bottom', col(t.bg.to, (v) => { t.bg.to = v; draw(); }))); form.append(two); }
      else if (t.bg.type === 'color') form.append(field('Colour', col(t.bg.color, (v) => { t.bg.color = v; draw(); })));
      else form.append(field('Image or video', sel(media.map((m) => [m.id, m.name]), t.bg.id, (v) => { t.bg.id = v; draw(); })));
      const two = el('div', 'two'); two.append(field('Text colour', col(t.color, (v) => { t.color = v; draw(); })), field('Reference colour', col(t.refColor, (v) => { t.refColor = v; draw(); }))); form.append(two);
      const two2 = el('div', 'two'); two2.append(field('Text weight', sel([['400', 'Regular'], ['500', 'Medium'], ['600', 'Semi-bold'], ['700', 'Bold']], String(t.weight), (v) => { t.weight = +v; draw(); })), field('Text position', sel([['center', 'Middle'], ['top', 'Top'], ['bottom', 'Bottom']], t.pos, (v) => { t.pos = v; draw(); }))); form.append(two2);
      const rng = el('input'); rng.type = 'range'; rng.min = 50; rng.max = 120; rng.value = t.maxSize; rng.oninput = () => { t.maxSize = +rng.value; draw(); }; form.append(field('Biggest text size (it still shrinks long text to fit)', rng));
      const sh = el('label', 'chk'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = t.shadow !== false; cb.onchange = () => { t.shadow = cb.checked; draw(); }; sh.append(cb, document.createTextNode('Soft shadow behind the text')); form.append(sh);
      const row = el('div', 'row-btns'); row.style.padding = '0';
      const reset = el('button', '', 'Reset this theme'); reset.onclick = () => { work[key] = CP.defaults().themes[key]; build(); draw(); };
      const all = el('button', '', 'Copy to all themes'); all.onclick = () => { KEYS.forEach(([k]) => { work[k] = JSON.parse(JSON.stringify(work[key])); }); CP.toast('Copied to all three.'); };
      row.append(reset, all); form.append(row);
    }
    build();
    CP.modal({ title: 'Slide themes', body, wide: true, buttons: [{ label: 'Cancel' }, { label: 'Save themes', cls: 'go', onClick: () => { CP.settings.themes = work; CP.saveSettings(); CP.emit('themes'); CP.toast('Themes saved.'); } }] });
    draw();
  }
  $('btnThemes').onclick = open;
  CP.on('themes', () => { const p = CP.getPreview(); if (p && p.theme && kindToKey[p.kind]) { p.theme = CP.theme(kindToKey[p.kind]); CP.setPreview(p); } });
})();
