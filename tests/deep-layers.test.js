const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const deep = require('../deep-layers.js');

/* ── Layer 3: state mapping for the main combinations ── */
assert.equal(deep.stateFor('Anxious', { silence: true }).label, 'Waiting in the silence');
assert.equal(deep.stateFor('Anxious', { apology: true }, 'Repeated apology seeking reassurance').label, 'Apologising to stop the panic');
assert.equal(deep.stateFor('Anxious', {}, 'Repeated apology seeking reassurance').label, 'Apologising to stop the panic');
assert.equal(deep.stateFor('Annoyed', { conflict: true }).label, 'Activated');
assert.equal(deep.stateFor('Rejected', {}).label, 'Sending to undo a feeling');
assert.equal(deep.stateFor('Rejected', { silence: true }).label, 'Sending to undo a feeling');
assert.equal(deep.stateFor('Unsure', { highIntent: true }).label, 'Reaching for certainty');
assert.equal(deep.stateFor('Good', { positive: true }).label, 'Settled');
assert.equal(deep.stateFor('Confused', {}).label, 'Drafting through fog');
assert.equal(deep.stateFor('Unsure', {}).label, 'Half-formed');
for (const combo of [['Anxious', { silence: true }], ['Annoyed', { conflict: true }], ['Rejected', {}], ['Unsure', { highIntent: true }], ['Good', { positive: true }]]) {
  const s = deep.stateFor(combo[0], combo[1]);
  assert(s.label && s.line, 'state mapping returns label + line for ' + combo[0]);
}
assert.equal(deep.HONESTY_LINE, 'This read can only see the words and the state you picked. It cannot know what they are thinking.');
console.log('ok: deep layer 3 state mapping (main combinations + feeling fallbacks)');

/* ── Layer 4: chip sets per scenario ── */
for (const scenario of ['Date', 'Work', 'Friend / Family', 'Conflict', 'Text / DM']) {
  const chips = deep.fearChipsFor(scenario);
  assert.equal(chips.length, 4, scenario + ': exactly 4 fear chips');
  assert.equal(new Set(chips.map(c => c.label)).size, 4, scenario + ': chip labels unique');
  for (const chip of chips) {
    assert(chip.label && chip.question, scenario + ': chip carries label + question fragment');
    assert.equal(deep.fearSentence(chip), 'So the real question under this draft is ' + chip.question + '.');
  }
}
assert.deepEqual(deep.fearChipsFor('Sales / Client'), deep.fearChipsFor('Text / DM'), 'unlisted scenarios fall back to the Text / DM chip set');
assert.equal(deep.FEAR_QUESTION, 'What are you most afraid happens if this just sits?');
console.log('ok: deep layer 4 fear chips per scenario + name-back sentence');

