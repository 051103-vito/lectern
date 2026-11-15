const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
const B = require(root + '/bible.js'), S = require(root + '/search.js'), P = require(root + '/songparse.js'), { createStore, decodeText } = require(root + '/store.js'), { normalize } = require(root + '/bible-import.js');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

// ---- Bible references ----
const one = (s) => { const r = B.parse(s); assert(r.ok, s); return r; };
eq(one('gen').candidates, ['Genesis']); eq(one('exo').candidates, ['Exodus']); eq(one('GEN1:1').candidates, ['Genesis']);
let r = one('gen 1:1-3'); eq([r.chapter, r.verse, r.verseEnd], [1, 1, 3]);
eq(one('1jo 2:3').candidates, ['1 John']); eq(one('jud').candidates, ['Judges']); eq(one('jude').candidates, ['Jude']);
eq(one('phi').candidates, ['Philippians']); eq(one('phm').candidates, ['Philemon']); eq(one('mt').candidates, ['Matthew']);
ok(one('jo').candidates.length === 5, 'jo is ambiguous');
for (const name of B.NAMES) { const k = name.toLowerCase().replace(/\s+/g, ''), typed = { Philemon: 'phm', Jude: 'jude' }[name] || k.slice(0, 3); ok(B.parse(typed).candidates.includes(name), typed + ' reaches ' + name); }
eq([B.stage('gen'), B.stage('gen '), B.stage('Genesis 1'), B.stage('gen 1:'), B.stage('gen 1:1')], [0, 1, 1, 2, 2]);

// ---- Bible data ----
const kjv = JSON.parse(fs.readFileSync(root + '/data/kjv.json', 'utf8')), asv = JSON.parse(fs.readFileSync(root + '/data/asv.json', 'utf8'));
for (const b of [kjv, asv]) { eq(b.books.length, 66); eq(b.books.reduce((a, x) => a + x.chapters.reduce((y, c) => y + c.length, 0), 0), 31102, b.version + ' verse count'); }
eq(kjv.books.map((b) => b.name), B.NAMES); ok(kjv.books[B.bookIndex('John')].chapters[2][15].startsWith('For God so loved the'));
ok(!fs.existsSync(root + '/data/bbe.json'), 'BBE is not bundled');
const web = JSON.parse(fs.readFileSync(root + '/data/web.json', 'utf8')); eq(web.version, 'WEB'); eq(web.books.length, 66); eq(web.books.map((b) => b.name), B.NAMES);
ok(web.books[B.bookIndex('John')].chapters[2][15].startsWith('For God so loved the world'), 'WEB John 3:16');
ok(web.books.every((b) => b.chapters.length > 0 && b.chapters.every((c) => c.length > 0)), 'WEB has no empty chapters');
// importer
const sm = { translation: 'Test Version', books: kjv.books.map((b) => ({ name: b.name, chapters: b.chapters.map((c, i) => ({ chapter: i + 1, verses: c.map((t, j) => ({ verse: j + 1, text: t })) })) })) };
const imp = normalize(sm, 'tst', 'Test Version'); eq(imp.version, 'TST'); eq(imp.books[0].chapters[0][0], kjv.books[0].chapters[0][0]);
const thi = normalize(kjv.books.map((b) => ({ abbrev: 'x', chapters: b.chapters })), 'XYZ', 'X'); eq(thi.books.length, 66);
assert.throws(() => normalize({ books: [] }, 'A', 'a')); n++;

