const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const deep = require('../deep-layers.js');

const EXPECTED_LINES = [
  'The question underneath your draft',
  'Your patterns, remembered on your device',
  'Three ways your message could land',
  'A calmer version built from your own words',
  'After you sent it: a read on their reply, and your next move'
];
const GENERIC_LEAD = 'The exact move. The message that keeps your position. The timing window. Lifetime Beta keeps the full decision layer available for one payment.';
const PEEL_LEAD = 'Open these layers on every receipt.';

/* ── Static copy: the card, the draft field, the paywall lead ─────── */
assert(html.includes('>Your decision</h3>'), 'decision card carries the "Your decision" heading');
assert(html.includes('Built from the choices you just made. Nothing here was guessed.'), 'decision card carries the honesty subline');
assert(html.includes('id=\\"decisionDraftText\\"'), 'the draft row is an editable field');
assert(html.includes('onclick=\\"deepCopyDecisionDraft()\\"'), 'the draft field has its own copy button');
assert(html.includes("What I'm afraid of"), 'the fear row label exists in the card builder');
assert(html.includes('id="paywallLead"'), 'paywall lead line is addressable');
assert(html.includes('>' + GENERIC_LEAD + '</p>'), 'paywall markup still opens with the generic lead');
assert(html.includes(PEEL_LEAD), 'the after-peel lead line exists in the page');
const openStart = html.indexOf('function openPaywall(');
const openSlice = html.slice(openStart, html.indexOf('\nfunction ', openStart + 10));
assert(openSlice.includes('renderPaywallLead()'), 'openPaywall renders the lead line every time it opens');
assert(openSlice.includes('renderPaywallProList()'), 'openPaywall still renders the Pro list');
console.log('ok: decision-card — static copy: heading, subline, editable draft field, paywall lead wiring');

assert(sw.includes('social-receipt-v37-decision'), 'service worker cache bumped for the decision card');
for (const lineage of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty', 'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty', 'social-receipt-v30-return-loop', 'social-receipt-v31-evidence', 'social-receipt-v31-first-peel', 'social-receipt-v32-first-peel', 'social-receipt-v33-scripts', 'social-receipt-v34-scripts-link', 'social-receipt-v35-challenge', 'social-receipt-v36-first-visit']) {
  assert(sw.includes(lineage), 'sw lineage keeps ' + lineage);
}
console.log('ok: decision-card — cache at v37-decision with the full lineage intact');

