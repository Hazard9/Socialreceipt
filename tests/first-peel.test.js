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

/* ── Static copy: the four flow states and the taste key ───────────── */
assert(html.includes('See inside once, free this month'), 'unused taste shows the offer button copy');
assert(html.includes("This is this month's free look inside. Pro opens this on every receipt."), 'revealed peel carries the marker line');
assert(html.includes("You used this month's free look inside."), 'used taste shows the honest line');
assert(html.includes('"sr_free_peel_used_" + freeMonthKey()'), 'taste key is sr_free_peel_used_ plus the shared month key');
assert(html.includes('id="paywallProList"'), 'paywall modal carries the Pro list container');
assert(html.includes('window._deepFreshView = !savedView'), 'receipt render records fresh vs saved view for the offer');
console.log('ok: first-peel — static copy for all four flow states, taste key wiring, paywall container present');

assert(sw.includes('social-receipt-v31-first-peel'), 'service worker cache bumped for first peel');
for (const lineage of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty', 'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty', 'social-receipt-v30-return-loop']) {
  assert(sw.includes(lineage), 'sw lineage keeps ' + lineage);
}
console.log('ok: first-peel — cache at v31 with the full lineage intact');

/* ── Functional: the real render path in a sandbox ───────────────────
   Same extraction approach as the other feature tests: pull the named
   top-level functions out of index.html and run them against an
   instrumented localStorage and a two-element document stub (the deep
   section and the paywall list). Receipts are built by the real engine
   and given deep layers by the real attachDeepLayers. */
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
const setCounts = {};
const localStorageStub = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { setCounts[k] = (setCounts[k] || 0) + 1; store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
const elements = {
  deepLayersSection: { innerHTML: '' },
  paywallProList: { innerHTML: '' }
};
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
  trackEvent: () => {}
};
loadPageFunctions(['includesAny', 'escapeHtml', 'analyzeText', 'computeConfidence', 'buildWhySignals',
  'getVerdict', 'makeReceipt', 'readReceiptPatternContext', 'addReceiptPattern', 'buildReceipt',
  'freeMonthKey', 'isPro', 'getReceipts', 'loadPatternHistory', 'savePatternHistory', 'attachDeepLayers',
  'buildSampleSituationReceipt', 'freePeelKey', 'freePeelUsed', 'consumeFreePeel', 'canOfferFreePeel',
  'revealFreePeel', 'proCapabilityListHtml', 'renderPaywallProList',
  'deepSectionInner', 'findDeepReceipt', 'persistDeepReceipt', 'refreshDeepSection'], sandbox);
for (const varName of ['SAMPLE_DRAFT_OVEREXPLAIN', 'SAMPLE_DRAFT_SAYNO', 'SAMPLE_SITUATIONS', 'PRO_CAPABILITY_LINES']) {
  const vStart = html.indexOf('var ' + varName);
  assert(vStart >= 0, varName + ' declared');
  vm.runInContext(html.slice(vStart, html.indexOf(';', vStart) + 1), sandbox);
}

const PEEL_KEY = sandbox.freePeelKey();

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

/* ── Taste key format ──────────────────────────────────────────────── */
assert.equal(PEEL_KEY, 'sr_free_peel_used_' + sandbox.freeMonthKey(), 'taste key shares the free-read month style');
assert(/^sr_free_peel_used_\d{4}-\d{1,2}$/.test(PEEL_KEY), 'taste key format is sr_free_peel_used_YYYY-M, got ' + PEEL_KEY);
assert.equal(sandbox.freePeelUsed(), false, 'taste starts unused');
console.log('ok: first-peel — taste key format sr_free_peel_used_YYYY-M, unused at first');

/* ── State 1: unused taste, free user, fresh receipt ───────────────── */
const r1 = makeFixtureReceipt('I keep checking my phone every two minutes. It has been four hours and nothing. I feel sick about it.');
const locked1 = viewReceipt(r1, true);
assert.equal(sandbox.canOfferFreePeel(r1), true, 'offer is available to a free user with an unused taste');
assert(locked1.includes('onclick="revealFreePeel()"'), 'locked peel wires the taste button');
assert(locked1.includes('See inside once, free this month'), 'locked peel shows the offer');
for (const line of EXPECTED_LINES) assert(locked1.includes(line), 'locked peel lists what Pro opens: ' + line);
assert(locked1.includes('Unlock the deep layers with Pro'), 'the Pro unlock path stays in place');
assert(!locked1.includes(deep.FEAR_QUESTION), 'locked peel does not render the real layer 4 content');
assert(!locked1.includes("This is this month's free look inside."), 'no marker before the reveal');
assert(!locked1.includes("You used this month's free look inside."), 'no used line before consumption');
console.log('ok: first-peel — unused taste: offer button + the five Pro lines on a still-locked peel');

