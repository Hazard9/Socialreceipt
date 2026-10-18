const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

/* ── Static wiring: panel, chip, derivation, gating, cache ─────────── */
assert(html.includes('function evidenceMatchedItems('), 'evidence derivation helper exists');
assert(html.includes('function evidencePanelHtml('), 'evidence panel renderer exists');
assert(html.includes('function patternFrequencyText('), 'pattern-frequency chip helper exists');
assert(html.includes('What this read matched'), 'panel heading present');
assert(html.includes('No wording patterns matched in this draft. This read rests on the draft\'s shape and the situation you picked.'), 'honest zero-match line present verbatim');
assert(html.includes('of your drafts from the last 30 days'), 'chip copy present');
assert(html.includes('WHAT THIS READ MATCHED'), 'render wiring block present in renderReceiptOutput');
assert(html.includes('evidencePanelHtml(receipt)') && html.includes('patternFrequencyText(receipt)'), 'render calls both helpers');

const evStart = html.indexOf('function evidenceMatchedItems(');
const evSrc = html.slice(evStart, html.indexOf('\nfunction ', evStart + 10));
assert(evSrc.includes('analyzeText(receipt.rawText)'), 'derivation recomputes analyzeText on the receipt rawText');
assert(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(html.slice(html.indexOf('/* ── WHAT THIS READ MATCHED'), html.indexOf('/* ── ONE TAP SEND'))), 'evidence block adds no network calls');

assert(sw.includes('social-receipt-v31-evidence'), 'service worker cache bumped for the evidence panel');
for (const prior of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty',
                     'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty', 'social-receipt-v30-return-loop']) {
  assert(sw.includes(prior), 'cache lineage keeps prior string ' + prior + ' for earlier feature tests');
}
console.log('ok: evidence-panel — panel + chip wired into the receipt render, derivation uses analyzeText on rawText, cache at v31 with full lineage');

/* ── Functional: real pipeline in a sandbox ─────────────────────────── */
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

