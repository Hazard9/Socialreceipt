(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SocialReceiptReturn = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Social Receipt — The Return Loop (deterministic, on-device, zero cost).
     Three honest reasons to come back: an unresolved conversation the
     user chose to keep open, a weekly picture of their own patterns,
     and a daily prompt. Everything is computed from data already on
     the user's device: no accounts, no notifications, no backend, no
     network surface at all. Free for everyone; no paywall hooks. */

  var THREADS_KEY = "sr_open_threads_v1";
  var MAX_THREADS = 5;
  var SENT_MAX = 500;
  var DAY_MS = 24 * 60 * 60 * 1000;
  var WEEK_MS = 7 * DAY_MS;
  var THREADS_COPY = "Conversations you are still in the middle of. Kept on this device only.";

  /* Today's Pause prompts, verbatim. The prompt is an invitation
     only: it makes no claims and stores nothing. */
  var PROMPTS = [
    "What is the text you have rewritten the most this week?",
    "One message you are glad you did not send?",
    "Whose reply are you still waiting on, and what do you actually need to hear?",
    "What would you say if you were not afraid of the reply?",
    "One draft sitting in your notes right now. Read it like a stranger wrote it.",
    "What are you trying to make them feel? Say that part plainly instead.",
    "The apology you keep rehearsing: what is it really for?",
    "What silence are you filling with another message?",
    "Write the version you would send if you trusted them.",
    "What do you need: an answer, an apology, or just to be heard?",
    "Read your last sent text out loud. Would you say it across a table?",
    "What is the kindest true sentence you could send today?",
    "Which conversation deserves a pause before the next word?",
    "What would waiting until morning change about this draft?"
  ];

  function normalizeText(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function truncateSent(text) {
    var t = String(text || "");
    return t.length > SENT_MAX ? t.slice(0, SENT_MAX) : t;
  }

  function firstLine(text) {
    var t = String(text || "").trim();
    var nl = t.indexOf("\n");
    var line = (nl === -1 ? t : t.slice(0, nl)).trim();
    return line.length > 90 ? line.slice(0, 90).trim() + "\u2026" : line;
  }

  function wordCount(text) {
    var t = String(text || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  /* ── Open Threads ───────────────────────────────────────────────────
     A thread is the message the user already sent, kept only when
     they tap "Keep this thread open" after a Both Sides read. The
     dynamic label rides along only when a Pro read produced one. */

  function makeThread(sent, dynamicLabel, now) {
    var text = truncateSent(sent);
    if (!normalizeText(text)) return null;
    return { ts: now, sent: text, dynamicLabel: dynamicLabel || null };
  }

  /* Prepend a thread, newest first. Saving the same sent text again
     updates nothing: the stored entry (and its age) is left exactly
     as it was. The list is capped; the oldest threads fall off. */
  function saveThread(list, thread) {
    var out = Array.isArray(list) ? list.slice() : [];
    if (!thread) return out.slice(0, MAX_THREADS);
    var norm = normalizeText(thread.sent);
    if (norm) {
      for (var i = 0; i < out.length; i++) {
        if (normalizeText(out[i].sent) === norm) return out.slice(0, MAX_THREADS);
      }
    }
    out.unshift(thread);
    return out.slice(0, MAX_THREADS);
  }

  function removeThread(list, index) {
    var out = Array.isArray(list) ? list.slice() : [];
    if (typeof index === "number" && index >= 0 && index < out.length) out.splice(index, 1);
    return out;
  }

  /* Whole calendar days between two local dates, DST-safe. */
  function calendarDayDiff(fromTs, toTs) {
    var a = new Date(fromTs); a.setHours(0, 0, 0, 0);
    var b = new Date(toTs); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / DAY_MS);
  }

  function threadAgeLabel(ts, now) {
    var days = calendarDayDiff(ts, now);
    if (days <= 0) return "Saved today";
    if (days === 1) return "Waiting 1 day";
    return "Waiting " + days + " days";
  }

  /* ── Your Week in Receipts ──────────────────────────────────────────
     Computed live at render from the journal and the pattern history
     already on the device. Every number is a count or an average of
     the user's own stored entries; nothing is estimated. */

  function isLateNight(ts) {
    var h = new Date(ts).getHours();
    return h >= 23 || h < 5;
  }

  function avgWords(entries) {
    if (!entries.length) return 0;
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += wordCount(entries[i].draft);
    return Math.round(total / entries.length);
  }

  function weekMetrics(entries, now) {
    var list = Array.isArray(entries) ? entries : [];
    var thisWeek = [], prevWeek = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || typeof e.ts !== "number") continue;
      if (e.ts > now - WEEK_MS && e.ts <= now) thisWeek.push(e);
      else if (e.ts > now - 2 * WEEK_MS && e.ts <= now - WEEK_MS) prevWeek.push(e);
    }
    var lateNight = 0;
    for (var k = 0; k < thisWeek.length; k++) {
      if (isLateNight(thisWeek[k].ts)) lateNight++;
    }
    /* The trend speaks only with a real base on both sides: at
       least 3 receipts this week and at least 3 the week before. */
    var trend = null;
    if (thisWeek.length >= 3 && prevWeek.length >= 3) {
      trend = { thisAvg: avgWords(thisWeek), lastAvg: avgWords(prevWeek) };
    }
    return {
      totalKept: list.length,
      receiptsThisWeek: thisWeek.length,
      prevWeekCount: prevWeek.length,
      lateNightThisWeek: lateNight,
      trend: trend
    };
  }

  function weekSummary(entries, history, now, journalApi, deepApi) {
    var m = weekMetrics(entries, now);
    var top = null;
    if (journalApi && typeof journalApi.topPattern === "function") {
      top = journalApi.topPattern(history, now, deepApi || null);
    }
    return {
      hasData: m.totalKept > 0,
      totalKept: m.totalKept,
      receiptsThisWeek: m.receiptsThisWeek,
      lateNightThisWeek: m.lateNightThisWeek,
      topPattern: top,
      trend: m.trend
    };
  }

  /* ── Today's Pause ──────────────────────────────────────────────────
     One prompt per local day, chosen deterministically: the same day
     always shows the same prompt on this device. */

  function dayOfYear(date) {
    var start = Date.UTC(date.getFullYear(), 0, 0);
    var cur = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((cur - start) / DAY_MS);
  }

  function promptIndexFor(date) {
    return dayOfYear(date) % PROMPTS.length;
  }

  function promptFor(date) {
    return PROMPTS[promptIndexFor(date)];
  }

  return {
    THREADS_KEY: THREADS_KEY,
    MAX_THREADS: MAX_THREADS,
    SENT_MAX: SENT_MAX,
    THREADS_COPY: THREADS_COPY,
    PROMPTS: PROMPTS.slice(),
    normalizeText: normalizeText,
    truncateSent: truncateSent,
    firstLine: firstLine,
    wordCount: wordCount,
    makeThread: makeThread,
    saveThread: saveThread,
    removeThread: removeThread,
    calendarDayDiff: calendarDayDiff,
    threadAgeLabel: threadAgeLabel,
    isLateNight: isLateNight,
    weekMetrics: weekMetrics,
    weekSummary: weekSummary,
    dayOfYear: dayOfYear,
    promptIndexFor: promptIndexFor,
    promptFor: promptFor
  };
});
