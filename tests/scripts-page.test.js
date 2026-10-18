const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scripts.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'scripts-toolkit.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const { loadEngine } = require('./helpers/receipt-engine');

/* ── Document order: value first, signup near the bottom ──────────── */
const scriptsAt = html.indexOf('id="scripts"');
const checkAt = html.indexOf('Your 20-second check.');
const signupAt = html.indexOf('<section class="signup"');
assert(scriptsAt > -1 && signupAt > -1, 'scripts section and signup section both exist');
assert(scriptsAt < signupAt, 'scripts appear before the signup section');
assert(checkAt > scriptsAt && checkAt < signupAt, 'the 20-second check sits between the scripts and the signup');
console.log('ok: scripts page — document order is hero, scripts, check, signup');

/* ── Trap drafts embedded verbatim ────────────────────────────────── */
const TRAPS = [
  { settings: { scenario: 'Work', format: 'Text / DM', feeling: 'Unsure', desiredOutcome: 'Maintain professionalism' },
    draft: 'I am so sorry, I wish I could cover Saturday but my cousin is visiting and I already promised my kids we would do something and I feel terrible about it. Maybe if it was any other weekend I totally would. Please do not be mad.' },
  { settings: { scenario: 'Text / DM', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Get clarity' },
    draft: 'Hey, about tomorrow. I keep thinking about what you might want to talk about and I am kind of spiraling. Did I do something wrong? Are we okay? Please just tell me it is nothing bad.' },
  { settings: { scenario: 'Friend / Family', format: 'Text / DM', feeling: 'Anxious', desiredOutcome: 'Repair tension' },
    draft: 'Sorry. Sorry, sorry. I know I keep saying it but I feel awful and I need you to tell me we are good because I cannot stop thinking about it. Please forgive me.' }
];
for (const trap of TRAPS) assert(html.includes(trap.draft), 'trap draft embedded verbatim: ' + trap.draft.slice(0, 40));
console.log('ok: scripts page — all three trap drafts embedded verbatim');

/* ── Embedded receipts match the real engine, character for character */
const engine = loadEngine();
const embedded = [...html.matchAll(/<span class="receipt-value">([^<]+)<\/span>/g)].map(m => m[1]);
assert.equal(embedded.length, 9, 'three receipt blocks with verdict, strength, and best move each');
TRAPS.forEach((trap, i) => {
  const r = engine.build(trap.draft, trap.settings);
  assert.equal(embedded[i * 3], r.verdict, 'receipt ' + (i + 1) + ' verdict matches buildReceipt');
  assert.equal(embedded[i * 3 + 1], String(r.confidence), 'receipt ' + (i + 1) + ' read strength matches buildReceipt');
  assert.equal(embedded[i * 3 + 2], r.bestMove, 'receipt ' + (i + 1) + ' best move matches buildReceipt');
});
assert.equal((html.match(/A real Social Receipt read of that draft\./g) || []).length, 3, 'each receipt block is labeled as a real read');
assert(!html.includes('receipt-value" data-text'), 'receipt values are static text, never swapped by the language toggle');
console.log('ok: scripts page — embedded verdicts, strengths, and best moves match buildReceipt exactly');

/* ── Three copyable variants per script ───────────────────────────── */
const copyTargets = [...html.matchAll(/data-copy="([^"]+)"/g)].map(m => m[1]);
assert.equal(copyTargets.length, 9, 'nine copy buttons (three variants per script)');
for (const id of copyTargets) assert(html.includes('id="' + id + '"'), 'copy target exists: ' + id);
for (const label of ['Direct', 'Warmer', 'Firmer', 'With repair']) assert(html.includes('>' + label + '<'), 'variant label present: ' + label);
console.log('ok: scripts page — nine copyable variants with Direct / Warmer / Firmer / With repair labels');

/* ── Honest email offer: no emailed-scripts promise anywhere ─────── */
const FORBIDDEN = ['Send me the 3 scripts', 'Keep these scripts in your inbox', 'scripts in your inbox', 'look for the scripts in', 'receive these scripts', 'Envíame los 3 mensajes', 'Guarda estos mensajes en tu correo', 'busca los mensajes en tu correo', 'Recibe los tres mensajes'];
for (const phrase of FORBIDDEN) {
  assert(!html.includes(phrase), 'page does not promise emailed scripts (html): ' + phrase);
  assert(!js.includes(phrase), 'page does not promise emailed scripts (js): ' + phrase);
}
assert(html.includes('Take the scripts with you.'), 'email section headline present');
assert(html.includes('Join the list for occasional Social Receipt tips'), 'email offer promises only list membership and tips');
assert(html.includes('id="gift-email-form"') && html.includes('data-sr-form="gift_email_capture"'), 'form id and analytics hook unchanged');
assert(js.includes("'/.netlify/functions/subscribe-email'"), 'subscribe endpoint unchanged');
assert(js.includes('You’re on the list.'), 'success copy confirms list membership only');
console.log('ok: scripts page — email offer is honest (list plus tips), form contract unchanged');

/* ── Print path delivered by the page itself ──────────────────────── */
assert(html.includes('@media print'), 'print stylesheet present');
assert(html.includes('id="print-page"'), 'print button present');
assert(js.includes("getElementById('print-page')"), 'print button wired to window.print');
console.log('ok: scripts page — print stylesheet and Print this page button');

/* ── App bridge ───────────────────────────────────────────────────── */
assert(html.includes('Check your own draft, free'), 'app CTA copy updated');
assert(html.includes('data-sr-cta="scripts_presend"'), 'app CTA analytics hook kept');
assert(html.includes('Three free receipts a month. No account.'), 'free receipts line under the CTA');
console.log('ok: scripts page — app bridge CTA and free line');

/* ── Spanish parity: the es dictionary covers every data-text key ── */
const htmlKeys = [...new Set([...html.matchAll(/data-text="([A-Za-z0-9]+)"/g)].map(m => m[1]))];
const esBlock = js.slice(js.indexOf('var es={'), js.indexOf('};', js.indexOf('var es={')));
const esKeys = [...esBlock.replace(/'[^']*'/g, "''").matchAll(/([A-Za-z0-9_]+):/g)].map(m => m[1]);
for (const key of htmlKeys) assert(esKeys.includes(key), 'es dictionary covers data-text key: ' + key);
assert(js.includes("receiptNote:'(Lectura generada a partir del borrador en inglés.)'"), 'es receipt note explains the read came from the English draft');
assert(html.includes('data-text="receiptNote"></p>'), 'receipt note element present (empty in English, shown in Spanish)');
console.log('ok: scripts page — Spanish dictionary covers all ' + htmlKeys.length + ' data-text keys');

/* ── Service worker bump with full lineage ────────────────────────── */
assert(sw.includes('social-receipt-v33-scripts'), 'service worker cache bumped for the scripts rebuild');
for (const lineage of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty', 'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty', 'social-receipt-v30-return-loop', 'social-receipt-v31-evidence', 'social-receipt-v31-first-peel', 'social-receipt-v32-first-peel']) {
  assert(sw.includes(lineage), 'sw lineage keeps ' + lineage);
}
console.log('ok: scripts page — sw cache v33-scripts with full lineage');
