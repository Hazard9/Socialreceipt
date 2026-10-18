'use strict';
/*
 * Read-quality challenge set runner (path to 9.0, step 2).
 *
 * Runs every case in tests/challenge-set.json through the CURRENT
 * engine (same harness as the rest of the suite) and records the full
 * receipt surface the audit asked about: verdict, confidence, pattern,
 * best move, suggested message, plus the flags analyzeText raised and
 * the secondary fields (interest/energy/risk/momentum/hidden/dont/
 * next/timing) that show how the read was assembled.
 *
 * The FIT judgment (fits / borderline / misfit) is a human judgment
 * stored in challenge-set.json; this runner never invents or alters
 * it. It only refuses to call the set complete while a judgment is
 * missing.
 *
 * Usage:
 *   node tests/run-challenge-set.js            # write + print
 *   node tests/run-challenge-set.js --check    # also exit 1 on any misfit
 *
 * Output: tests/challenge-results.json and a compact table on stdout.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEngine } = require('./helpers/receipt-engine');

const setPath = path.join(__dirname, 'challenge-set.json');
const outPath = path.join(__dirname, 'challenge-results.json');
const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
const engine = loadEngine();

const FLAG_NAMES = ['conflict', 'delay', 'silence', 'apology', 'positive',
  'professional', 'romantic', 'sales', 'overExplain', 'highIntent', 'oneWord'];

const results = [];
for (const c of set.cases) {
  const settings = Object.assign({ format: 'Text / DM' }, c.settings);
  const a = engine.analyze(c.draft);
  const flags = {};
  for (const f of FLAG_NAMES) flags[f] = Boolean(a[f]);
  const r = engine.build(c.draft, settings, {});
  results.push({
    id: c.id,
    family: c.family,
    draft: c.draft,
    settings,
    intent: c.intent,
    flags,
    verdict: r.verdict,
    confidence: r.confidence,
    pattern: r.pattern ? { label: r.pattern.label, evidence: r.pattern.evidence } : null,
    bestMove: r.bestMove,
    suggestedMessage: r.message,
    interest: r.interest,
    energy: r.energy,
    risk: r.risk,
    momentum: r.momentum,
    hidden: r.hidden,
    dont: r.dont,
    next: r.next,
    timing: r.timing,
    whySignals: r.whySignals,
    fit: c.fit,
    fitWhy: c.fitWhy
  });
}

const missing = results.filter(r => !r.fit);
const counts = { fits: 0, borderline: 0, misfit: 0, unjudged: missing.length };
for (const r of results) if (r.fit && counts[r.fit] !== undefined) counts[r.fit] += 1;

const out = {
  generatedFrom: 'tests/challenge-set.json',
  engineBaseline: 'main f4e6583 (plus any local challenge fixes when re-run)',
  counts,
  results
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

for (const r of results) {
  console.log('### ' + r.id + ' [' + r.family + '] fit=' + (r.fit || 'UNJUDGED'));
  console.log('  draft: ' + JSON.stringify(r.draft));
  console.log('  ctx:   ' + r.settings.scenario + ' / ' + r.settings.feeling + ' / ' + r.settings.desiredOutcome);
  console.log('  flags: ' + FLAG_NAMES.filter(f => r.flags[f]).join(', ') || '  flags: (none)');
  console.log('  verdict (' + r.confidence + '): ' + r.verdict);
  console.log('  pattern: ' + (r.pattern ? r.pattern.label + ' [' + (r.pattern.evidence || []).join(' + ') + ']' : 'none'));
  console.log('  bestMove: ' + r.bestMove + ' | timing: ' + r.timing + ' | risk: ' + r.risk);
  console.log('  suggested: ' + JSON.stringify(r.suggestedMessage));
  if (r.fitWhy) console.log('  fitWhy: ' + r.fitWhy);
}
console.log('\ncounts: ' + JSON.stringify(counts) + ' of ' + results.length + ' cases');
if (missing.length) console.log('UNJUDGED: ' + missing.map(r => r.id).join(', '));
console.log('wrote ' + path.relative(process.cwd(), outPath));

if (process.argv.includes('--check') && counts.misfit > 0) process.exit(1);
