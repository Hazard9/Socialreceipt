const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const share = require('../share-card.js');

/* ── Module shape ────────────────────────────────────────────────── */
assert.equal(typeof share.renderToCanvas, 'function', 'render function exists');
assert.equal(typeof share.buildCardModel, 'function', 'card model builder exists');
assert.equal(typeof share.shareReceipt, 'function', 'share entry point exists');
assert.equal(share.CARD_W, 1080, 'card width 1080');
assert.equal(share.CARD_H, 1350, 'card height 1350 (4:5)');
assert.equal(share.PRIVACY_NOTE, 'Your draft text will appear in the image.', 'privacy confirm note present');
console.log('ok: share card module shape (render fn, privacy note, 1080x1350)');

/* ── No network capability in the module ─────────────────────────── */
const src = fs.readFileSync(path.join(__dirname, '..', 'share-card.js'), 'utf8');
for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket']) {
  assert(!src.includes(banned), 'share-card.js must not contain ' + banned);
}
console.log('ok: share card module has no network API strings');

/* ── Card model: only the receipt's real fields ──────────────────── */
const receipt = {
  verdict: "Silence is the signal. Don't overwrite it.",
  rawText: 'Left on read for two days. I am drafting a long follow up.',
  confidence: 67,
  bestMove: 'Do nothing',
  message: 'Hey. No rush. Just making sure this did not get lost.',
  pattern: { label: 'An explanation is being assumed' }
};
const model = share.buildCardModel(receipt);
assert.equal(model.brand, 'SOCIAL RECEIPT');
assert.equal(model.tagline, 'Before you send it, get the receipt.');
assert.equal(model.verdict, receipt.verdict, 'verdict passes through verbatim');
assert.equal(model.excerpt, receipt.rawText, 'short draft passes through verbatim');
assert.equal(model.patternLine, 'Pattern spotted: An explanation is being assumed');
assert.equal(model.strengthLine, 'Read strength: 67');
assert.equal(model.basisLine, 'based on wording matched');
assert.equal(model.bestMove, 'Do nothing');
assert.equal(model.message, receipt.message, 'suggested message passes through verbatim');
assert.equal(model.footerUrl, 'socialreceipt.netlify.app', 'footer url present');
assert.equal(model.footerFree, 'Free: 3 receipts a month', 'footer free line present');

const bare = share.buildCardModel({ verdict: 'V', rawText: 'x', bestMove: 'Wait', message: 'm' });
assert.equal(bare.patternLine, null, 'no pattern on the receipt -> no pattern line invented');
assert.equal(bare.strengthLine, null, 'no confidence on the receipt -> no strength line invented');

/* Truncation: graceful at ~180 chars, ends on a word boundary + ellipsis */
const longDraft = ('This is a very long draft message that keeps going and going with more and more words ' +
  'because the sender cannot stop explaining themselves and every sentence adds another layer of context nobody asked for tonight.');
assert(longDraft.length > 180, 'fixture draft exceeds the cap');
const truncated = share.truncateDraft(longDraft, 180);
assert(truncated.length <= 181, 'excerpt capped at ~180 chars, got ' + truncated.length);
assert(truncated.endsWith('\u2026'), 'truncated excerpt ends with an ellipsis');
assert.equal(share.truncateDraft('  spaced   out  ', 180), 'spaced out', 'whitespace normalized');
console.log('ok: share card model (real fields only, pattern/strength lines, 180-char truncation)');

/* ── Rendering against a stub canvas ─────────────────────────────── */
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
const canvas = fakeCanvas();
const returned = share.renderToCanvas(receipt, canvas);
assert.equal(returned, canvas, 'render returns the canvas');
assert.equal(canvas.width, 1080);
assert.equal(canvas.height, 1350);
const allText = canvas.drawn.join(' ');
for (const expected of ['SOCIAL RECEIPT', 'Before you send it, get the receipt.',
  'Left on read for two days. I am drafting a long follow up.',
  'Pattern spotted: An explanation is being assumed', 'Read strength: 67',
  'based on wording matched', 'Do nothing',
  'Hey. No rush. Just making sure this did not get lost.',
  'socialreceipt.netlify.app', 'Free: 3 receipts a month']) {
  assert(allText.includes(expected), 'card draws: ' + expected);
}
assert(allText.includes("Silence is the signal."), 'card draws the verdict');
console.log('ok: share card render (brand, tagline, draft, verdict, pattern, strength, move, message, footer)');

/* ── Privacy gate: never render silently ─────────────────────────── */
assert.equal(share.shareReceipt(receipt), false, 'no deps -> refused');
assert.equal(share.shareReceipt(receipt, {}), false, 'no confirmPrivacy -> refused');
assert.equal(share.shareReceipt(null, { confirmPrivacy: (d) => d(true) }), false, 'no receipt -> refused');

let canvasesCreated = 0;
function stubDocument() {
  return {
    createElement(tag) {
      if (tag === 'canvas') { canvasesCreated++; return fakeCanvas(); }
      return { href: '', download: '', clicked: false, click() { this.clicked = true; } };
    },
    body: { appendChild() {}, removeChild() {} },
    documentElement: {}
  };
}
canvasesCreated = 0;
assert.equal(share.shareReceipt(receipt, { confirmPrivacy: (d) => d(false), document: stubDocument(), navigator: {} }), true);
assert.equal(canvasesCreated, 0, 'Cancel at the privacy note -> nothing renders');
canvasesCreated = 0;
assert.equal(share.shareReceipt(receipt, { confirmPrivacy: (d) => d(true), document: stubDocument(), navigator: {} }), true);
assert.equal(canvasesCreated, 1, 'Continue at the privacy note -> exactly one card renders');
console.log('ok: share card privacy gate (confirm required, cancel renders nothing)');

/* ── Output: share sheet when available, download otherwise ──────── */
let sharedFiles = null;
const shareNav = {
  canShare(q) { return !!(q && q.files && q.files.length === 1); },
  share(q) { sharedFiles = q.files; return Promise.resolve(); }
};
class FakeFile { constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts && opts.type; } }
share.deliver(fakeCanvas(), { document: stubDocument(), navigator: shareNav, File: FakeFile });
assert(sharedFiles && sharedFiles.length === 1, 'navigator.share receives exactly one file');
assert.equal(sharedFiles[0].name, 'social-receipt.png');
assert.equal(sharedFiles[0].type, 'image/png');
console.log('ok: share card output (share sheet with PNG file, download fallback wired)');

/* ── Static wiring: page loads it, service worker precaches it ───── */
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="/share-card.js"></script>'), 'index.html loads /share-card.js');
assert(indexHtml.includes('Save or share this receipt'), 'receipt render carries the share card button');
assert(indexHtml.includes('Your draft text will appear in the image.'), 'privacy note lives in the page confirm');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert(sw.includes('"/share-card.js"'), 'service worker precaches /share-card.js');
assert(sw.includes('social-receipt-v27-share-card'), 'service worker cache bumped for the share card');
console.log('ok: share card wiring (script tag, button, privacy note, precache, cache version)');
