#!/usr/bin/env node
/*
  Social Receipt — lightweight deterministic validation
  ════════════════════════════════════════════
  Zero dependencies, runs in a few hundred milliseconds. This is the fast
  guardrail that runs on every push: it catches the exact class of bug
  that shipped before (demo-mode payment unlock, a service worker
  precaching a file that doesn't exist, placeholder Stripe links, secrets
  committed to the repo). It does NOT replace the Playwright e2e suite in
  tests/e2e.spec.js, which covers real user flows in a browser.

  Coverage:
   - required files exist
   - no Stripe placeholder links remain
   - no confirm()-based demo Pro unlock remains
   - payment success is only ever granted through verify-checkout, never
     a bare ?success=true URL param
   - success.html only claims payment after calling verify-checkout
   - service worker precache list only references files that exist
   - no committed Stripe/Kit secrets
   - required meta tags and local asset links resolve
*/
const fs = require("fs");
const path = require("path");

const { analyze } = require("../presend-analysis.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
let checks = 0;

function fail(msg) {
  failures++;
  console.log("FAIL: " + msg);
}
function pass(msg) {
  checks++;
  console.log("ok:   " + msg);
}
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf-8");
}
function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}


/* Local pre-send phrase/profile regression coverage */
[
  ["deflective apology and self-blame", "I’m sorry you feel that way. I guess I’m always the problem.", "medium", ["deflective-apology", "self-blame-shift"]],
  ["reluctant agreement and shutdown", "Fine. Whatever you want. I’m done talking about it.", "medium", ["reluctant-agreement", "conversation-close"]],
  ["clear boundary with alternative", "I can't make it Saturday. I can do Sunday afternoon if that works.", "low", ["boundary-setting"]],
  ["direct refusal", "I'm not available tonight.", "low", ["boundary-setting"]],
  ["space request", "I need some space.", "low", ["boundary-setting"]],
  ["accountability with next step", "I'm sorry I missed the deadline. I'll send it by noon.", "low", ["accountability-apology"]],
  ["repair invitation", "Can we talk this through?", "low", ["repair-attempt"]],
  ["clarification cue", "To be clear, can you clarify the time?", "low", ["clarifier"]],
  ["Spanish deflective apology", "Lo siento que te sientas así. Supongo que yo siempre soy el problema.", "medium", ["deflective-apology", "self-blame-shift"]],
  ["Spanish blame pattern", "Siempre haces lo mismo.", "medium", ["absolute-blame"]],
  ["Spanish boundary", "No puedo asistir esta noche.", "low", ["boundary-setting"]],
  ["Spanish softener and resentment", "No pasa nada. Como siempre.", "medium", ["polite-resentment"]],
  ["passive-aggressive softener plus resentment", "No worries. Apparently I’m the only one who remembers.", "medium", ["polite-resentment"]],
  ["resigned self-reliance", "I guess I'll do it myself, as usual.", "medium", ["resigned-self-reliance"]],
  ["absolute blame", "You never listen to me.", "medium", ["absolute-blame"]],
  ["sarcasm cue", "Thanks for nothing.", "medium", ["sarcasm-dismissal"]],
  ["guilt pressure", "Don't worry about me. I'll remember this.", "medium", ["guilt-pressure"]],
  ["direct insult", "You are an idiot.", "medium", ["insult"]],
  ["softener beside explicit frustration", "No worries. I'm honestly tired of this.", "medium", ["softener-frustration"]],
  ["deference beside frustration", "Take your time, I know you're busy. This is getting old.", "medium", ["softener-frustration"]],
  ["deference alone is not a verdict", "I know you're busy; no rush.", "uncertain", []],
  ["defensive reminder alone stays contextual", "I already told you the time.", "uncertain", ["defensive-proof"]],
  ["defensive reminder with frustration", "I already told you the time. This is getting old.", "medium", ["defensive-proof"]],
  ["repetition alone stays contextual", "How many times do I have to explain it?", "uncertain", ["repeated-explanation"]],
  ["repetition with frustration", "How many times do I have to explain it? This is frustrating.", "medium", ["repeated-explanation"]],
  ["intent attribution", "You're trying to make me look bad.", "medium", ["intent-attribution"]],
  ["reassurance request beside softener", "No worries, are we okay?", "medium", ["reassurance-pressure"]],
  ["Spanish softener beside frustration", "Sé que estás ocupado, pero estoy cansado de esto.", "medium", ["softener-frustration"]],
  ["direct threat", "If you leave, I'll hurt you.", "high", ["threat"]],
  ["reassurance question stays contextual", "Are we okay?", "uncertain", ["reassurance-seeking"]],
  ["softener alone is not a verdict", "No worries, all good.", "uncertain", []],
  ["benign whatever phrase is not a verdict", "Whatever works for you.", "uncertain", []],
  ["routine work request", "Can you send the file by 3?", "uncertain", []],
  ["factual reminder", "I sent you the address yesterday.", "uncertain", []],
  ["negated absolute is not blame", "I am not saying you always do that.", "uncertain", []],
  ["no pressure disclaimer", "I don't want to pressure you.", "uncertain", []],
  ["benign schedule alternative", "If Friday doesn't work, Saturday is fine.", "uncertain", []],
  ["neutral Spanish stays unclear", "Todo bien, nos vemos a las seis.", "uncertain", []],
  ["short Spanish stays unclear until language is selected", "Como quieras.", "uncertain", []],
  ["French passive-aggressive combination", "Pas de souci. Comme d’habitude, je vais le faire moi-même.", "medium", ["polite-resentment"]],
  ["French isolated softener stays unclear", "Pas de souci, à demain.", "uncertain", []],
  ["French boundary is positive", "Je ne peux pas venir samedi.", "low", ["boundary-setting"]],
  ["unsupported French threat is flagged", "Tu vas le regretter, je vais te frapper.", "high", ["threat"]],
  ["unknown short draft stays unclear", "Dinner at 7?", "uncertain", []],
  ["empty input stays unclear", "", "uncertain", []],
].forEach(([name, message, expectedLevel, expectedSignals]) => {
  const result = analyze(message);
  if (result.level !== expectedLevel) fail("pre-send "+name+": expected "+expectedLevel+", got "+result.level);
  else pass("pre-send "+name+": level "+expectedLevel);
  expectedSignals.forEach((signal) => {
    if (result.signals.some((item) => item.id === signal)) pass("pre-send "+name+": signal "+signal);
    else fail("pre-send "+name+": missing signal "+signal);
  });
});

