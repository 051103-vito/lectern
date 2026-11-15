// Reads Bible files into our own layout: { version, name, books: [{ name, chapters: [[verse text]] }] }
// Understood: XML in Zefania, OpenSong, Beblia ("Holy Bible XML"), OSIS and USFX layouts, and JSON files.
// A file may hold only part of the Bible (for example the New Testament); missing books are left empty.
(function (root) {
  const NAMES = (typeof module !== 'undefined' && module.exports) ? require('./bible.js').NAMES : root.BibleLogic.NAMES;
  const BL = (typeof module !== 'undefined' && module.exports) ? require('./bible.js') : root.BibleLogic;
  const keyOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const NAMEKEYS = NAMES.map(keyOf);
  const USFM = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
  const OSISB = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ').map((x) => x.toLowerCase());
  const ALIAS = { songofsongs: 21, canticles: 21, canticleofcanticles: 21, revelationofjohn: 65, apocalypse: 65, psalm: 18, actsoftheapostles: 43, ecclesiasticus: -1 };

  function nameToIndex(name) {
    let s = String(name).trim().replace(/^the\s+/i, '').replace(/^book of\s+/i, '');
    s = s.replace(/^(III|II|I)\.?\s+/i, (m, r) => ({ III: '3', II: '2', I: '1' }[r.toUpperCase()]) + ' ').replace(/^(\d)(st|nd|rd)\s*/i, '$1 ').replace(/^first\s+/i, '1 ').replace(/^second\s+/i, '2 ').replace(/^third\s+/i, '3 ');
    const k = keyOf(s); let i = NAMEKEYS.indexOf(k); if (i >= 0) return i;
    if (ALIAS[k] !== undefined) return ALIAS[k];
    const r = BL.parse(s); if (r.ok && r.candidates.length === 1) return NAMES.indexOf(r.candidates[0]);
    return -1;
  }

  // ---- collecting verses ----
  function Builder() { this.books = NAMES.map(() => []); this.verses = 0; }
  Builder.prototype.add = function (bi, ch, vs, text) {
    if (!(bi >= 0 && bi < 66 && ch > 0 && vs > 0)) return;
    text = String(text).replace(/\s+/g, ' ').trim(); if (!text) return;
    const b = this.books[bi]; while (b.length < ch) b.push([]);
    const c = b[ch - 1]; while (c.length < vs) c.push('');
    if (c[vs - 1]) c[vs - 1] += ' ' + text; else { c[vs - 1] = text; this.verses++; }
  };
  Builder.prototype.finish = function () {
    this.books.forEach((b) => b.forEach((c, i) => { if (!c.length) b[i] = ['']; }));          // no empty chapters in the middle of a book
    return NAMES.map((n, i) => ({ name: n, chapters: this.books[i] }));
  };

  const low = (n) => (n.localName || n.nodeName || '').toLowerCase();
  const attr = (n, a) => { const v = n.getAttribute(a); return v === null ? '' : v; };
  function textOf(el, skip) {
    let out = ''; const stack = [el.firstChild];
    (function walk(n) { for (; n; n = n.nextSibling) { if (n.nodeType === 3 || n.nodeType === 4) out += n.nodeValue; else if (n.nodeType === 1 && !skip.has(low(n))) walk(n.firstChild); } })(el.firstChild);
    return out;
  }
  const all = (doc, names) => { const set = new Set(names), out = []; const els = doc.getElementsByTagName('*'); for (let i = 0; i < els.length; i++) if (set.has(low(els[i]))) out.push(els[i]); return out; };
  const kids = (el, name) => { const o = []; for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && low(n) === name) o.push(n); return o; };

  function parseZefania(doc) {
    const b = new Builder();
    all(doc, ['biblebook']).forEach((bk) => {
      let bi = parseInt(attr(bk, 'bnumber'), 10) - 1; if (!(bi >= 0 && bi < 66)) bi = nameToIndex(attr(bk, 'bname') || attr(bk, 'bsname'));
      kids(bk, 'chapter').forEach((c) => kids(c, 'vers').forEach((v) => b.add(bi, parseInt(attr(c, 'cnumber'), 10), parseInt(attr(v, 'vnumber'), 10), textOf(v, new Set(['note'])))));
    });
    const root = doc.documentElement; const t = all(doc, ['title'])[0];
    return { b, name: attr(root, 'biblename') || (t ? t.textContent.trim() : ''), code: (all(doc, ['identifier'])[0] || {}).textContent };
  }
  function parseOpenSong(doc) {
    const b = new Builder();
    all(doc, ['b']).forEach((bk) => { const bi = nameToIndex(attr(bk, 'n')); kids(bk, 'c').forEach((c) => kids(c, 'v').forEach((v) => b.add(bi, parseInt(attr(c, 'n'), 10), parseInt(attr(v, 'n'), 10), v.textContent))); });
    return { b, name: attr(doc.documentElement, 'n') || attr(doc.documentElement, 'translation') };
  }
  function parseBeblia(doc) {
    const b = new Builder();
    all(doc, ['book']).forEach((bk) => {
      let bi = parseInt(attr(bk, 'number') || attr(bk, 'id'), 10) - 1; if (!(bi >= 0 && bi < 66)) bi = nameToIndex(attr(bk, 'name'));
      kids(bk, 'chapter').forEach((c) => kids(c, 'verse').forEach((v) => b.add(bi, parseInt(attr(c, 'number'), 10), parseInt(attr(v, 'number'), 10), v.textContent)));
    });
    return { b, name: attr(doc.documentElement, 'translation') || attr(doc.documentElement, 'name') };
  }
  const OSIS_SKIP = new Set(['note', 'title', 'rdg', 'catchword', 'index', 'header', 'teiheader']);
  function osisRef(id) {
    const ref = String(id).trim().split(/\s+/)[0].replace(/^[^:]+:/, ''), p = ref.split('.');
    let bi = OSISB.indexOf((p[0] || '').toLowerCase()); if (bi < 0) bi = nameToIndex(p[0] || '');
    return [bi, parseInt(p[1], 10), parseInt(p[2], 10)];
  }
  function parseOsis(doc) {
    const b = new Builder(); let cur = null, buf = '';
    const flush = () => { if (cur) b.add(cur[0], cur[1], cur[2], buf); cur = null; buf = ''; };
    (function walk(n) {
      for (; n; n = n.nextSibling) {
        if (n.nodeType === 3 || n.nodeType === 4) { if (cur) buf += n.nodeValue; continue; }
        if (n.nodeType !== 1) continue;
        const nm = low(n);
        if (nm === 'verse') {
          if (n.getAttribute('eID')) { flush(); continue; }
          if (n.getAttribute('sID')) { flush(); cur = osisRef(n.getAttribute('osisID') || n.getAttribute('sID')); continue; }
          const id = n.getAttribute('osisID'); if (id) { flush(); const r = osisRef(id); b.add(r[0], r[1], r[2], textOf(n, OSIS_SKIP)); continue; }
        }
        if (OSIS_SKIP.has(nm)) continue;
        walk(n.firstChild);
      }
    })(doc.documentElement.firstChild);
    flush();
    const w = all(doc, ['work'])[0], t = w && all(w, ['title']).length ? null : null; let name = '';
    const works = all(doc, ['work']); if (works.length) { const tt = works[0].getElementsByTagName('title')[0]; if (tt) name = tt.textContent.trim(); }
    return { b, name, code: attr(doc.documentElement, 'osisIDWork') || (doc.getElementsByTagName('osisText')[0] ? attr(doc.getElementsByTagName('osisText')[0], 'osisIDWork') : '') };
  }
  const USFX_SKIP = new Set(['f', 'x', 'fr', 'ft', 'fk', 'fq', 'fqa', 'fv', 'fdc', 'fm', 'xo', 'xk', 'xq', 'xt', 'rem', 'ide', 'id', 'h', 'toc', 'mt', 'mt1', 'mt2', 'mt3', 'mt4', 'ms', 'ms1', 'ms2', 'ms3', 'mr', 's', 's1', 's2', 's3', 's4', 'sr', 'r', 'd', 'sp', 'cl', 'cd', 'cp', 'ca', 'va', 'vp', 'periph', 'fig', 'figure']);
  function parseUsfx(doc) {
    const b = new Builder(); let bi = -1, ch = 0, vs = 0, active = false, buf = '';
    const flush = () => { if (active) b.add(bi, ch, vs, buf); buf = ''; active = false; };
    (function walk(n) {
      for (; n; n = n.nextSibling) {
        if (n.nodeType === 3 || n.nodeType === 4) { if (active) buf += n.nodeValue; continue; }
        if (n.nodeType !== 1) continue;
        const nm = low(n);
        if (nm === 'book') { flush(); bi = USFM.indexOf(attr(n, 'id').toUpperCase()); ch = 0; vs = 0; walk(n.firstChild); flush(); continue; }
        if (nm === 'c') { flush(); ch = parseInt(attr(n, 'id'), 10) || 0; vs = 0; continue; }
        if (nm === 'v') { flush(); vs = parseInt(attr(n, 'id'), 10) || 0; active = bi >= 0 && ch > 0 && vs > 0; continue; }
        if (nm === 've') { flush(); continue; }
        if (USFX_SKIP.has(nm)) continue;
        walk(n.firstChild);
      }
    })(doc.documentElement.firstChild);
    flush();
    return { b, name: '' };
  }

  function guessCode(filename) {
    const base = String(filename || '').split(/[\\/]/).pop().split('.')[0].replace(/^(eng|en)[-_]/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return (base || 'NEW').slice(0, 6);
  }
  function summarize(bk) {
    const have = bk.filter((x) => x.chapters.length), verses = have.reduce((a, x) => a + x.chapters.reduce((y, c) => y + c.filter(Boolean).length, 0), 0);
    return { books: have.length, verses, missing: bk.filter((x) => !x.chapters.length).map((x) => x.name) };
  }

  function fromXml(text, filename, Parser) {
    Parser = Parser || (typeof DOMParser !== 'undefined' ? DOMParser : null); if (!Parser) throw new Error('This computer cannot read XML here.');
    const doc = new Parser().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
    if (!doc.documentElement || doc.getElementsByTagName('parsererror').length) throw new Error('This XML file could not be read. It may be damaged.');
    const rootName = low(doc.documentElement); let format, r;
    if (rootName === 'xmlbible') { format = 'Zefania XML'; r = parseZefania(doc); }
    else if (rootName === 'osis') { format = 'OSIS XML'; r = parseOsis(doc); }
    else if (rootName === 'usfx') { format = 'USFX XML'; r = parseUsfx(doc); }
    else if (rootName === 'bible') { if (all(doc, ['b']).length) { format = 'OpenSong XML'; r = parseOpenSong(doc); } else { format = 'Holy Bible XML'; r = parseBeblia(doc); } }
    else throw new Error('This XML layout is not one the program knows (' + doc.documentElement.nodeName + '). Zefania, OpenSong, OSIS, USFX and Holy Bible XML files work.');
    const books = r.b.finish(), st = summarize(books);
    if (!st.books) throw new Error('No Bible books were found in this file.');
    const code = (r.code && /^[A-Za-z0-9]{2,8}$/.test(r.code.trim()) ? r.code.trim() : guessCode(filename)).toUpperCase().slice(0, 6);
    return { format, version: code, name: (r.name || '').trim() || String(filename || '').replace(/\.[^.]+$/, ''), books, stats: st };
  }

  // JSON: our own layout, or the common "scrollmapper" and "thiagobodruk" layouts
  function normalize(raw, version, name) {
    if (raw && raw.version && Array.isArray(raw.books) && raw.books[0] && Array.isArray(raw.books[0].chapters && raw.books[0].chapters[0])) {
      return { version: String(version || raw.version).toUpperCase(), name: name || raw.name || raw.version, books: raw.books.map((b, i) => ({ name: NAMES[i] || b.name, chapters: b.chapters })) };
    }
    let books = null;
    if (Array.isArray(raw)) books = raw.map((b) => b.chapters);
    else if (raw && Array.isArray(raw.books)) books = raw.books.map((b) => (b.chapters || []).map((c) => (Array.isArray(c) ? c : (c.verses || []).slice().sort((x, y) => x.verse - y.verse).map((v) => (v.text || '').trim()))));
    if (!books || books.length !== 66) throw new Error('This file does not look like a 66-book Bible (found ' + (books ? books.length : 0) + ' books).');
    const label = name || (raw && raw.translation) || version || 'Imported Bible';
    return { version: String(version || (label.match(/^[A-Za-z0-9]{2,6}/) || ['NEW'])[0]).toUpperCase(), name: label, books: books.map((chs, i) => ({ name: NAMES[i], chapters: chs.map((c) => c.map((t) => String(t).replace(/\s+/g, ' ').trim())) })) };
  }
  function fromText(text, filename, Parser) {
    const s = String(text).replace(/^\uFEFF/, '').replace(/^\s+/, '');
    if (s[0] === '<') return fromXml(s, filename, Parser);
    if (s[0] === '{' || s[0] === '[') {
      const b = normalize(JSON.parse(s), guessCode(filename), null); b.format = 'JSON'; b.stats = summarize(b.books); return b;
    }
    throw new Error('Unknown file type. Use an XML or JSON Bible file.');
  }
  const api = { fromText, fromXml, normalize, nameToIndex, guessCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BibleImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
