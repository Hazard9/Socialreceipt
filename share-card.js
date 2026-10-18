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

  /* The card's text model: exactly the current receipt's real fields,
     nothing else. Pattern line is null when the receipt has no pattern. */
  function buildCardModel(receipt) {
    receipt = receipt || {};
    var patternLabel = null;
    if (receipt.pattern && receipt.pattern.label) patternLabel = String(receipt.pattern.label);
    else if (typeof receipt.patternLabel === "string" && receipt.patternLabel) patternLabel = receipt.patternLabel;
    return {
      brand: BRAND,
      tagline: TAGLINE,
      verdict: String(receipt.verdict || ""),
      excerpt: truncateDraft(receipt.rawText || "", EXCERPT_LIMIT),
      patternLine: patternLabel ? "Pattern spotted: " + patternLabel : null,
      strengthLine: (typeof receipt.confidence === "number") ? "Read strength: " + receipt.confidence : null,
      basisLine: STRENGTH_BASIS,
      bestMove: String(receipt.bestMove || ""),
      message: String(receipt.message || ""),
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

  /* Draw the card. Pure canvas 2D; layout is measured first, then drawn
     top to bottom, with the footer pinned to the bottom edge. */
  function renderToCanvas(receipt, canvas) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    var m = buildCardModel(receipt);
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

  /* Entry point. deps.confirmPrivacy(done) is REQUIRED — it must show
     the privacy note (PRIVACY_NOTE) with Continue / Cancel and call
     done(true) only on Continue. Without it, nothing renders. */
  function shareReceipt(receipt, deps) {
    deps = deps || {};
    if (!receipt || typeof deps.confirmPrivacy !== "function") return false;
    deps.confirmPrivacy(function (approved) {
      if (!approved) return;
      var doc = deps.document || (typeof document !== "undefined" ? document : null);
      if (!doc || typeof doc.createElement !== "function") return;
      var canvas = doc.createElement("canvas");
      renderToCanvas(receipt, canvas);
      deliver(canvas, deps);
    });
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
    truncateDraft: truncateDraft,
    buildCardModel: buildCardModel,
    wrapText: wrapText,
    renderToCanvas: renderToCanvas,
    downloadBlob: downloadBlob,
    deliver: deliver,
    shareReceipt: shareReceipt
  };
});