// ---- importing Bible XML in every layout ----
const { JSDOM } = require('jsdom'); const DP = new JSDOM('').window.DOMParser; const BI = require(root + '/bible-import.js');
const fx = (f) => fs.readFileSync(root + '/test/fixtures/' + f, 'utf8'); const verse = (r, name, c, v) => r.books[B.bookIndex(name)].chapters[c - 1][v - 1];
let x = BI.fromText(fx('zefania.xml'), 'zefania.xml', DP);
eq([x.format, x.version, x.name, x.stats.books, x.stats.verses], ['Zefania XML', 'TZF', 'Test Zefania Bible', 2, 3]); eq(verse(x, 'Genesis', 1, 1), 'In the beginning God created the heaven and the earth.', 'notes skipped, styled words kept'); ok(x.stats.missing.length === 64, 'missing books are reported');
x = BI.fromText(fx('opensong.xml'), 'opensong.xml', DP); eq([x.format, x.stats.books], ['OpenSong XML', 4]); eq(verse(x, '1 John', 4, 8), 'He that loveth not knoweth not God; for God is love.', 'I John is read as 1 John'); ok(verse(x, 'Song of Solomon', 2, 1).startsWith('I am the rose') && verse(x, 'Revelation', 22, 21).startsWith('The grace'), 'other book names');
x = BI.fromText(fx('beblia.xml'), 'beblia.xml', DP); eq([x.format, x.name, x.stats.verses], ['Holy Bible XML', 'Test Holy Bible XML', 3]); eq(verse(x, 'John', 3, 17), 'For God sent not his Son.');
x = BI.fromText(fx('osis-container.xml'), 'osis-container.xml', DP); eq([x.format, x.version, x.name, x.stats.books], ['OSIS XML', 'TOC', 'Test OSIS Container', 2]); eq(verse(x, 'John', 3, 16), 'For God so loved the world.', 'OSIS note and heading skipped');
x = BI.fromText(fx('osis-milestone.xml'), 'osis-milestone.xml', DP); eq(verse(x, 'Psalms', 23, 1), 'The LORD is my shepherd; I shall not want.', 'OSIS milestone verses'); eq(verse(x, 'Psalms', 23, 2), 'He maketh me to lie down in green pastures.');
x = BI.fromText(fx('usfx.xml'), 'eng-test.usfx.xml', DP); eq([x.format, x.version, x.stats.books], ['USFX XML', 'TEST', 2]); eq(verse(x, 'John', 3, 16), 'For God so loved the world, that he gave', 'USFX footnote skipped'); eq(verse(x, 'John', 3, 17), 'For God did not send his Son.'); eq(verse(x, 'John', 3, 18), 'These two verses share a line.', 'verse range starts at its first number'); eq(verse(x, 'Psalms', 23, 1), 'Yahweh is my shepherd.', 'psalm title is not part of verse 1'); ok(!JSON.stringify(x.books).includes('preface'), 'front matter ignored');
assert.throws(() => BI.fromText('<root><x/></root>', 'a.xml', DP), /not one the program knows/); n++; assert.throws(() => BI.fromText('<xmlbible>', 'a.xml', DP), /could not be read/); n++; assert.throws(() => BI.fromText('hello', 'a.txt', DP), /Unknown file type/); n++;
x = BI.fromText(JSON.stringify({ translation: 'Json Test', books: sm.books }), 'json-test.json', DP); eq([x.format, x.stats.books, x.version], ['JSON', 66, 'JSONTE']);
eq(BI.guessCode('eng-web.usfx.xml'), 'WEB'); eq(BI.guessCode('C:\\Bibles\\NIV 2011.xml'), 'NIV201');

// ---- meaning search ----
const th = JSON.parse(fs.readFileSync(root + '/lang/thesaurus.json', 'utf8'));
const eng = S.create({ KJV: kjv, ASV: asv }, ['KJV', 'ASV'], th);
const rank = (q, ref) => eng.search(q, 'All', 60).results.findIndex((x) => B.NAMES[x.bi] + ' ' + x.ch + ':' + x.vs === ref) + 1;
eq(rank('God so loved the world', 'John 3:16'), 1);
ok(rank('God cared so much about humanity that he gave his only child', 'John 3:16') >= 1 && rank('God cared so much about humanity that he gave his only child', 'John 3:16') <= 5, 'paraphrase John 3:16');
ok(rank('dont worry about tomorrow', 'Matthew 6:34') >= 1 && rank('dont worry about tomorrow', 'Matthew 6:34') <= 3, 'paraphrase Matthew 6:34');
ok(rank('everything works out for good for those who love God', 'Romans 8:28') >= 1 && rank('everything works out for good for those who love God', 'Romans 8:28') <= 3);
eq(S.stem('cried'), S.stem('cry')); eq(S.stem('loveth'), S.stem('loved'));

