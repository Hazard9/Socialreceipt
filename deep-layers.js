(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SocialReceiptDeep = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Social Receipt — Deep Layers (deterministic, on-device, zero cost).
     Layers 3-7 sit under the standard receipt. Everything here is pure
     local logic over the draft, the picked state, and history stored on
     this device only. No network calls, no generation, no external data. */

  var HONESTY_LINE = "This read can only see the words and the state you picked. It cannot know what they are thinking.";
  var FEAR_QUESTION = "What are you most afraid happens if this just sits?";
  var REWRITE_LABEL = "A starting point built from your words. Edit it freely.";
  var HISTORY_KEY = "sr_pattern_history_v1";
  var DAY_MS = 86400000;

  /* ── Layer 3: the state that wrote this ─────────────────────────────
     Deterministic mapping over feeling + analyzeText flags + the
     receipt's pattern label. One label, one plain sentence. */
  function stateFor(feeling, flags, patternLabel) {
    flags = flags || {};
    var pat = String(patternLabel || "").toLowerCase();
    var apologyPattern = pat.indexOf("apolog") !== -1;
    if (feeling === "Anxious" && flags.silence) return { label: "Waiting in the silence", line: "You are drafting to end the not-knowing, not because there is something new to say." };
    if (feeling === "Anxious" && (apologyPattern || flags.apology)) return { label: "Apologising to stop the panic", line: "The apology is aimed at your own anxiety first." };
    if (feeling === "Rejected") return { label: "Sending to undo a feeling", line: "The message is trying to reverse the rejection, which is why it feels urgent." };
    if (feeling === "Annoyed" && flags.conflict) return { label: "Activated", line: "Written while hot; the draft is doing the arguing for you." };
    if (feeling === "Unsure" && flags.highIntent) return { label: "Reaching for certainty", line: "The draft asks for a definition the other person may not be ready to give." };
    if (feeling === "Good" || flags.positive) return { label: "Settled", line: "Written from a steady place, not from a spike." };
    if (flags.conflict) return { label: "In the middle of it", line: "The draft carries live tension; it is written from inside the conflict, not above it." };
    if (flags.silence) return { label: "Waiting in the silence", line: "You are drafting into a gap, and the gap is doing most of the talking." };
    if (flags.apology) return { label: "Apologising to repair", line: "The apology is doing repair work. Check it is not also asking to be reassured." };
    if (flags.overExplain) return { label: "Explaining to be understood", line: "The length is the tell: being understood matters more here than being brief." };
    if (flags.highIntent) return { label: "Reaching for certainty", line: "The draft asks for more definition than the moment may hold." };
    if (feeling === "Anxious") return { label: "Running the worst case", line: "Part of this draft is written to calm the writer, not to inform the reader." };
    if (feeling === "Annoyed") return { label: "Still heated", line: "Some heat is still in the wording; it will read hotter now than you will feel in an hour." };
    if (feeling === "Confused") return { label: "Drafting through fog", line: "The draft asks the other person to clear up what is still unclear to you." };
    if (feeling === "Interested") return { label: "Reaching toward", line: "Written to move things forward; the reach in it is genuine." };
    if (feeling === "Unsure") return { label: "Half-formed", line: "The draft is thinking out loud; it has not decided what it wants yet." };
    return { label: "Present", line: "No single impulse dominates this draft." };
  }

  /* ── Layer 4: the fear ──────────────────────────────────────────────
     One question, four deterministic chips keyed by scenario. Each chip
     carries the fragment used to name the fear back in one sentence. */
  var FEAR_CHIPS = {
    "Date": [
      { label: "I'm losing them", question: "whether you're losing them" },
      { label: "They think I'm not interested", question: "whether they read your silence as not caring" },
      { label: "Someone else gets there first", question: "whether waiting costs you the chance" },
      { label: "I look desperate either way", question: "whether there's a move here that doesn't cost you position" }
    ],
    "Work": [
      { label: "My competence gets questioned", question: "whether this costs you credibility at work" },
      { label: "It reads as an excuse", question: "whether this lands as an excuse instead of a fact" },
      { label: "I get written off as difficult", question: "whether you're being written off as difficult" },
      { label: "It stays in writing forever", question: "whether this stays on record and follows you" }
    ],
    "Friend / Family": [
      { label: "The relationship cools for good", question: "whether the distance becomes permanent" },
      { label: "I become the difficult one", question: "whether you become the one they avoid" },
      { label: "It turns into a bigger fight", question: "whether this blows up into something bigger" },
      { label: "They stop telling me things", question: "whether they stop trusting you with the truth" }
    ],
    "Conflict": [
      { label: "It escalates past repair", question: "whether this crosses a line you can't come back from" },
      { label: "I say the thing I can't take back", question: "whether you say the thing you can't take back" },
      { label: "They shut down completely", question: "whether they shut you out entirely" },
      { label: "I lose someone I need", question: "whether you lose them over this" }
    ],
    "Text / DM": [
      { label: "The silence means it's over", question: "whether the silence means it's already over" },
      { label: "I'm misreading everything", question: "whether you're reading this wrong" },
      { label: "Asking pushes them away", question: "whether asking pushes them further away" },
      { label: "It just sits there, unanswered", question: "whether it sits unanswered and changes things" }
    ]
  };

  function fearChipsFor(scenario) {
    return (FEAR_CHIPS[scenario] || FEAR_CHIPS["Text / DM"]).slice();
  }

  function fearSentence(chip) {
    return "So the real question under this draft is " + chip.question + ".";
  }

  /* ── Layer 5: pattern memory (on-device) ────────────────────────────
     History entries: {pattern, label, scenario, draft, ts}. Pure
     functions over the stored array so they can be tested with a fake
     clock and a fake store. */
  function normalizeDraft(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function patternKeyFor(flags, patternLabel) {
    flags = flags || {};
    if (patternLabel) return { key: "pattern:" + patternLabel, label: patternLabel, display: "\u201C" + patternLabel + "\u201D", fromPattern: true };
    var order = [
      ["silence", "silence"], ["apology", "apology"], ["conflict", "conflict"],
      ["highIntent", "high-intent"], ["overExplain", "over-explaining"],
      ["delay", "waiting"], ["oneWord", "short-reply"], ["positive", "positive"]
    ];
    for (var i = 0; i < order.length; i++) {
      if (flags[order[i][0]]) return { key: "flag:" + order[i][0], label: order[i][1], display: order[i][1], fromPattern: false };
    }
    return { key: "flag:general", label: "general", display: "general", fromPattern: false };
  }

  function recordPattern(history, entry, now) {
    var list = Array.isArray(history) ? history.slice() : [];
    var norm = normalizeDraft(entry && entry.draft);
    if (norm) {
      var dupe = false;
      for (var i = 0; i < list.length; i++) {
        if (normalizeDraft(list[i].draft) === norm && Math.abs(now - list[i].ts) < 10 * 60 * 1000) { dupe = true; break; }
      }
      if (!dupe) list.push({ pattern: entry.pattern, label: entry.label, scenario: entry.scenario, draft: entry.draft, ts: now });
    }
    if (list.length > 200) list = list.slice(list.length - 200);
    return list;
  }

  function patternSummary(history, key, now) {
    var count30 = 0, late7 = 0;
    var list = Array.isArray(history) ? history : [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.pattern === key && now - e.ts <= 30 * DAY_MS && e.ts <= now) count30++;
      if (now - e.ts <= 7 * DAY_MS && e.ts <= now) {
        var h = new Date(e.ts).getHours();
        if (h >= 23 || h < 5) late7++;
      }
    }
    return { count30: count30, lateCount7: late7, lateNight: late7 >= 3 };
  }

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ── Layer 6: the dynamic ───────────────────────────────────────────
     Three possibility reads. Every line is framed as a possibility and
     its "because" is tied to wording the engine actually detected. */
  function categoryFor(flags, patternLabel) {
    flags = flags || {};
    var pat = String(patternLabel || "").toLowerCase();
    if (pat.indexOf("apolog") !== -1) return "apology";
    if (pat.indexOf("blame") !== -1 || pat.indexOf("absolute") !== -1) return "conflict";
    if (flags.apology) return "apology";
    if (flags.conflict) return "conflict";
    if (flags.silence || flags.delay) return "waiting";
    if (flags.highIntent) return "high-intent";
    if (flags.overExplain) return "over-explain";
    return "general";
  }

  function becauseFor(flags, pattern) {
    flags = flags || {};
    if (pattern && pattern.evidence && pattern.evidence.length) return "the wording \u201C" + pattern.evidence[0] + "\u201D";
    if (flags.apology) return "the repeated apology";
    if (flags.conflict) return "the charged wording";
    if (flags.silence) return "the silence it is answering";
    if (flags.overExplain) return "the amount explained at once";
    if (flags.highIntent) return "how much it asks for at once";
    if (flags.oneWord) return "how little it gives them to work with";
    return "how it is worded";
  }

  var LANDINGS = {
    "apology": ["pressure to forgive before they are ready", "a request for reassurance wearing an apology's clothes", "guilt they did not agree to carry"],
    "conflict": ["an attack rather than a point", "an escalation they now have to absorb", "proof that you are not listening"],
    "waiting": ["chasing", "your anxiety rather than your intent", "confirmation that the distance is growing"],
    "high-intent": ["pressure to define things right now", "neediness, even if that read is unfair", "a test they did not know they were taking"],
    "over-explain": ["a lecture", "work they have to do before they can reply", "defensiveness, even where none was aimed at them"],
    "general": ["heavier than you intend it", "easy to misread without tone", "distance, even though you meant the opposite"]
  };
  var READERS = ["someone who is tired", "someone who is distracted", "someone who is already guarded"];

  function dynamicReadsFor(category, because) {
    var landings = LANDINGS[category] || LANDINGS.general;
    return READERS.map(function (who, i) {
      return { who: who, text: "Read by " + who + ", this could land as " + landings[i] + ", because of " + because + "." };
    });
  }

  /* ── Layer 7: choice + a rewrite built from their words ─────────────
     Deterministic composition: a stance opener, the core of THEIR
     draft kept verbatim, and a stance closer. The core always carries
     a verbatim fragment of the draft (4+ consecutive words) whenever
     the draft itself has one. */
  var STANCES = ["Calm and clear", "Warm", "Firm", "Short and done"];
  var STANCE_PARTS = {
    "Calm and clear": { open: "I want to say this clearly: ", close: "" },
    "Warm": { open: "I care about you, so I want to say this gently: ", close: " No pressure to reply right away." },
    "Firm": { open: "", close: " That part is not flexible for me." },
    "Short and done": { open: "", close: "" }
  };

  function wordCount(text) {
    var t = String(text || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function splitSentences(draft) {
    var text = String(draft || "").trim();
    if (!text) return [];
    var parts = text.split(/(?<=[.!?])\s+/);
    return parts.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  function trimClause(sentence) {
    var s = String(sentence || "").trim();
    if (s.length <= 110) return s;
    var comma = s.indexOf(",", 45);
    if (comma > 0 && comma <= 110) return s.slice(0, comma).trim() + ".";
    var cut = s.slice(0, 110), sp = cut.lastIndexOf(" ");
    return (sp > 40 ? cut.slice(0, sp) : cut).trim() + ".";
  }

  function extractCore(draft) {
    var sentences = splitSentences(draft);
    if (!sentences.length) return "";
    var i, core = null;
    for (i = 0; i < sentences.length; i++) { if (sentences[i].indexOf("?") !== -1) { core = sentences[i]; break; } }
    if (!core) {
      for (i = 0; i < sentences.length; i++) {
        if (/\b(please|let me know|can you|could you|would you|are you|do you|did you|tell me|call me|text me)\b/i.test(sentences[i])) { core = sentences[i]; break; }
      }
    }
    if (!core) {
      core = sentences.slice().sort(function (a, b) { return b.length - a.length; })[0];
    }
    return trimClause(core);
  }

  function composeRewrite(draft, stance) {
    var core = extractCore(draft);
    var whole = String(draft || "").trim();
    if (wordCount(core) < 4 && wordCount(whole) > wordCount(core)) core = whole;
    if (!core) return "";
    if (stance === "Short and done") {
      var clause = core.split(",")[0].trim();
      if (wordCount(clause) >= 4) {
        if (!/[.!?]$/.test(clause)) clause += ".";
        return clause;
      }
      return core;
    }
    var parts = STANCE_PARTS[stance] || STANCE_PARTS["Calm and clear"];
    return (parts.open + core + parts.close).trim();
  }

  return {
    HONESTY_LINE: HONESTY_LINE,
    FEAR_QUESTION: FEAR_QUESTION,
    REWRITE_LABEL: REWRITE_LABEL,
    HISTORY_KEY: HISTORY_KEY,
    STANCES: STANCES.slice(),
    stateFor: stateFor,
    fearChipsFor: fearChipsFor,
    fearSentence: fearSentence,
    normalizeDraft: normalizeDraft,
    patternKeyFor: patternKeyFor,
    recordPattern: recordPattern,
    patternSummary: patternSummary,
    ordinal: ordinal,
    categoryFor: categoryFor,
    becauseFor: becauseFor,
    dynamicReadsFor: dynamicReadsFor,
    splitSentences: splitSentences,
    extractCore: extractCore,
    composeRewrite: composeRewrite
  };
});