/* Context adds an explanation locally. Goal and situation must not alter the signal level. */
const boundaryDraft = "I can't make it Saturday. I can do Sunday afternoon if that works.";
const boundaryBase = analyze(boundaryDraft);
const boundaryWithContext = analyze(boundaryDraft, { goal: "boundary", situation: "after_conflict" });
if (boundaryWithContext.level === boundaryBase.level) pass("context does not change boundary signal level");
else fail("context unexpectedly changed boundary signal level");
if (boundaryWithContext.contextNotes.some((note) => note.indexOf("stated goal is a boundary") !== -1)) pass("boundary goal adds relevant context note");
else fail("boundary goal context note missing");

const concernDraft = "No worries. Apparently I’m the only one who remembers.";
const concernBase = analyze(concernDraft);
const concernWithContext = analyze(concernDraft, { goal: "repair", situation: "after_conflict" });
if (concernWithContext.level === concernBase.level) pass("goal and situation do not change concern level");
else fail("goal or situation changed concern level");
if (concernWithContext.contextNotes.some((note) => note.indexOf("following a disagreement") !== -1)) pass("after-conflict context is reflected cautiously");
else fail("after-conflict context note missing");
if (concernWithContext.contextNotes.some((note) => note.indexOf("Your stated goal is repair") !== -1)) pass("repair goal note is available");
else fail("repair goal context note missing");

const frenchAuto = analyze("Pas de souci. Comme d’habitude, je vais le faire moi-même.");
if (frenchAuto.language === "fr" && frenchAuto.supported && frenchAuto.level === "medium") pass("French pack auto-detects a clear French sentence");
else fail("French pack did not auto-detect a clear French sentence");
if (frenchAuto.signals.some((item) => item.evidence.length > 0)) pass("French wording evidence is returned");
else fail("French wording evidence is missing");
const frenchSelected = analyze("Comme tu veux.", { language: "fr" });
if (frenchSelected.supported && frenchSelected.language === "fr" && frenchSelected.level === "uncertain") pass("selected French pack keeps an isolated ambiguous phrase uncertain");
else fail("selected French pack overstates an isolated ambiguous phrase");

const shortSpanishAuto = analyze("Como quieras.");
const shortSpanishSelected = analyze("Como quieras.", { language: "es" });
if (shortSpanishAuto.level === "uncertain") pass("ambiguous short Spanish stays unclear in auto-detect");
else fail("short Spanish auto-detect was overconfident");
if (shortSpanishSelected.level === "medium" && shortSpanishSelected.language === "es" && shortSpanishSelected.signals.some((item) => item.id === "reluctant-agreement")) pass("selected Spanish pack reads a short Spanish phrase");
else fail("selected Spanish pack did not read the short Spanish phrase");
if (shortSpanishSelected.contextNotes.some((note) => note.indexOf("repertorio de frases en español") !== -1)) pass("selected language pack is disclosed in the result");
else fail("selected language pack disclosure missing");

