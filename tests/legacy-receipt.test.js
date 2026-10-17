const assert=require('node:assert/strict');
const {loadEngine}=require('./helpers/receipt-engine');
const engine=loadEngine();
const controls=require('./fixtures/legacy-spine-controls.json');
for(const item of controls.cases){
 const r=engine.build(item.draft,item.settings);
 for(const field of controls.fields) assert.deepEqual(r[field],item.expected[field],`${item.draft} / ${item.settings.feeling} / ${field}`);
 assert.deepEqual(r.whySignals,item.whySignals,'legacy why signals must be retained exactly');
 assert(!Object.hasOwn(r,'guidance'),'legacy renderer must remain active');
}
console.log(`ok: ${controls.cases.length} synthetic legacy controls × ${controls.fields.length} fields (not the seven posted videos)`);
const concepts=require('./fixtures/concept-patterns.json');
for(const item of concepts){
 const context={perspective:'outgoing',language:'en'};
 const settings={scenario:'Text / DM',format:'Text / DM',feeling:'Unsure',desiredOutcome:'Get clarity'};
 const base=engine.build(item.draft,settings,context);
 const goal=engine.build(item.draft,settings,{...context,goal:item.goal});
 assert.deepEqual(goal.pattern,item.pattern,`concept ${item.id}: PR #93 pattern preserved`);
 assert(goal.pattern.evidence.length,`concept ${item.id}: evidence`);
 assert(goal.patternWhySignals.some(s=>s.includes('Matched wording')),`concept ${item.id}: displayed evidence`);
 assert.equal(goal.message,base.message,`concept ${item.id}: never replace the legacy message`);
 assert(goal.goalSuggestion,`concept ${item.id}: additive goal suggestion`);
 assert(!Object.hasOwn(goal,'guidance'));
 assert(!Object.hasOwn(base,'goalSuggestion'),'no goal means no goal-specific wording');
 console.log(`ok: concept ${item.id}: ${goal.pattern.label}; evidence ${JSON.stringify(goal.pattern.evidence)}`);
}
const generic="I will handle everything myself as usual.";
const fallback=engine.build(generic,{feeling:'Unsure'},{perspective:'outgoing'});
assert.equal(fallback.verdict,fallback.pattern.label);
assert.equal(fallback.bestMove,'Clarify the goal');
const nonFallback=engine.build(generic,{feeling:'Anxious'},{perspective:'outgoing'});
assert.equal(nonFallback.verdict,'Your read is anxious, not accurate. Wait 12 hours.');
assert.equal(nonFallback.bestMove,'Wait');
for(const word of ['ignore','ignored','ignores','ignoring']) assert(engine.analyze('Are you '+word+' me?').silence,word);
for(const phrase of ['you never','never listen','you only care','if you actually cared','if you cared']) assert(engine.analyze(phrase).conflict,phrase);
assert(engine.analyze('Whatever.').oneWord);
assert(!engine.analyze('Whatever you decide I will carefully document all of the agreed next steps.').oneWord);
assert(engine.analyze("Sorry, I was late.").apology);
assert(engine.analyze('Please tell me we are okay.').highIntent);
console.log('ok: requested phrase additions, fallback-only override and legacy message separation');
