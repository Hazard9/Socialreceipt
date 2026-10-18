(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SocialReceiptShare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Social Receipt — Shareable Receipt Card (deterministic, on-device,
     zero cost). Renders the CURRENT receipt to a 1080x1350 canvas image
     the user can save or share. The card is composed only from the
     receipt object passed in: no invented lines, no stock quotes.
     The image is built entirely on this device: nothing is uploaded
     and this module performs no network activity of any kind.
     PRIVACY: the user's draft text appears on the card, so rendering
     NEVER happens silently — shareReceipt() refuses to run without a
     confirmPrivacy callback and renders only after it approves. */

  var CARD_W = 1080;
  var CARD_H = 1350;
  var FILE_NAME = "social-receipt.png";

  var BRAND = "SOCIAL RECEIPT";
  var TAGLINE = "Before you send it, get the receipt.";
  var FOOTER_URL = "socialreceipt.netlify.app";
  var FOOTER_FREE = "Free: 3 receipts a month";
  var PRIVACY_NOTE = "Your draft text will appear in the image.";
  var STRENGTH_BASIS = "based on wording matched";
  var EXCERPT_LIMIT = 180;

  /* Privacy tiers (Wave 4): one all-or-nothing card under-shares,
     because nobody posts a screenshot that exposes the whole personal
     exchange. Three levels, safest first. The DEFAULT is the takeaway:
     the lesson only, never the draft and never any message text. */
  var TIER_TAKEAWAY = "takeaway";
  var TIER_BEFORE_AFTER = "beforeafter";
  var TIER_FULL = "full";
  var TIERS = [TIER_TAKEAWAY, TIER_BEFORE_AFTER, TIER_FULL];
  var DEFAULT_TIER = TIER_TAKEAWAY;
  var TIER_LABELS = {
    takeaway: "Just the takeaway",
    beforeafter: "Before and after",
    full: "Full receipt"
  };
  var TAKEAWAY_LINE = "I checked before I sent.";
  var BEFORE_LABEL = "BEFORE";
  var AFTER_LABEL = "AFTER";
  var AFTER_SUGGESTED_LABEL = "AFTER (SUGGESTED VERSION)";
  var NO_REWRITE_LINE = "No rewrite for this receipt yet.";
  var PRIVACY_NOTE_TAKEAWAY = "No draft text and no message text on this card, only the lesson.";
  var PRIVACY_NOTE_BEFORE_AFTER = "Your draft and the rewrite will appear in the image.";

  /* Palette lifted from the in-app receipt (index.html :root). */
  var COLORS = {
    bg: "#0c0b09",
    surface: "#161410",
    surface2: "#1c1a15",
    text: "#f2ece0",
    muted: "#9c9280",
    muted2: "#635d50",
    gold: "#c9a84c",
    gold2: "#e2c06a",
    borderWarm: "rgba(212,170,90,0.22)",
    borderSoft: "rgba(255,245,220,0.07)"
  };

  /* System font stack only (spec): the generic fallbacks of the app's
     own font directions — serif display, mono labels, system sans. */
  var FONTS = {
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', Courier, monospace",
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  };

  function truncateDraft(text, limit) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    var max = typeof limit === "number" ? limit : EXCERPT_LIMIT;
    if (t.length <= max) return t;
    var cut = t.slice(0, max);
    var lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
    return cut.replace(/[\s,;:.!?-]+$/, "") + "\u2026";
  }

  function patternLineFor(receipt) {
    if (!receipt) return null;
    var patternLabel = null;
    if (receipt.pattern && receipt.pattern.label) patternLabel = String(receipt.pattern.label);
    else if (typeof receipt.patternLabel === "string" && receipt.patternLabel) patternLabel = receipt.patternLabel;
    return patternLabel ? "Pattern spotted: " + patternLabel : null;
  }

  function strengthLineFor(receipt) {
    if (!receipt) return null;
    return (typeof receipt.confidence === "number") ? "Read strength: " + receipt.confidence : null;
  }

  /* The card's text model: exactly the current receipt's real fields,
     nothing else. Pattern line is null when the receipt has no pattern. */
  function buildCardModel(receipt) {
    receipt = receipt || {};
    return {
      brand: BRAND,
      tagline: TAGLINE,
      verdict: String(receipt.verdict || ""),
      excerpt: truncateDraft(receipt.rawText || "", EXCERPT_LIMIT),
      patternLine: patternLineFor(receipt),
      strengthLine: strengthLineFor(receipt),
      basisLine: STRENGTH_BASIS,
      bestMove: String(receipt.bestMove || ""),
      message: String(receipt.message || ""),
      footerUrl: FOOTER_URL,
      footerFree: FOOTER_FREE
    };
  }

  function normalizeTier(tier) {
    return (tier === TIER_FULL || tier === TIER_BEFORE_AFTER || tier === TIER_TAKEAWAY) ? tier : DEFAULT_TIER;
  }

  /* The "After" text for the before/after tier: the Layer 7 rewrite
     from the receipt's deep state when the user actually made one;
     otherwise the receipt's suggested message, flagged as suggested
     so the card never passes it off as the user's own rewrite.
     Null when the receipt carries neither. */
  function rewriteFor(receipt) {
    if (!receipt) return null;
    var deep = receipt.deep || {};
    if (typeof deep.rewrite === "string" && deep.rewrite.trim()) return { text: deep.rewrite, suggested: false };
    if (typeof receipt.message === "string" && receipt.message.trim()) return { text: receipt.message, suggested: true };
    return null;
  }

  function tierAvailable(receipt, tier) {
    if (normalizeTier(tier) === TIER_BEFORE_AFTER) return !!rewriteFor(receipt);
    return true;
  }

  function privacyNoteFor(tier) {
    var t = normalizeTier(tier);
    if (t === TIER_TAKEAWAY) return PRIVACY_NOTE_TAKEAWAY;
    if (t === TIER_BEFORE_AFTER) return PRIVACY_NOTE_BEFORE_AFTER;
    return PRIVACY_NOTE;
  }

  /* The elements a tier can put on the card, in render order. Only
     elements actually present on this receipt are listed as present;
     the page's remove-details step offers exactly the toggleable,
     present ones. The takeaway line itself is the takeaway card's
     whole point, so it is listed as fixed, never toggleable. */
  function shareElementsFor(receipt, tier) {
    receipt = receipt || {};
    var t = normalizeTier(tier);
    var els = [];
    function el(key, label, present, toggleable) {
      els.push({ key: key, label: label, present: !!present, toggleable: toggleable !== false });
    }
    var hasDraft = !!(receipt.rawText && String(receipt.rawText).trim());
    if (t === TIER_TAKEAWAY) {
      el("takeaway", "The takeaway line", true, false);
      el("verdict", "The verdict", !!receipt.verdict);
      el("pattern", "The pattern", !!patternLineFor(receipt));
      el("strength", "The read strength", typeof receipt.confidence === "number");
      el("bestMove", "The best move", !!receipt.bestMove);
    } else if (t === TIER_BEFORE_AFTER) {
      el("draft", "Your draft (Before)", hasDraft);
      el("verdict", "The verdict", !!receipt.verdict);
      el("after", "The rewrite (After)", !!rewriteFor(receipt));
      el("pattern", "The pattern", !!patternLineFor(receipt));
      el("bestMove", "The best move", !!receipt.bestMove);
    } else {
      el("draft", "Your draft", hasDraft);
      el("verdict", "The verdict", !!receipt.verdict);
      el("pattern", "The pattern", !!patternLineFor(receipt));
      el("strength", "The read strength", typeof receipt.confidence === "number");
      el("bestMove", "The best move", !!receipt.bestMove);
      el("message", "The suggested message", !!(receipt.message && String(receipt.message).trim()));
    }
    return els;
  }

  /* Tier-aware card model. options.include maps element keys to
     booleans; anything not set to false stays on. Real fields only:
     an absent field stays absent, and the takeaway model never
     carries draft or message text at all. Returns null for the
     before/after tier when the receipt has no rewrite to show. */
  function buildTierModel(receipt, options) {
    options = options || {};
    receipt = receipt || {};
    var tier = normalizeTier(options.tier);
    var include = options.include || {};
    function inc(key) { return include[key] !== false; }
    if (tier === TIER_FULL) {
      var full = buildCardModel(receipt);
      if (!inc("draft")) full.excerpt = "";
      if (!inc("verdict")) full.verdict = "";
      if (!inc("pattern")) full.patternLine = null;
      if (!inc("strength")) full.strengthLine = null;
      if (!inc("bestMove")) full.bestMove = "";
      if (!inc("message")) full.message = "";
      full.tier = TIER_FULL;
      return full;
    }
    if (tier === TIER_BEFORE_AFTER) {
      var rw = rewriteFor(receipt);
      if (!rw) return null;
      return {
        tier: TIER_BEFORE_AFTER,
        brand: BRAND,
        tagline: TAGLINE,
        beforeText: inc("draft") ? truncateDraft(receipt.rawText || "", EXCERPT_LIMIT) : "",
        verdict: inc("verdict") ? String(receipt.verdict || "") : "",
        afterText: inc("after") ? rw.text : "",
        afterLabel: rw.suggested ? AFTER_SUGGESTED_LABEL : AFTER_LABEL,
        afterSuggested: rw.suggested,
        patternLine: inc("pattern") ? patternLineFor(receipt) : null,
        bestMove: inc("bestMove") ? String(receipt.bestMove || "") : "",
        footerUrl: FOOTER_URL,
        footerFree: FOOTER_FREE
      };
    }
    return {
      tier: TIER_TAKEAWAY,
      brand: BRAND,
      tagline: TAGLINE,
      takeawayLine: TAKEAWAY_LINE,
      verdict: inc("verdict") ? String(receipt.verdict || "") : "",
      patternLine: inc("pattern") ? patternLineFor(receipt) : null,
      strengthLine: inc("strength") ? strengthLineFor(receipt) : null,
      basisLine: STRENGTH_BASIS,
      bestMove: inc("bestMove") ? String(receipt.bestMove || "") : "",
      footerUrl: FOOTER_URL,
      footerFree: FOOTER_FREE
    };
  }

  function wrapText(ctx, text, maxWidth) {
    var words = String(text || "").split(/\s+/).filter(function (w) { return w.length > 0; });
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var trial = line ? line + " " + words[i] : words[i];
      if (line && ctx.measureText(trial).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function capLines(lines, max) {
    if (lines.length <= max) return lines;
    var kept = lines.slice(0, max);
    kept[max - 1] = kept[max - 1].replace(/[\s,;:.!?-]+$/, "") + "\u2026";
    return kept;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  function setTracking(ctx, px) {
    try { ctx.letterSpacing = px + "px"; } catch (e) { /* older engines: no-op */ }
  }
  function clearTracking(ctx) {
    try { ctx.letterSpacing = "0px"; } catch (e) { /* no-op */ }
  }

  /* Draw the full-receipt card from a prepared model. Pure canvas 2D;
     layout is measured first, then drawn top to bottom, with the
     footer pinned to the bottom edge. */
  function drawCardModel(canvas, m) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext("2d");
    var PAD = 92;
    var INNER_W = CARD_W - PAD * 2;
    var FOOTER_TOP = CARD_H - 172;

    /* ── measure pass ─────────────────────────────────────────── */
    function measure() {
      var plan = {};
      ctx.font = "35px " + FONTS.sans;
      plan.excerptLines = m.excerpt ? capLines(wrapText(ctx, "\u201C" + m.excerpt + "\u201D", INNER_W), 4) : [];
      plan.verdictSize = 66;
      ctx.font = plan.verdictSize + "px " + FONTS.serif;
      plan.verdictLines = m.verdict ? wrapText(ctx, m.verdict, INNER_W) : [];
      while (plan.verdictLines.length > 3 && plan.verdictSize > 44) {
        plan.verdictSize -= 6;
        ctx.font = plan.verdictSize + "px " + FONTS.serif;
        plan.verdictLines = wrapText(ctx, m.verdict, INNER_W);
      }
      ctx.font = "32px " + FONTS.sans;
      plan.messageLines = m.message ? capLines(wrapText(ctx, m.message, INNER_W - 48), 4) : [];
      var h = 0;
      if (plan.excerptLines.length) h += 34 + plan.excerptLines.length * 48 + 40;
      if (plan.verdictLines.length) h += 34 + plan.verdictLines.length * (plan.verdictSize * 1.16) + 16;
      if (m.patternLine) h += 44;
      if (m.strengthLine) h += 84;
      if (m.bestMove) h += 34 + 52 + 36;
      if (plan.messageLines.length) h += 34 + plan.messageLines.length * 44 + 40;
      plan.total = h;
      return plan;
    }
    var plan = measure();
    var avail = FOOTER_TOP - 268;
    if (plan.total > avail) {
      plan.excerptLines = capLines(plan.excerptLines, 3);
      plan = (function (p) {
        var h = 0;
        if (p.excerptLines.length) h += 34 + p.excerptLines.length * 48 + 40;
        if (p.verdictLines.length) h += 34 + p.verdictLines.length * (p.verdictSize * 1.16) + 16;
        if (m.patternLine) h += 44;
        if (m.strengthLine) h += 84;
        if (m.bestMove) h += 34 + 52 + 36;
        if (p.messageLines.length) h += 34 + p.messageLines.length * 44 + 40;
        p.total = h;
        return p;
      })(plan);
    }
    if (plan.total > avail) plan.messageLines = capLines(plan.messageLines, 3);

    /* ── draw pass ────────────────────────────────────────────── */
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    roundRectPath(ctx, 36, 36, CARD_W - 72, CARD_H - 72, 36);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.strokeStyle = COLORS.borderWarm;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textBaseline = "alphabetic";
    var y = 138;

    /* Brand header */
    ctx.fillStyle = COLORS.gold;
    ctx.font = "700 37px " + FONTS.mono;
    setTracking(ctx, 7);
    ctx.fillText(m.brand, PAD, y);
    clearTracking(ctx);
    y += 52;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "italic 34px " + FONTS.serif;
    ctx.fillText(m.tagline, PAD, y);
    y += 34;
    ctx.strokeStyle = COLORS.borderWarm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(CARD_W - PAD, y);
    ctx.stroke();
    y += 30;

    function eyebrow(text) {
      y += 34;
      ctx.fillStyle = COLORS.muted2;
      ctx.font = "700 23px " + FONTS.mono;
      setTracking(ctx, 4);
      ctx.fillText(text, PAD, y);
      clearTracking(ctx);
      y += 10;
    }
    function drawLines(lines, font, color, lineHeight) {
      ctx.font = font;
      ctx.fillStyle = color;
      for (var i = 0; i < lines.length; i++) {
        y += lineHeight;
        ctx.fillText(lines[i], PAD, y);
      }
    }

    if (plan.excerptLines.length) {
      eyebrow("YOUR DRAFT");
      drawLines(plan.excerptLines, "35px " + FONTS.sans, COLORS.text, 48);
      y += 40;
    }

    if (plan.verdictLines.length) {
      eyebrow("THE VERDICT");
      drawLines(plan.verdictLines, plan.verdictSize + "px " + FONTS.serif, COLORS.text, plan.verdictSize * 1.16);
      y += 16;
    }

    if (m.patternLine) {
      y += 28;
      ctx.font = "26px " + FONTS.mono;
      ctx.fillStyle = COLORS.gold2;
      ctx.fillText(m.patternLine, PAD, y);
      y += 16;
    }

    if (m.strengthLine) {
      y += 30;
      ctx.font = "30px " + FONTS.sans;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(m.strengthLine, PAD, y);
      y += 32;
      ctx.font = "24px " + FONTS.sans;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(m.basisLine, PAD, y);
      y += 22;
    }

    if (m.bestMove) {
      ctx.strokeStyle = COLORS.borderSoft;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 6);
      ctx.lineTo(CARD_W - PAD, y + 6);
      ctx.stroke();
      eyebrow("BEST MOVE");
      ctx.font = "42px " + FONTS.serif;
      ctx.fillStyle = COLORS.gold2;
      y += 52;
      ctx.fillText(m.bestMove, PAD, y);
      y += 36;
    }

    if (plan.messageLines.length) {
      eyebrow("SUGGESTED MESSAGE");
      var boxH = plan.messageLines.length * 44 + 40;
      roundRectPath(ctx, PAD, y + 14, INNER_W, boxH, 18);
      ctx.fillStyle = COLORS.surface2;
      ctx.fill();
      ctx.strokeStyle = COLORS.borderSoft;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = "32px " + FONTS.sans;
      ctx.fillStyle = COLORS.text;
      var my = y + 14;
      for (var j = 0; j < plan.messageLines.length; j++) {
        my += 44;
        ctx.fillText(plan.messageLines[j], PAD + 24, my);
      }
      y += 14 + boxH;
    }

    /* Footer — pinned */
    ctx.strokeStyle = COLORS.borderWarm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, FOOTER_TOP);
    ctx.lineTo(CARD_W - PAD, FOOTER_TOP);
    ctx.stroke();
    ctx.font = "29px " + FONTS.mono;
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(m.footerUrl, PAD, FOOTER_TOP + 58);
    ctx.font = "25px " + FONTS.sans;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(m.footerFree, PAD, FOOTER_TOP + 102);

    return canvas;
  }

  function renderToCanvas(receipt, canvas) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    return drawCardModel(canvas, buildCardModel(receipt));
  }

  /* Shared chrome for the tier cards: same frame, brand header, and
     pinned footer as the full card, so every tier reads as the same
     product. drawCardHeader returns the y cursor under the divider. */
  var TIER_PAD = 92;
  var TIER_INNER_W = CARD_W - TIER_PAD * 2;
  var TIER_FOOTER_TOP = CARD_H - 172;

  function drawCardHeader(ctx, m) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    roundRectPath(ctx, 36, 36, CARD_W - 72, CARD_H - 72, 36);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.strokeStyle = COLORS.borderWarm;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textBaseline = "alphabetic";
    var y = 138;
    ctx.fillStyle = COLORS.gold;
    ctx.font = "700 37px " + FONTS.mono;
    setTracking(ctx, 7);
    ctx.fillText(m.brand, TIER_PAD, y);
    clearTracking(ctx);
    y += 52;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "italic 34px " + FONTS.serif;
    ctx.fillText(m.tagline, TIER_PAD, y);
    y += 34;
    ctx.strokeStyle = COLORS.borderWarm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TIER_PAD, y);
    ctx.lineTo(CARD_W - TIER_PAD, y);
    ctx.stroke();
    y += 30;
    return y;
  }

  function drawCardFooter(ctx, m) {
    ctx.strokeStyle = COLORS.borderWarm;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TIER_PAD, TIER_FOOTER_TOP);
    ctx.lineTo(CARD_W - TIER_PAD, TIER_FOOTER_TOP);
    ctx.stroke();
    ctx.font = "29px " + FONTS.mono;
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(m.footerUrl, TIER_PAD, TIER_FOOTER_TOP + 58);
    ctx.font = "25px " + FONTS.sans;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(m.footerFree, TIER_PAD, TIER_FOOTER_TOP + 102);
  }

  /* Section helpers for the tier draws; each returns the new y. */
  function tierEyebrow(ctx, y, text) {
    y += 34;
    ctx.fillStyle = COLORS.muted2;
    ctx.font = "700 23px " + FONTS.mono;
    setTracking(ctx, 4);
    ctx.fillText(text, TIER_PAD, y);
    clearTracking(ctx);
    return y + 10;
  }
  function tierLines(ctx, y, lines, font, color, lineHeight) {
    ctx.font = font;
    ctx.fillStyle = color;
    for (var i = 0; i < lines.length; i++) {
      y += lineHeight;
      ctx.fillText(lines[i], TIER_PAD, y);
    }
    return y;
  }
  function tierVerdict(ctx, y, verdict) {
    var size = 66;
    ctx.font = size + "px " + FONTS.serif;
    var lines = wrapText(ctx, verdict, TIER_INNER_W);
    while (lines.length > 3 && size > 44) {
      size -= 6;
      ctx.font = size + "px " + FONTS.serif;
      lines = wrapText(ctx, verdict, TIER_INNER_W);
    }
    y = tierEyebrow(ctx, y, "THE VERDICT");
    y = tierLines(ctx, y, lines, size + "px " + FONTS.serif, COLORS.text, size * 1.16);
    return y + 16;
  }
  function tierPattern(ctx, y, patternLine) {
    y += 28;
    ctx.font = "26px " + FONTS.mono;
    ctx.fillStyle = COLORS.gold2;
    ctx.fillText(patternLine, TIER_PAD, y);
    return y + 16;
  }
  function tierStrength(ctx, y, m) {
    y += 30;
    ctx.font = "30px " + FONTS.sans;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(m.strengthLine, TIER_PAD, y);
    y += 32;
    ctx.font = "24px " + FONTS.sans;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(m.basisLine, TIER_PAD, y);
    return y + 22;
  }
  function tierBestMove(ctx, y, bestMove) {
    ctx.strokeStyle = COLORS.borderSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TIER_PAD, y + 6);
    ctx.lineTo(CARD_W - TIER_PAD, y + 6);
    ctx.stroke();
    y = tierEyebrow(ctx, y, "BEST MOVE");
    ctx.font = "42px " + FONTS.serif;
    ctx.fillStyle = COLORS.gold2;
    y += 52;
    ctx.fillText(bestMove, TIER_PAD, y);
    return y + 36;
  }
  function tierMessageBox(ctx, y, lines) {
    var boxH = lines.length * 44 + 40;
    roundRectPath(ctx, TIER_PAD, y + 14, TIER_INNER_W, boxH, 18);
    ctx.fillStyle = COLORS.surface2;
    ctx.fill();
    ctx.strokeStyle = COLORS.borderSoft;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "32px " + FONTS.sans;
    ctx.fillStyle = COLORS.text;
    var my = y + 14;
    for (var j = 0; j < lines.length; j++) {
      my += 44;
      ctx.fillText(lines[j], TIER_PAD + 24, my);
    }
    return y + 14 + boxH;
  }

  /* Takeaway card: the lesson only. The model carries no draft and
     no message text, so nothing private can reach the canvas. */
  function drawTakeawayCard(canvas, m) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext("2d");
    var y = drawCardHeader(ctx, m);
    if (m.verdict) y = tierVerdict(ctx, y, m.verdict);
    y = tierEyebrow(ctx, y, "THE TAKEAWAY");
    ctx.font = "italic 38px " + FONTS.serif;
    var takeawayLines = wrapText(ctx, m.takeawayLine, TIER_INNER_W);
    y = tierLines(ctx, y, takeawayLines, "italic 38px " + FONTS.serif, COLORS.text, 50);
    y += 16;
    if (m.patternLine) y = tierPattern(ctx, y, m.patternLine);
    if (m.strengthLine) y = tierStrength(ctx, y, m);
    if (m.bestMove) y = tierBestMove(ctx, y, m.bestMove);
    drawCardFooter(ctx, m);
    return canvas;
  }

  /* Before/after card: the draft and the rewrite, honestly labeled.
     The after label says SUGGESTED VERSION whenever the "after" is
     the app's suggested message rather than the user's own rewrite. */
  function drawBeforeAfterCard(canvas, m) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = canvas.getContext("2d");
    var y = drawCardHeader(ctx, m);
    if (m.beforeText) {
      ctx.font = "35px " + FONTS.sans;
      var beforeLines = capLines(wrapText(ctx, "\u201C" + m.beforeText + "\u201D", TIER_INNER_W), 4);
      y = tierEyebrow(ctx, y, BEFORE_LABEL);
      y = tierLines(ctx, y, beforeLines, "35px " + FONTS.sans, COLORS.text, 48);
      y += 40;
    }
    if (m.verdict) y = tierVerdict(ctx, y, m.verdict);
    if (m.afterText) {
      ctx.font = "32px " + FONTS.sans;
      var afterLines = capLines(wrapText(ctx, m.afterText, TIER_INNER_W - 48), 4);
      y = tierEyebrow(ctx, y, m.afterLabel);
      y = tierMessageBox(ctx, y, afterLines);
    }
    if (m.patternLine) y = tierPattern(ctx, y, m.patternLine);
    if (m.bestMove) y = tierBestMove(ctx, y, m.bestMove);
    drawCardFooter(ctx, m);
    return canvas;
  }

  /* Render a receipt at a privacy tier. options: { tier, include }.
     Returns null when the tier cannot be built for this receipt
     (before/after with no rewrite) or the canvas is unusable. */
  function renderTierToCanvas(receipt, canvas, options) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    var m = buildTierModel(receipt, options);
    if (!m) return null;
    if (m.tier === TIER_TAKEAWAY) return drawTakeawayCard(canvas, m);
    if (m.tier === TIER_BEFORE_AFTER) return drawBeforeAfterCard(canvas, m);
    return drawCardModel(canvas, m);
  }

  function downloadBlob(blob, doc) {
    if (!blob || !doc || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
    var url = URL.createObjectURL(blob);
    var a = doc.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    var parent = doc.body || doc.documentElement;
    if (parent && parent.appendChild) parent.appendChild(a);
    if (typeof a.click === "function") a.click();
    if (parent && parent.removeChild) parent.removeChild(a);
    if (typeof URL.revokeObjectURL === "function") {
      var t = (typeof setTimeout === "function") ? setTimeout : null;
      if (t) t(function () { URL.revokeObjectURL(url); }, 4000);
      else URL.revokeObjectURL(url);
    }
    return true;
  }

  /* Turn the rendered canvas into a PNG and hand it to the user:
     native share sheet with the file when the browser supports it,
     otherwise (and on any share failure) a plain download. */
  function deliver(canvas, deps) {
    deps = deps || {};
    if (!canvas || typeof canvas.toBlob !== "function") return false;
    var doc = deps.document || (typeof document !== "undefined" ? document : null);
    var nav = deps.navigator || (typeof navigator !== "undefined" ? navigator : null);
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var file = null;
      var FileCtor = deps.File || (typeof File !== "undefined" ? File : null);
      if (FileCtor) {
        try { file = new FileCtor([blob], FILE_NAME, { type: "image/png" }); } catch (e) { file = null; }
      }
      var canShareFile = !!(nav && file && typeof nav.canShare === "function" && typeof nav.share === "function" && nav.canShare({ files: [file] }));
      if (canShareFile) {
        var p = nav.share({ files: [file] });
        if (p && typeof p.catch === "function") p.catch(function () { downloadBlob(blob, doc); });
      } else {
        downloadBlob(blob, doc);
      }
    }, "image/png");
    return true;
  }

  /* Entry point. deps.confirmPrivacy(done, info) is REQUIRED — it must
     show the privacy note for the chosen tier with Continue / Cancel
     and call done(true) only on Continue. Without it, nothing renders.
     deps.tier picks the privacy tier (default: the takeaway, the
     safest); deps.include maps element keys to booleans from the
     remove-details step. info carries { tier, tierLabel, privacyNote }
     so the confirm can name exactly what is about to be shared. */
  function shareReceipt(receipt, deps) {
    deps = deps || {};
    if (!receipt || typeof deps.confirmPrivacy !== "function") return false;
    var tier = normalizeTier(deps.tier);
    if (!tierAvailable(receipt, tier)) return false;
    var info = { tier: tier, tierLabel: TIER_LABELS[tier], privacyNote: privacyNoteFor(tier) };
    deps.confirmPrivacy(function (approved) {
      if (!approved) return;
      var doc = deps.document || (typeof document !== "undefined" ? document : null);
      if (!doc || typeof doc.createElement !== "function") return;
      var canvas = doc.createElement("canvas");
      renderTierToCanvas(receipt, canvas, { tier: tier, include: deps.include });
      deliver(canvas, deps);
    }, info);
    return true;
  }

  return {
    CARD_W: CARD_W,
    CARD_H: CARD_H,
    FILE_NAME: FILE_NAME,
    BRAND: BRAND,
    TAGLINE: TAGLINE,
    FOOTER_URL: FOOTER_URL,
    FOOTER_FREE: FOOTER_FREE,
    PRIVACY_NOTE: PRIVACY_NOTE,
    STRENGTH_BASIS: STRENGTH_BASIS,
    EXCERPT_LIMIT: EXCERPT_LIMIT,
    COLORS: COLORS,
    FONTS: FONTS,
    TIER_TAKEAWAY: TIER_TAKEAWAY,
    TIER_BEFORE_AFTER: TIER_BEFORE_AFTER,
    TIER_FULL: TIER_FULL,
    TIERS: TIERS.slice(),
    DEFAULT_TIER: DEFAULT_TIER,
    TIER_LABELS: TIER_LABELS,
    TAKEAWAY_LINE: TAKEAWAY_LINE,
    BEFORE_LABEL: BEFORE_LABEL,
    AFTER_LABEL: AFTER_LABEL,
    AFTER_SUGGESTED_LABEL: AFTER_SUGGESTED_LABEL,
    NO_REWRITE_LINE: NO_REWRITE_LINE,
    PRIVACY_NOTE_TAKEAWAY: PRIVACY_NOTE_TAKEAWAY,
    PRIVACY_NOTE_BEFORE_AFTER: PRIVACY_NOTE_BEFORE_AFTER,
    truncateDraft: truncateDraft,
    buildCardModel: buildCardModel,
    normalizeTier: normalizeTier,
    rewriteFor: rewriteFor,
    tierAvailable: tierAvailable,
    privacyNoteFor: privacyNoteFor,
    shareElementsFor: shareElementsFor,
    buildTierModel: buildTierModel,
    wrapText: wrapText,
    renderToCanvas: renderToCanvas,
    renderTierToCanvas: renderTierToCanvas,
    downloadBlob: downloadBlob,
    deliver: deliver,
    shareReceipt: shareReceipt
  };
});
