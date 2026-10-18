const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const bs = require('../both-sides.js');
const deep = require('../deep-layers.js');
const { loadEngine } = require('./helpers/receipt-engine.js');

const OE_DRAFT = "I know this is a lot and I'm sorry for the long message, I just want to explain why I was quiet earlier, it's not that I don't care, work has been insane and I keep thinking about it and I didn't want you to take it the wrong way.";
const SN_DRAFT = "I wish I could say yes to covering Sunday, I feel bad even typing this, maybe if my family thing falls through I could, I just don't want anyone to be upset with me.";
const REPLIED_SENT = 'Hey, are we good? I felt like things were off last night.';
const REPLIED_REPLY = 'ok';

/* ── Static markup: chooser replaces the single sample card ───────── */
assert(html.includes('id="firstVisitCard"'), 'home carries the first-visit situation chooser');
assert(html.includes('Start with a moment like yours'), 'chooser heading is the spec copy');
assert(html.includes('I&rsquo;m about to over-explain.'), 'chooser row 1 label present');
assert(html.includes('They replied, and now I&rsquo;m overthinking.'), 'chooser row 2 label present');
assert(html.includes('I need to say no.'), 'chooser row 3 label present');
assert(html.includes('onclick="runSampleSituation(\'overexplain\')"'), 'row 1 wired to its sample');
assert(html.includes('onclick="runSampleSituation(\'replied\')"'), 'row 2 wired to its sample');
assert(html.includes('onclick="runSampleSituation(\'sayno\')"'), 'row 3 wired to its sample');
assert(!html.includes('id="sampleReadCard"'), 'the old single-sample card is gone (folded into the chooser)');
assert(!html.includes('runSampleRead()'), 'the old single-sample entry point is gone');
assert(!html.includes('SAMPLE_DRAFT_TEXT'), 'the old single sample draft is gone');
assert(!html.includes('function buildSampleReceipt('), 'the old single sample builder is gone');
assert(html.includes('var SAMPLE_DRAFT_OVEREXPLAIN = "' + OE_DRAFT + '"'), 'over-explain sample runs the exact spec draft');
assert(html.includes('var SAMPLE_DRAFT_SAYNO = "' + SN_DRAFT + '"'), 'say-no sample runs the exact spec draft');
assert(html.includes('var SAMPLE_REPLIED_SENT = "' + REPLIED_SENT + '"'), 'replied sample uses the exact spec sent text');
assert(html.includes('var SAMPLE_REPLIED_REPLY = "' + REPLIED_REPLY + '"'), 'replied sample uses the exact spec reply');
assert(html.includes('receipt.sample = true'), 'situation receipts are tagged as samples');
assert(html.includes('currentReceipt.sample'), 'saveCurrentReceipt still refuses sample receipts');
console.log('ok: first-visit — chooser with the three spec situations replaces the old sample card; drafts are the exact spec wording');

assert(html.includes('onclick=\\"exitSampleToCheck()\\"'), 'draft samples exit through their own handler');
assert(html.includes('>Check my message</button>'), 'draft sample footer button reads "Check my message"');
assert(html.includes('onclick=\\"exitSampleToBothSides()\\"'), 'replied sample exits through its own handler');
assert(html.includes('>Try it with your thread</button>'), 'replied sample footer button reads "Try it with your thread"');
assert(html.includes('function exitSampleToCheck() { openPresend(); }'), '"Check my message" exits into the normal pre-send check flow');
assert(html.includes('function exitSampleToBothSides() { openBothSides(); }'), '"Try it with your thread" exits into the real Both Sides flow');
console.log('ok: first-visit — sample footers carry the spec CTAs wired into the real flows');

