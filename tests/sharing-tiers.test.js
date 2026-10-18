const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const share = require('../share-card.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const shareSrc = fs.readFileSync(path.join(__dirname, '..', 'share-card.js'), 'utf8');

/* ── Fixture: distinctive strings so any leak is visible ─────────── */
const fixture = {
  verdict: "VERDICTX: the draft is asking for reassurance.",
  rawText: "DRAFTX private words about the Sunday shift swap",
  confidence: 42,
  bestMove: "Wait",
  message: "MESSAGEX the suggested calmer replacement text",
  pattern: { label: "PATTERNX reassurance loop" },
  deep: { rewrite: "REWRITEX my own calmer words" }
};

/* ── Tier shape and the default ──────────────────────────────────── */
assert.equal(share.DEFAULT_TIER, 'takeaway', 'the default tier is the safest one');
assert.deepEqual(share.TIERS, ['takeaway', 'beforeafter', 'full'], 'three tiers, safest first');
assert.equal(share.TIER_LABELS.takeaway, 'Just the takeaway');
assert.equal(share.TIER_LABELS.beforeafter, 'Before and after');
assert.equal(share.TIER_LABELS.full, 'Full receipt');
assert.equal(share.TAKEAWAY_LINE, 'I checked before I sent.');
assert.equal(share.NO_REWRITE_LINE, 'No rewrite for this receipt yet.');
assert(!shareSrc.includes('localStorage'), 'share-card.js never touches storage');
console.log('ok: sharing tiers — three tiers named, takeaway is the default, module storage-free');

/* ── Takeaway model: the lesson only, no private text anywhere ───── */
const takeaway = share.buildTierModel(fixture, { tier: 'takeaway' });
assert.equal(takeaway.takeawayLine, 'I checked before I sent.');
assert.equal(takeaway.verdict, fixture.verdict, 'verdict is the app words and may be shared');
assert.equal(takeaway.patternLine, 'Pattern spotted: PATTERNX reassurance loop');
assert.equal(takeaway.strengthLine, 'Read strength: 42');
assert.equal(takeaway.bestMove, 'Wait');
const takeawayJson = JSON.stringify(takeaway);
for (const secret of ['DRAFTX', 'MESSAGEX', 'REWRITEX']) {
  assert(!takeawayJson.includes(secret), 'takeaway model must not carry ' + secret);
}
assert(!('excerpt' in takeaway) && !('message' in takeaway) && !('beforeText' in takeaway) && !('afterText' in takeaway),
  'takeaway model has no draft/message fields at all');
console.log('ok: sharing tiers — takeaway model carries the lesson and zero private text');

/* ── Canvas stub (same shape as share-card.test.js) ──────────────── */
function fakeCanvas() {
  const drawn = [];
  const ctx = {
    drawn,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '',
    measureText(t) {
      const size = parseInt((this.font.match(/(\d+)px/) || [0, 16])[1], 10);
      return { width: String(t).length * size * 0.5 };
    },
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {},
    fillText(t, x, y) { drawn.push(String(t)); },
    createLinearGradient() { return { addColorStop() {} }; }
  };
  return {
    width: 0, height: 0, _ctx: ctx, drawn,
    getContext() { return ctx; },
    toBlob(cb) { cb(new Blob(['png'], { type: 'image/png' })); }
  };
}

/* ── Takeaway render: drawn text is lesson-only ──────────────────── */
const takeawayCanvas = fakeCanvas();
assert.equal(share.renderTierToCanvas(fixture, takeawayCanvas, { tier: 'takeaway' }), takeawayCanvas);
const takeawayDrawn = takeawayCanvas.drawn.join(' ');
for (const expected of ['SOCIAL RECEIPT', 'I checked before I sent.', 'VERDICTX',
  'Pattern spotted: PATTERNX reassurance loop', 'Read strength: 42', 'Wait',
  'socialreceipt.netlify.app', 'Free: 3 receipts a month']) {
  assert(takeawayDrawn.includes(expected), 'takeaway card draws: ' + expected);
}
for (const secret of ['DRAFTX', 'MESSAGEX', 'REWRITEX']) {
  assert(!takeawayDrawn.includes(secret), 'takeaway card must not draw ' + secret);
}
console.log('ok: sharing tiers — takeaway card renders the lesson, pattern, strength, move; no draft, no message');

/* ── Before and after: real rewrite, verbatim, labeled AFTER ─────── */
const ba = share.buildTierModel(fixture, { tier: 'beforeafter' });
assert.equal(ba.beforeText, fixture.rawText, 'short draft passes through verbatim');
assert.equal(ba.afterText, 'REWRITEX my own calmer words', 'the Layer 7 rewrite is the after text');
assert.equal(ba.afterLabel, 'AFTER', 'a real rewrite is labeled plainly');
assert.equal(ba.afterSuggested, false);
const baCanvas = fakeCanvas();
share.renderTierToCanvas(fixture, baCanvas, { tier: 'beforeafter' });
const baDrawn = baCanvas.drawn.join(' ');
for (const expected of ['BEFORE', 'AFTER', 'DRAFTX', 'REWRITEX']) {
  assert(baDrawn.includes(expected), 'before/after card draws: ' + expected);
}
assert(!baDrawn.includes('SUGGESTED VERSION'), 'a real rewrite never gets the suggested label');
console.log('ok: sharing tiers — before/after shows draft and the user rewrite verbatim');

/* ── Before and after fallback: suggested message, honestly labeled  */
const fallbackFixture = {
  verdict: 'A plain verdict.', rawText: 'DRAFTX fallback draft words',
  bestMove: 'Send', message: 'MESSAGEX the suggested version words'
};
const baFallback = share.buildTierModel(fallbackFixture, { tier: 'beforeafter' });
assert.equal(baFallback.afterText, fallbackFixture.message, 'fallback after text is the suggested message verbatim');
assert.equal(baFallback.afterLabel, 'AFTER (SUGGESTED VERSION)', 'fallback is labeled as suggested, never as the user rewrite');
assert.equal(baFallback.afterSuggested, true);
const baFallbackCanvas = fakeCanvas();
share.renderTierToCanvas(fallbackFixture, baFallbackCanvas, { tier: 'beforeafter' });
assert(baFallbackCanvas.drawn.join(' ').includes('AFTER (SUGGESTED VERSION)'), 'the card itself carries the honest label');
console.log('ok: sharing tiers — suggested-message fallback renders with the (suggested version) label');

/* ── Before and after with no rewrite at all: tier unavailable ───── */
const noRewrite = { verdict: 'A plain verdict.', rawText: 'DRAFTX lonely draft', bestMove: 'Wait' };
assert.equal(share.rewriteFor(noRewrite), null, 'no deep rewrite and no message -> no rewrite');
assert.equal(share.tierAvailable(noRewrite, 'beforeafter'), false);
assert.equal(share.buildTierModel(noRewrite, { tier: 'beforeafter' }), null, 'unbuildable tier returns null');
assert.equal(share.renderTierToCanvas(noRewrite, fakeCanvas(), { tier: 'beforeafter' }), null, 'unbuildable tier renders nothing');
let confirmCalls = 0;
assert.equal(share.shareReceipt(noRewrite, { tier: 'beforeafter', confirmPrivacy: () => { confirmCalls++; } }), false,
  'shareReceipt refuses the unavailable tier');
assert.equal(confirmCalls, 0, 'refusal happens before any privacy prompt');
console.log('ok: sharing tiers — before/after is unavailable when the receipt has no rewrite');

/* ── Full tier: exactly the pre-change card ──────────────────────── */
const fullModel = share.buildTierModel(fixture, { tier: 'full' });
assert.deepEqual(fullModel, Object.assign({}, share.buildCardModel(fixture), { tier: 'full' }),
  'full tier model equals the original card model field for field');
const fullCanvas = fakeCanvas();
share.renderTierToCanvas(fixture, fullCanvas, { tier: 'full' });
const legacyCanvas = fakeCanvas();
share.renderToCanvas(fixture, legacyCanvas);
assert.deepEqual(fullCanvas.drawn, legacyCanvas.drawn, 'full tier draws exactly what the card always drew');
console.log('ok: sharing tiers — full tier is the original card, unchanged');

/* ── Remove-details toggles reach the render ─────────────────────── */
const noPattern = share.buildTierModel(fixture, { tier: 'takeaway', include: { pattern: false } });
assert.equal(noPattern.patternLine, null, 'unchecked pattern leaves the model');
const noPatternCanvas = fakeCanvas();
share.renderTierToCanvas(fixture, noPatternCanvas, { tier: 'takeaway', include: { pattern: false } });
assert(!noPatternCanvas.drawn.join(' ').includes('PATTERNX'), 'unchecked pattern is not drawn');
assert(noPatternCanvas.drawn.join(' ').includes('I checked before I sent.'), 'the rest of the card still draws');

const slimFull = share.buildTierModel(fixture, { tier: 'full', include: { draft: false, message: false } });
assert.equal(slimFull.excerpt, '', 'unchecked draft leaves the full model');
assert.equal(slimFull.message, '', 'unchecked message leaves the full model');
const slimFullCanvas = fakeCanvas();
share.renderTierToCanvas(fixture, slimFullCanvas, { tier: 'full', include: { draft: false, message: false } });
const slimDrawn = slimFullCanvas.drawn.join(' ');
assert(!slimDrawn.includes('DRAFTX') && !slimDrawn.includes('MESSAGEX'), 'unchecked elements are not drawn on the full card');
assert(slimDrawn.includes('VERDICTX'), 'kept elements still draw');

const baNoAfter = share.buildTierModel(fixture, { tier: 'beforeafter', include: { after: false } });
assert.equal(baNoAfter.afterText, '', 'unchecked rewrite leaves the before/after model');
const baNoAfterCanvas = fakeCanvas();
share.renderTierToCanvas(fixture, baNoAfterCanvas, { tier: 'beforeafter', include: { after: false } });
const baNoAfterDrawn = baNoAfterCanvas.drawn.join(' ');
assert(!baNoAfterDrawn.includes('REWRITEX') && baNoAfterDrawn.includes('DRAFTX'), 'before stays, unchecked after goes');
console.log('ok: sharing tiers — unchecking an element removes it from the model and from the card');

/* ── Element lists: only what is actually on the receipt ─────────── */
const takeawayEls = Object.fromEntries(share.shareElementsFor(fixture, 'takeaway').map((e) => [e.key, e]));
assert.equal(takeawayEls.takeaway.toggleable, false, 'the takeaway line itself is fixed, not a toggle');
assert.equal(takeawayEls.pattern.present, true);
assert(!('draft' in takeawayEls) && !('message' in takeawayEls), 'takeaway offers no draft or message elements');
const bareEls = Object.fromEntries(share.shareElementsFor({ verdict: 'v' }, 'takeaway').map((e) => [e.key, e]));
assert.equal(bareEls.pattern.present, false, 'no pattern on the receipt -> pattern not offered');
assert.equal(bareEls.strength.present, false, 'no confidence -> strength not offered');
assert.equal(bareEls.bestMove.present, false, 'no best move -> not offered');
const bareFullEls = Object.fromEntries(share.shareElementsFor({ verdict: 'v' }, 'full').map((e) => [e.key, e]));
assert.equal(bareFullEls.draft.present, false, 'no draft -> draft not offered on the full tier');
assert.equal(bareFullEls.message.present, false, 'no message -> message not offered on the full tier');
const bareBaEls = Object.fromEntries(share.shareElementsFor({ verdict: 'v' }, 'beforeafter').map((e) => [e.key, e]));
assert.equal(bareBaEls.after.present, false, 'no rewrite -> after not offered');
console.log('ok: sharing tiers — element lists only offer what the receipt actually has');

/* ── shareReceipt plumbing: tier and note reach the confirm ──────── */
function stubDocument(counter) {
  return {
    createElement(tag) {
      if (tag === 'canvas') { counter.n++; return fakeCanvas(); }
      return { href: '', download: '', click() {} };
    },
    body: { appendChild() {}, removeChild() {} },
    documentElement: {}
  };
}
let seenInfo = null;
const counter1 = { n: 0 };
assert.equal(share.shareReceipt(fixture, {
  confirmPrivacy: (done, info) => { seenInfo = info; done(true); },
  document: stubDocument(counter1), navigator: {}
}), true);
assert.equal(seenInfo.tier, 'takeaway', 'no tier passed -> the confirm hears the default tier');
assert.equal(seenInfo.tierLabel, 'Just the takeaway');
assert.equal(seenInfo.privacyNote, 'No draft text and no message text on this card, only the lesson.');
assert.equal(counter1.n, 1, 'approved confirm renders exactly one card');
const counter2 = { n: 0 };
let seenInfo2 = null;
share.shareReceipt(fixture, {
  tier: 'full',
  confirmPrivacy: (done, info) => { seenInfo2 = info; done(false); },
  document: stubDocument(counter2), navigator: {}
});
assert.equal(seenInfo2.tierLabel, 'Full receipt');
assert.equal(seenInfo2.privacyNote, 'Your draft text will appear in the image.', 'full tier keeps the original privacy note');
assert.equal(counter2.n, 0, 'cancelled confirm renders nothing');
console.log('ok: sharing tiers — shareReceipt carries tier, label, and the tier privacy note to the confirm');

/* ── Page wiring: chooser markup, details step, honest confirm ───── */
for (const needle of ['id="shareTierOverlay"', 'id="shareTierOptions"', 'id="shareTierDetails"',
  'id="shareTierChooseView"', 'id="shareTierDetailsView"', 'id="shareCardNote"',
  'Choose how much the card shows. You can remove details on the next step.',
  'Anything you switch off stays off the card.', '>Make the card</button>',
  'function shareReceiptCard(', 'function selectShareTier(', 'function toggleShareElement(',
  'function confirmShareTier(', 'You are sharing: ',
  'That was a sample. Paste your own draft to share a real read.']) {
  assert(html.includes(needle), 'index.html carries: ' + needle);
}
console.log('ok: sharing tiers — page carries the chooser, the details step, and the tier-naming confirm');

/* ── Free-limit copy: the exact spec string ──────────────────────── */
assert(html.includes('<h2 class="modal-title">You used your 3 free receipts this month.</h2>'),
  'limit wall headline is the spec line');
assert(html.includes('<p class="modal-sub">Pro keeps every conversation covered.</p>'),
  'limit wall subline is the spec line');
assert(!html.includes("You've used your 3 free reads."), 'old limit headline is gone');
assert(!html.includes('The next one that matters should not be a guess.'), 'old limit subline is gone');
console.log('ok: sharing tiers — free-limit message is exactly the spec copy');

/* ── Service worker: v38 with the whole lineage ──────────────────── */
assert(sw.includes('var CACHE_NAME = "social-receipt-v38-sharing"'), 'cache bumped to v38-sharing');
for (const lineage of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty',
  'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty', 'social-receipt-v30-return-loop',
  'social-receipt-v31-evidence', 'social-receipt-v31-first-peel', 'social-receipt-v32-first-peel',
  'social-receipt-v33-scripts', 'social-receipt-v34-scripts-link', 'social-receipt-v35-challenge',
  'social-receipt-v36-first-visit', 'social-receipt-v37-decision']) {
  assert(sw.includes(lineage), 'sw lineage keeps ' + lineage);
}
console.log('ok: sharing tiers — cache at v38-sharing with the full lineage intact');

