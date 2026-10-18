const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

const SAMPLE_DRAFT = 'Sorry to bother you again, I know you are busy and it is probably nothing, but are we okay? I keep thinking I said something wrong.';

/* ── Static markup: sample card, gauge meter, sample tag, sharpen line ── */
assert(html.includes('id="sampleReadCard"'), 'home screen carries the sample card');
assert(html.includes('New here? See a sample read'), 'sample card heading present');
assert(html.includes('A sample draft, read by the same engine that reads yours.'), 'sample label copy present');
assert(html.includes('onclick="runSampleRead()"'), 'sample button wired to runSampleRead');
assert(html.includes('var SAMPLE_DRAFT_TEXT = "' + SAMPLE_DRAFT + '"'), 'the exact spec sample draft is the one the card runs');
assert(html.includes('receipt.sample = true'), 'sample receipt is tagged');
assert(html.includes('sample-tag'), 'receipt render carries a visible Sample tag');
assert(html.includes('currentReceipt.sample'), 'saveCurrentReceipt refuses sample receipts, so they never enter the journal');
console.log('ok: first-thirty — sample card, exact sample draft, tag, and journal guard present');

assert(html.includes('confidence-meter') && html.includes('confidence-tick'), 'confidence renders as a segmented meter');
assert(html.includes('role=\\"meter\\"') && html.includes('aria-valuenow'), 'meter exposes its value accessibly');
assert(html.includes('id=\\"confFill\\"'), 'existing fill animation target is preserved');
assert(html.includes('getConfidenceNote(receipt.confidence)'), 'the number and basis note still come from the untouched gauge path');
assert(sw.includes('social-receipt-v27-first-thirty'), 'service worker cache bumped for this build');
console.log('ok: first-thirty — gauge meter markup present alongside the untouched number and basis note; cache at v27');

assert(html.includes('function sharpenReadHints('), 'sharpen line helper exists');
assert(html.includes('What would sharpen this read'), 'sharpen line renders under that label');
console.log('ok: first-thirty — sharpen line wired into the receipt render');

/* ── Functional: run the real sample path in a sandbox ────────────────
   localStorage is instrumented: every setItem/removeItem is recorded,
   so the zero-writes claim is proven, not assumed. Deep layers attach
   exactly the way renderReceiptOutput attaches them (record = false). */
function loadPageFunctions(names, sandbox) {
  vm.createContext(sandbox);
  for (const name of names) {
    const start = html.indexOf('function ' + name + '(');
    assert(start >= 0, 'index.html defines ' + name);
    const next = html.indexOf('\nfunction ', start + 10);
    vm.runInContext(html.slice(start, next < 0 ? undefined : next), sandbox);
  }
  return sandbox;
}

const writes = [];
const store = {};
const localStorageStub = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { writes.push(['setItem', k]); store[k] = String(v); },
  removeItem: (k) => { writes.push(['removeItem', k]); delete store[k]; }
};
const deep = require('../deep-layers.js');
const sandbox = {
  console,
  state: { scenario: 'Work', format: 'Text / DM', feeling: 'Good', desiredOutcome: 'Say no clearly' },
  window: {
    SocialReceiptAnalysis: require('../presend-analysis.js'),
    SocialReceiptGuidance: require('../draft-guidance.js'),
    SocialReceiptDeep: deep
  },
  document: { getElementById: () => null },
  localStorage: localStorageStub,
  getCurrentUser: () => ({ anonId: 'test-user', email: null })
};
loadPageFunctions(['includesAny', 'escapeHtml', 'analyzeText', 'computeConfidence', 'buildWhySignals',
  'getVerdict', 'makeReceipt', 'readReceiptPatternContext', 'addReceiptPattern', 'buildReceipt',
  'freeMonthKey', 'getFreeUsed', 'loadPatternHistory', 'savePatternHistory', 'attachDeepLayers',
  'buildSampleReceipt', 'sharpenReadHints'], sandbox);
const vStart = html.indexOf('var SAMPLE_DRAFT_TEXT');
assert(vStart >= 0, 'SAMPLE_DRAFT_TEXT declared');
vm.runInContext(html.slice(vStart, html.indexOf(';', vStart) + 1), sandbox);

const usedBefore = sandbox.getFreeUsed();
const receipt = sandbox.buildSampleReceipt();
sandbox.attachDeepLayers(receipt, false);

assert.equal(writes.length, 0, 'sample path must create zero localStorage writes, saw: ' + JSON.stringify(writes));
assert.equal(sandbox.getFreeUsed(), usedBefore, 'sample must not move the free-read counter');
assert(!(deep.HISTORY_KEY in store), 'sample must not create pattern history');
assert.equal(receipt.sample, true, 'sample receipt carries the tag flag');
assert.equal(receipt.rawText, SAMPLE_DRAFT, 'sample runs the exact spec draft');
assert.deepEqual([receipt.scenario, receipt.feeling, receipt.desiredOutcome],
  ['Text / DM', 'Anxious', 'Get clarity'], 'sample uses the spec context');
assert.equal(receipt.verdict, 'Your read is anxious, not accurate. Wait 12 hours.');
assert.equal(receipt.confidence, 44, 'sample confidence is the real gauge output');
assert(receipt.deep && receipt.deep.stateLabel, 'deep state card attaches read-only, like a normal receipt');
assert.deepEqual([sandbox.state.scenario, sandbox.state.feeling, sandbox.state.desiredOutcome],
  ['Work', 'Good', 'Say no clearly'], "the visitor's own picks are restored after the sample build");
console.log('ok: first-thirty — sample read runs the real engine (verdict pinned, confidence 44), zero localStorage writes, free counter and pattern history untouched, picks restored');

/* ── Sharpen line: only true absences, derived from analyzeText fields ── */
assert.equal(sandbox.sharpenReadHints(receipt),
  'No timing words in this draft. No direct ask or stated need in this draft.',
  'sample sharpen line states exactly its two absent gauge inputs (delay, highIntent)');

Object.assign(sandbox.state, { scenario: 'Date', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Get clarity' });
const leftOnRead = sandbox.buildReceipt('Left on read for two days. I am drafting a long follow up.', {});
assert.equal(leftOnRead.confidence, 67, 'left-on-read control still reads 67');
assert.equal(sandbox.sharpenReadHints(leftOnRead),
  'No questions in this draft. No direct ask or stated need in this draft. Only 13 words in this draft.',
  'left-on-read sharpen line states exactly its absent gauge inputs (qMarks, highIntent, length tier)');

const rich = { rawText: 'I need you to tell me we are okay, it has been days since you replied and I am still waiting here wondering what happens next for us both?' };
assert.equal(sandbox.sharpenReadHints(rich), '', 'line hides when none of the four scored inputs is absent');
assert.equal(sandbox.sharpenReadHints(null), '', 'line hides without a receipt');
assert.equal(sandbox.sharpenReadHints({}), '', 'line hides without a draft');
console.log('ok: first-thirty — sharpen line states only true absences from analyzeText fields (qMarks, delay, highIntent, length) and hides when nothing is derivable');
