const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function loadEngine(html = fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8')) {
  const analysis = require('../../presend-analysis');
  const guidance = require('../../draft-guidance');
  const sandbox = {
    state:{scenario:'Text / DM',format:'Text / DM',feeling:'Unsure',desiredOutcome:'Get clarity'},
    window:{SocialReceiptAnalysis:analysis,SocialReceiptGuidance:guidance},
    document:{getElementById:()=>null},
    getCurrentUser:()=>({anonId:'test-user',email:null})
  };
  vm.createContext(sandbox);
  const names=['includesAny','analyzeText','computeConfidence','buildWhySignals','getVerdict','makeReceipt','escapeHtml','readReceiptPatternContext','addReceiptPattern','buildReceipt'];
  for (const name of names) {
    const start=html.indexOf('function '+name+'(');
    if(start<0) continue;
    const next=html.indexOf('\nfunction ',start+10);
    vm.runInContext(html.slice(start,next<0?undefined:next),sandbox);
  }
  return {
    build(draft,settings={},context={}) {
      Object.assign(sandbox.state,settings);
      return JSON.parse(JSON.stringify(sandbox.buildReceipt(draft,context)));
    },
    analyze:sandbox.analyzeText,
    sandbox
  };
}
module.exports={loadEngine};
