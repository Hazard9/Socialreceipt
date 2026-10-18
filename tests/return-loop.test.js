const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ret = require('../return-loop.js');
const journal = require('../journal.js');
const deep = require('../deep-layers.js');

/* ── Constants + copy ── */
assert.equal(ret.THREADS_KEY, 'sr_open_threads_v1');
assert.equal(ret.MAX_THREADS, 5);
assert.equal(ret.SENT_MAX, 500);
assert.equal(ret.THREADS_COPY, 'Conversations you are still in the middle of. Kept on this device only.');
console.log('ok: return loop constants and honest copy');

/* ── makeThread: shape, truncation, null on empty ── */
const t0 = new Date(2026, 9, 17, 9, 0).getTime();
const th = ret.makeThread('Are we okay? I keep thinking about last night.', 'The imbalance is the information', t0);
assert.equal(th.ts, t0);
assert.equal(th.sent, 'Are we okay? I keep thinking about last night.');
assert.equal(th.dynamicLabel, 'The imbalance is the information');
assert.equal(ret.makeThread('plain sent text', null, t0).dynamicLabel, null);
assert.equal(ret.makeThread('x'.repeat(600), null, t0).sent.length, 500, 'sent text truncated to 500 chars');
assert.equal(ret.makeThread('   ', null, t0), null, 'empty sent text makes no thread');
assert.equal(ret.makeThread('', null, t0), null);
console.log('ok: return loop makeThread shape, truncation, null on empty');

/* ── saveThread: newest first, dedupe updates nothing, cap 5 ── */
let threads = [];
threads = ret.saveThread(threads, ret.makeThread('first sent', null, t0));
assert.equal(threads.length, 1);
threads = ret.saveThread(threads, ret.makeThread('second sent', null, t0 + 1000));
assert.equal(threads.length, 2);
assert.equal(threads[0].sent, 'second sent', 'newest first');
const before = JSON.stringify(threads);
threads = ret.saveThread(threads, ret.makeThread('  SECOND   sent ', 'Some label', t0 + 999999));
assert.equal(threads.length, 2, 'same sent text (normalized) adds no thread');
assert.equal(JSON.stringify(threads), before, 'dedupe updates nothing: stored ts and label untouched');
assert.equal(threads[0].ts, t0 + 1000);
for (let i = 0; i < 6; i++) {
  threads = ret.saveThread(threads, ret.makeThread('sent number ' + i, null, t0 + 2000 + i));
}
assert.equal(threads.length, 5, 'cap 5');
assert.equal(threads[0].sent, 'sent number 5', 'newest kept');
assert.equal(threads[4].sent, 'sent number 1', 'oldest fall off the end');
assert.equal(ret.saveThread(threads, null).length, 5, 'null thread is a no-op');
console.log('ok: return loop saveThread newest-first, dedupe, cap 5');

/* ── removeThread ── */
const afterRemove = ret.removeThread(threads, 0);
assert.equal(afterRemove.length, 4);
assert.equal(afterRemove[0].sent, 'sent number 4');
assert.equal(ret.removeThread(threads, 99).length, 5, 'out-of-range index removes nothing');
assert.equal(ret.removeThread(threads, -1).length, 5);
console.log('ok: return loop removeThread');

/* ── threadAgeLabel: calendar days, not 24h blocks ── */
assert.equal(ret.threadAgeLabel(new Date(2026, 9, 17, 8, 0).getTime(), new Date(2026, 9, 17, 12, 0).getTime()), 'Saved today');
assert.equal(ret.threadAgeLabel(new Date(2026, 9, 16, 23, 30).getTime(), new Date(2026, 9, 17, 0, 30).getTime()), 'Waiting 1 day');
assert.equal(ret.threadAgeLabel(new Date(2026, 9, 16, 0, 30).getTime(), new Date(2026, 9, 17, 23, 30).getTime()), 'Waiting 1 day');
assert.equal(ret.threadAgeLabel(new Date(2026, 9, 14, 10, 0).getTime(), new Date(2026, 9, 17, 12, 0).getTime()), 'Waiting 3 days');
console.log('ok: return loop thread age labels');

