const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bs = require('../both-sides.js');
const deep = require('../deep-layers.js');

/* Load the app's real analyzeText (and its helper) out of index.html so
   the facts below run on the exact engine the page uses. */
function loadPageFunctions(names, extra) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sandbox = Object.assign({ console }, extra || {});
  vm.createContext(sandbox);
  for (const name of names) {
    const start = html.indexOf('function ' + name + '(');
    assert(start >= 0, 'index.html defines ' + name);
    const next = html.indexOf('\nfunction ', start + 10);
    vm.runInContext(html.slice(start, next < 0 ? undefined : next), sandbox);
  }
  return sandbox;
}
const engine = loadPageFunctions(['includesAny', 'analyzeText']);
const analyzeText = engine.analyzeText;

/* ── Fixture exchanges ─────────────────────────────────────────────── */
const FIXTURES = [
  {
    id: 'imbalance', time: 'days',
    sent: "I have been thinking about Saturday all week and I keep going back and forth on whether I should even bring this up. Did I do something wrong the other night? You went quiet after dinner and I have not heard from you since. Are you upset with me about something I said? I just need to know where we stand?",
    reply: "Yeah ok sounds good",
    facts: { sentWords: 61, replyWords: 4, sentQuestions: 3, replyQuestions: 0, ratio: 15.3,
      wordsLine: "You sent 61 words. The reply was 4.",
      ratioLine: "The reply is a fraction of what you sent.",
      questionsLine: "You asked 3 questions. The reply asks none back.",
      signals: { positive: true, oneWord: true, apology: false, conflict: false, dismissal: false } },
    rule: 'imbalance', recommend: 'wait', state: 'Waiting in the silence'
  },
  {
    id: 'warm-stalled', time: 'hours',
    sent: "Hey, I was thinking we could do dinner at my place on Saturday and I can cook that pasta you liked. Do you want to come over around seven? And should I grab anything special from the store on my way home from work?",
    reply: "That sounds great, thanks so much!",
    facts: { sentWords: 44, replyWords: 6, sentQuestions: 2, replyQuestions: 0,
      signals: { positive: true, oneWord: false, apology: false, conflict: false, dismissal: false } },
    rule: 'warm-stalled', recommend: 'close', state: 'Reaching for certainty'
  },
  {
    id: 'repair', time: 'hours',
    sent: "I hate how we left things last night and I have been thinking about it all day at work. I should not have raised my voice like that.",
    reply: "I'm sorry about last night. Let's talk tomorrow after work, I'll call you.",
    facts: { sentWords: 28, replyWords: 13, sentQuestions: 0, replyQuestions: 0,
      signals: { positive: false, oneWord: false, apology: true, conflict: false, dismissal: false },
      planPhrase: "Let's talk" },
    rule: 'repair', recommend: 'reply', state: 'Settled'
  },
  {
    id: 'heated', time: 'minutes',
    sent: "I need you to actually hear me on this because it keeps happening and I am tired of repeating myself every single week.",
    reply: "You never listen to anyone. This is exactly what you always do, every single time.",
    facts: { sentWords: 23, replyWords: 15, sentQuestions: 0, replyQuestions: 0,
      signals: { positive: false, oneWord: false, apology: false, conflict: true, dismissal: false },
      conflictPhrase: "You never" },
    rule: 'heated', recommend: 'wait', state: 'Activated'
  },
  {
    id: 'engaged', time: 'hours',
    sent: "The car died again this morning and the shop still has it. Did he say anything to you about when it might be ready? I am stuck without it for work tomorrow and I do not know what to do.",
    reply: "Wait, what happened with the car? Did he say when it would be ready? I can drive you Thursday if that helps.",
    facts: { sentWords: 40, replyWords: 22, sentQuestions: 1, replyQuestions: 2,
      signals: { positive: false, oneWord: false, apology: false, conflict: false, dismissal: false } },
    rule: 'engaged', recommend: 'reply', state: 'Settled'
  },
  {
    id: 'dismissed', time: 'minutes',
    sent: "Are we still good for the weekend trip or did the plans change on your end? I need to know by tonight so I can book the room.",
    reply: "Whatever.",
    facts: { sentWords: 28, replyWords: 1, sentQuestions: 1, replyQuestions: 0,
      signals: { positive: false, oneWord: true, apology: false, conflict: false, dismissal: true },
      dismissalPhrase: "Whatever" },
    rule: 'dismissed', recommend: 'close', state: 'Sending to undo a feeling'
  },
  {
    id: 'slow-warm', time: 'days',
    sent: "I know you have been busy but I wanted to check in because we never confirmed anything for this weekend. Are we still doing dinner at your sister's place on Saturday night?",
    reply: "Hey, sorry for the slow reply, work has been a lot. Dinner Saturday sounds really good to me.",
    facts: { sentWords: 32, replyWords: 18, sentQuestions: 1, replyQuestions: 0,
      signals: { positive: true, oneWord: false, apology: true, conflict: false, dismissal: false } },
    rule: 'slow-warm', recommend: 'reply', state: 'Running the worst case'
  },
  {
    id: 'open', time: 'hours',
    sent: "Just sending the update on the schedule change for next week. The meeting moved to Thursday morning and the room changed too. Let me know you got this when you can.",
    reply: "I got your message. Things are busy here but I saw the update about the schedule.",
    facts: { sentWords: 31, replyWords: 16, sentQuestions: 0, replyQuestions: 0,
      signals: { positive: false, oneWord: false, apology: false, conflict: false, dismissal: false },
      signalNames: [], signalsLine: "No strong wording signals detected in the reply." },
    rule: 'open', recommend: 'wait', state: 'Drafting through fog'
  }
];