/* ── Deep links: ?sit= opens the matching sample, unknown falls back ── */
assert(html.includes('sampleSituationKey(window.location.search)'), 'init reads the sit param');
assert(html.includes('runSampleSituation(sitKey)'), 'init opens the matching sample');
const repliedSrc = html.slice(html.indexOf('function runRepliedSample('), html.indexOf('function runRepliedSample(') + 1600);
assert(!repliedSrc.includes('analyzeExchange'), 'replied sample never computes the Pro dynamic read');
assert(!repliedSrc.includes('_bothSides'), 'replied sample never touches Both Sides thread state (nothing can be saved from it)');
assert(repliedSrc.includes('bothSidesFactsHtml(facts)'), 'replied sample renders the real free facts strip');
assert(repliedSrc.includes('The full read, what the reply is doing and the next move to make, is Pro.'), 'replied sample carries the honest Pro line');
console.log('ok: first-visit — deep-link hook wired; replied sample is facts-only by construction (no analyzeExchange, no thread state)');

assert(sw.includes('social-receipt-v36-first-visit'), 'service worker cache bumped for this build');
for (const prior of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty',
                     'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty', 'social-receipt-v30-return-loop',
                     'social-receipt-v31-evidence', 'social-receipt-v31-first-peel', 'social-receipt-v32-first-peel',
                     'social-receipt-v33-scripts', 'social-receipt-v34-scripts-link', 'social-receipt-v35-challenge']) {
  assert(sw.includes(prior), 'cache lineage keeps prior string ' + prior);
}
console.log('ok: first-visit — sw cache v36-first-visit with full lineage');

/* ── Functional sandbox: instrumented storage proves the guards ───── */
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
function loadVar(name, sandbox) {
  const vStart = html.indexOf('var ' + name);
  assert(vStart >= 0, name + ' declared');
  vm.runInContext(html.slice(vStart, html.indexOf(';', vStart) + 1), sandbox);
}

const writes = [];
const store = {};
const localStorageStub = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { writes.push(['setItem', k]); store[k] = String(v); },
  removeItem: (k) => { writes.push(['removeItem', k]); delete store[k]; }
};
const sandbox = {
  console,
  URLSearchParams,
  state: { scenario: 'Work', format: 'Text / DM', feeling: 'Good', desiredOutcome: 'Say no clearly' },
  window: {
    SocialReceiptAnalysis: require('../presend-analysis.js'),
    SocialReceiptGuidance: require('../draft-guidance.js'),
    SocialReceiptDeep: deep,
    SocialReceiptBothSides: bs
  },
  document: { getElementById: () => null },
  localStorage: localStorageStub,
  getCurrentUser: () => ({ anonId: 'test-user', email: null })
};
loadPageFunctions(['includesAny', 'escapeHtml', 'analyzeText', 'computeConfidence', 'buildWhySignals',
  'getVerdict', 'makeReceipt', 'readReceiptPatternContext', 'addReceiptPattern', 'buildReceipt',
  'freeMonthKey', 'getFreeUsed', 'loadPatternHistory', 'savePatternHistory', 'attachDeepLayers',
  'buildSampleSituationReceipt', 'buildSampleRepliedFacts', 'sampleTakeawayLine', 'sampleFooterHtml',
  'sampleSituationKey', 'bothSidesFactsHtml'], sandbox);
for (const v of ['SAMPLE_DRAFT_OVEREXPLAIN', 'SAMPLE_DRAFT_SAYNO', 'SAMPLE_SITUATIONS',
                 'SAMPLE_REPLIED_SENT', 'SAMPLE_REPLIED_REPLY', 'SAMPLE_REPLIED_TIME']) loadVar(v, sandbox);

/* Deep-link parsing, exercised directly */
assert.equal(sandbox.sampleSituationKey('?sit=overexplain'), 'overexplain');
assert.equal(sandbox.sampleSituationKey('?sit=replied'), 'replied');
assert.equal(sandbox.sampleSituationKey('?x=1&sit=sayno'), 'sayno');
assert.equal(sandbox.sampleSituationKey('?sit=bogus'), null, 'unknown sit value falls back');
assert.equal(sandbox.sampleSituationKey('?sit='), null, 'empty sit value falls back');
assert.equal(sandbox.sampleSituationKey(''), null, 'no query falls back');
assert.equal(sandbox.sampleSituationKey('?success=true'), null, 'unrelated params fall back');
console.log('ok: first-visit — ?sit= selects exactly the three samples; anything else falls back to normal home');

