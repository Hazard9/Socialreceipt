const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadEngine } = require('./helpers/receipt-engine');
const engine = loadEngine();
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

/* Corpus: the 7 posted-video packet drafts + the 10 concept drafts. */
const packet = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/posted-video-packet.json'), 'utf8'));
const concepts = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/concept-patterns.json'), 'utf8'));
const conceptSettings = { scenario: 'Text / DM', format: 'Text / DM', feeling: 'Unsure', desiredOutcome: 'Get clarity' };
const corpus = [];
for (const c of packet.cases) corpus.push({ id: 'packet:' + c.id, draft: c.draft, settings: c.settings });
for (const c of concepts) corpus.push({ id: 'concept:' + c.id, draft: c.draft, settings: conceptSettings });

const WEIGHTED_FLAGS = ['conflict', 'silence', 'overExplain', 'highIntent', 'delay', 'apology', 'oneWord', 'positive', 'professional', 'romantic', 'sales'];
function flagCount(a) {
  let n = WEIGHTED_FLAGS.filter(k => a[k]).length;
  if (a.qMarks > 0) n++;
  if (a.exclaims > 0) n++;
  if (a.length > 20) n++;
  return n;
}

const scores = new Map();
let zeroSignalChecked = 0, multiSignalChecked = 0;
for (const item of corpus) {
  const a = engine.analyze(item.draft);
  const r = engine.build(item.draft, item.settings);
  scores.set(item.id, r.confidence);
  assert(r.confidence >= 3 && r.confidence <= 95, `${item.id}: confidence ${r.confidence} outside [3, 95]`);
  const flags = flagCount(a);
  if (flags === 0) { zeroSignalChecked++; assert(r.confidence <= 20, `${item.id}: zero-signal draft scored ${r.confidence}, must be <= 20`); }
  if (flags >= 3) { multiSignalChecked++; assert(r.confidence >= 55, `${item.id}: multi-signal draft (${flags} flags) scored ${r.confidence}, must be >= 55`); }
}
const distinct = new Set(scores.values());
assert(distinct.size >= 6, `gauge spread too flat: only ${distinct.size} distinct values across the corpus (${[...distinct].join(', ')})`);
assert(zeroSignalChecked >= 1, 'corpus must contain a zero-signal draft for the <= 20 check');
assert(multiSignalChecked >= 1, 'corpus must contain a multi-signal draft for the >= 55 check');
console.log(`ok: honest gauge spread — ${distinct.size} distinct values across ${corpus.length} corpus drafts (${[...distinct].sort((x, y) => x - y).join(', ')}); zero-signal <= 20 (n=${zeroSignalChecked}); multi-signal >= 55 (n=${multiSignalChecked})`);

/* The self-picked feeling is not evidence: it must never move the score. */
const draft6 = packet.cases[0];
const confUnsure = engine.build(draft6.draft, { ...draft6.settings, feeling: 'Unsure' }).confidence;
const confAnxious = engine.build(draft6.draft, { ...draft6.settings, feeling: 'Anxious' }).confidence;
const confGood = engine.build(draft6.draft, { ...draft6.settings, feeling: 'Good' }).confidence;
assert.equal(confUnsure, confAnxious, 'feeling (Anxious) must not inflate confidence');
assert.equal(confUnsure, confGood, 'feeling (Good) must not change confidence');
console.log('ok: confidence is wording-only — the picked feeling does not move it');

/* Banned mind-reading assertions: gone from app copy and from engine output. */
const BANNED = ['chose not to respond', 'they read the message'];
for (const file of ['index.html', 'presend-analysis.js', 'draft-guidance.js', 'deep-layers.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').toLowerCase();
  for (const phrase of BANNED) assert(!src.includes(phrase), `${file} still contains banned assertion: "${phrase}"`);
}
for (const item of corpus) {
  const r = engine.build(item.draft, item.settings);
  const blob = JSON.stringify(r).toLowerCase();
  for (const phrase of BANNED) assert(!blob.includes(phrase), `${item.id}: receipt output contains banned assertion: "${phrase}"`);
}
console.log('ok: banned mind-reading phrases absent from app copy and corpus receipts');

/* The confidence note states its basis in plain words at every band. */
const noteStart = html.indexOf('function getConfidenceNote(');
const noteEnd = html.indexOf('\nfunction ', noteStart + 10);
const noteSandbox = {};
vm.createContext(noteSandbox);
vm.runInContext(html.slice(noteStart, noteEnd < 0 ? undefined : noteEnd), noteSandbox);
for (const v of [3, 33, 56, 67, 95]) {
  assert(noteSandbox.getConfidenceNote(v).includes('Based on how much of your wording this read could match.'), `confidence note at ${v} must state its basis`);
}
console.log('ok: confidence note states the wording basis at every band');