/* ── Facts accuracy + rule selection per fixture ── */
for (const fx of FIXTURES) {
  const res = bs.analyzeExchange(fx.sent, fx.reply, fx.time, analyzeText, deep);
  const f = res.facts, e = fx.facts;
  assert.equal(f.sentWords, e.sentWords, fx.id + ': sent word count');
  assert.equal(f.replyWords, e.replyWords, fx.id + ': reply word count');
  assert.equal(f.sentQuestions, e.sentQuestions, fx.id + ': questions asked');
  assert.equal(f.replyQuestions, e.replyQuestions, fx.id + ': questions in the reply');
  assert.deepEqual(f.signals, e.signals, fx.id + ': detected signals on the reply');
  if (e.ratio !== undefined) assert.equal(f.ratio, e.ratio, fx.id + ': ratio');
  if (e.wordsLine) assert.equal(f.wordsLine, e.wordsLine, fx.id + ': words line');
  if (e.ratioLine) assert.equal(f.ratioLine, e.ratioLine, fx.id + ': ratio wording');
  if (e.questionsLine) assert.equal(f.questionsLine, e.questionsLine, fx.id + ': questions line');
  if (e.planPhrase) assert.equal(f.planPhrase, e.planPhrase, fx.id + ': plan phrase quoted');
  if (e.conflictPhrase) assert.equal(f.conflictPhrase, e.conflictPhrase, fx.id + ': conflict phrase quoted');
  if (e.dismissalPhrase) assert.equal(f.dismissalPhrase, e.dismissalPhrase, fx.id + ': dismissal phrase quoted');
  if (e.signalNames) assert.deepEqual(f.signalNames, e.signalNames, fx.id + ': signal names');
  if (e.signalsLine) assert.equal(f.signalsLine, e.signalsLine, fx.id + ': signals line');

  assert.equal(res.rule.id, fx.rule, fx.id + ': dynamic rule selection');
  assert.equal(res.rule.recommend, fx.recommend, fx.id + ': recommended move follows the rule');
  assert(res.rule.name && res.rule.because.startsWith('because'), fx.id + ': rule carries a name and a because');
  assert.equal(res.state.label, fx.state, fx.id + ': state check reuses the layer-3 naming');

  assert.equal(res.moves.length, 3, fx.id + ': three next-move options');
  assert.deepEqual(res.moves.map(m => m.key), ['wait', 'close', 'reply'], fx.id + ': move order is Wait / One clean close / Send a reply');
  const marked = res.moves.filter(m => m.recommended);
  assert.equal(marked.length, 1, fx.id + ': exactly one recommended move');
  assert.equal(marked[0].key, fx.recommend, fx.id + ': the marked move is the rule recommendation');
}
console.log('ok: both sides facts accuracy + dynamic rule selection across ' + FIXTURES.length + ' fixture exchanges');

/* ── Reply-time chip parsing ── */
assert.deepEqual(bs.TIME_CHIPS.map(c => c.key), ['minutes', 'hours', 'next-day', 'days'], 'four reply-time chips in order');
assert.equal(bs.parseReplyTime('minutes').label, 'Minutes');
assert.equal(bs.parseReplyTime('hours').phrase, 'within hours');
assert.equal(bs.parseReplyTime('next-day').label, 'Next day');
assert.equal(bs.parseReplyTime('days').phrase, 'after days');
assert.equal(bs.parseReplyTime('eventually'), null, 'unknown time keys are rejected');
assert.equal(bs.parseReplyTime(''), null, 'empty time key is rejected');
console.log('ok: both sides reply-time chip parsing');

