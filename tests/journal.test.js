const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const journal = require('../journal.js');
const deep = require('../deep-layers.js');

/* ── Constants + copy ── */
assert.equal(journal.JOURNAL_KEY, 'sr_receipt_journal_v1');
assert.equal(journal.MAX_ENTRIES, 30);
assert.equal(journal.DRAFT_MAX, 280);
assert.equal(journal.EMPTY_LINE, 'Your receipts will live here, on this device only.');
assert.equal(journal.PRIVACY_LINE, 'Kept on this device only. Nothing is uploaded.');
console.log('ok: journal constants and honest copy');

/* ── makeEntry: summary fields + full receipt kept ── */
const MIN = 60000;
const now = new Date(2026, 9, 17, 21, 30).getTime();
const receipt = {
  rawText: 'Sorry again. I feel awful. Please tell me you are not still mad at me.',
  scenario: 'Date',
  verdict: 'This needed space. You almost overplayed it.',
  pattern: { label: 'Repeated apology seeking reassurance', detail: 'd', evidence: ['sorry'] },
  confidence: 44,
  bestMove: 'Wait'
};
const entry = journal.makeEntry(receipt, now);
assert.equal(entry.ts, now);
assert.equal(entry.draft, receipt.rawText);
assert.equal(entry.scenario, 'Date');
assert.equal(entry.verdict, receipt.verdict);
assert.equal(entry.patternLabel, 'Repeated apology seeking reassurance');
assert.equal(entry.confidence, 44);
assert.equal(entry.receipt, receipt, 'full receipt object stored for re-render');
const noPattern = journal.makeEntry({ rawText: 'ok', scenario: 'Work', verdict: 'v', confidence: 3 }, now);
assert.equal(noPattern.patternLabel, null, 'patternLabel falls back to null');
assert.equal(journal.makeEntry(null, now), null);
console.log('ok: journal makeEntry summary fields + full receipt');

/* ── Draft truncation at 280 chars ── */
const longDraft = 'x'.repeat(400);
const longEntry = journal.makeEntry({ rawText: longDraft, scenario: 'Work', verdict: 'v' }, now);
assert.equal(longEntry.draft.length, 280);
assert.equal(journal.truncateDraft('short'), 'short');
console.log('ok: journal draft truncated to 280 chars');

/* ── recordEntry: newest first, 10-minute dedupe, cap 30 ── */
let list = [];
list = journal.recordEntry(list, journal.makeEntry({ rawText: 'first draft', scenario: 'Work', verdict: 'a' }, now), now);
assert.equal(list.length, 1);
list = journal.recordEntry(list, journal.makeEntry({ rawText: 'second draft', scenario: 'Work', verdict: 'b' }, now + MIN), now + MIN);
assert.equal(list.length, 2);
assert.equal(list[0].draft, 'second draft', 'newest first');
list = journal.recordEntry(list, journal.makeEntry({ rawText: '  SECOND   draft ', scenario: 'Work', verdict: 'b2' }, now + 5 * MIN), now + 5 * MIN);
assert.equal(list.length, 2, 'same draft (normalized) within 10 minutes adds no entry');
list = journal.recordEntry(list, journal.makeEntry({ rawText: 'second draft', scenario: 'Work', verdict: 'b3' }, now + 12 * MIN), now + 12 * MIN);
assert.equal(list.length, 3, 'same draft after the dedupe window records again');
assert.equal(journal.recordEntry(list, null, now).length, 3, 'null entry is a no-op');
for (let i = 0; i < 40; i++) {
  list = journal.recordEntry(list, journal.makeEntry({ rawText: 'draft number ' + i, scenario: 'Work', verdict: 'v' }, now + (20 + i) * MIN), now + (20 + i) * MIN);
}
assert.equal(list.length, 30, 'journal caps at 30 entries');
assert.equal(list[0].draft, 'draft number 39', 'cap keeps the newest');
assert(!list.some(e => e.draft === 'first draft'), 'cap drops the oldest');
console.log('ok: journal recordEntry newest-first, dedupe window, 30-entry cap');

/* ── firstLine for the list view ── */
assert.equal(journal.firstLine('hello there\nsecond line'), 'hello there');
assert.equal(journal.firstLine('single line'), 'single line');
assert.equal(journal.firstLine(''), '');
assert(journal.firstLine('y'.repeat(120)).endsWith('\u2026'), 'long first lines are ellipsized');
console.log('ok: journal firstLine');

/* ── topPattern: Deep Layer 5 summary home ── */
const DAY = 86400000;
const hist = [
  { pattern: 'flag:silence', label: 'silence', scenario: 'Date', draft: 'a', ts: now - DAY },
  { pattern: 'pattern:Repeated apology seeking reassurance', label: 'Repeated apology seeking reassurance', scenario: 'Date', draft: 'b', ts: now - 2 * DAY },
  { pattern: 'pattern:Repeated apology seeking reassurance', label: 'Repeated apology seeking reassurance', scenario: 'Date', draft: 'c', ts: now - 3 * DAY },
  { pattern: 'pattern:Repeated apology seeking reassurance', label: 'Repeated apology seeking reassurance', scenario: 'Work', draft: 'd', ts: now - 4 * DAY }
];
const top = journal.topPattern(hist, now, deep);
assert.equal(top.key, 'pattern:Repeated apology seeking reassurance');
assert.equal(top.count, 3, 'count comes from deep.patternSummary count30');
assert.equal(top.display, '\u201CRepeated apology seeking reassurance\u201D');
const topNoDeep = journal.topPattern(hist, now, null);
assert.equal(topNoDeep.count, 3, 'without the deep module it falls back to the raw frequency');
assert.equal(journal.topPattern([], now, deep), null, 'no history, no summary');
assert.equal(journal.topPattern([{ pattern: 'flag:silence', label: 'silence', draft: 'x', ts: now - 40 * DAY }], now, deep), null, 'stale-only history shows no summary');
console.log('ok: journal topPattern uses patternSummary over the pattern history');

/* ── formatWhen ── */
assert(/\d/.test(journal.formatWhen(now)), 'formatWhen renders a readable date/time');
assert.equal(journal.formatWhen(NaN), '');
console.log('ok: journal formatWhen');

/* ── No network surface in the module ── */
const src = fs.readFileSync(path.join(__dirname, '..', 'journal.js'), 'utf8');
for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource']) {
  assert(!src.includes(banned), 'journal.js must not reference ' + banned);
}
console.log('ok: journal module has no network calls');

/* ── Wiring: script tag, precache, home card, journal screen, hook ── */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(html.includes('<script src="/journal.js"></script>'), 'index.html loads journal.js');
assert(html.includes('id="journalScreen"'), 'index.html carries the journal screen');
assert(html.includes('id="homeJournalText"'), 'home carries the journal entry card');
assert(html.includes('recordJournalEntry(receipt);'), 'fresh receipts are journaled at the generate hook');
assert(html.includes('_journalReplay'), 'reopen guard flag is wired');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert(sw.includes('"/journal.js"'), 'service worker precaches journal.js');
assert(sw.includes('social-receipt-v27-journal'), 'service worker cache bumped for the journal');
console.log('ok: journal wiring in index.html and sw.js');