/* ── Layer 5: counting with a fake clock/store ── */
const DAY = 86400000;
function ts(y, mo, d, h, mi) { return new Date(y, mo, d, h, mi || 0, 0).getTime(); }
const now = ts(2026, 9, 17, 14, 0);
const entry = { pattern: 'pattern:Repeated apology seeking reassurance', label: 'Repeated apology seeking reassurance', scenario: 'Date', draft: "Sorry again. Please tell me you're not still mad." };
let hist = [];
hist = deep.recordPattern(hist, entry, now);
assert.equal(hist.length, 1, 'first draft recorded');
hist = deep.recordPattern(hist, entry, now + 5 * 60000);
assert.equal(hist.length, 1, 'same draft within 10 minutes is deduped');
hist = deep.recordPattern(hist, entry, now + 11 * 60000);
hist = deep.recordPattern(hist, entry, now + 22 * 60000);
assert.equal(hist.length, 3, 'same draft after the dedupe window counts again');
assert.equal(deep.patternSummary(hist, entry.pattern, now + 22 * 60000).count30, 3, 'count of this pattern in the last 30 days');
const oldOnly = deep.recordPattern([], entry, now - 40 * DAY);
assert.equal(deep.patternSummary(oldOnly, entry.pattern, now).count30, 0, 'entries older than 30 days do not count');
assert.equal(deep.patternSummary(hist, 'pattern:Something else', now).count30, 0, 'other patterns do not count');
let late = [];
late = deep.recordPattern(late, { ...entry, draft: 'unique draft one' }, ts(2026, 9, 16, 23, 30));
late = deep.recordPattern(late, { ...entry, draft: 'unique draft two' }, ts(2026, 9, 17, 1, 15));
late = deep.recordPattern(late, { ...entry, draft: 'unique draft three' }, ts(2026, 9, 15, 4, 59));
const lateSum = deep.patternSummary(late, entry.pattern, ts(2026, 9, 17, 12, 0));
assert.equal(lateSum.lateCount7, 3, 'three drafts between 23:00 and 05:00 in the last 7 days');
assert.equal(lateSum.lateNight, true, 'late-night note fires at 3+');
assert.equal(deep.patternSummary(late.slice(0, 2), entry.pattern, ts(2026, 9, 17, 12, 0)).lateNight, false, 'late-night note stays off below 3');
console.log('ok: deep layer 5 pattern counting, dedupe window, 30-day count, late-night rule');

/* ── Layer 6: possibility framing tied to detected wording ── */
const reads = deep.dynamicReadsFor('apology', deep.becauseFor({ apology: true }, null));
assert.equal(reads.length, 3, 'three reads');
for (const r of reads) assert(r.text.includes('could land as'), 'every read is framed as a possibility: ' + r.text);
assert(reads[0].text.includes('the repeated apology'), 'because is tied to detected wording');
const evidenceReads = deep.dynamicReadsFor('conflict', deep.becauseFor({}, { evidence: ['you never'] }));
assert(evidenceReads[0].text.includes('\u201Cyou never\u201D'), 'pattern evidence wording is quoted in the because');
console.log('ok: deep layer 6 three possibility reads with wording-tied because');

/* ── Layer 7: rewrite contains a verbatim fragment of the draft ── */
function hasVerbatimFragment(output, draft) {
  const words = String(draft).split(/\s+/);
  for (let i = 0; i + 4 <= words.length; i++) {
    if (output.indexOf(words.slice(i, i + 4).join(' ')) !== -1) return true;
  }
  return false;
}
const drafts = [
  'I just wanted to explain what happened last night because I know this is a lot. Can we please talk tonight when you get home?',
  'Sorry, I was late to the meeting this morning. I will send the full report by noon tomorrow.',
  'Did I do something wrong, or are you ignoring me? I keep checking my phone every five minutes.',
  'You never listen to me. You only care when something affects you, and I am done repeating myself.',
  'Hey, no rush at all. Just making sure my last message did not get lost in the shuffle somewhere.'
];
for (const draft of drafts) {
  for (const stance of deep.STANCES) {
    const out = deep.composeRewrite(draft, stance);
    assert(out && out.length > 0, 'rewrite produced for stance ' + stance);
    assert(hasVerbatimFragment(out, draft), 'rewrite for "' + stance + '" must contain a verbatim 4+ word fragment of the draft. Got: ' + out);
  }
}
assert.equal(deep.REWRITE_LABEL, 'A starting point built from your words. Edit it freely.');
console.log('ok: deep layer 7 verbatim-fragment rewrites across 5 drafts x 4 stances');

