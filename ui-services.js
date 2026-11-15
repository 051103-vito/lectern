// Saved services: keep a whole queue (for example "Sunday Service") and load it again next week.
(() => {
  const CP = window.CP, $ = CP.$, el = CP.el;
  let services = [];
  const save = () => presenter.storeSet('services', services);
  function open() {
    const body = el('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const box = el('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow:auto';
    const dlg = CP.modal({ title: 'Saved services', body, buttons: [{ label: 'Close' }] });
    function draw() {
      box.textContent = ''; if (!services.length) box.append(el('div', 'empty', 'No saved services yet. Build a queue, then use Save current queue.'));
      services.forEach((s) => {
        const li = el('div', 'li'), t = el('div', 't'); t.append(el('b', '', s.name), el('small', '', s.items.length + ' items'));
        const mk = (txt, fn, cls) => { const b = el('button', cls || 'mini', txt); b.onclick = fn; return b; };
        li.append(t,
          mk('Load', () => { CP.setQueue(JSON.parse(JSON.stringify(s.items))); CP.toast('Loaded "' + s.name + '".'); dlg.close(); }, 'mini go'),
          mk('Add to queue', () => { CP.setQueue(CP.getQueue().concat(JSON.parse(JSON.stringify(s.items)))); CP.toast('Added.'); }),
          mk('Duplicate', () => { services.push({ id: CP.uid('v'), name: s.name + ' copy', items: JSON.parse(JSON.stringify(s.items)) }); save(); draw(); }),
          mk('Delete', () => { services = services.filter((x) => x.id !== s.id); save(); draw(); }));
        box.append(li);
      });
    }
    const sv = el('button', 'go', 'Save current queue as\u2026'); sv.onclick = () => { if (!CP.getQueue().length) { CP.toast('The queue is empty.'); return; } CP.ask('Save service', 'Name (for example Sunday Service)', '', (name) => { const ex = services.find((x) => x.name.toLowerCase() === name.toLowerCase()); const items = JSON.parse(JSON.stringify(CP.getQueue())); if (ex) ex.items = items; else services.push({ id: CP.uid('v'), name, items }); save(); draw(); CP.toast('Service saved.'); }, 'Save'); };
    body.append(sv, box); draw();
  }
  $('btnServices').onclick = open;
  CP.onInit(async () => { services = (await presenter.storeGet('services', [])) || []; });
  CP.getServices = () => services;
})();