/* ── State check needs the deep module, and stays the user\'s state ── */
assert.equal(bs.stateCheckFor('imbalance', null), null, 'state check is null without the deep module');
assert.equal(bs.analyzeExchange(FIXTURES[0].sent, FIXTURES[0].reply, 'days', analyzeText, null).state, null, 'exchange still reads without the deep module');
console.log('ok: both sides state check degrades cleanly without the deep module');

/* ── Composed reply carries a verbatim fragment in every fixture ── */
function hasVerbatimFragment(output, sourceA, sourceB) {
  for (const source of [sourceA, sourceB]) {
    const words = String(source).split(/\s+/);
    for (let i = 0; i + 4 <= words.length; i++) {
      if (output.indexOf(words.slice(i, i + 4).join(' ')) !== -1) return true;
    }
  }
  return false;
}
for (const fx of FIXTURES) {
  for (const stance of deep.STANCES) {
    const out = bs.composeNextReply(fx.sent, fx.reply, stance, deep);
    assert(out && out.length > 0, fx.id + ': composed reply produced for stance ' + stance);
    assert(hasVerbatimFragment(out, fx.sent, fx.reply), fx.id + ': composed reply for "' + stance + '" must contain a verbatim 4+ word fragment of the sent text or the reply. Got: ' + out);
  }
}
assert.equal(bs.composeNextReply('a b c', 'reply text here now', 'Warm', deep).length > 0, true, 'short sent text falls back to the reply as the fragment source');
assert.equal(bs.REWRITE_LABEL, 'A starting point built from your words. Edit it freely.');
console.log('ok: both sides composed replies carry verbatim fragments across all fixtures x stances');

/* ── Page-level Pro gating: facts free, the read locked ── */
function fakeStorage() {
  const data = {};
  return {
    getItem: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}
const storage = fakeStorage();
const page = loadPageFunctions(['escapeHtml', 'isPro', 'bothSidesFactsHtml', 'bothSidesComposeHtml', 'bothSidesOutputHtml'], {
  window: { SocialReceiptBothSides: bs, SocialReceiptDeep: deep },
  localStorage: storage,
  document: { getElementById: () => null }
});
page._bothSides = { time: 'days', stance: null, sent: FIXTURES[0].sent, reply: FIXTURES[0].reply, result: null };
const fxResult = bs.analyzeExchange(FIXTURES[0].sent, FIXTURES[0].reply, 'days', analyzeText, deep);

const freeHtml = page.bothSidesOutputHtml(fxResult);
assert(freeHtml.includes('The facts, in words'), 'free output shows the facts strip');
assert(freeHtml.includes('You sent 61 words. The reply was 4.'), 'free facts strip includes the word counts');
assert(freeHtml.includes('openPaywall'), 'free output routes to the existing paywall');
assert(!freeHtml.includes('The imbalance is the information'), 'free output does NOT show the dynamic read');
assert(!freeHtml.includes('One clean close') && !freeHtml.includes('Recommended'), 'free output does NOT show the next-move options or a recommendation');

storage.setItem('sr_pro', '1');
const proHtml = page.bothSidesOutputHtml(fxResult);
assert(proHtml.includes('The imbalance is the information'), 'Pro output shows the dynamic read');
assert(proHtml.includes('Waiting in the silence'), 'Pro output shows the state check with layer-3 naming');
assert(proHtml.includes('The next move') && proHtml.includes('Recommended'), 'Pro output shows the three moves with one recommended');
assert(!proHtml.includes('openPaywall'), 'Pro output does not route to the paywall');
page._bothSides.stance = 'Warm';
const composedHtml = page.bothSidesOutputHtml(fxResult);
assert(composedHtml.includes(bs.REWRITE_LABEL), 'Pro output labels the composed reply a starting point');
assert(hasVerbatimFragment(composedHtml, FIXTURES[0].sent, FIXTURES[0].reply), 'rendered composed reply carries a verbatim fragment');
console.log('ok: both sides page gating (facts free; dynamic read, state, moves, composed reply Pro-only)');

/* ── Static wiring: module loaded by the page and precached ── */
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="/both-sides.js"></script>'), 'index.html loads /both-sides.js');
assert(indexHtml.includes('id="bothSidesScreen"'), 'index.html has the Both Sides screen');
assert(indexHtml.includes('id="bsSentText"') && indexHtml.includes('id="bsReplyText"') && indexHtml.includes('id="bsTimeRow"'), 'Both Sides screen carries both text areas and the time chips');
assert(indexHtml.includes('After you sent it'), 'the section heading is present');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert(sw.includes('"/both-sides.js"'), 'service worker precaches /both-sides.js');
console.log('ok: both sides module wiring (script tag + screen + precache)');