/* ── index.html integration: attach, Pro gating, packet regression ── */
function fakeStorage() {
  const data = {};
  return {
    getItem: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}
function loadDeepPage() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const storage = fakeStorage();
  const sandbox = {
    state: { scenario: 'Text / DM', format: 'Text / DM', feeling: 'Unsure', desiredOutcome: 'Get clarity', currentReceipt: null },
    window: { SocialReceiptAnalysis: require('../presend-analysis'), SocialReceiptGuidance: require('../draft-guidance'), SocialReceiptDeep: deep },
    document: { getElementById: () => null },
    localStorage: storage,
    getCurrentUser: () => ({ anonId: 'test-user', email: null }),
    getReceipts: () => [],
    trackEvent: () => {}
  };
  vm.createContext(sandbox);
  const names = ['includesAny', 'analyzeText', 'computeConfidence', 'buildWhySignals', 'getVerdict', 'makeReceipt', 'escapeHtml', 'readReceiptPatternContext', 'addReceiptPattern', 'buildReceipt', 'isPro', 'loadPatternHistory', 'savePatternHistory', 'attachDeepLayers', 'deepStateCardHtml', 'deepLayersHtml', 'deepSectionInner'];
  for (const name of names) {
    const start = html.indexOf('function ' + name + '(');
    assert(start >= 0, 'index.html defines ' + name);
    const next = html.indexOf('\nfunction ', start + 10);
    vm.runInContext(html.slice(start, next < 0 ? undefined : next), sandbox);
  }
  return { sandbox, storage };
}
const page = loadDeepPage();
const sb = page.sandbox;

/* Layer 3 card + locked deep section for non-Pro */
Object.assign(sb.state, { scenario: 'Date', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Get clarity' });
const receipt = sb.buildReceipt("Sorry again. Please tell me you're not still mad at me.");
sb.attachDeepLayers(receipt, true);
assert(receipt.deep, 'deep state attached');
assert.equal(receipt.deep.stateLabel, 'Apologising to stop the panic');
assert(!Object.prototype.hasOwnProperty.call(receipt, 'guidance'), 'guidance is never attached');
const history = JSON.parse(page.storage.getItem('sr_pattern_history_v1') || '[]');
assert.equal(history.length, 1, 'pattern history recorded on-device under sr_pattern_history_v1');
assert.equal(history[0].pattern, receipt.deep.patternKey);
const stateCard = sb.deepStateCardHtml(receipt);
assert(stateCard.includes('The state that wrote this') && stateCard.includes(deep.HONESTY_LINE), 'layer 3 card carries the label and the honesty line');
const locked = sb.deepLayersHtml(receipt);
assert(locked.includes('Peel a layer') && locked.includes('openPaywall'), 'non-Pro sees the steps with the existing paywall action');
assert(!locked.includes('deepChooseFear('), 'non-Pro does not get active deep steps');

/* Pro unlocks the steps */
page.storage.setItem('sr_pro', '1');
const pro = sb.deepLayersHtml(receipt);
assert(pro.includes('deepChooseFear('), 'Pro sees the layer 4 chips');
assert(pro.includes(deep.FEAR_QUESTION), 'Pro sees the fear question');
assert(pro.includes('Layer 5'), 'Pro sees layer 5 in the sequence');
console.log('ok: deep attach, layer 3 card, Pro gating (locked for free, open for Pro), on-device history');

/* Regression: the seven packet receipts are unchanged with deep attached */
const packet = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/posted-video-packet.json'), 'utf8'));
for (const item of packet.cases) {
  Object.assign(sb.state, item.settings);
  const live = sb.buildReceipt(item.draft, item.context || {});
  sb.attachDeepLayers(live, true);
  const actual = JSON.parse(JSON.stringify(live));
  for (const field of packet.fields) {
    assert.deepEqual(actual[field], item.expected[field], item.id + ': ' + field + ' unchanged with deep data attached');
  }
  assert(!Object.prototype.hasOwnProperty.call(actual, 'guidance'), item.id + ': guidance must not be attached');
  assert(actual.deep && actual.deep.stateLabel, item.id + ': deep state attached');
}
console.log('ok: deep regression — seven packet receipts x 14 fields unchanged with deep attached');

/* Static wiring: module is loaded by the page and precached */
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="/deep-layers.js"></script>'), 'index.html loads /deep-layers.js');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert(sw.includes('"/deep-layers.js"'), 'service worker precaches /deep-layers.js');
console.log('ok: deep layers module wiring (script tag + precache)');