/* ── Page flow in a sandbox: sample refusal, defaults, toggles ───── */
function makeElement() {
  const classes = new Set(['hidden']);
  return {
    innerHTML: '', textContent: '', style: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c)
    }
  };
}
const pageElements = {};
const toasts = [];
let storageWrites = 0;
const pageSandbox = {
  console,
  state: { currentReceipt: null },
  document: { getElementById: (id) => { if (!pageElements[id]) pageElements[id] = makeElement(); return pageElements[id]; } },
  toast: (msg) => { toasts.push(msg); },
  localStorage: {
    getItem: () => null,
    setItem: () => { storageWrites++; },
    removeItem: () => {}
  }
};
pageSandbox.window = pageSandbox;
pageSandbox.SocialReceiptShare = share;
vm.createContext(pageSandbox);
const flowStart = html.indexOf('var _shareChoice');
const flowEnd = html.indexOf('function bsRenderTimeChips(');
assert(flowStart >= 0 && flowEnd > flowStart, 'share tier flow located in index.html');
vm.runInContext(html.slice(flowStart, flowEnd), pageSandbox);

/* Samples stay refused, with the sample message, and no overlay opens */
pageSandbox.state.currentReceipt = Object.assign({}, fixture, { sample: true });
pageSandbox.shareReceiptCard();
assert.deepEqual(toasts, ['That was a sample. Paste your own draft to share a real read.'], 'sample share refused with the sample message');
assert(!pageElements.shareTierOverlay || pageElements.shareTierOverlay.classList.contains('hidden'),
  'sample never opens the tier chooser');