/* ── Functional: the real render path in a sandbox ───────────────────
   Same extraction approach as the other feature tests: pull the named
   top-level functions out of index.html and run them against an
   instrumented localStorage and a stub document. Receipts are built
   by the real engine and given deep layers by the real
   attachDeepLayers; the peel is walked with the real handlers. */
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
const localStorageStub = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
const elements = {
  deepLayersSection: { innerHTML: '' },
  paywallProList: { innerHTML: '' },
  paywallOwnershipProof: { innerHTML: '' },
  paywallLead: { textContent: '' },
  paywallSpike: { textContent: '', style: {} },
  paywallOverlay: { classList: { remove: () => {}, add: () => {} } },
  decisionDraftText: { value: '' }
};
const copied = [];
const sandbox = {
  console,
  state: { scenario: 'Text / DM', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Get clarity', currentReceipt: null },
  window: {
    SocialReceiptAnalysis: require('../presend-analysis.js'),
    SocialReceiptGuidance: require('../draft-guidance.js'),
    SocialReceiptDeep: deep,
    _deepReceiptId: null,
    _deepFreshView: true
  },
  document: { getElementById: (id) => elements[id] || null },
  localStorage: localStorageStub,
  getCurrentUser: () => ({ anonId: 'test-user', email: null }),
  trackEvent: () => {},
  haptic: () => {},
  oneTapCopy: (text) => { copied.push(text); }
};
loadPageFunctions(['includesAny', 'escapeHtml', 'analyzeText', 'computeConfidence', 'buildWhySignals',
  'getVerdict', 'makeReceipt', 'readReceiptPatternContext', 'addReceiptPattern', 'buildReceipt',
  'freeMonthKey', 'isPro', 'getReceipts', 'loadPatternHistory', 'savePatternHistory', 'attachDeepLayers',
  'buildSampleSituationReceipt', 'freePeelKey', 'freePeelUsed', 'consumeFreePeel', 'canOfferFreePeel',
  'revealFreePeel', 'proCapabilityListHtml', 'renderPaywallProList', 'renderPaywallOwnershipProof',
  'renderPaywallLead', 'openPaywall',
  'deepSectionInner', 'findDeepReceipt', 'persistDeepReceipt', 'refreshDeepSection',
  'deepChooseFear', 'deepAdvance', 'deepChooseStance',
  'decisionRowHtml', 'decisionCardHtml', 'deepCopyDecisionDraft', 'deepPeelCompleted'], sandbox);
for (const varName of ['SAMPLE_DRAFT_OVEREXPLAIN', 'SAMPLE_DRAFT_SAYNO', 'SAMPLE_SITUATIONS', 'PRO_CAPABILITY_LINES', 'PAYWALL_LEAD_DEFAULT', 'PAYWALL_LEAD_AFTER_PEEL']) {
  const vStart = html.indexOf('var ' + varName);
  assert(vStart >= 0, varName + ' declared');
  vm.runInContext(html.slice(vStart, html.indexOf(';', vStart) + 1), sandbox);
}
assert.equal(sandbox.PAYWALL_LEAD_DEFAULT, GENERIC_LEAD, 'the JS default lead matches the markup lead word for word');
assert.equal(sandbox.PAYWALL_LEAD_AFTER_PEEL, PEEL_LEAD, 'the after-peel lead is the spec line');

function makeFixtureReceipt(text) {
  const r = sandbox.buildReceipt(text, {});
  sandbox.attachDeepLayers(r, false);
  return r;
}
function viewReceipt(r, fresh) {
  sandbox.state.currentReceipt = r;
  sandbox.window._deepReceiptId = r.id;
  sandbox.window._deepFreshView = fresh !== false;
  return sandbox.deepSectionInner(r);
}
const FOOTER = (r) => 'Best move: ' + r.bestMove + ' · ' + r.timing;

/* ── Pro: the card grows only with choices actually made ──────────── */
store['sr_pro'] = '1';
const r1 = makeFixtureReceipt('I keep checking my phone every two minutes. It has been four hours and nothing. I feel sick about it.');
const fresh1 = viewReceipt(r1, true);
assert(fresh1.includes('>Your decision</h3>'), 'open peel ends with the decision card');
assert(fresh1.indexOf('>Your decision</h3>') > fresh1.indexOf('Layer 7 · Your choice'), 'the card renders after Layer 7');
assert(fresh1.includes('What I want'), 'the want row is there from the start: it is a real pick from this check');
assert(fresh1.includes(r1.desiredOutcome), 'the want row carries the picked outcome verbatim');
assert(fresh1.includes(FOOTER(r1)), 'the footer carries the receipt best move and timing verbatim');
assert(!fresh1.includes("What I'm afraid of"), 'no fear row before a fear is picked');
assert(!fresh1.includes('My choice'), 'no choice row before a stance is picked');
assert(!fresh1.includes('decisionDraftText'), 'no draft field before a rewrite exists');
assert.equal(sandbox.deepPeelCompleted(r1), false, 'an untouched peel is not completed');
console.log('ok: decision-card — open peel: card present with only the rows backed by real choices');

sandbox.deepChooseFear(0);
const chip0 = deep.fearChipsFor(r1.scenario)[0];
let section = elements.deepLayersSection.innerHTML;
assert(section.includes("What I'm afraid of"), 'picking a fear adds the fear row');
assert(section.includes(sandbox.escapeHtml(chip0.label)), 'the fear row carries the exact chip the user picked');
assert(!section.includes('My choice'), 'still no choice row before a stance');

sandbox.deepAdvance(3);
sandbox.deepAdvance(4);
sandbox.deepChooseStance(0);
section = elements.deepLayersSection.innerHTML;
const card1 = sandbox.decisionCardHtml(r1);
assert.equal(r1.deep.stance, deep.STANCES[0], 'the scripted stance landed');
assert(card1.includes('My choice') && card1.includes(deep.STANCES[0]), 'the choice row carries the picked stance');
assert(card1.includes('id="decisionDraftText"'), 'the draft row is the editable field');
assert(card1.includes(r1.deep.rewrite), 'the draft field holds the Layer 7 rewrite built from the user words');
assert.equal(r1.deep.rewrite, deep.composeRewrite(r1.rawText, deep.STANCES[0]), 'the rewrite in the card is the real Layer 7 output');
assert(card1.includes(sandbox.escapeHtml(chip0.label)) && card1.includes(r1.desiredOutcome) && card1.includes(FOOTER(r1)), 'the card assembles want, fear, and the footer verbatim');
assert(section.includes(card1), 'the rendered section ends with exactly this card');
assert.equal(sandbox.deepPeelCompleted(r1), true, 'a walked peel counts as completed');
console.log('ok: decision-card — full scripted peel: card contains exactly the picked fear, stance, rewrite, best move and timing');

/* ── The draft field is the user's: copy takes the edited text ────── */
const keysBefore = Object.keys(store).sort();
elements.decisionDraftText.value = 'Edited by hand. Shorter, calmer, mine.';
sandbox.deepCopyDecisionDraft();
assert.deepEqual(copied, ['Edited by hand. Shorter, calmer, mine.'], 'copy takes the field as edited, not the original rewrite');
sandbox.decisionCardHtml(r1);
assert.deepEqual(Object.keys(store).sort(), keysBefore, 'rendering the card and copying write no storage keys');
console.log('ok: decision-card — editable draft copies as edited; the card itself stores nothing');

/* ── Fear skipped: the row is absent, with no placeholder ─────────── */
const r2 = makeFixtureReceipt('Do you even care that I waited up for you? You never text back and I am done pretending it is fine.');
r2.deep.step = 4;
r2.deep.stance = 'Firm';
r2.deep.rewrite = deep.composeRewrite(r2.rawText, 'Firm');
assert.equal(r2.deep.fear, null, 'fixture never picked a fear');
const card2 = sandbox.decisionCardHtml(r2);
assert(card2.includes('My choice') && card2.includes('Firm'), 'choice row present without a fear');
assert(card2.includes(r2.deep.rewrite), 'draft present without a fear');
assert(!card2.includes("What I'm afraid of"), 'no fear row when no fear was picked');
for (const placeholder of ['Not chosen', 'No fear', 'Nothing picked', '—', 'N/A']) {
  assert(!card2.includes(placeholder), 'no placeholder text in place of the fear: ' + placeholder);
}
assert(viewReceipt(r2, true).includes(card2), 'the section renders the same fearless card');
console.log('ok: decision-card — fear skipped: row absent entirely, no placeholder');

/* ── Samples never render the card, even with forced peel state ───── */
const sample = sandbox.buildSampleSituationReceipt('overexplain');
sandbox.attachDeepLayers(sample, false);
sample.deep.step = 4;
sample.deep.fear = { label: 'A forced fear', question: 'forced', sentence: 'forced' };
sample.deep.stance = 'Warm';
sample.deep.rewrite = 'A forced rewrite.';
assert.equal(sample.sample, true, 'fixture is the real sample receipt');
assert.equal(sandbox.decisionCardHtml(sample), '', 'the card builder refuses samples outright');
const sampleView = viewReceipt(sample, true);
assert(!sampleView.includes('>Your decision</h3>'), 'sample section shows no decision card even for Pro');
assert(!sampleView.includes('decisionDraftText'), 'sample section shows no draft field');
assert.equal(sandbox.deepPeelCompleted(sample), false, 'a sample peel never counts as completed');
console.log('ok: decision-card — samples: no card, no draft field, never a completed peel');

/* ── Locked peel has no card; the free monthly peel ends with one ─── */
delete store['sr_pro'];
delete store[sandbox.freePeelKey()];
const r3 = makeFixtureReceipt('Quick one. The meeting moved to three and nobody told me. I need the new room number when you get this.');
const locked3 = viewReceipt(r3, true);
assert(!locked3.includes('detail-card decision-card'), 'a locked peel shows no decision card');
sandbox.openPaywall();
assert.equal(elements.paywallLead.textContent, GENERIC_LEAD, 'paywall lead stays generic before any completed peel');
sandbox.revealFreePeel();
section = elements.deepLayersSection.innerHTML;
assert(section.includes('detail-card decision-card'), 'the free monthly peel ends with the decision card too');
sandbox.deepChooseFear(1);
sandbox.deepAdvance(3);
sandbox.deepAdvance(4);
sandbox.deepChooseStance(2);
section = elements.deepLayersSection.innerHTML;
const chip1 = deep.fearChipsFor(r3.scenario)[1];
assert(section.includes(sandbox.escapeHtml(chip1.label)), 'free peel card carries the picked fear');
assert(section.includes(deep.STANCES[2]), 'free peel card carries the picked stance');
assert(section.includes(r3.deep.rewrite), 'free peel card carries the rewrite');
assert(section.includes(FOOTER(r3)), 'free peel card carries the footer');
assert.equal(sandbox.deepPeelCompleted(r3), true, 'the free peel counts as completed');
console.log('ok: decision-card — free monthly peel: locked shows nothing, revealed peel assembles the full card');

/* ── Paywall lead switches only with a completed peel in view ─────── */
sandbox.openPaywall();
assert.equal(elements.paywallLead.textContent, PEEL_LEAD, 'after the completed free peel, the paywall lead becomes the layers line');
for (const line of EXPECTED_LINES) assert(elements.paywallProList.innerHTML.includes(line), 'the five-capability list is unchanged: ' + line);
assert.deepEqual(Array.from(sandbox.PRO_CAPABILITY_LINES), EXPECTED_LINES, 'the capability list itself is untouched');
const r4 = makeFixtureReceipt('The invoice went out twice and the client is asking which one is real. I need to answer today.');
viewReceipt(r4, true);
sandbox.openPaywall();
assert.equal(elements.paywallLead.textContent, GENERIC_LEAD, 'viewing an unpeeled receipt returns the generic lead');
viewReceipt(r3, true);
sandbox.openPaywall();
assert.equal(elements.paywallLead.textContent, PEEL_LEAD, 'returning to the completed peel restores the layers line');
console.log('ok: decision-card — paywall lead: generic by default, layers line only from a completed peel, list untouched');
