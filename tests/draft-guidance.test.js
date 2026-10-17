const assert = require('node:assert/strict');
const {analyze} = require('../presend-analysis');
const {guide} = require('../draft-guidance');
const examples = [
 ['Did I do something wrong, or are you ignoring me?', 'confirm', 'intent-attribution', 'confirm-plan'],
 ["I'm so sorry, I can't cover Saturday. I know that makes things harder, but I'm exhausted and I already changed my plans last time.", 'decline', 'boundary-defense', 'direct-limit'],
 ["It's fine. I'll do everything myself like always.", 'help', 'resigned-self-reliance', 'help-request'],
 ['You never listen. You only care when something affects you.', 'request', 'absolute-blame', 'specific-concern'],
 ["I'm sorry again. I feel awful. Please tell me you're not still mad at me.", 'repair', 'repeated-apology', 'repair'],
 ["Do whatever you want. It's not like my opinion matters.", 'input', 'reluctant-agreement', 'shared-decision'],
 ["I did exactly what you asked, so I don't understand why this is suddenly a problem.", 'feedback', 'defensive-proof', 'feedback'],
 ['If you actually cared about me, you would make time.', 'connection', 'guilt-pressure', 'connection'],
 ["I'm done. I can't do this anymore.", 'pause', 'ambiguous-finality', 'pause'],
 ["Sure, whatever works for you. I'll figure it out somehow.", 'alternative', 'agreement-limit', 'alternative']
];
let count = 0;
for (const [draft,goal,id,template] of examples) {
 const context={perspective:'outgoing',goal,language:'en',urgency:'nonurgent'};
 const a=analyze(draft,context), g=guide(draft,context,a);
 assert(a.signals.some(s=>s.id===id && s.evidence.length), draft);
 assert.equal(g.templateId,template,draft);
 assert(g.suggestion && !g.suggestion.includes('Had a really good time'),draft);
 assert(!/\b(?:seven|eight|Sunday morning|bedtime|dishes)\b/.test(g.suggestion),'invented details');
 assert(!/they (?:are|want|feel|chose)/i.test(g.next),'invented intent');
 const received=guide(draft,{...context,perspective:'received'});
 assert.equal(received.suggestion,'','must not rewrite incoming as outgoing');
 assert(received.question);
 const unknown=guide(draft,{goal,language:'en'});
 assert.equal(unknown.suggestion,'');
 const quote=analyze('They wrote "'+draft.replace(/"/g,'')+'"',{language:'en',quoted:true});
 assert(!quote.signals.some(s=>s.id===id),'quoted phrase contributed to signal');
 count++;
}
for (const draft of ["Pick whatever restaurant you want. Both work for me.","I'm done with the report.",'You never need to apologize for asking.',"I'm not available tonight."]) {
 const a=analyze(draft,{language:'en',situation:'routine'});
 assert(!a.signals.some(s=>s.kind==='concern'||s.kind==='high'),draft);
 assert.equal(guide(draft,{perspective:'outgoing',language:'en',situation:'routine'},a).suggestion,'');
 count++;
}
for (const [draft,id] of [["Are you avoiding me?",'intent-attribution'],["If you really cared, you'd come.",'guilt-pressure'],["I will handle everything myself as usual.",'resigned-self-reliance'],["I did what you asked.",'defensive-proof']]) {
 assert(analyze(draft,{language:'en'}).signals.some(s=>s.id===id),draft);count++;
}
const ending=examples[8][0];
assert(guide(ending,{perspective:'outgoing',language:'en'}).question.includes('pause'));
assert.equal(guide(ending,{perspective:'outgoing',goal:'end',language:'en'}).templateId,'end');
assert(guide(examples[0][0],{perspective:'outgoing',goal:'confirm',urgency:'urgent',language:'en'}).next.includes('urgent'));
assert.equal(guide('你好吗',{perspective:'outgoing',goal:'confirm'}).suggestion,'');
assert.equal(guide('You will regret it.',{perspective:'outgoing',goal:'request',language:'en'}).suggestion,'');
// Actual refusal subject is retained, with no invented alternative availability.
assert.match(guide(examples[1][0],{perspective:'outgoing',goal:'decline',language:'en'}).suggestion,/can't cover Saturday/);
console.log(`ok: ${count} scenario/control/paraphrase cases plus perspective, quote, urgency and relevance assertions`);

const ownership = analyze("I'll do everything myself.", {language:'en'});
assert(ownership.signals.some(s=>s.id==='self-reliance' && s.kind==='context'));
assert.equal(guide("I'll do everything myself.", {perspective:'outgoing',goal:'help',language:'en'}, ownership).templateId,'help-request');
