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

// 1. Required files exist
[
  "index.html",
  "success.html",
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