const quotedDraft = "He said, “I’m sorry you feel that way.”";
const quotedBase = analyze(quotedDraft);
const quotedContext = analyze(quotedDraft, { quoted: true });
if (quotedBase.signals.some((item) => item.id === "deflective-apology")) pass("quoted phrase is detectable without quote context");
else fail("quoted phrase baseline signal missing");
if (!quotedContext.signals.some((item) => item.id === "deflective-apology") && quotedContext.level === "uncertain") pass("marked quoted words are excluded from sender-wording signals");
else fail("marked quoted words were still scored as sender wording");
if (quotedContext.contextNotes.some((note) => note.indexOf("excluded from wording signals") !== -1)) pass("quote exclusion is explained");
else fail("quote exclusion note missing");

const evidenceResult = analyze("No worries. Apparently I’m the only one who remembers.");
const evidenceSignal = evidenceResult.signals.find((item) => item.id === "polite-resentment");
if (evidenceSignal && evidenceSignal.evidence.join(" + ") === "no worries + apparently") pass("exact local wording evidence is returned");
else fail("exact local wording evidence is missing or incorrect");

const profileCases = [
  ["boundary cue maps to a move", "I can't make it Saturday.", "Boundary Protector-style limit"],
  ["reassurance cue maps to a move", "Are we okay?", "Reassurance Seeker-style request"],
  ["clarifier cue maps to a move", "To be clear, can you clarify the time?", "Clarifier-style explanation"],
  ["repair cue maps to a move", "Can we talk this through?", "Conflict Resolver-style repair"],
];
profileCases.forEach(([name, message, expected]) => {
  const result = analyze(message);
  if (result.styleHints.includes(expected)) pass(name);
  else fail(name+": expected "+expected);
});

// 1. Required files exist
[
  "index.html",
  "presend-analysis.js",
  "success.html",
  "confidence-profile.html",
  "manifest.json",
  "netlify.toml",
  "sw.js",
  "icon-192.png",
  "icon-512.png",
  "netlify/functions/verify-checkout.js",
  "netlify/functions/subscribe-email.js",
].forEach((f) => {
  if (exists(f)) pass("file exists: " + f);
  else fail("missing required file: " + f);
});

const indexHtml = read("index.html");
const successHtml = read("success.html");
const confidenceProfileHtml = read("confidence-profile.html");
const subscribeEmailJs = read("netlify/functions/subscribe-email.js");
const verifyCheckoutJs = read("netlify/functions/verify-checkout.js");
const swJs = read("sw.js");

// 2. No Stripe placeholder links
if (/REPLACE_MONTHLY|REPLACE_YEARLY|REPLACE_LIFETIME/.test(indexHtml)) {
  fail("index.html still contains placeholder Stripe Payment Link URLs");
} else {
  pass("no placeholder Stripe Payment Link URLs in index.html");
}

