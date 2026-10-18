# Receipt Journal

Receipts used to vanish when the user left. The journal gives the app
a memory the user can see: every fresh read is kept on the device, in
a list they can revisit. It is the retention surface of the app and
the visible home for the Deep Layer 5 pattern summary.

**Zero running cost is a hard constraint.** The journal is plain
client-side JavaScript over the receipt the app already built and
history already stored on the user's own device. No API calls, no
uploads, no external assets. `journal.js` contains no network surface
at all, and a test enforces that.

## What it does

- **Storage.** `localStorage` key `sr_receipt_journal_v1` holds an
  array of entries, newest first, capped at 30 (oldest fall off).
  Each entry is `{ts, draft, scenario, verdict, patternLabel,
  confidence, receipt}`: the draft truncated to 280 characters, the
  summary fields for the list view, and the full receipt object so a
  tap can re-render the complete receipt view from stored fields.
- **Recording.** A receipt is journaled at exactly one hook point:
  `generateReceipt` in `index.html`, immediately after
  `attachDeepLayers(receipt, true)` — the same point where the Deep
  Layers pattern memory records. The same draft inside a 10-minute
  window adds no second entry, mirroring the pattern-memory dedupe.
- **Reopen without recording.** Tapping an entry calls
  `openJournalEntry`, which sets the `_journalReplay` flag for the
  whole render and clears it in a `finally`. The recording hook
  returns immediately while the flag is set, and the reopen path only
  calls `renderReceiptOutput(receipt, true)` — it never passes
  through `generateReceipt` or `attachDeepLayers(..., true)` — so a
  reopen creates no journal entry and no pattern-history count.
- **Pattern home.** When the on-device pattern history
  (`sr_pattern_history_v1`) has a most frequent branch inside the
  last 30 days, the journal header shows it, counted with
  `SocialReceiptDeep.patternSummary`. With no history the journal
  shows the honest empty line: "Your receipts will live here, on
  this device only."
- **Privacy and control.** The screen states it plainly: "Kept on
  this device only. Nothing is uploaded." A Clear journal button
  empties the key after a `confirm`.
- **Free for everyone.** The journal is retention, not a feature
  gate. There are no paywall hooks anywhere in it.

## What it does not change

The receipt engine, `buildReceipt`, Deep Layers, Both Sides, and the
confidence gauge are untouched. Integration in `index.html` is purely
additive: one script tag, one home card, one screen, one hook call,
and the glue functions. The video packet gate
(`tests/verify-video-packet.js`) stays 98/98 and
`tests/validate.js` passes with the journal tests wired in.
