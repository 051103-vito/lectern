// Bible reference logic. Pure functions, no DOM, so it can be tested in Node.
(function (root) {
  const NAMES = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];

  // Where the first letters are not enough, or a common short form exists.
  const ALIASES = {
    jud: 'Judges', phi: 'Philippians', phil: 'Philippians', php: 'Philippians', phm: 'Philemon',
    ps: 'Psalms', psa: 'Psalms', pss: 'Psalms', prv: 'Proverbs', son: 'Song of Solomon', sos: 'Song of Solomon',
    mt: 'Matthew', mk: 'Mark', lk: 'Luke', jn: 'John', jas: 'James',
    '1jn': '1 John', '2jn': '2 John', '3jn': '3 John', '1sam': '1 Samuel', '2sam': '2 Samuel'
  };

  const keyOf = (name) => name.toLowerCase().replace(/\s+/g, '');

  // "gen 1:1-3", "1jo 2:3", "exo", "GEN1:1"  ->  candidates + chapter/verse numbers
  function parse(input) {
    const s = String(input || '').toLowerCase().trim();
    const m = s.match(/^([1-3]?)\s*([a-z]+)\.?\s*(?:(\d+)(?:(?:\s*[:.]\s*|\s+)(\d*)(?:\s*[-\u2013]\s*(\d*))?)?)?\s*$/);
    if (!m) return { ok: false, candidates: [] };
    const key = m[1] + m[2];
    let candidates;
    if (ALIASES[key]) candidates = [ALIASES[key]];
    else {
      const exact = NAMES.filter((n) => keyOf(n) === key);
      candidates = exact.length ? exact : NAMES.filter((n) => keyOf(n).startsWith(key));
    }
    if (!candidates.length) return { ok: false, candidates: [] };
    return {
      ok: true,
      candidates,
      chapter: m[3] ? parseInt(m[3], 10) : null,
      verse: m[4] ? parseInt(m[4], 10) : null,
      verseEnd: m[5] ? parseInt(m[5], 10) : null
    };
  }

  // 0 = typing the book, 1 = chapter, 2 = verse
  function stage(v) {
    const r = parse(v);
    if (!r.ok) return 0;
    if (r.verse !== null || (r.chapter !== null && /[:.\s]$/.test(v))) return 2;
    if (r.chapter !== null || /\s$/.test(v)) return 1;
    return 0;
  }

  // Auto-complete: what to show in the box, and where the completed part starts
  // (that part is selected, so typing the next letter simply replaces it).
  function complete(typed, name) {
    const t = typed.replace(/\s+/g, '').toLowerCase();
    if (!keyOf(name).startsWith(t)) return { text: name, selStart: name.length };
    let count = 0, i = 0;
    while (i < name.length && count < t.length) { if (!/\s/.test(name[i])) count++; i++; }
    return { text: name, selStart: i };
  }

  const bookIndex = (name) => NAMES.indexOf(name);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function formatRef(name, ch, v1, v2) {
    return name + ' ' + ch + ':' + v1 + (v2 && v2 !== v1 ? '-' + v2 : '');
  }

  // Bigger text for short passages, smaller for long ones (1920x1080 canvas).
  function fitSize(text) {
    const n = text.length;
    if (n <= 110) return 100;
    if (n <= 220) return 84;
    if (n <= 360) return 70;
    if (n <= 520) return 58;
    if (n <= 760) return 48;
    return 40;
  }

  const api = { NAMES, parse, stage, complete, bookIndex, clamp, formatRef, fitSize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BibleLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
