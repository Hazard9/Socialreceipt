(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SocialReceiptBothSides = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Social Receipt — Both Sides ("After you sent it").
     Deterministic, on-device, zero cost. Reads an exchange that
     already happened: what the user sent, what the other person
     replied, and how long the reply took. The honesty standard is
     the product: every line below reports facts about the texts
     (word counts, questions, detected wording) or possibilities
     framed as possibilities. Nothing here claims to know the other
     person's inner state. */

  var HEADING = "After you sent it";
  var SUBLINE = "Paste what you sent and what they replied. See what the reply actually did, in words.";
  var REWRITE_LABEL = "A starting point built from your words. Edit it freely.";

  /* ── Reply time chips ───────────────────────────────────────────────
     The user picks how long the reply took. Parsed into a key, a
     label for the chip, and a phrase for use inside sentences. */
  var TIME_CHIPS = [
    { key: "minutes", label: "Minutes", phrase: "inside a few minutes" },
    { key: "hours", label: "Hours", phrase: "within hours" },
    { key: "next-day", label: "Next day", phrase: "the next day" },
    { key: "days", label: "Days", phrase: "after days" }
  ];

  function parseReplyTime(key) {
    for (var i = 0; i < TIME_CHIPS.length; i++) {
      if (TIME_CHIPS[i].key === key) return TIME_CHIPS[i];
    }
    return null;
  }

  function wordCount(text) {
    var t = String(text || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  /* Find the earliest-occurring phrase from a list, returned with its
     original casing so it can be quoted back as evidence. */
  function firstPhrase(text, phrases) {
    var lower = String(text || "").toLowerCase();
    var best = null, bestAt = -1;
    for (var i = 0; i < phrases.length; i++) {
      var at = lower.indexOf(phrases[i]);
      if (at !== -1 && (bestAt === -1 || at < bestAt)) { bestAt = at; best = phrases[i]; }
    }
    if (best === null) return null;
    return String(text).slice(bestAt, bestAt + best.length);
  }

  var DISMISSAL_PHRASES = ["whatever", "forget it", "never mind", "nevermind", "doesn't matter", "if you say so"];
  var CONFLICT_PHRASES = ["you never", "never listen", "you only care", "if you actually cared", "if you cared",
    "angry", "mad", "upset", "argument", "fight", "annoyed", "rude", "ignored", "hurt", "tension", "defensive"];
  var PLAN_RE = /\b(let's\s+\w+|i'll call you|call you|this weekend|next week|tomorrow|tonight|see you|we should|meet up|meet)\b/i;

  /* ── Facts (free for everyone) ──────────────────────────────────────
     Computed with the app's existing analyzeText over both sides, so
     the signal vocabulary is identical to the pre-send read. */
  function factsFor(sent, reply, timeKey, analyzeFn) {
    var s = analyzeFn(String(sent || ""));
    var r = analyzeFn(String(reply || ""));
    var sentWords = s.length, replyWords = r.length;
    var planMatch = String(reply || "").match(PLAN_RE);
    var time = parseReplyTime(timeKey) || TIME_CHIPS[1];

    var signals = {
      positive: !!r.positive,
      oneWord: !!r.oneWord,
      apology: !!r.apology,
      conflict: !!r.conflict,
      dismissal: !!firstPhrase(reply, DISMISSAL_PHRASES)
    };
    var signalNames = [];
    if (signals.positive) signalNames.push("positive wording");
    if (signals.oneWord) signalNames.push("one-word energy");
    if (signals.apology) signalNames.push("an apology");
    if (signals.conflict) signalNames.push("conflict wording");
    if (signals.dismissal) signalNames.push("dismissive wording");

    var ratio = replyWords > 0 ? Math.round((sentWords / replyWords) * 10) / 10 : null;
    var ratioLine;
    if (replyWords === 0) ratioLine = "There is no reply text to read.";
    else if (sentWords >= replyWords * 3) ratioLine = "The reply is a fraction of what you sent.";
    else if (replyWords >= sentWords * 1.5) ratioLine = "The reply runs longer than what you sent.";
    else ratioLine = "The two are close in length.";

    return {
      sentWords: sentWords,
      replyWords: replyWords,
      ratio: ratio,
      wordsLine: "You sent " + plural(sentWords, "word") + ". The reply was " + replyWords + ".",
      ratioLine: ratioLine,
      sentQuestions: s.qMarks,
      replyQuestions: r.qMarks,
      questionsLine: "You asked " + plural(s.qMarks, "question") + ". The reply asks " + (r.qMarks === 0 ? "none" : r.qMarks) + " back.",
      signals: signals,
      signalNames: signalNames,
      signalsLine: signalNames.length
        ? "Signals in the reply: " + signalNames.join(", ") + "."
        : "No strong wording signals detected in the reply.",
      planPhrase: planMatch ? planMatch[0] : null,
      conflictPhrase: signals.conflict ? firstPhrase(reply, CONFLICT_PHRASES) : null,
      dismissalPhrase: signals.dismissal ? firstPhrase(reply, DISMISSAL_PHRASES) : null,
      time: time
    };
  }

  /* ── The dynamic read (Pro) ─────────────────────────────────────────
     A named pattern for the exchange from deterministic rules over
     the facts, in priority order. Every because is built only from
     observable facts: counts, questions, detected wording, timing. */
  function ruleFor(f) {
    if (f.signals.apology && f.planPhrase) return {
      id: "repair", recommend: "reply",
      name: "Repair is on the table",
      because: "because the reply carries an apology and a next step in its own words (\u201C" + f.planPhrase + "\u201D). As a text, the move it makes is toward fixing this."
    };
    if (f.signals.conflict) return {
      id: "heated", recommend: "wait",
      name: "Heat came back",
      because: "because the reply carries charged wording (\u201C" + (f.conflictPhrase || "conflict wording") + "\u201D) across " + plural(f.replyWords, "word") + ". Words sent into heat usually get read as heat back."
    };
    if (f.replyWords <= 6 && f.signals.dismissal) return {
      id: "dismissed", recommend: "close",
      name: "A closed door, for now",
      because: "because the reply is " + plural(f.replyWords, "word") + " and carries a conversation-ending word (\u201C" + (f.dismissalPhrase || "whatever") + "\u201D). As a text, it closes more than it opens."
    };
    if (f.sentWords >= 40 && f.replyWords <= Math.max(5, Math.floor(f.sentWords / 8)) && f.replyQuestions === 0) return {
      id: "imbalance", recommend: "wait",
      name: "The imbalance is the information",
      because: "because you sent " + plural(f.sentWords, "word") + ", the reply is " + f.replyWords + ", and " + (f.sentQuestions > 0 ? "none of your " + plural(f.sentQuestions, "question") + " gets one asked back" : "the reply asks nothing back") + ". The gap between the two lengths is the loudest fact in this exchange."
    };
    if (f.time.key === "days" && f.signals.positive && f.replyWords >= 15) return {
      id: "slow-warm", recommend: "reply",
      name: "Slow, not cold",
      because: "because the reply took days but carries warm wording across " + plural(f.replyWords, "word") + ". The delay and the content point in different directions, and the content is the part you can read."
    };
    if (f.signals.positive && f.replyQuestions === 0 && f.sentQuestions >= 1 && f.replyWords < f.sentWords) return {
      id: "warm-stalled", recommend: "close",
      name: "Warm, but not moving",
      because: "because the reply is warm in wording but asks none of your " + plural(f.sentQuestions, "question") + " back and adds nothing new to answer. As a text, it receives without advancing."
    };
    if (f.replyQuestions >= 1 && f.replyWords >= 20) return {
      id: "engaged", recommend: "reply",
      name: "They are still in it",
      because: "because the reply asks " + plural(f.replyQuestions, "question") + " back and runs " + plural(f.replyWords, "word") + ". The engagement is in the text itself, whatever the timing suggests."
    };
    return {
      id: "open", recommend: "wait",
      name: "No clear shape yet",
      because: "because the reply runs " + plural(f.replyWords, "word") + " against your " + f.sentWords + ", with " + (f.replyQuestions === 0 ? "no questions" : plural(f.replyQuestions, "question")) + " back and no strong wording signal either way. The honest read is that this exchange has not declared itself yet."
    };
  }

  /* ── Your state check (Pro) ─────────────────────────────────────────
     Reuses the Deep Layers layer-3 naming, keyed by the dynamic rule.
     Framed as the user's state only: how this reply is likely landing
     on the person reading it, never the other person's state. */
  function stateCheckFor(ruleId, deep) {
    if (!deep || typeof deep.stateFor !== "function") return null;
    switch (ruleId) {
      case "repair": return deep.stateFor("Good", { positive: true });
      case "heated": return deep.stateFor("Annoyed", { conflict: true });
      case "dismissed": return deep.stateFor("Rejected", {});
      case "imbalance": return deep.stateFor("Anxious", { silence: true });
      case "slow-warm": return deep.stateFor("Anxious", {});
      case "warm-stalled": return deep.stateFor("Unsure", { highIntent: true });
      case "engaged": return deep.stateFor("Interested", { positive: true });
      default: return deep.stateFor("Confused", {});
    }
  }

  /* ── The next move (Pro) ────────────────────────────────────────────
     Three options, the recommended one marked from the rule. */
  function nextMovesFor(rule, f) {
    return [
      { key: "wait", title: "Wait",
        line: "Give it at least as long as their reply took (" + f.time.label.toLowerCase() + ") before you read anything more into it.",
        recommended: rule.recommend === "wait" },
      { key: "close", title: "One clean close",
        line: "One short message that ends the thread cleanly without opening a new one. Then stop.",
        recommended: rule.recommend === "close" },
      { key: "reply", title: "Send a reply",
        line: "Answer what the reply actually did, not what the wait felt like.",
        recommended: rule.recommend === "reply" }
    ];
  }

  /* Composed reply for the "Send a reply" move. Reuses the Deep Layers
     layer-7 composer, so the output carries a verbatim fragment (4+
     consecutive words) of the user's own sent text — or of the reply
     when what they sent was too short to carry one. */
  function composeNextReply(sent, reply, stance, deep) {
    if (!deep || typeof deep.composeRewrite !== "function") return "";
    var source = wordCount(sent) >= 4 ? sent : reply;
    return deep.composeRewrite(source, stance);
  }

  function analyzeExchange(sent, reply, timeKey, analyzeFn, deep) {
    var facts = factsFor(sent, reply, timeKey, analyzeFn);
    var rule = ruleFor(facts);
    return {
      facts: facts,
      rule: rule,
      state: stateCheckFor(rule.id, deep),
      moves: nextMovesFor(rule, facts)
    };
  }

  return {
    HEADING: HEADING,
    SUBLINE: SUBLINE,
    REWRITE_LABEL: REWRITE_LABEL,
    TIME_CHIPS: TIME_CHIPS.slice(),
    parseReplyTime: parseReplyTime,
    wordCount: wordCount,
    factsFor: factsFor,
    ruleFor: ruleFor,
    stateCheckFor: stateCheckFor,
    nextMovesFor: nextMovesFor,
    composeNextReply: composeNextReply,
    analyzeExchange: analyzeExchange
  };
});
