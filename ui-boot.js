// Start-up: load everything, then restore what was happening if the app was closed in a hurry.
(async () => {
  const CP = window.CP, $ = CP.$, el = CP.el;
  const merge = (d, s) => { if (!s || typeof s !== 'object') return d; Object.keys(s).forEach((k) => { d[k] = (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && typeof s[k] === 'object' && s[k]) ? merge(d[k], s[k]) : s[k]; }); return d; };
  const info = await presenter.appInfo(); CP.appName = info.name; CP.setInfo(info); document.title = info.name; $('appName').textContent = info.name;
  CP.settings = merge(CP.defaults(), await presenter.storeGet('settings', null));
  document.body.classList.toggle('low', !!CP.settings.lowPerf);
  CP.setScale(CP.settings.uiScale || 1, false);
  CP.thes = await presenter.loadThesaurus();
  CP.initBible(await presenter.loadBible());
  for (const f of CP.initFns) { try { await f(); } catch (e) { console.error(e); } }
  const boot = await presenter.sessionBegin();
  if (boot && boot.snapshot) CP.restoreBasics(boot.snapshot);
  CP.setMode(CP.settings.mode === 'studio');
  CP.ready = true;

  // Closed in a hurry (power cut, crash, task manager)? Offer to put back what was on screen.
  const snap = boot && boot.snapshot, prog = snap && snap.program;
  if (boot && boot.crashed && prog && ['text', 'media', 'countdown'].includes(prog.mode)) {
    const bar = $('restore'); let left = 5, timer = null;
    const msg = el('span'), now = el('button', 'go mini', 'Show it now'), no = el('button', 'mini', 'Keep the screen black');
    const done = () => { clearInterval(timer); bar.hidden = true; };
    const paint = () => { msg.textContent = 'The app was closed unexpectedly. Your queue is back. Putting the last slide back on screen in ' + left + '...'; };
    now.onclick = () => { done(); CP.setPreview(prog); CP.setProgram(prog); }; no.onclick = done;
    bar.append(el('b', 'tag', 'RECOVERED'), msg, el('span', 'sp'), now, no); bar.hidden = false; paint();
    timer = setInterval(() => { left--; if (left <= 0) { done(); CP.setPreview(prog); CP.setProgram(prog); } else paint(); }, 1000);
    CP.restoreBar = { done };
  }
  if (CP.settings.firstRun) CP.firstRun();
  setTimeout(() => CP.buildSearch(), 700);          // build the search index quietly in the background
  CP.emit('booted'); CP.saveSoon();
})();