/* ── Week metrics: the worked example ──
   now = Sat Oct 17 2026, 12:00 local.
   This week (Oct 10 12:00 < ts <= Oct 17 12:00): 5 entries, drafts of
   5/10/15/20/25 words (avg 15), two of them late-night (23:30, 02:00).
   Prev week (Oct 3 12:00 < ts <= Oct 10 12:00): 4 entries, drafts of
   30/40/50/60 words (avg 45), one late-night (must not count).
   Older: 1 entry (Sep 20) counted only in the total. */
const words = n => Array(n).fill('word').join(' ');
const entry = (d, h, mi, n) => ({ ts: new Date(2026, 9, d, h, mi).getTime(), draft: words(n) });
const now = new Date(2026, 9, 17, 12, 0).getTime();
const journalFixture = [
  entry(17, 9, 0, 5),
  entry(16, 23, 30, 10),
  entry(15, 2, 0, 15),
  entry(12, 14, 0, 20),
  entry(11, 8, 0, 25),
  entry(9, 10, 0, 30),
  entry(7, 18, 0, 40),
  entry(5, 7, 0, 50),
  entry(4, 23, 45, 60),
  { ts: new Date(2026, 8, 20, 12, 0).getTime(), draft: words(100) }
];
const m = ret.weekMetrics(journalFixture, now);
assert.equal(m.totalKept, 10);
assert.equal(m.receiptsThisWeek, 5);
assert.equal(m.prevWeekCount, 4);
assert.equal(m.lateNightThisWeek, 2);
assert.deepEqual(m.trend, { thisAvg: 15, lastAvg: 45 });
console.log('ok: return loop week metrics (receipts 5, kept 10, late-night 2, trend 15 vs 45)');

/* ── weekSummary with the real journal + deep modules ── */
const historyFixture = [
  { pattern: 'silence', label: 'Waiting on a reply', ts: new Date(2026, 9, 16, 10, 0).getTime() },
  { pattern: 'silence', label: 'Waiting on a reply', ts: new Date(2026, 9, 15, 10, 0).getTime() },
  { pattern: 'silence', label: 'Waiting on a reply', ts: new Date(2026, 9, 10, 10, 0).getTime() },
  { pattern: 'conflict', label: 'Heated wording', ts: new Date(2026, 9, 9, 10, 0).getTime() }
];
const wk = ret.weekSummary(journalFixture, historyFixture, now, journal, deep);
assert.equal(wk.hasData, true);
assert.equal(wk.totalKept, 10);
assert.equal(wk.receiptsThisWeek, 5);
assert.equal(wk.lateNightThisWeek, 2);
assert.equal(wk.topPattern.key, 'silence');
assert.equal(wk.topPattern.label, 'Waiting on a reply');
assert.equal(wk.topPattern.count, 3);
assert.deepEqual(wk.trend, { thisAvg: 15, lastAvg: 45 });
console.log('ok: return loop weekSummary (top pattern silence x3 via journal.topPattern)');

/* ── Trend gating: needs 3 this week AND 3 the week before ── */
const only2this = [entry(17, 9, 0, 5), entry(16, 9, 0, 5), entry(9, 10, 0, 30), entry(7, 18, 0, 40), entry(5, 7, 0, 50), entry(4, 8, 0, 60)];
assert.equal(ret.weekMetrics(only2this, now).trend, null, 'trend hidden below 3 this week');
const only2prev = [entry(17, 9, 0, 5), entry(16, 9, 0, 5), entry(15, 9, 0, 5), entry(9, 10, 0, 30), entry(7, 18, 0, 40)];
assert.equal(ret.weekMetrics(only2prev, now).trend, null, 'trend hidden below 3 prev week');
assert.equal(ret.weekMetrics([], now).trend, null);
const emptySummary = ret.weekSummary([], [], now, journal, deep);
assert.equal(emptySummary.hasData, false, 'empty journal hides the whole block');
assert.equal(emptySummary.totalKept, 0);
assert.equal(emptySummary.receiptsThisWeek, 0);
assert.equal(emptySummary.topPattern, null);
console.log('ok: return loop trend gating and empty-journal behavior');

