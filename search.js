// Search by meaning. Works offline. A pastor may paraphrase ("God cared so much about
// the people of the earth"), so the words are matched by stem, by hand-made Bible
// paraphrase groups, and by WordNet synonyms, and verses are ranked by how well they fit.
(function (root) {
  const STOP = new Set(('a an the and or of to in on at by for with from as is are was were be been being am it its this that these those ' +
    'he him his she her they them their i me my we us our you your thou thee thy thine ye unto upon not no but if then so than up out into over ' +
    'very can could would should may might will shall do does did doth hath has have had what who whom which when where how why there here also too ' +
    'dont doesnt didnt cant wont isnt arent wasnt about just really actually kind sort lot much such after like').split(' '));
  const IRR = { said: 'say', says: 'say', saith: 'say', came: 'come', gave: 'give', given: 'give', went: 'go', gone: 'go', saw: 'see', seen: 'see',
    took: 'take', taken: 'take', made: 'make', spake: 'speak', spoke: 'speak', spoken: 'speak', begat: 'beget', knew: 'know', known: 'know',
    ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall', rose: 'rise', risen: 'rise', wrote: 'write', written: 'write', sent: 'send',
    told: 'tell', heard: 'hear', found: 'find', left: 'leave', brought: 'bring', forgave: 'forgive', forgiven: 'forgive', bore: 'bear', born: 'bear',
    thou: 'you', thee: 'you', ye: 'you', yours: 'your', thy: 'your', thine: 'your', hath: 'have', hast: 'have', has: 'have', had: 'have',
    doth: 'do', dost: 'do', does: 'do', men: 'man', women: 'woman', children: 'child', lives: 'life', wept: 'weep', slept: 'sleep', kept: 'keep',
    felt: 'feel', meant: 'mean', led: 'lead', taught: 'teach', caught: 'catch', sought: 'seek', stood: 'stand', sat: 'sit', ran: 'run', lost: 'lose', paid: 'pay',
    laid: 'lay', began: 'begin', grew: 'grow', drew: 'draw', sang: 'sing', drank: 'drink', hid: 'hide', held: 'hold', built: 'build', sold: 'sell', fought: 'fight',
    slain: 'slay', slew: 'slay', arose: 'arise', beheld: 'behold', smote: 'smite' };

  function stem(word) {
    let w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (IRR[w]) w = IRR[w];
    if (w.length <= 3) return w;
    const rules = [['ies', 'y'], ['ied', 'y'], ['ness', ''], ['ment', ''], ['ing', ''], ['eth', ''], ['est', ''], ['ed', ''], ['ly', ''], ['es', ''], ['s', '']];
    for (const [suf, rep] of rules) if (w.endsWith(suf) && w.length - suf.length >= (rep === 'y' ? 2 : 3)) { w = w.slice(0, -suf.length) + rep; break; }
    if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
    if (w.length > 3 && /(.)\1$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  const words = (text) => (String(text).toLowerCase().replace(/'/g, '').match(/[a-z]+/g) || []);
  const content = (text) => words(text).filter((w) => !STOP.has(w));

  function create(bibles, order, thesaurus) {
    const docs = [], post = new Map();
    let built = false;
    const th = thesaurus || { curated: [], wordnet: {} };

    // stem -> related stems from the hand-made groups
    const related = new Map();
    for (const g of th.curated) {
      const st = [...new Set(g.map(stem))];
      for (const a of st) { if (!related.has(a)) related.set(a, new Set()); for (const b of st) if (b !== a) related.get(a).add(b); }
    }
    const wnKeys = th.wordnet;
    function wnLookup(w) {
      const c = [w, w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/d$/, ''), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')];
      for (const k of c) if (wnKeys[k]) return wnKeys[k];
      return [];
    }

    function build() {
      if (built) return; built = true;
      order.forEach((id) => bibles[id].books.forEach((b, bi) => b.chapters.forEach((c, ci) => c.forEach((t, vi) => {
        const idx = docs.length, ws = words(t);
        docs.push({ v: id, bi, ch: ci + 1, vs: vi + 1, t, n: ws.length });
        const seen = new Set();
        for (const w of ws) { if (STOP.has(w)) continue; const s = stem(w); if (seen.has(s)) continue; seen.add(s); let a = post.get(s); if (!a) post.set(s, a = []); a.push(idx); }
      }))));
    }

    // One query word -> every stem that can stand for it, with a weight.
    function expand(w) {
      const s = stem(w), m = new Map([[s, 1]]);
      for (const r of related.get(s) || []) if (!m.has(r)) m.set(r, 0.65);
      for (const x of wnLookup(w).slice(0, 8)) { const xs = stem(x); if (!m.has(xs)) m.set(xs, 0.4); }
      return m;
    }

    function search(query, filter, limit) {
      build();
      limit = limit || 60;
      let ws = content(query);
      if (!ws.length) ws = words(query);
      const seenS = new Set(), terms = [];
      for (const w of ws) { const s = stem(w); if (!seenS.has(s)) { seenS.add(s); terms.push({ w, s, c: expand(w) }); } }
      const T = terms.length;
      if (!T) return { total: 0, results: [], hi: new Map() };
      const N = docs.length, acc = new Map(), hi = new Map();
      let wsum = 0;
      terms.forEach((t) => {
        const df = (post.get(t.s) || []).length;
        t.wt = Math.log(1 + N / (df + 5)); wsum += t.wt;
        const best = new Map();
        for (const [cs, wgt] of t.c) {
          if (!hi.has(cs) || hi.get(cs) < wgt) hi.set(cs, wgt);
          for (const d of post.get(cs) || []) { if (filter && filter !== 'All' && docs[d].v !== filter) continue; if ((best.get(d) || 0) < wgt) best.set(d, wgt); }
        }
        for (const [d, wgt] of best) { let a = acc.get(d); if (!a) acc.set(d, a = { s: 0, m: 0, ex: 0 }); a.s += wgt * t.wt; a.m++; if (wgt === 1) a.ex++; }
      });
      const need = T <= 2 ? T : Math.ceil(T * 0.4), q = String(query).trim().toLowerCase(), out = [];
      for (const [d, a] of acc) {
        if (a.m < need) continue;
        let sc = a.s / wsum + (a.m === T ? 0.15 : 0) - docs[d].n * 0.0008;
        if (sc < 0.3) continue;
        if (T > 1 && docs[d].t.toLowerCase().includes(q)) sc += 0.4;
        out.push({ d, sc, exact: a.ex === T });
      }
      out.sort((x, y) => y.sc - x.sc || x.d - y.d);
      return { total: out.length, hi, results: out.slice(0, limit).map((o) => Object.assign({ score: o.sc, exact: o.exact }, docs[o.d])) };
    }
    return { build, search, docs };
  }

  const api = { stem, words, content, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SearchLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