/* Live engine reference outputs for the same drafts and contexts */
const engine = loadEngine();
const liveOE = engine.build(OE_DRAFT, { scenario: 'Text / DM', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Keep connection warm' });
const liveSN = engine.build(SN_DRAFT, { scenario: 'Work', format: 'Text / DM', feeling: 'Unsure', desiredOutcome: 'Maintain professionalism' });

const usedBefore = sandbox.getFreeUsed();

/* Over-explain sample */
const oe = sandbox.buildSampleSituationReceipt('overexplain');
sandbox.attachDeepLayers(oe, false);
assert.equal(oe.sample, true, 'over-explain receipt is tagged as a sample');
assert.equal(oe.sampleKey, 'overexplain');
assert.equal(oe.rawText, OE_DRAFT, 'over-explain runs the exact spec draft');
assert.deepEqual([oe.scenario, oe.feeling, oe.desiredOutcome], ['Text / DM', 'Anxious', 'Keep connection warm'], 'over-explain uses the spec context');
assert.equal(oe.verdict, liveOE.verdict, 'over-explain verdict equals live buildReceipt output');
assert.equal(oe.confidence, liveOE.confidence, 'over-explain confidence equals live buildReceipt output');
assert.equal(oe.verdict, "You're explaining. They stopped listening.", 'over-explain verdict pinned');
assert.equal(oe.confidence, 89, 'over-explain confidence pinned');
assert.equal(oe.pattern && oe.pattern.label, 'Long draft', 'over-explain pattern is the real engine pattern');
assert(!oe.verdict.includes('UNCLEAR'), 'over-explain is not the generic fallback');

/* Say-no sample */
const sn = sandbox.buildSampleSituationReceipt('sayno');
sandbox.attachDeepLayers(sn, false);
assert.equal(sn.sample, true, 'say-no receipt is tagged as a sample');
assert.equal(sn.sampleKey, 'sayno');
assert.equal(sn.rawText, SN_DRAFT, 'say-no runs the exact spec draft');
assert.deepEqual([sn.scenario, sn.feeling, sn.desiredOutcome], ['Work', 'Unsure', 'Maintain professionalism'], 'say-no uses the spec context');
assert.equal(sn.verdict, liveSN.verdict, 'say-no verdict equals live buildReceipt output');
assert.equal(sn.confidence, liveSN.confidence, 'say-no confidence equals live buildReceipt output');
assert.equal(sn.verdict, 'This needed space. You almost overplayed it.', 'say-no verdict pinned');
assert.equal(sn.confidence, 67, 'say-no confidence pinned');
assert(!sn.verdict.includes('UNCLEAR'), 'say-no is not the generic fallback');
assert.notEqual(oe.verdict, sn.verdict, 'the two draft samples return distinct verdicts');
assert.deepEqual([sandbox.state.scenario, sandbox.state.feeling, sandbox.state.desiredOutcome],
  ['Work', 'Good', 'Say no clearly'], "the visitor's own picks are restored after both sample builds");
console.log('ok: first-visit — both draft samples equal live buildReceipt output (verdicts and confidences pinned), contexts exact, picks restored');

/* Replied sample: real facts, facts only */
const facts = sandbox.buildSampleRepliedFacts();
const liveFacts = bs.factsFor(REPLIED_SENT, REPLIED_REPLY, 'hours', sandbox.analyzeText);
assert.deepEqual(JSON.parse(JSON.stringify(facts)), JSON.parse(JSON.stringify(liveFacts)), 'replied facts equal live factsFor output');
assert.equal(facts.sentWords, 12, 'replied facts: sent word count');
assert.equal(facts.replyWords, 1, 'replied facts: reply word count');
assert.equal(facts.sentQuestions, 1, 'replied facts: questions asked');
assert.equal(facts.replyQuestions, 0, 'replied facts: questions asked back');
assert.equal(facts.wordsLine, 'You sent 12 words. The reply was 1.');
assert.equal(facts.ratioLine, 'The reply is a fraction of what you sent.');
assert.equal(facts.questionsLine, 'You asked 1 question. The reply asks none back.');
assert.equal(facts.signalsLine, 'Signals in the reply: one-word energy.');
assert.equal(facts.time.phrase, 'within hours');
const factsHtml = sandbox.bothSidesFactsHtml(facts);
assert(factsHtml.includes('The facts, in words'), 'facts strip renders under its real heading');
assert(factsHtml.includes(facts.wordsLine), 'facts strip carries the real words line');
assert(!factsHtml.includes('No clear shape yet'), 'facts strip contains no Pro dynamic read name');
assert(!factsHtml.includes('The dynamic read'), 'facts strip contains no Pro dynamic read section');
console.log('ok: first-visit — replied sample facts equal live factsFor output; the rendered strip is facts only, no Pro read');

/* Guards across all three samples */
assert.equal(writes.length, 0, 'all three sample paths create zero localStorage writes, saw: ' + JSON.stringify(writes));
assert.equal(sandbox.getFreeUsed(), usedBefore, 'samples never move the free-read counter');
assert(!(deep.HISTORY_KEY in store), 'samples never create pattern history');
assert.equal(sandbox.buildSampleSituationReceipt('bogus'), null, 'unknown situation builds nothing');
console.log('ok: first-visit — sample guards hold for all three: zero storage writes, free counter untouched, no pattern history');

/* Takeaway lines: quote only real fields, hide when fields are absent */
const oeTake = sandbox.sampleTakeawayLine('overexplain', oe);
assert(oeTake.includes('"' + oe.bestMove + '"'), 'over-explain takeaway quotes the live best move');
assert(oeTake.includes('(' + oe.timing + ')'), 'over-explain takeaway quotes the live timing');
const snTake = sandbox.sampleTakeawayLine('sayno', sn);
assert(snTake.includes('"' + sn.bestMove + '"'), 'say-no takeaway quotes the live best move');
assert(snTake.includes('(' + sn.timing + ')'), 'say-no takeaway quotes the live timing');
const rpTake = sandbox.sampleTakeawayLine('replied', facts);
assert(rpTake.includes(facts.ratioLine), 'replied takeaway quotes the live ratio line');
assert(rpTake.includes(facts.questionsLine), 'replied takeaway quotes the live questions line');
assert.equal(sandbox.sampleTakeawayLine('overexplain', {}), '', 'takeaway hides when its fields are absent');
assert.equal(sandbox.sampleTakeawayLine('replied', {}), '', 'replied takeaway hides when its fields are absent');
assert.equal(sandbox.sampleTakeawayLine('overexplain', null), '', 'takeaway hides without data');
const oeFooter = sandbox.sampleFooterHtml('overexplain', oe);
assert(oeFooter.includes(sandbox.escapeHtml(oeTake)), 'draft footer carries the takeaway (HTML-escaped, as rendered)');
assert(oeFooter.includes('>Check my message</button>'), 'draft footer carries the primary CTA');
const rpFooter = sandbox.sampleFooterHtml('replied', facts);
assert(rpFooter.includes(sandbox.escapeHtml(rpTake)), 'replied footer carries the takeaway (HTML-escaped, as rendered)');
assert(rpFooter.includes('>Try it with your thread</button>'), 'replied footer carries its primary CTA');
console.log('ok: first-visit — takeaway lines quote only live output fields and hide when those fields are absent');