/* ── Late-night boundaries (local hour >= 23 or < 5) ── */
assert.equal(ret.isLateNight(new Date(2026, 9, 17, 23, 0).getTime()), true);
assert.equal(ret.isLateNight(new Date(2026, 9, 17, 0, 0).getTime()), true);
assert.equal(ret.isLateNight(new Date(2026, 9, 17, 4, 59).getTime()), true);
assert.equal(ret.isLateNight(new Date(2026, 9, 17, 5, 0).getTime()), false);
assert.equal(ret.isLateNight(new Date(2026, 9, 17, 22, 59).getTime()), false);
console.log('ok: return loop late-night boundaries');

/* ── Today's Pause rotation: exact list, deterministic by day ── */
const EXPECTED_PROMPTS = [
  'What is the text you have rewritten the most this week?',
  'One message you are glad you did not send?',
  'Whose reply are you still waiting on, and what do you actually need to hear?',
  'What would you say if you were not afraid of the reply?',
  'One draft sitting in your notes right now. Read it like a stranger wrote it.',
  'What are you trying to make them feel? Say that part plainly instead.',
  'The apology you keep rehearsing: what is it really for?',
  'What silence are you filling with another message?',
  'Write the version you would send if you trusted them.',
  'What do you need: an answer, an apology, or just to be heard?',
  'Read your last sent text out loud. Would you say it across a table?',
  'What is the kindest true sentence you could send today?',
  'Which conversation deserves a pause before the next word?',
  'What would waiting until morning change about this draft?'
];
assert.deepEqual(ret.PROMPTS, EXPECTED_PROMPTS);
assert.equal(ret.PROMPTS.length, 14);
assert.equal(ret.dayOfYear(new Date(2026, 0, 1)), 1);
assert.equal(ret.promptIndexFor(new Date(2026, 0, 1)), 1);
assert.equal(ret.promptFor(new Date(2026, 0, 1)), EXPECTED_PROMPTS[1]);
assert.equal(ret.promptIndexFor(new Date(2026, 0, 14)), 0, 'day 14 wraps to the first prompt');
assert.equal(ret.promptFor(new Date(2026, 0, 14)), EXPECTED_PROMPTS[0]);
assert.equal(ret.dayOfYear(new Date(2026, 9, 17)), 290);
assert.equal(ret.promptFor(new Date(2026, 9, 17)), EXPECTED_PROMPTS[10]);
assert.equal(ret.promptFor(new Date(2026, 9, 17, 1, 0)), ret.promptFor(new Date(2026, 9, 17, 23, 59)), 'same day, same prompt');
console.log("ok: return loop today's pause rotation (14 prompts, day-of-year modulo)");

/* ── No network surface in the module ── */
const src = fs.readFileSync(path.join(__dirname, '..', 'return-loop.js'), 'utf8');
for (const bad of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket']) {
  assert.ok(!src.includes(bad), 'return-loop.js must not contain ' + bad);
}
console.log('ok: return loop module has no network calls');

/* ── Static wiring: page loads it, cards exist, cache carries it ── */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(html.includes('<script src="/return-loop.js"></script>'), 'index loads return-loop.js');
assert.ok(html.includes('id="homeThreadsCard"'), 'home open-threads card container present');
assert.ok(html.includes('id="todayPausePrompt"'), "today's pause prompt element present");
assert.ok(html.includes('id="bothSidesKeepThread"'), 'both sides keep-thread container present');
assert.ok(html.includes('id="journalWeek"'), 'journal week container present');
assert.ok(html.includes('Keep this thread open'), 'keep-thread button copy present');
assert.ok(html.includes('renderReturnHome();'), 'home refresh hook wired');
assert.ok(html.includes('renderKeepThreadButton();'), 'keep-thread render hook wired');
assert.ok(html.includes('renderJournalWeek();'), 'journal week render hook wired');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert.ok(sw.includes('"/return-loop.js"'), 'service worker precaches /return-loop.js');
assert.ok(sw.includes('social-receipt-v30-return-loop'), 'service worker cache bumped for the return loop');
for (const lineage of ['social-receipt-v27-journal', 'social-receipt-v27-share-card', 'social-receipt-v27-first-thirty', 'social-receipt-v28-share-card', 'social-receipt-v29-first-thirty']) {
  assert.ok(sw.includes(lineage), 'cache lineage keeps ' + lineage);
}
console.log('ok: return loop wiring (script tag, cards, precache, cache version, lineage)');
