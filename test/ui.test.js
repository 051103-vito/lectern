const assert = require('assert'), fs = require('fs'), path = require('path');
const { boot, wait, until } = require('./harness.js');
const sampleSong = fs.readFileSync(path.join(__dirname, '..', 'samples', 'amazing-grace.txt'), 'utf8');
let n = 0; const ok = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else n++; };

(async () => {
  // ================= Bible box, colours, recent, clicker =================
  let t = await boot(); let { $, key, typeStr, hi, step, sent, CP, w } = t;
  ok($('q').value === 'Genesis 1:1' && hi() === 'Genesis' && $('list').children.length === 31, 'starts on Genesis 1:1 with the book highlighted');
  ok([...$('verTabs').children].filter((x) => !x.classList.contains('imp')).map((x) => x.textContent).join() === 'KJV,ASV' && $('verTabs').querySelector('.imp'), 'KJV and ASV tabs, and a + Import tab beside them');
  typeStr('exo'); ok($('q').value === 'Exodus 1:1' && hi() === 'Exodus', 'typing exo completes the book');
  key('ArrowRight'); ok(hi() === '1' && step() === 1, 'Right Arrow selects the chapter');
  typeStr('20'); key(' '); ok(hi() === '1' && step() === 2, 'Space selects the verse'); typeStr('13');
  ok($('q').value === 'Exodus 20:13', 'Exodus 20:13');
  typeStr('9'); ok($('q').value === 'Exodus 20:13', 'impossible verse refused');
  const before = sent.length; key('Enter');
  ok(sent.length === before + 1 && t.last().ref === 'Exodus 20:13' && t.last().kind === 'verse', 'one Enter goes live (Direct)');
  ok($('list').querySelector('.v.live') && $('list').querySelector('.v.live').dataset.n === '13' && $('list').querySelector('.v.live .badge').textContent === 'LIVE', 'live verse is green with a LIVE badge');
  ok($('liveInd').classList.contains('on') && $('liveInd').textContent.includes('LIVE'), 'top bar shows LIVE');
  t.CP.setMode(true); key('ArrowDown');
  ok($('list').querySelector('.v.sel').dataset.n === '14' && $('list').querySelector('.v.live').dataset.n === '13' && $('list').querySelector('.v.sel .badge').textContent === 'SELECTED', 'Studio: selected (blue) and live (green) are different rows');
  ok(t.last().v1 === 13, 'Studio: arrows do not change the live output'); CP.setMode(false);
  key('PageDown'); ok(t.last().v1 === 15 && t.last().ref === 'Exodus 20:15', 'clicker PageDown goes to next verse live');
  key('PageDown', { ctrlKey: true }); ok($('q').value === 'Exodus 21:1' && t.last().v1 === 15, 'Ctrl+PageDown changes chapter without going live');
  CP.settings.clicker = false; key('PageDown'); ok($('q').value === 'Exodus 22:1', 'with clicker off PageDown changes chapter'); CP.settings.clicker = true;
  ok(!$('recent').hidden && [...$('recent').querySelectorAll('button')].length >= 2 && $('recent').querySelector('button').textContent === 'Exodus 20:15', 'recent verses list');
  $('recent').querySelectorAll('button')[1].click(); ok($('q').value === 'Exodus 20:13', 'clicking a recent verse selects it');
  key('Escape'); typeStr('jo'); ok($('sugg').children.length === 5 && $('q').value === 'Joshua 1:1', 'jo lists five books'); key('ArrowDown'); ok($('q').value === 'Job 1:1', 'Down switches book'); typeStr('h'); ok($('q').value === 'John 1:1', 'h narrows to John');
  const nTop = sent.length; $('bibNext').click(); ok(t.last().ref === 'John 1:2' && sent.length === nTop + 1, 'bottom-right arrow moves one verse and goes live');

  // ================= Search by meaning =================
  const S = $('s'); const sIn = async (v) => { S.value = v; S.dispatchEvent(new w.Event('input')); await wait(330); };
  const refs = () => [...$('res').querySelectorAll('.r')].map((r) => r.querySelector('b').textContent + ' ' + r.querySelector('.vt').textContent);
  key('/'); ok(w.document.activeElement === S, '/ focuses the word search');
  await sIn('so loved the world'); ok(!$('res').hidden && $('list').hidden && refs()[0] === 'John 3:16 KJV', 'exact words: John 3:16 first');
  await sIn('God cared so much about humanity that he gave his only child'); ok(refs().slice(0, 5).some((r) => r.startsWith('John 3:16')) && $('res').querySelector('.vt.sim'), 'paraphrase finds John 3:16 and tags similar meaning');
  await sIn('dont worry about tomorrow'); ok(refs().slice(0, 3).some((r) => r.startsWith('Matthew 6:34')), 'paraphrase finds Matthew 6:34');
  await sIn('so loved the world'); $('vers').children[2].click(); await wait(50); ok(refs().length > 0 && refs().every((r) => r.endsWith('ASV')), 'ASV chip filters results');
  const nSearch = sent.length; key('Enter', {}, S); ok(sent.length === nSearch + 1 && t.last().version === 'ASV' && t.last().ref === 'John 3:16', 'Enter in search opens the verse live in ASV');
  ok($('res').hidden && [...$('verTabs').children].find((x) => x.classList.contains('on')).textContent === 'ASV', 'results close and the ASV tab is selected');

  // ================= Queue: select first, Go live separately =================
  CP.setQueue([]); CP.applyRef({ v: 'KJV', bi: 42, ch: 3, v1: 16, v2: 16 }); $('addQ').click(); key('ArrowDown'); $('addQ').click(); key('ArrowDown'); $('addQ').click();
  let rows = $('qlist').querySelectorAll('.qi'); ok(rows.length === 3 && $('qn').textContent === '3', 'three verses queued');
  ok(rows[2].classList.contains('live') && rows[2].classList.contains('sel'), 'live queue row is green');
  $('addQ').click(); ok($('qlist').querySelectorAll('.qi').length === 3, 'adding the same verse twice does not duplicate');
  const n3 = sent.length; rows[0].click();
  ok(sent.length === n3 && rows[0].classList.contains('sel') && !rows[0].classList.contains('live') && rows[2].classList.contains('live'), 'clicking a queue row only SELECTS it (blue)');
  ok(t.$('prev').querySelector('.ref').textContent.startsWith('John 3:16'), 'selected item shows in Preview');
  rows[0].querySelector('[data-act=live]').click(); ok(sent.length === n3 + 1 && rows[0].classList.contains('live') && !rows[2].classList.contains('live'), 'Go live button puts it on the output (green moves)');
  $('qNext').click(); ok(sent.length === n3 + 1 && $('q').value === 'John 3:17' && rows[1].classList.contains('sel'), 'Next item only selects');
  key('ArrowLeft', { ctrlKey: true }); ok(sent.length === n3 + 1 && $('q').value === 'John 3:16', 'Ctrl+Left selects previous item');
  rows[1].querySelector('[data-act=up]').click(); ok($('qlist').querySelectorAll('.qi')[0].querySelector('b').textContent === 'John 3:17', 'Move up'); $('qlist').querySelectorAll('.qi')[0].querySelector('[data-act=del]').click(); ok($('qlist').querySelectorAll('.qi').length === 2, 'Remove');

  // ================= Songs =================
  t = await boot({ files: [{ name: 'amazing-grace.txt', text: sampleSong }], firstRun: false }); ({ $, key, typeStr, sent, CP, w } = t);
  t.data.songs = undefined; delete t.data.songs;
  CP.showTab('songs'); ok($('songList').querySelectorAll('.song').length === 0, 'no songs yet when not first run');
  $('songImport').click(); await wait(60); ok(t.modals() === 1 && t.w.document.querySelector('.modal').textContent.includes('Amazing Grace') && t.w.document.querySelector('.modal').textContent.includes('Verse 1, Verse 2, Verse 3'), 'import shows what the program worked out');
  t.modalBtn('Import').click(); await wait(30); ok($('songList').querySelectorAll('.song').length === 1 && t.modals() === 0, 'song imported');
  ok(CP.ctx === 'song' && $('slides').querySelectorAll('.sl').length === 3, 'slides appear in the Live slides panel');
  ok($('prev').querySelector('.txt').textContent.startsWith('Amazing grace'), 'first slide is in Preview');
  const s0 = sent.length; $('songLive').click(); ok(t.last().kind === 'song' && t.last().slideIx === 0 && !t.last().ref, 'Go live sends slide 1 of the song (no reference line)');
  ok($('slides').querySelector('.sl.live .badge').textContent === 'LIVE' && $('songList').querySelector('.song.live'), 'live slide and live song are green');
  key('ArrowRight', {}, w.document.body); ok(t.last().slideIx === 1 && t.last().text.startsWith('I once was lost') === false, 'arrow steps to slide 2 and goes live');
  key('PageDown', {}, w.document.body); ok(t.last().slideIx === 2, 'clicker PageDown steps to slide 3'); key('PageDown', {}, w.document.body); ok(t.last().slideIx === 2, 'stays on the last slide');
  key('ArrowLeft', {}, w.document.body); ok(t.last().slideIx === 1, 'Left Arrow goes back one slide');
  $('slides').querySelectorAll('.sl')[0].click(); ok(t.last().slideIx === 1 && $('slides').querySelectorAll('.sl')[0].classList.contains('sel'), 'clicking a slide only selects it');
  $('songAdd').click(); ok($('qlist').querySelector('.qi b').textContent === 'Amazing Grace', 'song added to the queue'); CP.emit('addcurrent'); ok($('qlist').querySelectorAll('.qi').length === 1, 'Ctrl+Enter on a song does not duplicate');
  $('songEdit').click(); ok(t.modals() === 1 && t.w.document.querySelector('.modal textarea').value.startsWith('Title: Amazing Grace'), 'editor opens with the song text');
  const lps = t.w.document.querySelector('.modal input[type=number]'); lps.value = 2; lps.dispatchEvent(new w.Event('input')); t.modalBtn('Save song').click(); await wait(30);
  ok($('slides').querySelectorAll('.sl').length === 6, 'two lines per slide gives six slides');
  $('songQ').value = 'wretch'; $('songQ').dispatchEvent(new w.Event('input')); ok($('songList').querySelectorAll('.song').length === 1, 'search finds a song by a word in its lyrics'); $('songQ').value = 'zzzz'; $('songQ').dispatchEvent(new w.Event('input')); ok($('songList').querySelectorAll('.song').length === 0, 'no match'); $('songQ').value = ''; $('songQ').dispatchEvent(new w.Event('input'));
  $('songNew').click(); const ta = t.w.document.querySelector('.modal textarea'); ta.value = 'Title: Mine\n\n[Verse 1]\nOne\nTwo\n\n[Chorus]\nThree\nFour\n\nOrder: Verse 1, Chorus'; ta.dispatchEvent(new w.Event('input')); t.modalBtn('Save song').click(); await wait(30); ok($('songList').querySelectorAll('.song').length === 2, 'new song saved');
  $('songDel').click(); t.modalBtn('Delete').click(); ok($('songList').querySelectorAll('.song').length === 1, 'song deleted');
  t.data.songs && ok(t.data.songs.length === 1, 'songs saved to storage');
  // first start seeds sample hymns
  t = await boot({ firstRun: true }); ok(t.CP.getSongs().length === 3 && t.modals() === 1 && t.w.document.querySelector('.modal').textContent.includes('Welcome'), 'first start: three sample hymns and the welcome window');
  t.modalBtn('Start').click(); await wait(30); ok(t.data.settings.firstRun === false && t.modals() === 0, 'welcome window closes and is remembered');

  // ================= Media, countdown, backgrounds =================
  const media = [{ id: 'm1', name: 'Sunrise', kind: 'image', url: 'file:///a.jpg', file: '/a.jpg' }, { id: 'm2', name: 'Loop', kind: 'video', url: 'file:///b.mp4', file: '/b.mp4' }];
  t = await boot({ media }); ({ $, key, sent, CP, w } = t);
  CP.showTab('media'); $('mediaImport').click(); await wait(40); ok($('mediaGrid').querySelectorAll('.mt').length === 2, 'two media tiles');
  $('mediaGrid').querySelectorAll('.mt')[0].click(); ok(t.$('prev').querySelector('img.media') && CP.getPreview().mode === 'media', 'selecting an image previews it');
  const m0 = sent.length; $('mediaLive').click(); ok(sent.length === m0 + 1 && t.last().mode === 'media' && t.last().url === 'file:///a.jpg', 'Go live shows the image on the output'); ok($('mediaGrid').querySelector('.mt.live'), 'live tile is green');
  $('mediaGrid').querySelectorAll('.mt')[1].click(); $('mediaLive').click(); ok(t.last().kind === 'video' && t.last().loop === true, 'video goes live and loops');
  $('mediaCount').click(); t.w.document.querySelector('.modal input[type=number]').value = 2; t.modalBtn('Create').click(); await wait(20);
  const tile = [...$('mediaGrid').querySelectorAll('.mt')].find((x) => x.textContent.includes('Countdown')); ok(!!tile, 'countdown created'); tile.click(); ok(CP.getPreview().seconds === 120, 'countdown previews its full time');
  $('mediaLive').click(); ok(t.last().mode === 'countdown' && t.last().endsAt > Date.now() + 100000 && t.last().endsAt <= Date.now() + 121000, 'countdown goes live with an end time');
  $('mediaAdd').click(); ok($('qlist').querySelector('.qi b').textContent.includes('Countdown'), 'media added to the queue');
  $('mediaGrid').querySelectorAll('.mt')[0].click(); $('mediaBg').click(); t.modalBtn('Song slides').click(); ok(CP.settings.themes.song.bg.type === 'media' && CP.theme('song').bg.url === 'file:///a.jpg', 'image set as the song background');
  $('mediaDel').click(); t.modalBtn('Delete').click(); ok(CP.settings.themes.song.bg.type === 'gradient', 'deleting a background image resets the theme');

  // ================= Announcements, alerts, themes =================
  t = await boot(); ({ $, key, sent, CP, w } = t);
  CP.showTab('ann'); $('quickText').value = 'Please move your car'; $('quickShow').click(); ok(t.last().kind === 'quick' && t.last().text === 'Please move your car', 'quick text goes live');
  $('alertText').value = 'Nursery call'; $('alertSend').click(); ok(t.last().alert && t.last().alert.text === 'Nursery call' && t.last().alert.pos === 'bottom' && t.last().text === 'Please move your car', 'alert shows over the current slide');
  $('alertHide').click(); ok(!t.last().alert, 'alert hidden');
  $('annNew').click(); const ins = t.w.document.querySelectorAll('.modal input[type=text],.modal textarea'); ins[0].value = 'Welcome'; ins[1].value = 'Youth meeting Friday'; t.modalBtn('Save').click(); await wait(20);
  ok($('annList').querySelectorAll('.song').length === 1, 'announcement slide saved'); $('annLive').click(); ok(t.last().kind === 'ann' && t.last().ref === 'Welcome', 'announcement goes live');
  $('btnThemes').click(); const colors = t.w.document.querySelectorAll('.modal input[type=color]'); const tc = colors[colors.length - 2]; tc.value = '#ffcc00'; tc.dispatchEvent(new w.Event('input')); t.modalBtn('Save themes').click();
  ok(CP.settings.themes.bible.color === '#ffcc00' && t.data.settings.themes.bible.color === '#ffcc00', 'theme text colour saved'); CP.showTab('bible'); ok(CP.theme('bible').color === '#ffcc00', 'new verse slides use the theme');

  // ================= Layout: lock, resize, save =================
  t = await boot(); ({ $, key, sent, CP, w } = t);
  const rect = (el, r) => { el.getBoundingClientRect = () => r; }; rect($('grid'), { left: 0, top: 0, width: 1000, height: 600 }); rect($('colL'), { left: 0, top: 0, width: 500, height: 600 }); rect($('colR'), { left: 510, top: 0, width: 490, height: 600 });
  ok($('grid').classList.contains('locked') && CP.isLocked(), 'layout starts locked'); const mouse = (type, x, y, el) => (el || w).dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  const cw0 = $('grid').style.getPropertyValue('--cw'); mouse('mousedown', 500, 10, $('splitV')); mouse('mousemove', 700, 10); mouse('mouseup', 700, 10); ok($('grid').style.getPropertyValue('--cw') === cw0, 'locked: dragging does nothing');
  $('btnLock').click(); ok(!CP.isLocked() && !$('grid').classList.contains('locked') && $('btnLock').getAttribute('aria-label') === 'Layout unlocked', 'unlocked');
  mouse('mousedown', 500, 10, $('splitV')); mouse('mousemove', 600, 10); mouse('mouseup', 600, 10); ok($('grid').style.getPropertyValue('--cw') === '60' && t.data.settings.layoutNow.cw === 60, 'dragging resizes and saves');
  mouse('mousedown', 100, 300, $('splitL')); mouse('mousemove', 100, 420); mouse('mouseup', 100, 420); ok($('grid').style.getPropertyValue('--rl') === '70', 'left panels resize');
  mouse('mousedown', 700, 300, $('splitR')); mouse('mousemove', 700, 100); mouse('mouseup', 700, 100); ok($('grid').style.getPropertyValue('--rr') === '25', 'right panels resize, limited to 25 percent');
  key('ArrowRight', {}, $('splitV')); ok($('grid').style.getPropertyValue('--cw') === '62', 'keyboard resizes too'); $('splitV').dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); ok($('grid').style.getPropertyValue('--cw') === '50', 'double-click resets one edge');
  $('btnLayout').click(); t.btn('Worship', w.document.querySelector('.menu')).click(); ok($('grid').style.getPropertyValue('--rr') === '62' && CP.settings.layoutName.startsWith('Worship'), 'layout preset applies');
  $('btnLayout').click(); t.btn('Save this layout', w.document.querySelector('.menu')).click(); w.document.querySelector('.modal input').value = 'Mine'; t.modalBtn('Save').click(); ok(CP.settings.layouts.Mine && CP.settings.layouts.Mine.rr === 62, 'custom layout saved');
  $('btnLayout').click(); t.btn('Default', w.document.querySelector('.menu')).click(); ok($('grid').style.getPropertyValue('--rr') === '50', 'back to the default layout');
  key('l', { ctrlKey: true }, w.document.body); ok(CP.isLocked(), 'Ctrl+L locks again'); ok(t.data.settings.locked === true, 'lock state saved');

  // ================= Saved services =================
  t = await boot(); ({ $, key, CP } = t);
  CP.applyRef({ v: 'KJV', bi: 42, ch: 3, v1: 16, v2: 16 }); $('addQ').click(); CP.applyRef({ v: 'KJV', bi: 18, ch: 23, v1: 1, v2: 1 }); $('addQ').click();
  $('btnServices').click(); t.modalBtn('Save current queue').click(); t.w.document.querySelectorAll('.modal input')[0].value = 'Sunday'; t.modalBtn('Save').click(); await wait(20);
  ok(CP.getServices().length === 1 && CP.getServices()[0].items.length === 2, 'service saved'); t.modalBtn('Close').click();
  $('qClear').click(); ok($('qlist').querySelectorAll('.qi').length === 0, 'queue cleared'); $('btnServices').click(); t.modalBtn('Load').click(); ok($('qlist').querySelectorAll('.qi').length === 2, 'service loaded back into the queue');

  // ================= Settings and updates =================
  t = await boot(); ({ $, key, CP, w } = t);
  $('btnSettings').click(); await wait(30); ok(t.modals() === 1, 'settings open'); const cbs = t.w.document.querySelectorAll('.modal input[type=checkbox]');
  cbs[0].checked = false; cbs[0].dispatchEvent(new w.Event('change')); ok(CP.settings.clicker === false && t.data.settings.clicker === false, 'clicker setting saved'); cbs[1].checked = true; cbs[1].dispatchEvent(new w.Event('change')); ok(w.document.body.classList.contains('low'), 'low performance mode');
  const sel = t.w.document.querySelector('.modal select'); sel.value = '2'; sel.dispatchEvent(new w.Event('change')); await wait(10); ok(CP.settings.outputDisplay === '2' && t.calls.includes('rebuild'), 'choosing an output screen rebuilds the output');
  t.modalBtn('Close').click();
  w._upd({ state: 'available', version: '1.1.0' }); ok(!$('banner').hidden && $('banner').textContent.includes('1.1.0') && t.btn('Download update', $('banner')), 'update banner appears'); t.btn('Download update', $('banner')).click(); ok(t.calls.includes('download'), 'download starts');
  CP.setProgram({ mode: 'text', kind: 'quick', text: 'x', theme: CP.theme('bible') }); w._upd({ state: 'ready', version: '1.1.0' }); const rb = t.btn('Restart now', $('banner')); ok(rb.disabled, 'restart blocked while something is live'); CP.black(); ok(!rb.disabled, 'restart allowed once the screen is black'); rb.click(); ok(t.calls.includes('install'), 'restart installs the update');

  // ================= Importing a Bible from an XML file, and interface size =================
  const nt = fs.readFileSync(path.join(__dirname, 'fixtures', 'opensong.xml'), 'utf8');
  t = await boot({ bibleFile: { name: 'nt-test.xml', text: nt } }); ({ $, key, typeStr, CP, w } = t);
  $('verTabs').querySelector('.imp').click(); await wait(150);
  ok(t.modals() === 1 && w.document.querySelector('.modal').textContent.includes('OpenSong XML: 4 books'), 'import window shows what was found in the XML file');
  const bins = w.document.querySelectorAll('.modal input'); bins[0].value = 'tst'; bins[0].dispatchEvent(new w.Event('input')); bins[1].value = 'Test Version';
  t.modalBtn('Import').click(); await wait(60);
  ok(t.calls.includes('saveBible:TST') && [...$('verTabs').children].find((x) => x.classList.contains('on')).textContent === 'TST' && t.modals() === 0, 'imported Bible is saved and selected');
  key('Escape'); typeStr('exo'); ok($('hint').textContent === 'TST does not include Exodus' && $('list').children.length === 0, 'a book the imported Bible lacks shows a clear message');
  const nImp = t.sent.length; key('Enter'); ok(t.sent.length === nImp, 'nothing is sent live for a missing book');
  key('Escape'); typeStr('1jo'); key('ArrowRight'); ok($('list').querySelector('.v.gap') !== null, 'a verse the version lacks is shown as not in this version');
  typeStr('4'); key('ArrowRight'); typeStr('8'); ok($('q').value === '1 John 4:8' && $('list').querySelector('.v.sel').textContent.includes('God is love'), 'the imported text is readable');
  const S2 = $('s'); S2.value = 'God is love'; S2.dispatchEvent(new w.Event('input')); await wait(350); ok($('vers').children.length === 4 && [...$('res').querySelectorAll('.vt')].some((x) => x.textContent === 'TST'), 'word search includes the imported Bible');
  key('Escape'); $('btnSettings').click(); await wait(30); const rm = t.modalBtn('Remove'); ok(!!rm, 'Settings lists imported Bibles with a Remove button'); rm.click(); t.modalBtn('Remove').click(); await wait(30);
  ok(t.calls.includes('removeBible:TST') && !CP.bibles.TST && [...$('verTabs').children].every((x) => x.textContent !== 'TST'), 'removing a Bible works');
  t.modalBtn('Close').click();
  // interface size
  t = await boot({ data: { settings: { firstRun: false, uiScale: 0.7 } } }); ({ $, key, CP, w } = t); ok(t.zooms[0] === 0.7, 'saved interface size is applied at start');
  $('btnSettings').click(); await wait(30); const rng = w.document.querySelector('.modal input[type=range]'); ok(+rng.value === 70, 'slider shows the saved size');
  rng.value = 80; rng.dispatchEvent(new w.Event('input')); ok(t.zooms[t.zooms.length - 1] === 0.8, 'slider changes the size live'); rng.dispatchEvent(new w.Event('change')); ok(t.data.settings.uiScale === 0.8, 'size is remembered');
  t.modalBtn('Close').click(); key('-', { ctrlKey: true }, w.document.body); ok(t.zooms[t.zooms.length - 1] === 0.75, 'Ctrl+minus makes it smaller'); key('=', { ctrlKey: true }, w.document.body); key('=', { ctrlKey: true }, w.document.body); ok(t.zooms[t.zooms.length - 1] === 0.85, 'Ctrl+plus makes it bigger'); key('0', { ctrlKey: true }, w.document.body); ok(t.zooms[t.zooms.length - 1] === 1, 'Ctrl+0 resets it');
  key('-', { ctrlKey: true }, w.document.body); for (let i = 0; i < 12; i++) key('-', { ctrlKey: true }, w.document.body); ok(t.zooms[t.zooms.length - 1] === 0.6, 'smallest size is 60 percent');

  // ================= Crash recovery =================
  t = await boot(); ({ $, key, typeStr, CP, w } = t);
  CP.setQueue([{ t: 'verse', v: 'KJV', bi: 42, ch: 3, v1: 16, v2: 16 }, { t: 'verse', v: 'ASV', bi: 18, ch: 23, v1: 1, v2: 1 }]);
  key('Escape'); typeStr('gen'); key('ArrowRight'); typeStr('3'); key('ArrowRight'); typeStr('5'); key('Enter'); await wait(500);
  const saved = t.data.session; ok(saved && saved.queue.length === 2 && saved.program.ref === 'Genesis 3:5' && saved.sel.ch === 3, 'session snapshot is saved while working');
  // power cut: a new run of the app starts from the same files, and the "running" flag says it did not close properly
  const t2 = await boot({ data: t.data, crashed: true }); ok(t2.$('qlist').querySelectorAll('.qi').length === 2, 'queue comes back after a crash'); ok(t2.$('q').value === 'Genesis 3:5', 'selection comes back');
  ok(!t2.$('restore').hidden && t2.$('restore').textContent.includes('closed unexpectedly') && t2.sent.length === 0 || t2.sent.every((s) => s.mode === 'black' || s.mode === undefined), 'recovery notice shown and nothing is put on screen yet');
  t2.btn('Show it now', t2.$('restore')).click(); ok(t2.last().ref === 'Genesis 3:5' && t2.$('restore').hidden, 'Show it now puts the last slide back on the output');
  const t3 = await boot({ data: t.data, crashed: true }); t3.btn('Keep the screen black', t3.$('restore')).click(); await wait(20); ok(t3.$('restore').hidden && !t3.sent.some((s) => s.mode === 'text'), 'can choose to stay black');
  const t4 = await boot({ data: t.data, crashed: false }); ok(t4.$('restore').hidden && t4.$('qlist').querySelectorAll('.qi').length === 2, 'normal restart: queue back, no recovery notice');
  await wait(30);
  console.log((process.exitCode ? 'UI TESTS FAILED' : 'ui tests passed') + ': ' + n + ' checks');
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