const store = {};
const deep = require('../deep-layers.js');
const sandbox = {
  console,
  state: { scenario: 'Date', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Get clarity' },
  window: {
    SocialReceiptAnalysis: require('../presend-analysis.js'),
    SocialReceiptGuidance: require('../draft-guidance.js'),
    SocialReceiptDeep: deep
  },
  document: { getElementById: () => null },
  localStorage: {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  getCurrentUser: () => ({ anonId: 'test-user', email: null })
};
loadPageFunctions(['includesAny', 'escapeHtml', 'analyzeText', 'computeConfidence', 'buildWhySignals',
  'getVerdict', 'makeReceipt', 'readReceiptPatternContext', 'addReceiptPattern', 'buildReceipt',
  'loadPatternHistory', 'savePatternHistory', 'attachDeepLayers',
  'evidenceMatchedItems', 'evidencePanelHtml', 'patternFrequencyText'], sandbox);

/* Worked example 1: the left-on-read packet draft (Date / Anxious / Get clarity) */
const lor = sandbox.buildReceipt('Left on read for two days. I am drafting a long follow up.', {});
sandbox.attachDeepLayers(lor, false);
assert.equal(lor.verdict, 'Silence is the signal. Don\'t overwrite it.', 'control receipt verdict untouched');
assert.equal(lor.confidence, 67, 'control receipt confidence untouched');
const lorEv = sandbox.evidenceMatchedItems(lor);
assert.deepEqual([...lorEv.items], ['References to silence or no reply', 'A wait or delay mentioned'],
  'left-on-read matches exactly the silence and delay fields');
assert.equal(lorEv.patternLine, '', 'left-on-read carries no pattern under the standard context');
assert.equal(sandbox.evidencePanelHtml(lor),
  '<details class="evidence-panel"><summary>What this read matched</summary><div class="evidence-body">' +
  '<div class="evidence-item">References to silence or no reply</div>' +
  '<div class="evidence-item">A wait or delay mentioned</div></div></details>',
  'left-on-read panel lists exactly its two matched signals');
console.log('ok: evidence-panel — left-on-read worked example: silence + delay items, no pattern line, receipt values untouched');

/* Worked example 2: a zero-signal draft shows the honest line, not a dressed-up list */
Object.assign(sandbox.state, { scenario: 'Text / DM', feeling: 'Unsure', desiredOutcome: 'Get clarity' });
const zero = sandbox.buildReceipt('I will bring the papers by your office tomorrow morning.', {});
sandbox.attachDeepLayers(zero, false);
assert.equal(zero.pattern, null, 'zero-signal draft carries no pattern');
const zeroEv = sandbox.evidenceMatchedItems(zero);
assert.deepEqual([...zeroEv.items], [], 'zero-signal draft matches no panel field');
assert.equal(zeroEv.patternLine, '', 'zero-signal draft has no pattern evidence');
const zeroPanel = sandbox.evidencePanelHtml(zero);
assert(zeroPanel.includes('<div class="evidence-none">No wording patterns matched in this draft. This read rests on the draft\'s shape and the situation you picked.</div>'),
  'zero-signal panel shows the honest line');
assert(!zeroPanel.includes('evidence-item'), 'zero-signal panel lists no items');
console.log('ok: evidence-panel — zero-signal worked example: honest no-match line, empty list');

/* Pattern evidence line comes from the pattern layer's own data */
Object.assign(sandbox.state, { scenario: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Get clarity' });
const pat = sandbox.buildReceipt('Sorry to bother you again, I know you are busy and it is probably nothing, but are we okay? I keep thinking I said something wrong.', {});
const patEv = sandbox.evidenceMatchedItems(pat);
assert.deepEqual([...patEv.items], ['Apology wording', 'A direct question'], 'pattern draft matches apology + question fields');
assert.equal(patEv.patternLine, 'Pattern evidence: Reassurance-seeking cue: are we okay',
  'pattern evidence line quotes the pattern layer\'s matched wording');
assert(sandbox.evidencePanelHtml(pat).includes('<div class="evidence-pattern">Pattern evidence: Reassurance-seeking cue: are we okay</div>'),
  'pattern evidence line renders inside the panel');
console.log('ok: evidence-panel — pattern evidence line is the pattern layer\'s real matched wording');

/* Sample exclusion: a sample never shows the panel or the visitor's pattern data */
pat.sample = true;
assert.equal(sandbox.evidencePanelHtml(pat), '', 'sample receipt shows no evidence panel');
assert.equal(sandbox.patternFrequencyText(pat), '', 'sample receipt shows no pattern-frequency chip');
delete pat.sample;
console.log('ok: evidence-panel — sample receipts excluded from panel and chip');

/* Chip gating: hidden below count30 2, exact copy at 2, never for the branchless key */
sandbox.attachDeepLayers(pat, true); /* records the current draft: count30 becomes 1 */
assert.equal(pat.deep.patternCount30, 1, 'recorded draft counted once');
assert.equal(sandbox.patternFrequencyText(pat), '', 'chip hidden at count30 = 1');
const hist = sandbox.loadPatternHistory();
hist.push({ pattern: pat.deep.patternKey, label: 'seed', scenario: 'Text / DM', draft: 'a different earlier draft', ts: Date.now() });
sandbox.savePatternHistory(hist);
assert.equal(sandbox.patternFrequencyText(pat), 'This pattern appears in 2 of your drafts from the last 30 days.',
  'chip shows the exact line at count30 = 2 (current draft included)');
assert.equal(zero.deep.patternKey, 'flag:general', 'zero-signal receipt lands on the branchless key');
const hist2 = sandbox.loadPatternHistory();
for (let i = 0; i < 3; i++) hist2.push({ pattern: 'flag:general', label: 'general', scenario: 'Text / DM', draft: 'seeded general draft ' + i, ts: Date.now() });
sandbox.savePatternHistory(hist2);
assert.equal(sandbox.patternFrequencyText(zero), '', 'chip never fires for the branchless general key');
console.log('ok: evidence-panel — chip gated at count30 >= 2 with the current draft included, and never for flag:general');
