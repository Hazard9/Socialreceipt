(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SocialReceiptJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Social Receipt — Receipt Journal (deterministic, on-device, zero cost).
     Every fresh receipt is kept in a journal on this device only, so the
     read does not vanish when the user leaves. Nothing here talks to a
     server: entries live in localStorage under JOURNAL_KEY and the user
     can clear them at any time. Free for everyone; no paywall hooks. */

  var JOURNAL_KEY = "sr_receipt_journal_v1";
  var MAX_ENTRIES = 30;
  var DRAFT_MAX = 280;
  var DEDUPE_MS = 10 * 60 * 1000;
  var EMPTY_LINE = "Your receipts will live here, on this device only.";
  var PRIVACY_LINE = "Kept on this device only. Nothing is uploaded.";

  function normalizeDraft(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function truncateDraft(text) {
    var t = String(text || "");
    return t.length > DRAFT_MAX ? t.slice(0, DRAFT_MAX) : t;
  }

  function firstLine(draft) {
    var t = String(draft || "").trim();
    var nl = t.indexOf("\n");
    var line = (nl === -1 ? t : t.slice(0, nl)).trim();
    return line.length > 90 ? line.slice(0, 90).trim() + "\u2026" : line;
  }

  /* Build a journal entry from a receipt object. The full receipt rides
     along so a tap can re-render the complete receipt view from stored
     fields; receipts are small, so the summary fields are duplicated
     out of it purely for the list view. */
  function makeEntry(receipt, now) {
    if (!receipt) return null;
    return {
      ts: now,
      draft: truncateDraft(receipt.rawText || ""),
      scenario: receipt.scenario || "",
      verdict: receipt.verdict || "",
      patternLabel: receipt.pattern ? receipt.pattern.label : null,
      confidence: typeof receipt.confidence === "number" ? receipt.confidence : null,
      receipt: receipt
    };
  }

  /* Prepend an entry, newest first. The same draft inside the dedupe
     window (mirrors the Deep Layers pattern memory) adds no new entry.
     The journal is capped; the oldest entries fall off the end. */
  function recordEntry(list, entry, now) {
    var out = Array.isArray(list) ? list.slice() : [];
    if (!entry) return out.slice(0, MAX_ENTRIES);
    var norm = normalizeDraft(entry.draft);
    if (norm) {
      for (var i = 0; i < out.length; i++) {
        if (normalizeDraft(out[i].draft) === norm && Math.abs(now - out[i].ts) < DEDUPE_MS) {
          return out.slice(0, MAX_ENTRIES);
        }
      }
    }
    out.unshift(entry);
    return out.slice(0, MAX_ENTRIES);
  }

  /* The visible home for the Deep Layer 5 pattern summary: the most
     frequent pattern branch in the on-device pattern history, with its
     30-day count from SocialReceiptDeep.patternSummary when available. */
  function topPattern(history, now, deep) {
    var list = Array.isArray(history) ? history : [];
    var counts = {}, labels = {}, best = null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.pattern) continue;
      counts[e.pattern] = (counts[e.pattern] || 0) + 1;
      if (!labels[e.pattern]) labels[e.pattern] = e.label || e.pattern;
      if (!best || counts[e.pattern] > counts[best]) best = e.pattern;
    }
    if (!best) return null;
    var count = counts[best];
    if (deep && typeof deep.patternSummary === "function") {
      var s = deep.patternSummary(list, best, now);
      if (s && typeof s.count30 === "number") count = s.count30;
    }
    if (count <= 0) return null;
    var label = labels[best];
    var display = best.indexOf("pattern:") === 0 ? "\u201C" + label + "\u201D" : label;
    return { key: best, label: label, display: display, count: count };
  }

  function formatWhen(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString() + ", " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return {
    JOURNAL_KEY: JOURNAL_KEY,
    MAX_ENTRIES: MAX_ENTRIES,
    DRAFT_MAX: DRAFT_MAX,
    DEDUPE_MS: DEDUPE_MS,
    EMPTY_LINE: EMPTY_LINE,
    PRIVACY_LINE: PRIVACY_LINE,
    normalizeDraft: normalizeDraft,
    truncateDraft: truncateDraft,
    firstLine: firstLine,
    makeEntry: makeEntry,
    recordEntry: recordEntry,
    topPattern: topPattern,
    formatWhen: formatWhen
  };
});
