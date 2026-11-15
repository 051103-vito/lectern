// Reads a plain-text song and works out its structure by itself.
//  - finds the title, author and copyright lines
//  - removes chord lines
//  - finds labels such as "Verse 1", "[Chorus]", "Bridge", or numbered stanzas (1. 2. 3.)
//  - recognises a stanza that repeats as the chorus
//  - builds the singing order (including "Chorus x2" or a chorus printed once)
//  - cuts every section into slides
(function (root) {
  const LABELS = 'verse|v|chorus|ch|refrain|pre[- ]?chorus|prechorus|bridge|tag|outro|ending|intro|interlude|instrumental|coda|vamp|hook|turnaround';
  const LABEL_ONLY = new RegExp('^\\s*[\\[\\(\\{<]?\\s*(' + LABELS + ')\\s*[-.:]?\\s*(\\d+)?\\s*([a-d])?\\s*(?:\\(?\\s*(?:x|\\u00d7)\\s*(\\d+)\\s*\\)?|\\(?\\s*(\\d+)\\s*(?:x|\\u00d7)\\s*\\)?)?\\s*[\\]\\)\\}>]?\\s*[:.\\-]?\\s*(?:\\(?(repeat|repeats)\\)?)?\\s*$', 'i');
  const LABEL_INLINE = new RegExp('^\\s*[\\[\\(]?\\s*(' + LABELS + ')\\s*(\\d+)?\\s*[\\]\\)]?\\s*[:.\\-]\\s+(\\S.*)$', 'i');
  const NUM_STANZA = /^\s*(\d{1,2})\s*[.):]\s+(\S.*)$/;
  const CHORD = /^[A-G][#b]?(?:maj|min|m|dim|aug|sus|add)?\d{0,2}(?:sus\d?|add\d+)?(?:\/[A-G][#b]?)?$/;
  const META = [
    ['title', /^\s*(?:title|song)\s*[:=]\s*(.+)$/i],
    ['author', /^\s*(?:author|artist|words(?: and music)?(?: by)?|music(?: by)?|written by|by|composer)\s*[:=]\s*(.+)$/i],
    ['copyright', /^\s*(?:copyright|\u00a9|\(c\)|ccli(?: song)?(?: #| no\.?| number)?|public domain|publisher)\b\s*[:=]?\s*(.*)$/i],
    ['key', /^\s*(?:key|tempo|bpm|capo|time(?: signature)?|ccli)\s*[:=]\s*(.+)$/i]
  ];
  const norm = (s) => s.toLowerCase().replace(/[^a-z\u00c0-\u024f\s]/g, '').replace(/\s+/g, ' ').trim();
  const titleCase = (s) => s.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());

  function isChordLine(line) {
    const t = line.trim().split(/\s+/).filter(Boolean);
    if (!t.length || t.length > 14) return false;
    const chords = t.filter((x) => CHORD.test(x.replace(/[()|]/g, '')) || /^[|\-\/%]+$/.test(x));
    if (chords.length / t.length < 0.8) return false;
    if (t.length === 1) return /[#b\d]|m$|maj|min|sus|dim|aug|\//.test(t[0]) && CHORD.test(t[0]);   // a lone "A" or "C" is a word, not a chord
    return chords.some((x) => CHORD.test(x));
  }
  const stripInlineChords = (l) => l.replace(/\[([A-G][#b]?[^\]\s]{0,8})\]/g, (m, c) => (CHORD.test(c) ? '' : m)).replace(/\s{2,}/g, ' ').trimEnd();   // [G] goes, [Chorus] stays

  function labelOf(kind, num) {
    const k = kind.toLowerCase().replace(/[- ]/g, '');
    const nm = { v: 'Verse', verse: 'Verse', ch: 'Chorus', chorus: 'Chorus', refrain: 'Chorus', prechorus: 'Pre-Chorus', bridge: 'Bridge', tag: 'Tag', outro: 'Outro', ending: 'Outro', coda: 'Outro',
      intro: 'Intro', interlude: 'Interlude', instrumental: 'Instrumental', vamp: 'Vamp', hook: 'Chorus', turnaround: 'Interlude' }[k] || 'Verse';
    return nm + (num && nm !== 'Chorus' || num && nm === 'Chorus' ? ' ' + num : '');
  }
  const typeOf = (label) => label.replace(/\s*\d+$/, '').toLowerCase().replace(/[^a-z]/g, '');

  // Split off one song's header lines and footer lines (author, copyright ...).
  function peel(lines, meta) {
    const out = [];
    for (const raw of lines) {
      const line = raw.trim();
      let hit = false;
      for (const [key, re] of META) {
        const m = line.match(re);
        if (m && (key !== 'author' || /[:=]/.test(line)) ) { if (!meta[key]) meta[key] = (m[1] || line).trim(); else if (key === 'copyright') meta[key] += ' ' + (m[1] || '').trim(); hit = true; break; }
      }
      if (!hit && /^\s*(\u00a9|\(c\)\s|copyright\s|ccli\b|words and music\b|public domain\b|used by permission)/i.test(line)) { meta.copyright = ((meta.copyright || '') + ' ' + line).trim(); hit = true; }
      if (!hit) out.push(raw);
    }
    return out;
  }

  function splitBlocks(lines) {
    const blocks = []; let cur = [];
    for (const l of lines) { if (!l.trim()) { if (cur.length) blocks.push(cur); cur = []; } else cur.push(l); }
    if (cur.length) blocks.push(cur);
    return blocks;
  }

  function similar(a, b) {
    if (a === b) return true;
    const A = new Set(a.split(' ')), B = new Set(b.split(' ')); if (!A.size || !B.size) return false;
    let n = 0; for (const w of A) if (B.has(w)) n++;
    return n / Math.max(A.size, B.size) >= 0.82 && Math.min(A.size, B.size) >= 4;
  }

  function parseOne(text, opts) {
    opts = opts || {};
    const meta = {}; const warnings = [];
    let lines = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\t/g, '    ').split('\n').map((l) => l.replace(/\s+$/, ''));
    // chords
    let chordLines = 0;
    lines = lines.filter((l) => { if (isChordLine(l)) { chordLines++; return false; } return true; }).map(stripInlineChords);
    if (chordLines) warnings.push('Removed ' + chordLines + ' chord line' + (chordLines === 1 ? '' : 's') + '.');
    const explicitOrder = (() => { const i = lines.findIndex((l) => /^\s*order\s*[:=]/i.test(l)); if (i < 0) return null; const v = lines[i].replace(/^\s*order\s*[:=]\s*/i, ''); lines.splice(i, 1); return v.split(/[,;>]+/).map((s) => s.trim()).filter(Boolean); })();
    lines = peel(lines, meta);
    while (lines.length && !lines[0].trim()) lines.shift();

    // title: from metadata, else a short first line standing alone, else the file name
    let title = meta.title; delete meta.title;
    if (!title && lines.length) {
      const first = lines[0].trim(), second = lines[1];
      const alone = second === undefined || !second.trim() || LABEL_ONLY.test(second) || /^\s*[\[\(]/.test(second);
      if (first.length <= 60 && !/[,;:.!?]$/.test(first) && !LABEL_ONLY.test(first) && !NUM_STANZA.test(first) && alone && lines.filter((l) => l.trim()).length > 2) { title = first.replace(/^["'\u201c]|["'\u201d]$/g, ''); lines.shift(); }
    }
    // a short two-line block at the top ("Title" then "Author") followed by more stanzas
    if (!title && lines.length) {
      const cut = lines.findIndex((l) => !l.trim());
      const head = cut > 0 ? lines.slice(0, cut) : [];
      const short = (l) => l.trim().length <= 60 && !/[,;:.!?]$/.test(l.trim()) && !LABEL_ONLY.test(l) && !NUM_STANZA.test(l);
      if (head.length === 2 && head.every(short) && splitBlocks(lines.slice(cut + 1)).length >= 2 && /^[A-Z][\w'.\-]*(\s+[A-Z&][\w'.\-]*){0,3}$/.test(head[1].trim())) {
        title = head[0].trim(); meta.author = meta.author || head[1].trim(); lines = lines.slice(cut + 1);
        warnings.push('Title and author were taken from the first two lines. Please check them.');
      }
    }
    if (!title) { title = opts.filename ? titleCase(opts.filename.replace(/\.[^.]+$/, '')) : 'Untitled song'; warnings.push('No title found, used "' + title + '".'); }

    // numbered stanzas at the start of lines (1. 2. 3.) become Verse labels
    const hasLabels = lines.some((l) => LABEL_ONLY.test(l) || LABEL_INLINE.test(l));
    const blocks = splitBlocks(lines);
    const secs = [];                    // {label, lines, labelled, repeat}
    const refs = [];                    // order entries that only point at a section ("Chorus")
    for (const blk of blocks) {
      let cur = null;
      const push = () => { if (cur && (cur.lines.length || cur.refOnly)) secs.push(cur); cur = null; };
      for (const l of blk) {
        let m = l.match(LABEL_ONLY);
        if (m && m[1]) {
          push();
          const lab = labelOf(m[1], m[2] ? m[2] + (m[3] || '') : '');
          const times = parseInt(m[4] || m[5] || '1', 10);
          cur = { label: lab, lines: [], labelled: true, times: times > 1 ? times : 1, refOnly: false, repeatMark: !!m[6] };
          continue;
        }
        m = l.match(LABEL_INLINE);
        if (m) { push(); cur = { label: labelOf(m[1], m[2]), lines: [m[3].trim()], labelled: true, times: 1 }; continue; }
        m = l.match(NUM_STANZA);
        if (m && !hasLabels) { push(); cur = { label: 'Verse ' + m[1], lines: [m[2].trim()], labelled: true, times: 1 }; continue; }
        if (m && hasLabels && blk.indexOf(l) === 0) { push(); cur = { label: 'Verse ' + m[1], lines: [m[2].trim()], labelled: true, times: 1 }; continue; }
        if (!cur) cur = { label: '', lines: [], labelled: false, times: 1 };
        cur.lines.push(l.trim());
      }
      push();
    }
    // a label with no lines (e.g. "(Chorus)") is a pointer to an earlier section
    const sections = [], order = [];
    const byName = (name) => sections.find((s) => typeOf(s.label) === typeOf(name) && (!/\d/.test(name) || s.label === name)) || sections.find((s) => typeOf(s.label) === typeOf(name));
    let verseN = 0;
    // 1) classify unlabelled blocks by repetition
    const sigs = secs.map((s) => norm(s.lines.join(' ')));
    const groups = [];                  // groups of indexes that are the same stanza
    secs.forEach((s, i) => {
      if (!s.lines.length) return;
      const g = groups.find((gr) => similar(sigs[gr[0]], sigs[i]));
      if (g) g.push(i); else groups.push([i]);
    });
    const repeated = groups.filter((g) => g.length > 1).sort((a, b) => b.length - a.length)[0];
    const repeatedSet = new Set(repeated || []);
    const firstOfGroup = (i) => groups.find((g) => g.includes(i))[0];
    const dupOf = {};                  // index -> index of the section it repeats
    groups.forEach((g) => g.slice(1).forEach((i) => { dupOf[i] = g[0]; }));
    let sawChorus = false;
    secs.forEach((s, i) => {
      if (!s.lines.length) { if (s.label) { const t = byName(s.label); if (t) order.push(t.id); } return; }
      if (dupOf[i] !== undefined && sections.find((x) => x.srcIndex === dupOf[i])) { const t = sections.find((x) => x.srcIndex === dupOf[i]); order.push(t.id); for (let k = 1; k < s.times; k++) order.push(t.id); return; }
      let label = s.label, inferred = false;
      if (!s.labelled) {
        if (repeated && repeatedSet.has(i) && firstOfGroup(i) === i && repeated[0] === i) { label = 'Chorus'; inferred = true; sawChorus = true; }
        else { verseN++; label = 'Verse ' + verseN; inferred = blocks.length > 1; }
      } else if (/^verse/i.test(label)) { const n = parseInt((label.match(/\d+/) || [0])[0], 10); if (n > verseN) verseN = n; if (!/\d/.test(label)) { verseN++; label = 'Verse ' + verseN; } }
      if (/^chorus/i.test(label)) sawChorus = true;
      // same label used twice with different words -> give it its own number
      if (sections.some((x) => x.label === label)) { const base = label.replace(/\s*\d+$/, ''); let n = 2; while (sections.some((x) => x.label === base + ' ' + n)) n++; label = base + ' ' + n; }
      const sec = { id: 's' + (sections.length + 1), label, type: typeOf(label), lines: s.lines.slice(), inferred, srcIndex: i };
      sections.push(sec); order.push(sec.id); for (let k = 1; k < s.times; k++) order.push(sec.id);
    });
    // bridge guess: a short one-off block after the chorus has been heard at least twice
    sections.forEach((s) => delete s.srcIndex);
    if (!sections.length) { warnings.push('No lyrics found.'); }
    // a chorus printed only once between verses is usually sung after every verse
    let chorusRepeat = false;
    const ch = sections.filter((s) => s.type === 'chorus');
    if (ch.length === 1 && sections.filter((s) => s.type === 'verse').length >= 2 && order.filter((id) => id === ch[0].id).length === 1) {
      chorusRepeat = true; if (!explicitOrder) { const o = []; order.forEach((id, i) => { o.push(id); const s = sections.find((x) => x.id === id); const nxt = sections.find((x) => x.id === order[i + 1]); if (s.type === 'verse' && (!nxt || nxt.type !== 'chorus')) o.push(ch[0].id); }); order.length = 0; order.push(...o); }
    }
    let finalOrder = order;
    if (explicitOrder) { const ids = explicitOrder.map((n) => (sections.find((s) => s.label.toLowerCase() === n.toLowerCase()) || sections.find((s) => s.type === typeOf(n))) ).filter(Boolean).map((s) => s.id); if (ids.length) finalOrder = ids; }
    if (sections.some((s) => s.inferred)) warnings.push('No section labels in the file, so the verses and chorus were worked out by the program. Please check them.');
    return { title, author: meta.author || '', copyright: meta.copyright || '', key: meta.key || '', sections, order: finalOrder, chorusRepeat, warnings: Array.from(new Set(warnings)) };
  }

  // One file can hold several songs, divided by lines such as ==== or ----, or repeated "Title:" lines.
  function parse(text, opts) {
    opts = opts || {};
    const t = String(text).replace(/^\uFEFF/, '');
    let chunks = t.split(/\n[ \t]*(?:[=\-*_#~]{4,})[ \t]*\n/);
    if (chunks.length < 2 || chunks.some((c) => c.trim().split('\n').filter((x) => x.trim()).length < 2)) {
      const idx = []; t.split(/\r?\n/).forEach((l, i) => { if (/^\s*title\s*[:=]/i.test(l)) idx.push(i); });
      if (idx.length > 1) { const ls = t.split(/\r?\n/); chunks = idx.map((s, k) => ls.slice(s, idx[k + 1] || ls.length).join('\n')); }
      else chunks = [t];
    }
    return chunks.filter((c) => c.trim()).map((c, i, a) => parseOne(c, { filename: a.length > 1 ? (opts.filename ? opts.filename.replace(/\.[^.]+$/, '') + ' ' + (i + 1) : '') : opts.filename }));
  }

  // Slides: every section is cut into slides of at most `lines` lines, split as evenly as possible.
  function slidesOf(song, opts) {
    const per = Math.max(1, (opts && opts.lines) || song.linesPerSlide || 4);
    const out = [];
    song.order.forEach((id, k) => {
      const s = song.sections.find((x) => x.id === id); if (!s || !s.lines.length) return;
      if (/^(instrumental|interlude|intro)$/.test(s.type) && s.lines.join(' ').length < 4) return;
      const weight = (l) => (l.length > 70 ? 2 : 1);
      const total = s.lines.reduce((a, l) => a + weight(l), 0), count = Math.max(1, Math.ceil(total / per));
      const target = total / count; let cur = [], w = 0, made = 0;
      s.lines.forEach((l, i) => {
        cur.push(l); w += weight(l);
        const left = s.lines.length - i - 1, slidesLeft = count - made - 1;
        if (made < count - 1 && (w >= target - 0.01 || left <= slidesLeft)) { out.push({ section: s.id, label: s.label, n: made + 1, of: count, text: cur.join('\n'), pos: k }); cur = []; w = 0; made++; }
      });
      if (cur.length) out.push({ section: s.id, label: s.label, n: made + 1, of: count, text: cur.join('\n'), pos: k });
    });
    return out;
  }

  // The editable text form (also understood by parse()).
  function format(song) {
    const o = ['Title: ' + song.title]; if (song.author) o.push('Author: ' + song.author); if (song.copyright) o.push('Copyright: ' + song.copyright); o.push('');
    song.sections.forEach((s) => { o.push('[' + s.label + ']'); o.push(...s.lines); o.push(''); });
    o.push('Order: ' + song.order.map((id) => (song.sections.find((s) => s.id === id) || {}).label).join(', '));
    return o.join('\n');
  }

  const api = { parse, parseOne, slidesOf, format, isChordLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SongParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