// ---- songs ----
const sample = (f) => fs.readFileSync(root + '/samples/' + f, 'utf8');
let a = P.parse(sample('amazing-grace.txt'), { filename: 'amazing-grace.txt' })[0];
eq([a.title, a.author, a.copyright], ['Amazing Grace', 'John Newton', 'Public Domain']); eq(a.sections.map((s) => s.label), ['Verse 1', 'Verse 2', 'Verse 3']);
a = P.parse(sample('blessed-assurance-unlabelled.txt'))[0];
eq(a.sections.map((s) => s.label), ['Verse 1', 'Chorus', 'Verse 2']); eq(a.order.map((id) => a.sections.find((s) => s.id === id).label), ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
a = P.parse(sample('holy-holy-holy-chords.txt'))[0]; eq(a.title, 'Holy, Holy, Holy'); ok(a.sections.every((s) => s.lines.every((l) => !/^[A-G]\s/.test(l))), 'chord lines removed'); eq(a.sections[0].lines.length, 4);
a = P.parse(sample('chorus-once.txt'))[0]; eq(a.order.map((id) => a.sections.find((s) => s.id === id).label), ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 3', 'Chorus']);
const multi = P.parse(sample('several-songs.txt')); eq(multi.map((s) => s.title), ['Song One', 'Song Two']);
ok(P.isChordLine('G  D  Em  C') && !P.isChordLine('A') && !P.isChordLine('Amazing grace how sweet'), 'chord detection');
// repeat markers and numbered stanzas, curly quotes, windows line endings
a = P.parse('Title: Test\r\n\r\nVerse 1\r\nOne two three four\r\nFive six seven eight\r\n\r\nChorus x2\r\nSing it out loud\r\nSing it again\r\n')[0];
eq(a.order.map((id) => a.sections.find((s) => s.id === id).label), ['Verse 1', 'Chorus', 'Chorus']);
// slides: even splitting
const longSec = { title: 't', sections: [{ id: 's1', label: 'Verse 1', type: 'verse', lines: ['a', 'b', 'c', 'd', 'e', 'f'] }], order: ['s1'] };
eq(P.slidesOf(longSec, { lines: 4 }).map((s) => s.text.split('\n').length), [3, 3], 'six lines at four per slide split 3+3');
eq(P.slidesOf(longSec, { lines: 2 }).length, 3);
// format then parse gives the same song back
const rt = P.parse(P.format(a))[0]; eq(rt.title, a.title); eq(rt.order.length, a.order.length);

// ---- storage and crash detection ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lect-')); const st = createStore(dir);
st.set('settings', { a: 1 }); eq(st.get('settings'), { a: 1 }); eq(st.get('nothing', 5), 5);
st.set('settings', { a: 2 }); fs.writeFileSync(path.join(dir, 'settings.json'), '{broken'); eq(st.get('settings'), { a: 1 }, 'damaged file falls back to the previous copy');
let b1 = st.begin(); eq(b1.crashed, false); st.set('session', { queue: [1, 2], program: { mode: 'text' } });
const st2 = createStore(dir); b1 = st2.begin(); eq(b1.crashed, true, 'flag left behind means an unexpected close'); eq(b1.snapshot.queue, [1, 2]);
st2.end(); eq(createStore(dir).begin().crashed, false, 'clean exit leaves no flag');
eq(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x41])), 'A'); eq(decodeText(Buffer.from([0xff, 0xfe, 0x41, 0x00])), 'A'); eq(decodeText(Buffer.from([0x63, 0x61, 0x66, 0xe9])), 'caf\u00e9', 'Windows-1252 text');
fs.rmSync(dir, { recursive: true, force: true });
console.log('logic tests passed: ' + n + ' checks');