// 3. No demo-mode confirm() unlock
if (/Demo mode: Simulate Pro unlock/.test(indexHtml)) {
  fail("index.html still contains the confirm()-based demo Pro unlock");
} else {
  pass("no confirm()-based demo Pro unlock in index.html");
}
if (/confirm\(\s*["'`]Demo/i.test(indexHtml)) {
  fail("index.html still contains a confirm() dialog that grants Pro access");
} else {
  pass("no confirm() dialog grants Pro access in index.html");
}

// 4. Pro is never granted from a bare success=true param
if (/params\.get\(\s*["']success["']\s*\)/.test(indexHtml)) {
  fail('index.html still reads a bare "success" URL param to grant access');
} else {
  pass('index.html does not trust a bare "success" URL param');
}
if (/session_id/.test(indexHtml) && /verify-checkout/.test(indexHtml)) {
  pass("index.html verifies checkout via session_id + verify-checkout function");
} else {
  fail("index.html does not appear to call verify-checkout with a session_id");
}

// 4a. Verified Stripe payments emit a GA4 purchase with server-confirmed value data.
if (/trackEvent\("purchase"/.test(indexHtml) && /transaction_id:\s*String\(data\.sessionId\)/.test(indexHtml) &&
    /amountTotal:\s*Number\.isFinite\(session\.amount_total\)/.test(verifyCheckoutJs) &&
    /currency:\s*typeof session\.currency/.test(verifyCheckoutJs)) {
  pass("verified Stripe checkout sends GA4 purchase with transaction, value, and currency");
} else {
  fail("verified Stripe checkout is missing its GA4 purchase event or server-confirmed amount data");
}

// 4b. Confidence Profile remains an honest, non-diagnostic funnel.
if (/not a diagnosis or a fixed personality type/.test(confidenceProfileHtml) && /subscribe-email/.test(confidenceProfileHtml)) {
  pass("confidence profile is non-diagnostic and uses the server-side email capture");
} else {
  fail("confidence profile is missing its non-diagnostic or email-capture guardrail");
}
if (/recognition/.test(confidenceProfileHtml) && /Your strongest asset/.test(confidenceProfileHtml) && /Your next move/.test(confidenceProfileHtml)) {
  pass("confidence profile includes the memorable recognition and practical next move reveal");
} else {
  fail("confidence profile is missing its richer result reveal");
}
if (/shareProfile/.test(confidenceProfileHtml) && /confidence_profile_shared/.test(confidenceProfileHtml) && /No private message text/.test(confidenceProfileHtml)) {
  pass("confidence profile sharing is privacy-safe and attributed");
} else {
  fail("confidence profile sharing is missing its privacy or analytics guardrail");
}
if (/profile:pick\(\)\.name/.test(confidenceProfileHtml) && /KIT_PROFILE_FIELD_KEY/.test(subscribeEmailJs) && /normalizeProfile/.test(subscribeEmailJs)) {
  pass("profile selection can be carried into Kit without weakening signup validation");
} else {
  fail("profile-specific Kit capture wiring is incomplete");
}

// 5. success.html only claims payment after verification
if (/verify-checkout/.test(successHtml)) {
  pass("success.html calls verify-checkout before showing a confirmed state");
} else {
  fail("success.html does not call verify-checkout");
}
if (/Payment received/.test(successHtml) && /showConfirmed/.test(successHtml)) {
  pass('success.html only renders "Payment received" from a JS success branch');
} else {
  fail('success.html "Payment received" copy is not gated behind a JS success branch');
}

// 6. Service worker precache list only references real files
const precacheMatch = swJs.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/);
if (!precacheMatch) {
  fail("could not find PRECACHE_URLS in sw.js");
} else {
  const urls = precacheMatch[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  urls.forEach((url) => {
    const rel = url === "/" ? "index.html" : url.replace(/^\//, "");
    if (exists(rel)) pass("sw.js precaches a file that exists: " + url);
    else fail("sw.js precaches a file that does NOT exist: " + url);
  });
}

// 7. No committed secrets
const secretPatterns = [
  { name: "Stripe live/test secret key", re: /sk_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: "Kit API secret literal", re: /kit_api_secret_[A-Za-z0-9]+/i },
];
const filesToScan = ["index.html", "success.html", "netlify/functions/verify-checkout.js", "netlify/functions/subscribe-email.js", "netlify.toml"];
let secretFound = false;
filesToScan.forEach((f) => {
  const content = read(f);
  secretPatterns.forEach((p) => {
    if (p.re.test(content)) {
      fail("possible committed secret (" + p.name + ") in " + f);
      secretFound = true;
    }
  });
});
if (!secretFound) pass("no committed Stripe/Kit secrets found in scanned files");

// Functions must read secrets from process.env, never hardcode them
["netlify/functions/verify-checkout.js", "netlify/functions/subscribe-email.js"].forEach((f) => {
  const content = read(f);
  if (/process\.env\./.test(content)) pass(f + " reads secrets from process.env");
  else fail(f + " does not appear to read any secret from process.env");
});

// 8. Required meta tags for social/PH readiness
["og:title", "og:description", "og:image", "twitter:card"].forEach((tag) => {
  if (indexHtml.indexOf(tag) !== -1) pass("index.html has meta tag: " + tag);
  else fail("index.html is missing meta tag: " + tag);
});

// 9. manifest.json is valid JSON and icons exist
try {
  const manifest = JSON.parse(read("manifest.json"));
  pass("manifest.json is valid JSON");
  (manifest.icons || []).forEach((icon) => {
    if (exists(icon.src)) pass("manifest icon exists: " + icon.src);
    else fail("manifest icon missing: " + icon.src);
  });
} catch (e) {
  fail("manifest.json is not valid JSON: " + e.message);
}

// 10. netlify.toml wires up the functions directory
const netlifyToml = read("netlify.toml");
if (/functions\s*=\s*"netlify\/functions"/.test(netlifyToml)) {
  pass("netlify.toml declares the functions directory");
} else {
  fail("netlify.toml does not declare a functions directory");
}

// 11. Local absolute asset references resolve to real files
const assetRefs = new Set();
[indexHtml, successHtml].forEach((html) => {
  const re = /(?:href|src)="(\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) assetRefs.add(m[1]);
});
assetRefs.forEach((ref) => {
  const clean = ref.split("?")[0].split("#")[0];
  const rel = clean === "/" ? "index.html" : clean.replace(/^\//, "");
  if (exists(rel)) pass("local asset resolves: " + ref);
  else fail("local asset does NOT resolve: " + ref);
});

console.log("\n" + checks + " checks passed, " + failures + " failed.");
if (failures > 0) process.exit(1);
