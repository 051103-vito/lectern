"""Rebuilds lang/thesaurus.json from WordNet plus tools/curated-groups.txt.
Needs:  pip install nltk   and   python -c "import nltk; nltk.download('wordnet')"
Run from the repo root:  python tools/build-thesaurus.py
WordNet synonyms are kept only when the synonym occurs in a bundled Bible text."""
import json, re, glob
from nltk.corpus import wordnet as wn
V = set()
for f in glob.glob('data/*.json'):
    for b in json.load(open(f, encoding='utf-8'))['books']:
        for c in b['chapters']:
            for v in c: V.update(re.findall(r"[a-z]+", v.lower()))
has = lambda l: l in V or any((l + s) in V for s in ('s', 'es', 'd', 'ed', 'ing', 'eth', 'est', 'er', 'ly')) or (l.endswith('e') and (l[:-1] + 'ing') in V) or (l.endswith('y') and (l[:-1] + 'ied') in V)
wnmap = {}
for l in (x for x in wn.all_lemma_names() if re.fullmatch(r'[a-z]{3,}', x)):
    out = []
    for s in wn.synsets(l)[:3]:
        for m in s.lemma_names():
            if m != l and re.fullmatch(r'[a-z]{3,}', m) and has(m) and m not in out: out.append(m)
    if out: wnmap[l] = out[:10]
groups = [list(dict.fromkeys(l.split())) for l in open('tools/curated-groups.txt') if l.strip()]
json.dump({'note': 'WordNet 3.0 (Princeton University) synonyms limited to words found in the bundled Bibles; plus hand-made groups.', 'curated': groups, 'wordnet': wnmap}, open('lang/thesaurus.json', 'w'), separators=(',', ':'))
print('groups', len(groups), 'wordnet keys', len(wnmap))