/* ── State 2: the reveal renders the real peel and consumes once ───── */
sandbox.revealFreePeel();
assert.equal(r1.peelFreeReveal, true, 'reveal flag lands on the receipt');
assert.equal(store[PEEL_KEY], '1', 'taste recorded as used');
assert.equal(setCounts[PEEL_KEY], 1, 'consumption recorded exactly once');
const shown = elements.deepLayersSection.innerHTML;
assert(shown.includes("This is this month's free look inside. Pro opens this on every receipt."), 'revealed peel shows the marker line');
assert(shown.includes(deep.FEAR_QUESTION), 'revealed peel renders the real layer 4 question');
assert(shown.includes('Answer the fear above to open this layer.'), 'revealed peel renders the real progressive layer path');
assert(!shown.includes('See inside once, free this month'), 'offer button is gone after the reveal');
sandbox.revealFreePeel();
assert.equal(setCounts[PEEL_KEY], 1, 'a second reveal attempt cannot consume again');
console.log('ok: first-peel — reveal renders the full real peel with the marker, consumption recorded once');

/* ── State 3: used taste, a later receipt stays locked ─────────────── */
const r2 = makeFixtureReceipt('Do you even care that I waited up for you? You never text back and I am done pretending it is fine.');
const locked2 = viewReceipt(r2, true);
assert.equal(sandbox.canOfferFreePeel(r2), false, 'no second offer in the same month');
assert(locked2.includes("You used this month's free look inside."), 'later receipt shows the honest used line');
assert(!locked2.includes('See inside once, free this month'), 'later receipt shows no offer button');
assert(!locked2.includes(deep.FEAR_QUESTION), 'later receipt peel stays locked');
sandbox.revealFreePeel();
assert(!r2.peelFreeReveal, 'reveal is a no-op once the taste is used');
console.log('ok: first-peel — used taste: later receipts locked with the honest used line');

/* ── State 4: Pro never sees the offer, the marker, or the used line ── */
store['sr_pro'] = '1';
const proView = viewReceipt(r2, true);
assert(proView.includes(deep.FEAR_QUESTION), 'Pro peel is simply open');
assert(!proView.includes('See inside once, free this month'), 'Pro sees no offer button');
assert(!proView.includes("This is this month's free look inside."), 'Pro sees no taste marker');
assert(!proView.includes("You used this month's free look inside."), 'Pro sees no used line');
assert(!sandbox.deepSectionInner(r1).includes("This is this month's free look inside."), 'Pro sees no marker even on the tasted receipt');
assert.equal(sandbox.canOfferFreePeel(r2), false, 'Pro is never offered the taste');
delete store['sr_pro'];
console.log('ok: first-peel — Pro: peel open as today, no button, no marker, no used line');

/* ── Sample receipts never offer and never consume ─────────────────── */
delete store[PEEL_KEY];
assert.equal(sandbox.freePeelUsed(), false, 'taste reset to unused for the sample checks');
const sample = sandbox.buildSampleSituationReceipt('overexplain');
sandbox.attachDeepLayers(sample, false);
const sampleView = viewReceipt(sample, true);
assert.equal(sample.sample, true, 'fixture is the real sample receipt');
assert(!sampleView.includes('See inside once, free this month'), 'sample never offers the taste');
assert(!sampleView.includes("You used this month's free look inside."), 'sample shows no used line');
assert.equal(sandbox.canOfferFreePeel(sample), false, 'offer check refuses the sample');
sandbox.revealFreePeel();
assert(!sample.peelFreeReveal, 'sample cannot be revealed');
assert(!(PEEL_KEY in store), 'sample never consumes the taste');
console.log('ok: first-peel — sample receipt: no offer, no reveal, no consumption');

/* ── Freshness: the offer belongs to fresh receipts, not saved views ── */
const r3 = makeFixtureReceipt('Quick one. The meeting moved to three and nobody told me. I need the new room number when you get this.');
assert(!viewReceipt(r3, false).includes('See inside once, free this month'), 'no taste offer on a saved (journal) view');
assert(viewReceipt(r3, true).includes('See inside once, free this month'), 'the same receipt, fresh, offers the taste');
console.log('ok: first-peel — offer appears only on a fresh receipt view');

/* ── Paywall list: exactly the five real capabilities ──────────────── */
assert.deepEqual(Array.from(sandbox.PRO_CAPABILITY_LINES), EXPECTED_LINES, 'the capability list is exactly the five real Pro capabilities, in order');
const listHtml = sandbox.proCapabilityListHtml('What Pro opens');
for (const line of EXPECTED_LINES) {
  assert.equal(listHtml.split(line).length - 1, 1, 'list renders each capability exactly once: ' + line);
}
sandbox.renderPaywallProList();
assert(elements.paywallProList.innerHTML.includes('What Pro opens'), 'paywall list renders under its heading');
for (const line of EXPECTED_LINES) assert(elements.paywallProList.innerHTML.includes(line), 'paywall list contains: ' + line);
const openStart = html.indexOf('function openPaywall(');
const openSlice = html.slice(openStart, html.indexOf('\nfunction ', openStart + 10));
assert(openSlice.includes('renderPaywallProList()'), 'openPaywall renders the Pro list every time it opens');
console.log('ok: first-peel — paywall list contains exactly the five lines, rendered from the one source of truth');