/* A real receipt opens on the safest tier with the chooser rendered */
pageSandbox.state.currentReceipt = fixture;
pageSandbox.shareReceiptCard();
assert(!pageElements.shareTierOverlay.classList.contains('hidden'), 'chooser opens for a real receipt');
assert.equal(pageSandbox._shareChoice.tier, 'takeaway', 'chooser opens on the default tier');
const optionsHtml = pageElements.shareTierOptions.innerHTML;
for (const label of ['Just the takeaway', 'Before and after', 'Full receipt']) {
  assert(optionsHtml.includes(label), 'chooser offers: ' + label);
}
assert(optionsHtml.includes('share-tier-option selected'), 'the default tier renders selected');
assert(pageElements.shareTierDetails.innerHTML.includes('The takeaway line · always on this card'),
  'details step marks the takeaway line as always on');
assert(pageElements.shareTierDetails.innerHTML.includes('The pattern'), 'details step lists the pattern toggle');

/* Switching tiers and toggling an element reach the share call */
pageSandbox.selectShareTier('beforeafter');
assert.equal(pageSandbox._shareChoice.tier, 'beforeafter');
assert(pageElements.shareTierDetails.innerHTML.includes('Your draft (Before)'), 'details follow the chosen tier');
pageSandbox.toggleShareElement('pattern', false);
assert.equal(pageSandbox._shareChoice.include.pattern, false, 'the toggle is recorded');
pageSandbox.confirmShareTier();
assert(pageElements.shareTierOverlay.classList.contains('hidden'), 'chooser closes once the card is confirmed into the privacy step');
assert.equal(pageElements.shareCardNote.textContent,
  'You are sharing: Before and after. Your draft and the rewrite will appear in the image. Nothing is uploaded. The card is made on your device.',
  'the privacy confirm names the tier and its note');
assert(!pageElements.shareCardOverlay.classList.contains('hidden'), 'the privacy confirm opens');
assert.equal(typeof pageSandbox._shareCardDone, 'function', 'the render waits on the privacy confirm');

/* Before/after cannot be selected when there is no rewrite */
pageSandbox.state.currentReceipt = noRewrite;
pageSandbox.shareReceiptCard();
assert(pageElements.shareTierOptions.innerHTML.includes('No rewrite for this receipt yet.'),
  'the chooser explains why before/after is off');
assert(pageElements.shareTierOptions.innerHTML.includes('share-tier-option disabled'),
  'the unavailable tier renders disabled');
pageSandbox.selectShareTier('beforeafter');
assert.equal(pageSandbox._shareChoice.tier, 'takeaway', 'selecting the unavailable tier changes nothing');

assert.equal(storageWrites, 0, 'the whole tier flow wrote nothing to storage');
console.log('ok: sharing tiers — page flow: samples refused, safest default, toggles reach the confirm, zero storage writes');
