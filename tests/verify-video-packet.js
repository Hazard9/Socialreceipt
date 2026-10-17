#!/usr/bin/env node
// Required independent gate. Never substitute synthetic controls for the real packet.
// Format: {cases:[{id,draft,settings:{scenario,format,feeling,desiredOutcome},expected:{14 legacy fields}}]}
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {loadEngine}=require('./helpers/receipt-engine');
function verifyPacket(file) {
if(!file){console.error('BLOCKED: supply the six posted-video cases and intro validation packet: node tests/verify-video-packet.js <packet.json>');return 2;}
const packet=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(packet.cases.length,7,'requires six posted videos plus intro');
const engine=loadEngine();let failed=0;
for(const item of packet.cases){
 assert.equal(Object.keys(item.expected).length,14,`${item.id}: exactly 14 expected legacy fields required`);
 for(const key of ['scenario','format','feeling','desiredOutcome']) assert(Object.hasOwn(item.settings,key),`${item.id}: missing ${key}`);
 const actual=engine.build(item.draft,item.settings,item.context||{});
 for(const [field,expected] of Object.entries(item.expected)){
  try{assert.deepEqual(actual[field],expected);console.log(`PASS ${item.id} ${field}`);}
  catch{failed++;console.error(`FAIL ${item.id} ${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[field])}`);}
 }
 assert(!Object.hasOwn(actual,'guidance'),`${item.id}: guidance must not be attached`);
}
console.log(`Video compatibility: ${98-failed}/98 fields passed`);return failed?1:0;
}
module.exports={verifyPacket};
if(require.main===module) process.exitCode=verifyPacket(process.argv[2]);
